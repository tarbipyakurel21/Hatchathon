from fastapi import APIRouter
from typing import List
from backend.app.schemas.model_info import ModelInfo
from backend.app.services.segmentation.registry import registry

router = APIRouter(prefix="/api/models", tags=["Models"])

@router.get("", response_model=List[ModelInfo])
async def get_models():
    """List available segmentation models with architecture details and speed ratings."""
    return registry.list_models()
