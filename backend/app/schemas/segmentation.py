from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from backend.app.schemas.annotation import AnnotationResponse

class SegmentationRequest(BaseModel):
    model_id: Optional[str] = Field(default=None, description="Model identifier ('fastsam-s', 'microscopy-watershed')")
    min_area: Optional[int] = Field(default=25, ge=1, le=50000, description="Minimum object area in pixels")
    max_area: Optional[int] = Field(default=100000, ge=10, description="Maximum object area in pixels")
    threshold: Optional[float] = Field(default=0.4, ge=0.01, le=0.99, description="Sensitivity/Confidence threshold")

class SegmentationResponse(BaseModel):
    image_id: str
    model_id: str
    model_name: str
    detected_count: int
    inference_time_ms: float
    annotations: List[AnnotationResponse]
    metadata: Dict[str, Any] = {}

class BenchmarkModelResult(BaseModel):
    model_id: str
    model_name: str
    detected_count: int
    inference_time_ms: float
    mean_object_area: float
    notes: str

class BenchmarkResponse(BaseModel):
    image_id: str
    results: List[BenchmarkModelResult]
    recommendation: str
