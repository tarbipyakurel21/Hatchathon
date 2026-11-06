import math
import json
import uuid
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timezone

from backend.app.services.database import (
    get_connection,
    get_video,
    get_video_tracks_and_annotations,
    now_iso
)

DEFAULT_UNCERTAINTY_SETTINGS = {
    "w_detection": 0.25,
    "w_temporal": 0.35,
    "w_tracking": 0.25,
    "w_shape": 0.15,
    "threshold_high": 0.55,
    "threshold_medium": 0.30,
}

def get_uncertainty_settings() -> Dict[str, float]:
    """Retrieve configurable uncertainty weights and thresholds from DB or defaults."""
    conn = get_connection()
    try:
        row = conn.execute("SELECT value FROM app_settings WHERE key = 'uncertainty_weights'").fetchone()
        if row:
            try:
                return json.loads(row["value"])
            except Exception:
                pass
    except Exception:
        pass
    finally:
        conn.close()
    return DEFAULT_UNCERTAINTY_SETTINGS.copy()

def save_uncertainty_settings(settings: Dict[str, float]) -> Dict[str, float]:
    """Persist updated uncertainty weights and thresholds."""
    conn = get_connection()
    try:
        ts = now_iso()
        val_json = json.dumps(settings)
        conn.execute(
            """
            INSERT INTO app_settings (key, value, updated_at) VALUES ('uncertainty_weights', ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (val_json, ts)
        )
        conn.commit()
    finally:
        conn.close()
    return settings

def analyze_single_annotation_uncertainty(
    ann: Dict[str, Any],
    prev_ann: Optional[Dict[str, Any]],
    next_ann: Optional[Dict[str, Any]],
    frame_other_tracks: List[Dict[str, Any]],
    video_w: int,
    video_h: int,
    settings: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Computes explainable uncertainty signals for a single frame annotation.
    Returns: {
        'detection_uncertainty': float,
        'temporal_instability': float,
        'tracking_inconsistency': float,
        'shape_anomaly': float,
        'overall_review_priority': float,
        'priority_tier': 'high' | 'medium' | 'low',
        'reasons': List[str]
    }
    """
    if settings is None:
        settings = get_uncertainty_settings()

    w_det = settings.get("w_detection", 0.25)
    w_temp = settings.get("w_temporal", 0.35)
    w_track = settings.get("w_tracking", 0.25)
    w_shape = settings.get("w_shape", 0.15)
    th_high = settings.get("threshold_high", 0.55)
    th_med = settings.get("threshold_medium", 0.30)

    reasons = []

    # 1. Detection Uncertainty
    confidence = float(ann.get("confidence", 1.0))
    source = ann.get("source", "manual")
    if source in ["ai_detector", "ai_sam2", "ai_propagated"]:
        # Invert confidence
        u_det = max(0.0, min(1.0, 1.0 - confidence))
        if confidence < 0.70:
            reasons.append(f"Low model detection confidence ({round(confidence * 100)}%)")
    else:
        # Manual human keyframe has 0 detector uncertainty
        u_det = 0.0

    # 2. Temporal Mask Instability
    u_temp = 0.0
    curr_area = float(ann.get("area", 0.0))
    curr_bbox = ann.get("bbox", [0, 0, 0, 0])
    curr_cx = curr_bbox[0] + curr_bbox[2] / 2.0
    curr_cy = curr_bbox[1] + curr_bbox[3] / 2.0
    curr_frame = int(ann.get("frame_idx", 0))

    if prev_ann is not None:
        prev_area = float(prev_ann.get("area", 0.0))
        prev_bbox = prev_ann.get("bbox", [0, 0, 0, 0])
        prev_cx = prev_bbox[0] + prev_bbox[2] / 2.0
        prev_cy = prev_bbox[1] + prev_bbox[3] / 2.0
        prev_frame = int(prev_ann.get("frame_idx", curr_frame - 1))

        # Area volatility
        area_diff = abs(curr_area - prev_area)
        area_ratio = area_diff / max(10.0, prev_area)
        if area_ratio > 0.25:
            sig = min(1.0, area_ratio / 0.8)
            u_temp = max(u_temp, sig)
            reasons.append(f"Mask area fluctuated by {round(area_ratio * 100)}% compared to frame {prev_frame}")

        # Centroid jump
        dist = math.sqrt((curr_cx - prev_cx) ** 2 + (curr_cy - prev_cy) ** 2)
        frame_gap = max(1, curr_frame - prev_frame)
        velocity = dist / frame_gap
        if velocity > 25.0:
            sig = min(1.0, (velocity - 25.0) / 45.0)
            u_temp = max(u_temp, sig)
            reasons.append(f"Abrupt centroid displacement of {round(dist, 1)}px ({round(velocity, 1)}px/frame)")

        # Aspect ratio distortion
        curr_ar = curr_bbox[2] / max(1.0, curr_bbox[3])
        prev_ar = prev_bbox[2] / max(1.0, prev_bbox[3])
        ar_diff = abs(curr_ar - prev_ar) / max(0.1, prev_ar)
        if ar_diff > 0.40:
            sig = min(1.0, ar_diff)
            u_temp = max(u_temp, sig * 0.7)
            reasons.append(f"Bounding box geometry distorted by {round(ar_diff * 100)}%")

    # 3. Tracking Inconsistency
    u_track = 0.0
    # A. Dropped frames / continuity gap
    if prev_ann is not None:
        gap = curr_frame - int(prev_ann.get("frame_idx", curr_frame - 1))
        if gap > 1:
            u_track = max(u_track, min(1.0, (gap - 1) * 0.25))
            reasons.append(f"Track continuity interrupted across {gap - 1} missing frames")

    # B. Central frame appearance/disappearance (not entering from edge)
    is_terminal = (prev_ann is None) or (next_ann is None)
    if is_terminal and not ann.get("is_keyframe", False):
        if (0.25 * video_w < curr_cx < 0.75 * video_w) and (0.25 * video_h < curr_cy < 0.75 * video_h):
            u_track = max(u_track, 0.45)
            action_desc = "appeared" if prev_ann is None else "terminated"
            reasons.append(f"Track {action_desc} abruptly in central surgical field")

    # C. Multi-track overlap conflict (ID switch check)
    for other in frame_other_tracks:
        if other.get("track_id") != ann.get("track_id"):
            ob = other.get("bbox", [0, 0, 0, 0])
            # Compute IoU
            ix1 = max(curr_bbox[0], ob[0])
            iy1 = max(curr_bbox[1], ob[1])
            ix2 = min(curr_bbox[0] + curr_bbox[2], ob[0] + ob[2])
            iy2 = min(curr_bbox[1] + curr_bbox[3], ob[1] + ob[3])
            iw = max(0.0, ix2 - ix1)
            ih = max(0.0, iy2 - iy1)
            inter = iw * ih
            union = (curr_bbox[2] * curr_bbox[3]) + (ob[2] * ob[3]) - inter
            iou = inter / max(1.0, union)
            if iou > 0.40:
                u_track = max(u_track, 0.65)
                other_name = other.get("label", f"Track #{other.get('track_id')}")
                reasons.append(f"Spatial conflict (IoU {round(iou, 2)}) with {other_name} — potential ID swap")

    # 4. Shape Anomaly
    u_shape = 0.0
    # A. Tiny isolated mask
    if curr_area < 45.0:
        sig = min(1.0, (45.0 - curr_area) / 35.0)
        u_shape = max(u_shape, sig)
        reasons.append(f"Isolated tiny mask ({round(curr_area)}px²) below surgical instrument profile")

    # B. Truncated at frame boundaries
    if (curr_bbox[0] <= 2 or curr_bbox[1] <= 2 or
        (curr_bbox[0] + curr_bbox[2]) >= (video_w - 2) or
        (curr_bbox[1] + curr_bbox[3]) >= (video_h - 2)):
        u_shape = max(u_shape, 0.40)
        reasons.append("Mask boundaries truncated at frame perimeter")

    # C. Jaggedness / fragmentation from polygon
    polygon = ann.get("polygon", [])
    if len(polygon) >= 16:
        # Calculate perimeter
        perimeter = 0.0
        for i in range(len(polygon)):
            p1 = polygon[i]
            p2 = polygon[(i + 1) % len(polygon)]
            perimeter += math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)
        # Isoperimetric ratio Q = 4 * pi * Area / P^2 (Circle = 1.0, thin/jagged < 0.12)
        if perimeter > 0:
            q = (4.0 * math.pi * curr_area) / (perimeter ** 2)
            if q < 0.10:
                u_shape = max(u_shape, 0.45)
                reasons.append("High contour roughness / boundary fragmentation detected")

    # Combined Transparent Score
    score = (w_det * u_det) + (w_temp * u_temp) + (w_track * u_track) + (w_shape * u_shape)
    score = round(max(0.0, min(1.0, score)), 3)

    if score >= th_high:
        tier = "high"
    elif score >= th_med:
        tier = "medium"
    else:
        tier = "low"

    if not reasons and score >= th_med:
        reasons.append("Aggregate temporal variance exceeding baseline threshold")

    return {
        "detection_uncertainty": round(u_det, 3),
        "temporal_instability": round(u_temp, 3),
        "tracking_inconsistency": round(u_track, 3),
        "shape_anomaly": round(u_shape, 3),
        "overall_review_priority": score,
        "priority_tier": tier,
        "reasons": reasons
    }

