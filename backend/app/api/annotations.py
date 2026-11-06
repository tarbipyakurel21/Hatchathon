from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from backend.app.services.database import (
    get_video,
    get_video_tracks_and_annotations,
    get_annotation_by_id,
    update_annotation_by_id
)
from backend.app.services.uncertainty_service import recalculate_video_uncertainty

router = APIRouter(prefix="/api/annotations", tags=["SurgiLabel Annotations"])

class AnnotationUpdateRequest(BaseModel):
    polygon: Optional[List[List[float]]] = None
    bbox: Optional[List[float]] = None
    review_status: Optional[str] = None
    confidence: Optional[float] = None
    is_keyframe: Optional[bool] = None

@router.get("/{video_id}")
async def get_annotations_for_video(video_id: str):
    """Retrieve all tracks and frame-by-frame annotations for a video."""
    video = get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return get_video_tracks_and_annotations(video_id)

@router.put("/{annotation_id}")
async def update_single_annotation(annotation_id: str, req: AnnotationUpdateRequest):
    """Update geometry, review status, or keyframe state of an individual frame annotation."""
    ann = get_annotation_by_id(annotation_id)
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")

    updates = req.model_dump(exclude_unset=True)
    if req.polygon:
        import cv2
        import numpy as np
        cnt = np.array(req.polygon, dtype=np.float32)
        updates["area"] = float(cv2.contourArea(cnt))
    elif req.bbox:
        updates["area"] = float(req.bbox[2] * req.bbox[3])

    updated = update_annotation_by_id(annotation_id, updates)

    # Recalculate uncertainty signals
    try:
        recalculate_video_uncertainty(ann["video_id"])
    except Exception:
        pass

    return {
        "status": "success",
        "annotation": updated
    }
