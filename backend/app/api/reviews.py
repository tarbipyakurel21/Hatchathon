from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from backend.app.services.database import (
    get_annotation_by_id,
    save_review_record,
    get_reviews_for_video,
    get_video,
    update_annotation_by_id
)
from backend.app.services.uncertainty_service import (
    get_review_queue_items,
    recalculate_video_uncertainty
)

router = APIRouter(prefix="/api/reviews", tags=["SurgiLabel Review Queue"])

class ReviewActionRequest(BaseModel):
    review_action: str = Field(..., description="'approved', 'corrected', 'rejected', or 'skipped'")
    corrected_polygon: Optional[List[List[float]]] = None
    corrected_bbox: Optional[List[float]] = None
    reviewer_notes: Optional[str] = None

class BatchReviewRequest(BaseModel):
    annotation_ids: List[str]
    review_action: str = Field(default="approved")
    reviewer_notes: Optional[str] = None

@router.get("/queue", response_model=List[Dict[str, Any]])
async def query_review_queue(
    video_id: Optional[str] = Query(None, description="Filter by video ID"),
    priority: Optional[str] = Query(None, description="Filter by priority: high, medium, low"),
    review_status: Optional[str] = Query(None, description="Filter by status: unreviewed, approved, corrected, rejected"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """
    Retrieve uncertainty-ranked annotations for human inspection, ordered by review priority score descending.
    """
    return get_review_queue_items(
        video_id=video_id,
        priority=priority,
        review_status=review_status,
        limit=limit,
        offset=offset
    )

@router.post("/{annotation_id}")
async def submit_annotation_review(annotation_id: str, req: ReviewActionRequest):
    """
    Submit human review decision (approve, correct, reject, skip) for an annotation.
    Preserves original AI prediction vs human correction in audit log.
    """
    ann = get_annotation_by_id(annotation_id)
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")

    video_id = ann["video_id"]
    frame_idx = ann["frame_idx"]
    track_id = ann["track_id"]

    orig_pred = {
        "polygon": ann.get("polygon", []),
        "bbox": ann.get("bbox", [0, 0, 0, 0]),
        "confidence": ann.get("confidence", 1.0),
        "area": ann.get("area", 0.0)
    }

    corrected = None
    if req.review_action == "corrected" and (req.corrected_polygon or req.corrected_bbox):
        poly = req.corrected_polygon or ann.get("polygon", [])
        bbox = req.corrected_bbox or ann.get("bbox", [0, 0, 0, 0])
        # Compute corrected area
        area = ann.get("area", 0.0)
        if len(poly) >= 3:
            # Shoelace formula
            import cv2
            import numpy as np
            cnt = np.array(poly, dtype=np.float32)
            area = float(cv2.contourArea(cnt))
        elif bbox[2] > 0 and bbox[3] > 0:
            area = float(bbox[2] * bbox[3])

        corrected = {
            "polygon": poly,
            "bbox": bbox,
            "area": area
        }

    review_record = save_review_record(
        annotation_id=annotation_id,
        video_id=video_id,
        frame_idx=frame_idx,
        track_id=track_id,
        review_action=req.review_action,
        original_prediction=orig_pred,
        corrected_annotation=corrected,
        reviewer_notes=req.reviewer_notes
    )

    # Recalculate uncertainty signals for the affected video
    try:
        recalculate_video_uncertainty(video_id)
    except Exception:
        pass

    return {
        "status": "success",
        "review": review_record,
        "annotation": get_annotation_by_id(annotation_id)
    }

@router.post("/batch/action")
async def batch_review_annotations(req: BatchReviewRequest):
    """
    Batch approve or reject multiple annotations.
    """
    results = []
    video_ids_to_recalc = set()

    for ann_id in req.annotation_ids:
        ann = get_annotation_by_id(ann_id)
        if not ann:
            continue
        v_id = ann["video_id"]
        video_ids_to_recalc.add(v_id)

        orig_pred = {
            "polygon": ann.get("polygon", []),
            "bbox": ann.get("bbox", [0, 0, 0, 0]),
            "confidence": ann.get("confidence", 1.0)
        }
        rec = save_review_record(
            annotation_id=ann_id,
            video_id=v_id,
            frame_idx=ann["frame_idx"],
            track_id=ann["track_id"],
            review_action=req.review_action,
            original_prediction=orig_pred,
            reviewer_notes=req.reviewer_notes
        )
        results.append(rec)

    for vid in video_ids_to_recalc:
        try:
            recalculate_video_uncertainty(vid)
        except Exception:
            pass

    return {
        "status": "success",
        "processed_count": len(results),
        "action": req.review_action
    }

@router.get("/history/{video_id}")
async def get_video_review_history(video_id: str):
    """
    Retrieve audit history of human reviews and corrections for a video.
    """
    video = get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    reviews = get_reviews_for_video(video_id)
    return {
        "video_id": video_id,
        "review_count": len(reviews),
        "reviews": reviews
    }