def recalculate_video_uncertainty(video_id: str) -> Dict[str, Any]:
    """
    Computes uncertainty records for every annotated frame in the video,
    persists them in `uncertainty_records`, updates `video_frame_annotations`,
    and returns a summary.
    """
    video = get_video(video_id)
    if not video:
        raise ValueError(f"Video {video_id} not found")

    w = int(video.get("width", 640))
    h = int(video.get("height", 480))
    settings = get_uncertainty_settings()

    data = get_video_tracks_and_annotations(video_id)
    tracks = {t["track_id"]: t for t in data["tracks"]}
    annotations = data["annotations"]

    # Group annotations by track_id
    track_ann_map = {}
    frame_ann_map = {}
    for a in annotations:
        tid = a["track_id"]
        fidx = a["frame_idx"]
        track_ann_map.setdefault(tid, []).append(a)
        frame_ann_map.setdefault(fidx, []).append(a)

    # Sort each track's annotations by frame_idx
    for tid in track_ann_map:
        track_ann_map[tid].sort(key=lambda x: x["frame_idx"])

    conn = get_connection()
    try:
        cursor = conn.cursor()
        ts = now_iso()

        # Clear existing uncertainty records for this video
        cursor.execute("DELETE FROM uncertainty_records WHERE video_id = ?", (video_id,))

        summary = {"total": 0, "high": 0, "medium": 0, "low": 0}

        for tid, ann_list in track_ann_map.items():
            for i, ann in enumerate(ann_list):
                prev_ann = ann_list[i - 1] if i > 0 else None
                next_ann = ann_list[i + 1] if i < len(ann_list) - 1 else None
                fidx = ann["frame_idx"]
                other_tracks = [x for x in frame_ann_map.get(fidx, []) if x["track_id"] != tid]

                sig = analyze_single_annotation_uncertainty(
                    ann=ann,
                    prev_ann=prev_ann,
                    next_ann=next_ann,
                    frame_other_tracks=other_tracks,
                    video_w=w,
                    video_h=h,
                    settings=settings
                )

                ann_id = ann.get("id") or str(uuid.uuid4())
                tier = sig["priority_tier"]
                score = sig["overall_review_priority"]
                reasons_json = json.dumps(sig["reasons"])

                # Insert uncertainty record
                rec_id = str(uuid.uuid4())
                cursor.execute(
                    """
                    INSERT INTO uncertainty_records
                    (id, annotation_id, video_id, frame_idx, track_id, detection_uncertainty,
                     temporal_instability, tracking_inconsistency, shape_anomaly,
                     overall_review_priority, priority_tier, reasons, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (rec_id, ann_id, video_id, fidx, tid, sig["detection_uncertainty"],
                     sig["temporal_instability"], sig["tracking_inconsistency"], sig["shape_anomaly"],
                     score, tier, reasons_json, ts, ts)
                )

                # Update video_frame_annotations
                cursor.execute(
                    """
                    UPDATE video_frame_annotations
                    SET uncertainty_score = ?, priority_tier = ?, flag_reasons = ?
                    WHERE id = ?
                    """,
                    (score, tier, reasons_json, ann_id)
                )

                summary["total"] += 1
                summary[tier] += 1

        conn.commit()
    finally:
        conn.close()

    return summary

def get_review_queue_items(
    video_id: Optional[str] = None,
    priority: Optional[str] = None,
    review_status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """
    Queries uncertainty-ranked annotations for the review queue.
    Sorted by overall_review_priority DESC, then frame_idx ASC.
    """
    conn = get_connection()
    try:
        query = """
        SELECT u.*, 
               fa.polygon, fa.bbox, fa.area, fa.is_keyframe, fa.confidence, fa.review_status, fa.source,
               t.label, t.category, t.color,
               v.filename as video_title, v.fps, v.duration_seconds
        FROM uncertainty_records u
        JOIN video_frame_annotations fa ON u.annotation_id = fa.id
        JOIN video_tracks t ON u.video_id = t.video_id AND u.track_id = t.track_id
        JOIN videos v ON u.video_id = v.id
        WHERE 1=1
        """
        params = []
        if video_id:
            query += " AND u.video_id = ?"
            params.append(video_id)
        if priority:
            query += " AND u.priority_tier = ?"
            params.append(priority)
        if review_status:
            query += " AND fa.review_status = ?"
            params.append(review_status)

        query += " ORDER BY u.overall_review_priority DESC, u.frame_idx ASC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        rows = conn.execute(query, params).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["polygon"] = json.loads(d["polygon"]) if d.get("polygon") else []
            d["bbox"] = json.loads(d["bbox"]) if d.get("bbox") else [0, 0, 0, 0]
            d["reasons"] = json.loads(d["reasons"]) if d.get("reasons") else []
            d["timestamp_seconds"] = round(d["frame_idx"] / max(1.0, d.get("fps", 25.0)), 2)
            results.append(d)
        return results
    finally:
        conn.close()
