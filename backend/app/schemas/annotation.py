from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional

class AnnotationBase(BaseModel):
    label: str = Field(..., max_length=100)
    category: str = Field(default="cell", max_length=50)
    color: str = Field(default="#06B6D4", max_length=20)
    polygon: List[List[float]] = Field(..., description="List of [x, y] coordinates in original image space")
    bbox: List[float] = Field(..., description="[x, y, width, height] in original image space")
    area: float = Field(..., ge=0, description="Area in pixels")
    is_visible: bool = Field(default=True)
    model_name: Optional[str] = Field(default="manual", max_length=100)

class AnnotationCreate(AnnotationBase):
    id: Optional[str] = None

class AnnotationUpdate(BaseModel):
    label: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None
    polygon: Optional[List[List[float]]] = None
    bbox: Optional[List[float]] = None
    area: Optional[float] = None
    is_visible: Optional[bool] = None

class AnnotationResponse(AnnotationBase):
    id: str
    image_id: str
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)

class AnnotationBatchUpdate(BaseModel):
    annotations: List[AnnotationCreate]
