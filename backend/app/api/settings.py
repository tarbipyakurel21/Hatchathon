from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

from backend.app.services.uncertainty_service import (
    get_uncertainty_settings,
    save_uncertainty_settings,
    DEFAULT_UNCERTAINTY_SETTINGS
)
from backend.app.services.database import DEFAULT_TAXONOMY, list_videos
from backend.app.services.uncertainty_service import recalculate_video_uncertainty

router = APIRouter(prefix="/api/settings", tags=["SurgiLabel Settings"])

class SettingsUpdateRequest(BaseModel):
    w_detection: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    w_temporal: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    w_tracking: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    w_shape: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    threshold_high: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    threshold_medium: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    recalculate_existing: Optional[bool] = Field(default=True)

@router.get("")
async def get_system_settings():
    """Retrieve active uncertainty scoring parameters and taxonomy defaults."""
    uncertainty_cfg = get_uncertainty_settings()
    return {
        "uncertainty_weights": uncertainty_cfg,
        "default_taxonomy": DEFAULT_TAXONOMY,
        "models": {
            "detector": "Surgical Saliency & Morphological Instrument Detector v1.0",
            "segmenter": "Meta SAM 2 Tiny (sam2_t.pt)",
            "tracker": "Farneback Optical Flow + CSRT Temporal Interpolation"
        }
    }

@router.post("")
async def update_system_settings(req: SettingsUpdateRequest):
    """Update uncertainty scoring weights and thresholds."""
    current = get_uncertainty_settings()
    updates = req.model_dump(exclude_unset=True, exclude={"recalculate_existing"})

    for k, v in updates.items():
        if v is not None:
            current[k] = float(v)

    saved = save_uncertainty_settings(current)

    if req.recalculate_existing:
        videos = list_videos()
        for v in videos:
            try:
                recalculate_video_uncertainty(v["id"])
            except Exception:
                pass

    return {
        "status": "success",
        "uncertainty_weights": saved,
        "message": "Settings updated successfully"
    }

@router.post("/reset")
async def reset_system_settings():
    """Reset uncertainty weights and thresholds to default values."""
    saved = save_uncertainty_settings(DEFAULT_UNCERTAINTY_SETTINGS.copy())
    return {
        "status": "success",
        "uncertainty_weights": saved,
        "message": "Reset to default settings"
    }
