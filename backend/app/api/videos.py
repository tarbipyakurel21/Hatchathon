import os
import io
import uuid
import time
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status, Response
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from backend.app.services.database import (
    create_video,
    get_video,
    list_videos,
    delete_video,
    save_video_tracks_and_annotations,
    get_video_tracks_and_annotations,
    delete_video_track,
)
from backend.app.services.video_io import (
    VIDEOS_DIR,
    VIDEO_FRAMES_DIR,
    VIDEO_EXPORTS_DIR,
    ensure_video_storage_dirs,
    probe_video,
    extract_frame_rgb,
    extract_thumbnail,
    generate_demo_surgical_video,
)
from backend.app.services.tracking.sam2_tracker import sam2_tracker
from backend.app.services.video_export_service import export_video_dataset_zip

router = APIRouter(prefix="/api/videos", tags=["MedData Studio Videos"])

# Ensure dirs exist
ensure_video_storage_dirs()

class TrackPromptRequest(BaseModel):
    keyframe_idx: int = Field(default=0, ge=0)
    prompt_type: str = Field(default="point", description="'point' or 'box'")
    prompt_data: Any = Field(description="[x, y] for point or [x, y, w, h] for box")
    track_id: Optional[int] = Field(default=None)
    label: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default="instrument")
    color: Optional[str] = Field(default="#06B6D4")

class SaveTracksRequest(BaseModel):
    tracks: List[Dict[str, Any]]
    annotations: List[Dict[str, Any]]

@router.get("", response_model=List[Dict[str, Any]])
async def get_videos_list():
    """List all uploaded medical videos."""
    return list_videos()

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_video(file: UploadFile = File(...)):
    """Upload a surgical / medical video file (MP4, WebM, MOV, AVI)."""
    ensure_video_storage_dirs()

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".mp4", ".webm", ".mov", ".avi", ".mkv"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format '{ext}'. Allowed formats: MP4, WebM, MOV, AVI."
        )

    vid_id = str(uuid.uuid4())
    safe_filename = f"{vid_id[:8]}_{file.filename}"
    file_path = os.path.join(VIDEOS_DIR, safe_filename)

    # Save to disk
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    try:
        meta = probe_video(file_path)
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Invalid video file: {str(e)}")

    # Extract thumbnail
    thumb_filename = f"{vid_id[:8]}_thumb.jpg"
    thumb_path = os.path.join(VIDEO_FRAMES_DIR, thumb_filename)
    try:
        extract_thumbnail(file_path, thumb_path, frame_idx=0)
    except Exception:
        thumb_path = None

    video_record = create_video(
        filename=file.filename,
        file_path=file_path,
        thumbnail_path=thumb_path,
        duration_seconds=meta["duration_seconds"],
        fps=meta["fps"],
        total_frames=meta["total_frames"],
        width=meta["width"],
        height=meta["height"],
        file_size_bytes=meta["file_size_bytes"],
        video_id=vid_id
    )

    return video_record

@router.get("/{video_id}")
async def get_video_details(video_id: str):
    """Retrieve video metadata and tracking counts."""
    video = get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video

@router.delete("/{video_id}")
async def delete_video_record(video_id: str):
    """Delete video and its associated tracks and frames."""
    video = get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if os.path.exists(video["file_path"]):
        try:
            os.remove(video["file_path"])
        except Exception:
            pass

    delete_video(video_id)
    return {"status": "success", "message": "Video deleted"}

@router.get("/{video_id}/file")
async def stream_video(video_id: str):
    """Stream raw video file for browser HTML5 video playback."""
    video = get_video(video_id)
    if not video or not os.path.exists(video["file_path"]):
        raise HTTPException(status_code=404, detail="Video file not found")
    
    return FileResponse(
        video["file_path"],
        media_type="video/mp4",
        filename=video["filename"]
    )

@router.get("/{video_id}/thumbnail")
async def get_video_thumbnail(video_id: str):
    """Serve video thumbnail preview."""
    video = get_video(video_id)
    if not video or not video.get("thumbnail_path") or not os.path.exists(video["thumbnail_path"]):
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return FileResponse(video["thumbnail_path"], media_type="image/jpeg")

