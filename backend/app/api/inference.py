import os
import time
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from backend.app.services.database import (
    get_video,
    get_video_tracks_and_annotations,
    save_video_tracks_and_annotations
)
from backend.app.services.video_io import extract_frame_rgb
from backend.app.services.detection.surgical_detector import surgical_detector
from backend.app.services.tracking.sam2_tracker import sam2_tracker
from backend.app.services.uncertainty_service import recalculate_video_uncertainty

router = APIRouter(prefix="/api/inference", tags=["SurgiLabel AI Inference"])

class DetectRequest(BaseModel):
    video_id: str
    frame_idx: int = Field(default=0, ge=0)
    min_confidence: Optional[float] = Field(default=0.40, ge=0.0, le=1.0)

class SegmentRequest(BaseModel):
    video_id: str
    frame_idx: int = Field(default=0, ge=0)
    prompt_type: str = Field(default="box", description="'box' or 'point'")
    prompt_data: Any = Field(description="[x, y, w, h] for box or [x, y] for point")
    label: Optional[str] = Field(default="Surgical Instrument")
    category: Optional[str] = Field(default="instrument")
    color: Optional[str] = Field(default="#3B82F6")

class PropagateRequest(BaseModel):
    video_id: str
    keyframe_idx: int = Field(default=0, ge=0)
    prompt_type: str = Field(default="box", description="'box' or 'point'")
    prompt_data: Any = Field(description="[x, y, w, h] for box or [x, y] for point")
    track_id: Optional[int] = Field(default=None)
    label: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default="instrument")
    color: Optional[str] = Field(default="#3B82F6")

@router.post("/detect")
async def run_surgical_detector(req: DetectRequest):
    """
    Run surgical instrument and anatomy detection on a video frame.
    Outputs bounding boxes, predicted classes, confidence scores, and timestamps.
    """
    video = get_video(req.video_id)
    if not video or not os.path.exists(video["file_path"]):
        raise HTTPException(status_code=404, detail="Video not found")

    start_time = time.time()
    try:
        frame_rgb = extract_frame_rgb(video["file_path"], req.frame_idx)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract frame: {str(e)}")

    detections = surgical_detector.detect_frame(
        frame_rgb=frame_rgb,
        frame_idx=req.frame_idx,
        fps=video.get("fps", 25.0),
        min_confidence=req.min_confidence or 0.40
    )
    elapsed_ms = round((time.time() - start_time) * 1000)

    return {
        "status": "success",
        "model": "Surgical Saliency & Morphological Instrument Detector v1.0",
        "frame_idx": req.frame_idx,
        "detection_count": len(detections),
        "inference_time_ms": elapsed_ms,
        "detections": detections
    }

@router.post("/segment")
async def run_prompt_segmentation(req: SegmentRequest):
    """
    Generate pixel-level polygon segmentation mask from a point or bounding-box prompt.
    """
    video = get_video(req.video_id)
    if not video or not os.path.exists(video["file_path"]):
        raise HTTPException(status_code=404, detail="Video not found")

    start_time = time.time()
    try:
        frame_rgb = extract_frame_rgb(video["file_path"], req.frame_idx)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract frame: {str(e)}")

    poly, bbox, area = sam2_tracker.segment_keyframe_mask(
        frame_rgb=frame_rgb,
        prompt_type=req.prompt_type,
        prompt_data=req.prompt_data
    )
    elapsed_ms = round((time.time() - start_time) * 1000)

    return {
        "status": "success",
        "model": "Meta SAM 2 Tiny (sam2_t.pt)",
        "frame_idx": req.frame_idx,
        "label": req.label,
        "category": req.category,
        "color": req.color,
        "polygon": poly,
        "bbox": bbox,
        "area": round(area, 1),
        "confidence": 0.95,
        "inference_time_ms": elapsed_ms
    }

@router.post("/propagate")
async def run_temporal_propagation(req: PropagateRequest):
    """
    Propagate keyframe mask across consecutive frames using SAM 2 Tiny and temporal optical flow,
    then automatically calculate uncertainty indicators for human review prioritization.
    """
    video = get_video(req.video_id)
    if not video or not os.path.exists(video["file_path"]):
        raise HTTPException(status_code=404, detail="Video not found")

    start_time = time.time()
    try:
        propagated_annotations = sam2_tracker.propagate_track(
            video_path=video["file_path"],
            keyframe_idx=req.keyframe_idx,
            prompt_type=req.prompt_type,
            prompt_data=req.prompt_data,
            total_frames=video["total_frames"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tracking propagation error: {str(e)}")

    # Mark source as AI propagated
    for fa in propagated_annotations:
        if not fa.get("is_keyframe", False):
            fa["source"] = "ai_propagated"
            fa["review_status"] = "unreviewed"
        else:
            fa["source"] = "manual"
            fa["review_status"] = "approved"

    # Assign track ID
    data = get_video_tracks_and_annotations(req.video_id)
    existing_tracks = data["tracks"]
    track_id = req.track_id or (max([t["track_id"] for t in existing_tracks], default=0) + 1)
    label = req.label or f"Track {track_id}"

    new_track = {
        "track_id": track_id,
        "label": label,
        "category": req.category or "instrument",
        "color": req.color or "#3B82F6"
    }

    updated_tracks = [t for t in existing_tracks if t["track_id"] != track_id] + [new_track]

    for fa in propagated_annotations:
        fa["track_id"] = track_id

    other_annotations = [a for a in data["annotations"] if a["track_id"] != track_id]
    all_annotations = other_annotations + propagated_annotations

    # Save to database
    save_video_tracks_and_annotations(req.video_id, updated_tracks, all_annotations)

    # Compute uncertainty indicators
    uncertainty_summary = recalculate_video_uncertainty(req.video_id)
    elapsed_ms = round((time.time() - start_time) * 1000)

    return {
        "status": "success",
        "model": "Meta SAM 2 Tiny + Farneback Optical Flow",
        "track": new_track,
        "propagated_frames_count": len(propagated_annotations),
        "inference_time_ms": elapsed_ms,
        "uncertainty_summary": uncertainty_summary,
        "annotations": propagated_annotations
    }
