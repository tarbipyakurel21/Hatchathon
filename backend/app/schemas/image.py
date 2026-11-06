from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from backend.app.schemas.annotation import AnnotationResponse

class ImageBase(BaseModel):
    filename: str
    file_format: str
    file_size_bytes: int
    width: int
    height: int
    channels: int

class ImageResponse(ImageBase):
    id: str
    dataset_id: str
    annotation_count: int = 0
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)

class ImageDetailResponse(ImageResponse):
    annotations: List[AnnotationResponse] = []
