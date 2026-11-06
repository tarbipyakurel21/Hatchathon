from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
import numpy as np

class BaseSegmentationModel(ABC):
    @property
    @abstractmethod
    def id(self) -> str:
        """Unique model identifier (e.g. 'microscopy-watershed', 'fastsam-s')"""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Display name for UI"""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Technical description of architecture and capabilities"""
        pass

    @property
    @abstractmethod
    def architecture(self) -> str:
        """Model architecture class (e.g. 'Classical / Watershed', 'CNN / Transformer')"""
        pass

    @property
    @abstractmethod
    def is_microscopy_specialized(self) -> bool:
        """True if designed/tuned specifically for cellular microscopy"""
        pass

    @property
    @abstractmethod
    def speed_rating(self) -> str:
        """Speed rating description"""
        pass

    @property
    @abstractmethod
    def recommended_for(self) -> List[str]:
        """List of recommended microscopy modalities"""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Returns True if model dependencies and weights are ready"""
        pass

    @abstractmethod
    def predict(
        self,
        image_rgb: np.ndarray,
        min_area: int = 25,
        max_area: int = 100000,
        threshold: float = 0.4,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Run real segmentation inference on an RGB numpy image array.
        
        Returns dict with:
            - annotations: List of dicts (label, category, color, polygon, bbox, area, model_name)
            - detected_count: int
            - inference_time_ms: float
            - model_id: str
            - model_name: str
            - metadata: dict
        """
        pass
