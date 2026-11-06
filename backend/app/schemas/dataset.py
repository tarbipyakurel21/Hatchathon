from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class DatasetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)

class DatasetCreate(DatasetBase):
    pass

class DatasetResponse(DatasetBase):
    id: str
    image_count: int = 0
    annotation_count: int = 0
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)
