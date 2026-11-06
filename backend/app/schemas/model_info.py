from pydantic import BaseModel
from typing import Dict, Any, List

class ModelInfo(BaseModel):
    id: str
    name: str
    display_name: str
    description: str
    architecture: str
    is_available: bool
    is_microscopy_specialized: bool
    parameters: Dict[str, Any] = {}
    speed_rating: str  # "Fast (~30ms)", "Moderate (~800ms)", etc.
    recommended_for: List[str]
