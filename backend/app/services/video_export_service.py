import os
import json
import zipfile
import shutil
import cv2
import numpy as np
from datetime import datetime, timezone
from typing import Dict, Any, List

from backend.app.services.video_io import (
    VIDEO_EXPORTS_DIR,
    extract_frame_rgb,
    probe_video,
)

def export_video_dataset_zip(
    video: Dict[str, Any],
    tracks: List[Dict[str, Any]],
    annotations: List[Dict[str, Any]]
) -> str:
    """
    Exports video, keyframes, binary/instance mask images, and Video-COCO annotations
    into a standardized ZIP archive ready for training AI video segmentation models.
    """
    os.makedirs(VIDEO_EXPORTS_DIR, exist_ok=True)
    video_id = video["id"]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    export_dirname = f"meddata_{video_id[:8]}_{timestamp}"
    temp_dir = os.path.join(VIDEO_EXPORTS_DIR, export_dirname)

    # Subdirectories
    videos_sub = os.path.join(temp_dir, "videos")
    frames_sub = os.path.join(temp_dir, "frames")
    masks_sub = os.path.join(temp_dir, "masks")
    ann_sub = os.path.join(temp_dir, "annotations")

    for d in [videos_sub, frames_sub, masks_sub, ann_sub]:
        os.makedirs(d, exist_ok=True)

    # 1. Copy video file if exists
    if os.path.exists(video["file_path"]):
        shutil.copy2(video["file_path"], os.path.join(videos_sub, video["filename"]))

    # Group annotations by frame
    anns_by_frame: Dict[int, List[Dict[str, Any]]] = {}
    for a in annotations:
        f_idx = a["frame_idx"]
        anns_by_frame.setdefault(f_idx, []).append(a)

    w = video["width"]
    h = video["height"]

    # 2. Extract frames and render instance masks
    cap = cv2.VideoCapture(video["file_path"])
    total_frames = video["total_frames"]

    # Export sampled frames (e.g. up to 100 frames to keep ZIP fast and lightweight)
    sample_step = max(1, total_frames // 100)
    for f in range(0, total_frames, sample_step):
        cap.set(cv2.CAP_PROP_POS_FRAMES, f)
        ret, frame_bgr = cap.read()
        if not ret:
            break

        # Save frame JPG
        frame_filename = f"frame_{f:05d}.jpg"
        cv2.imwrite(os.path.join(frames_sub, frame_filename), frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])

        # Render composite instance mask for this frame
        frame_anns = anns_by_frame.get(f, [])
        if frame_anns:
            # 8-bit mask where pixel value == track_id
            mask = np.zeros((h, w), dtype=np.uint8)
            for fa in frame_anns:
                pts = fa.get("polygon", [])
                if len(pts) >= 3:
                    pts_np = np.array(pts, dtype=np.int32).reshape((-1, 1, 2))
                    cv2.fillPoly(mask, [pts_np], int(fa["track_id"]))

            mask_filename = f"mask_{f:05d}.png"
            cv2.imwrite(os.path.join(masks_sub, mask_filename), mask)

    cap.release()

    # 3. Create Video COCO standard annotations
    categories = [
        {"id": 1, "name": "instrument", "supercategory": "surgical_tool"},
        {"id": 2, "name": "tissue", "supercategory": "anatomy"},
        {"id": 3, "name": "organ", "supercategory": "anatomy"},
        {"id": 4, "name": "lesion", "supercategory": "pathology"},
    ]
    cat_map = {"instrument": 1, "tissue": 2, "organ": 3, "lesion": 4}

    track_cat_map = {t["track_id"]: cat_map.get(t.get("category", "instrument"), 1) for t in tracks}

    coco_annotations = []
    ann_counter = 1
    for a in annotations:
        f_idx = a["frame_idx"]
        track_id = a["track_id"]
        flat_poly = []
        for pt in a.get("polygon", []):
            flat_poly.extend([round(pt[0], 1), round(pt[1], 1)])

        coco_annotations.append({
            "id": ann_counter,
            "video_id": 1,
            "image_id": f_idx + 1,
            "track_id": track_id,
            "category_id": track_cat_map.get(track_id, 1),
            "segmentation": [flat_poly],
            "area": a.get("area", 0.0),
            "bbox": a.get("bbox", [0, 0, 0, 0]),
            "iscrowd": 0,
            "is_keyframe": a.get("is_keyframe", False),
        })
        ann_counter += 1

    coco_dataset = {
        "info": {
            "description": "MedData Studio Surgical Video Dataset",
            "version": "1.0",
            "year": datetime.now().year,
            "contributor": "MedData Studio SAM 2 Tracker",
            "date_created": datetime.now(timezone.utc).isoformat(),
        },
        "videos": [
            {
                "id": 1,
                "name": video["filename"],
                "width": w,
                "height": h,
                "fps": video["fps"],
                "length": video["total_frames"],
                "duration_seconds": video["duration_seconds"],
            }
        ],
        "categories": categories,
        "tracks": tracks,
        "annotations": coco_annotations,
    }

    with open(os.path.join(ann_sub, "video_coco.json"), "w") as f:
        json.dump(coco_dataset, f, indent=2)

    # 4. Metadata JSON
    metadata = {
        "platform": "MedData Studio",
        "tagline": "AI-Powered Medical Video Dataset Creation",
        "source_video": video["filename"],
        "duration_seconds": video["duration_seconds"],
        "fps": video["fps"],
        "total_frames": video["total_frames"],
        "resolution": f"{w}x{h}",
        "track_count": len(tracks),
        "total_segmented_instances": len(annotations),
        "model_architecture": "Meta SAM 2 Tiny (sam2_t.pt)",
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }
    with open(os.path.join(temp_dir, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    # 5. Package as ZIP
    zip_filename = f"{export_dirname}.zip"
    zip_path = os.path.join(VIDEO_EXPORTS_DIR, zip_filename)

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(temp_dir):
            for file in files:
                abs_file = os.path.join(root, file)
                rel_file = os.path.relpath(abs_file, os.path.dirname(temp_dir))
                zipf.write(abs_file, rel_file)

    # Cleanup temporary directory
    shutil.rmtree(temp_dir, ignore_errors=True)

    return zip_filename
