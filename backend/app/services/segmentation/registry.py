import asyncio
import logging
from typing import Dict, List, Optional
from backend.app.services.segmentation.base import BaseSegmentationModel
from backend.app.services.segmentation.watershed import MicroscopyWatershedModel
from backend.app.services.segmentation.fastsam import FastSAMModel
from backend.app.schemas.model_info import ModelInfo

logger = logging.getLogger("biolabel.registry")

class ModelRegistry:
    def __init__(self):
        self._models: Dict[str, BaseSegmentationModel] = {}
        # Concurrency control: limit concurrent CPU inference jobs to 1 to safeguard 8GB M3 memory
        self._inference_semaphore = asyncio.Semaphore(1)
        self._register_default_models()

    def _register_default_models(self):
        # Register both models: Classical Watershed (default baseline) and FastSAM-s (deep learning)
        watershed_model = MicroscopyWatershedModel()
        self._models[watershed_model.id] = watershed_model

        fastsam_model = FastSAMModel()
        self._models[fastsam_model.id] = fastsam_model

    def get_model(self, model_id: Optional[str] = None) -> BaseSegmentationModel:
        if not model_id:
            # Default to cell-specific watershed baseline
            return self._models["microscopy-watershed"]
        
        if model_id in self._models:
            return self._models[model_id]

        # Fallback
        logger.warning(f"Model ID '{model_id}' not found, falling back to 'microscopy-watershed'")
        return self._models["microscopy-watershed"]

    def list_models(self) -> List[ModelInfo]:
        results = []
        for model in self._models.values():
            results.append(ModelInfo(
                id=model.id,
                name=model.name,
                display_name=model.name,
                description=model.description,
                architecture=model.architecture,
                is_available=model.is_available(),
                is_microscopy_specialized=model.is_microscopy_specialized,
                speed_rating=model.speed_rating,
                recommended_for=model.recommended_for,
                parameters={
                    "min_area": {"type": "int", "default": 25, "min": 5, "max": 10000},
                    "max_area": {"type": "int", "default": 100000, "min": 50, "max": 500000},
                    "threshold": {"type": "float", "default": 0.4, "min": 0.1, "max": 0.9}
                }
            ))
        return results

    @property
    def semaphore(self) -> asyncio.Semaphore:
        return self._inference_semaphore

# Global singleton
registry = ModelRegistry()