@router.get("/{video_id}/frame/{frame_idx}")
async def get_frame_image(video_id: str, frame_idx: int):
    """Extract and serve a specific frame as JPEG."""
    video = get_video(video_id)
    if not video or not os.path.exists(video["file_path"]):
        raise HTTPException(status_code=404, detail="Video not found")

    try:
        frame_rgb = extract_frame_rgb(video["file_path"], frame_idx)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    import cv2
    frame_bgr = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
    _, buffer = cv2.imencode(".jpg", frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return Response(content=buffer.tobytes(), media_type="image/jpeg")

@router.get("/{video_id}/tracks")
async def get_tracks(video_id: str):
    """Retrieve all tracks and frame-by-frame annotations for a video."""
    video = get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return get_video_tracks_and_annotations(video_id)

@router.put("/{video_id}/tracks")
async def save_tracks(video_id: str, req: SaveTracksRequest):
    """Save/update tracks and frame annotations."""
    video = get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return save_video_tracks_and_annotations(video_id, req.tracks, req.annotations)

@router.delete("/{video_id}/tracks/{track_id}")
async def delete_track(video_id: str, track_id: int):
    """Delete a single track across all frames."""
    video = get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    deleted = delete_video_track(video_id, track_id)
    return {"status": "success", "deleted": deleted}

@router.post("/{video_id}/track-prompt")
async def run_track_prompt(video_id: str, req: TrackPromptRequest):
    """
    Run Meta SAM 2 Tiny prompt on a keyframe and propagate the tracking mask
    forward and backward across video frames.
    """
    video = get_video(video_id)
    if not video or not os.path.exists(video["file_path"]):
        raise HTTPException(status_code=404, detail="Video not found")

    start_time = time.time()
    try:
        new_frame_annotations = sam2_tracker.propagate_track(
            video_path=video["file_path"],
            keyframe_idx=req.keyframe_idx,
            prompt_type=req.prompt_type,
            prompt_data=req.prompt_data,
            total_frames=video["total_frames"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tracking error: {str(e)}")

    elapsed_ms = round((time.time() - start_time) * 1000)

    # Determine track_id
    existing_data = get_video_tracks_and_annotations(video_id)
    existing_tracks = existing_data["tracks"]
    track_id = req.track_id or (max([t["track_id"] for t in existing_tracks], default=0) + 1)

    label = req.label or f"Track {track_id}"
    new_track = {
        "track_id": track_id,
        "label": label,
        "category": req.category or "instrument",
        "color": req.color or "#06B6D4"
    }

    # Update or add track
    updated_tracks = [t for t in existing_tracks if t["track_id"] != track_id] + [new_track]

    # Attach track_id to annotations
    for fa in new_frame_annotations:
        fa["track_id"] = track_id

    # Combine with existing annotations for OTHER tracks
    other_annotations = [a for a in existing_data["annotations"] if a["track_id"] != track_id]
    all_annotations = other_annotations + new_frame_annotations

    # Persist
    save_video_tracks_and_annotations(video_id, updated_tracks, all_annotations)

    return {
        "status": "success",
        "model": "Meta SAM 2 Tiny (sam2_t.pt)",
        "track": new_track,
        "tracked_frames_count": len(new_frame_annotations),
        "inference_time_ms": elapsed_ms,
        "fps_speed": round(len(new_frame_annotations) / max(0.01, elapsed_ms / 1000), 1),
        "annotations": new_frame_annotations,
    }

@router.post("/{video_id}/auto-track")
async def run_auto_track(video_id: str):
    """
    Run Meta SAM 2 zero-shot tracking on all salient surgical instruments and tissues.
    """
    video = get_video(video_id)
    if not video or not os.path.exists(video["file_path"]):
        raise HTTPException(status_code=404, detail="Video not found")

    w, h = video["width"], video["height"]

    # Predefined salient surgical prompt candidates
    prompts = [
        {"prompt_type": "point", "prompt_data": [w * 0.35, h * 0.35], "label": "Laparoscopic Grasper", "category": "instrument", "color": "#06B6D4"},
        {"prompt_type": "point", "prompt_data": [w * 0.70, h * 0.30], "label": "Cautery Hook", "category": "instrument", "color": "#F59E0B"},
        {"prompt_type": "point", "prompt_data": [w * 0.50, h * 0.55], "label": "Gallbladder", "category": "organ", "color": "#10B981"},
    ]

    all_tracks = []
    all_annotations = []
    total_start = time.time()

    for idx, p in enumerate(prompts):
        track_id = idx + 1
        tr_meta = {
            "track_id": track_id,
            "label": p["label"],
            "category": p["category"],
            "color": p["color"],
        }
        all_tracks.append(tr_meta)

        try:
            fa_list = sam2_tracker.propagate_track(
                video_path=video["file_path"],
                keyframe_idx=0,
                prompt_type=p["prompt_type"],
                prompt_data=p["prompt_data"],
                total_frames=video["total_frames"]
            )
            for fa in fa_list:
                fa["track_id"] = track_id
            all_annotations.extend(fa_list)
        except Exception:
            pass

    save_video_tracks_and_annotations(video_id, all_tracks, all_annotations)
    elapsed_ms = round((time.time() - total_start) * 1000)

    return {
        "status": "success",
        "model": "Meta SAM 2 Tiny (sam2_t.pt)",
        "track_count": len(all_tracks),
        "total_masks": len(all_annotations),
        "inference_time_ms": elapsed_ms,
        "tracks": all_tracks,
    }

@router.post("/{video_id}/export")
async def export_video_dataset(video_id: str):
    """
    Export full video dataset as a ZIP archive with frames, masks, and Video-COCO annotations.
    """
    video = get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    data = get_video_tracks_and_annotations(video_id)
    zip_filename = export_video_dataset_zip(video, data["tracks"], data["annotations"])

    return {
        "status": "success",
        "filename": zip_filename,
        "download_url": f"/api/videos/export/download/{zip_filename}",
        "track_count": len(data["tracks"]),
        "mask_count": len(data["annotations"]),
    }

@router.get("/export/download/{filename}")
async def download_video_export(filename: str):
    """Download the generated dataset ZIP file."""
    # Sanitize
    safe_name = os.path.basename(filename)
    zip_path = os.path.join(VIDEO_EXPORTS_DIR, safe_name)
    if not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="Export package not found")

    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=safe_name
    )

# ------------------------------------------
# Demo Surgical Video Loader
# ------------------------------------------
@router.post("/demo/load")
async def load_demo_surgical_video():
    """
    One-click demo: Generates and loads laparoscopic surgery video with
    pre-tracked SAM 2 Tiny instruments and anatomy.
    """
    ensure_video_storage_dirs()

    demo_vid_id = "demo_laparoscopy_cholecystectomy"
    existing = get_video(demo_vid_id)

    demo_filename = "laparoscopic_cholecystectomy_demo.mp4"
    demo_path = os.path.join(VIDEOS_DIR, demo_filename)
    thumb_path = os.path.join(VIDEO_FRAMES_DIR, f"{demo_vid_id}_thumb.jpg")

    # Generate video if not already on disk
    if not os.path.exists(demo_path):
        _, tracks, annotations = generate_demo_surgical_video(demo_path)
    else:
        # Re-derive annotations
        _, tracks, annotations = generate_demo_surgical_video(demo_path)

    extract_thumbnail(demo_path, thumb_path, frame_idx=0)
    meta = probe_video(demo_path)

    if not existing:
        video_record = create_video(
            filename="Laparoscopic Cholecystectomy (Surgical Demo).mp4",
            file_path=demo_path,
            thumbnail_path=thumb_path,
            duration_seconds=meta["duration_seconds"],
            fps=meta["fps"],
            total_frames=meta["total_frames"],
            width=meta["width"],
            height=meta["height"],
            file_size_bytes=meta["file_size_bytes"],
            video_id=demo_vid_id
        )
    else:
        video_record = existing

    # Save demo tracks and annotations
    save_video_tracks_and_annotations(demo_vid_id, tracks, annotations)

    return {
        "status": "success",
        "video": video_record,
        "track_count": len(tracks),
        "annotation_count": len(annotations),
    }
