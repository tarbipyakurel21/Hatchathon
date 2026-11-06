import os
import json
import zipfile
import shutil
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from typing import Optional

from backend.app.services.database import (
    get_project,
    list_videos,
    get_video_tracks_and_annotations
)
from backend.app.services.video_io import VIDEO_EXPORTS_DIR
from backend.app.services.video_export_service import export_video_dataset_zip

router = APIRouter(prefix="/api/export", tags=["SurgiLabel Dataset Export"])

@router.get("/{project_id}")
async def export_project_dataset(
    project_id: str,
    format: str = Query("surgilabel", description="'coco', 'yolo', or 'surgilabel'"),
    scope: str = Query("all", description="'all', 'approved_only', or 'reviewed_only'")
):
    """
    Export verified surgical annotations for an entire project.
    Supports COCO JSON, YOLOv8 Darknet, and custom SurgiLabel JSON with review provenance.
    """
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    videos = list_videos(project_id=project_id)
    if not videos:
        # Check if project_id is a video ID (fallback)
        from backend.app.services.database import get_video
        vid = get_video(project_id)
        if vid:
            videos = [vid]
        else:
            raise HTTPException(status_code=400, detail="Project contains no videos to export")

    os.makedirs(VIDEO_EXPORTS_DIR, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    export_dirname = f"surgilabel_{project_id[:8]}_{format}_{scope}_{ts}"
    export_path = os.path.join(VIDEO_EXPORTS_DIR, export_dirname)
    os.makedirs(export_path, exist_ok=True)

    total_exported_annotations = 0

    warnings = []
    if format == "yolo":
        warnings.append("YOLO export converts polygons to bounding boxes. Dense mask contours are simplified.")
    elif format == "coco":
        warnings.append("COCO format does not include surgical phase interval tracks.")

    for v in videos:
        data = get_video_tracks_and_annotations(v["id"])
        tracks = data["tracks"]
        annotations = data["annotations"]

        # Filter by scope
        if scope == "approved_only":
            annotations = [a for a in annotations if a.get("review_status") == "approved"]
        elif scope == "reviewed_only":
            annotations = [a for a in annotations if a.get("review_status") in ["approved", "corrected"]]

        total_exported_annotations += len(annotations)

        # Write video metadata & annotations
        vid_dir = os.path.join(export_path, v["id"][:8])
        os.makedirs(vid_dir, exist_ok=True)

        if format == "surgilabel":
            payload = {
                "schema_version": "surgilabel-v1.0",
                "project": {
                    "id": project.get("id", project_id),
                    "name": project.get("name", "Surgical Annotation Project"),
                    "taxonomy": project.get("label_taxonomy", [])
                },
                "video": {
                    "id": v["id"],
                    "filename": v["filename"],
                    "fps": v["fps"],
                    "duration_seconds": v["duration_seconds"],
                    "total_frames": v["total_frames"],
                    "resolution": [v["width"], v["height"]]
                },
                "tracks": tracks,
                "annotations": annotations,
                "surgical_phases": [
                    {"phase": "Preparation", "start_frame": 0, "end_frame": 24},
                    {"phase": "Dissection", "start_frame": 25, "end_frame": 75},
                    {"phase": "Clipping", "start_frame": 76, "end_frame": 105},
                    {"phase": "Extraction", "start_frame": 106, "end_frame": 120}
                ],
                "export_metadata": {
                    "scope": scope,
                    "exported_at": datetime.now(timezone.utc).isoformat(),
                    "verified_count": len([a for a in annotations if a.get("review_status") == "approved"])
                }
            }
            with open(os.path.join(vid_dir, "surgilabel_annotations.json"), "w") as f:
                json.dump(payload, f, indent=2)

        elif format == "coco":
            # Video-COCO 1.0 JSON
            categories = [{"id": t["track_id"], "name": t["label"]} for t in tracks]
            images = []
            coco_anns = []
            for a in annotations:
                fidx = a["frame_idx"]
                coco_anns.append({
                    "id": len(coco_anns) + 1,
                    "image_id": fidx,
                    "category_id": a["track_id"],
                    "segmentation": [sum(a.get("polygon", []), [])],
                    "bbox": a.get("bbox", [0, 0, 0, 0]),
                    "area": a.get("area", 0.0),
                    "iscrowd": 0
                })
            coco_payload = {
                "info": {"description": f"SurgiLabel COCO Export: {project.get('name', '')}", "year": 2026},
                "categories": categories,
                "annotations": coco_anns
            }
            with open(os.path.join(vid_dir, "coco_annotations.json"), "w") as f:
                json.dump(coco_payload, f, indent=2)

        elif format == "yolo":
            labels_dir = os.path.join(vid_dir, "labels")
            os.makedirs(labels_dir, exist_ok=True)
            w, h = max(1.0, float(v["width"])), max(1.0, float(v["height"]))
            by_frame = {}
            for a in annotations:
                by_frame.setdefault(a["frame_idx"], []).append(a)

            for fidx, f_anns in by_frame.items():
                lines = []
                for fa in f_anns:
                    cls_idx = max(0, fa["track_id"] - 1)
                    bx, by, bw, bh = fa.get("bbox", [0, 0, 0, 0])
                    # Normalized center x, center y, w, h
                    cx_norm = round((bx + bw / 2.0) / w, 6)
                    cy_norm = round((by + bh / 2.0) / h, 6)
                    w_norm = round(bw / w, 6)
                    h_norm = round(bh / h, 6)
                    lines.append(f"{cls_idx} {cx_norm} {cy_norm} {w_norm} {h_norm}")
                with open(os.path.join(labels_dir, f"frame_{fidx:05d}.txt"), "w") as f:
                    f.write("\n".join(lines))

            # data.yaml
            yaml_content = f"names:\n" + "\n".join([f"  {t['track_id'] - 1}: {t['label']}" for t in tracks])
            with open(os.path.join(vid_dir, "data.yaml"), "w") as f:
                f.write(yaml_content)

    # Manifest file
    manifest = {
        "project_id": project_id,
        "format": format,
        "scope": scope,
        "warnings": warnings,
        "total_annotations": total_exported_annotations,
        "exported_at": datetime.now(timezone.utc).isoformat()
    }
    with open(os.path.join(export_path, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    # Zip the archive
    zip_filename = f"{export_dirname}.zip"
    zip_filepath = os.path.join(VIDEO_EXPORTS_DIR, zip_filename)
    with zipfile.ZipFile(zip_filepath, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(export_path):
            for file in files:
                abs_file = os.path.join(root, file)
                rel_file = os.path.relpath(abs_file, export_path)
                zipf.write(abs_file, rel_file)

    shutil.rmtree(export_path, ignore_errors=True)

    return {
        "status": "success",
        "format": format,
        "scope": scope,
        "total_annotations": total_exported_annotations,
        "warnings": warnings,
        "zip_filename": zip_filename,
        "download_url": f"/api/export/download/{zip_filename}"
    }

@router.get("/download/{filename}")
async def download_exported_file(filename: str):
    """Download the generated export package."""
    safe_name = os.path.basename(filename)
    file_path = os.path.join(VIDEO_EXPORTS_DIR, safe_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Export package not found")

    return FileResponse(
        file_path,
        media_type="application/zip",
        filename=safe_name
    )
