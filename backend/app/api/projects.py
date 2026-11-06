import uuid
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from backend.app.services.database import (
    create_project,
    get_project,
    list_projects,
    update_project,
    delete_project,
    list_videos,
)

router = APIRouter(prefix="/api/projects", tags=["SurgiLabel Projects"])

class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = Field(default="")
    label_taxonomy: Optional[List[Dict[str, Any]]] = Field(default=None)
    project_id: Optional[str] = Field(default=None)

class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    label_taxonomy: Optional[List[Dict[str, Any]]] = None

@router.get("", response_model=List[Dict[str, Any]])
async def get_all_projects():
    """List all surgical video projects with summary metrics."""
    return list_projects()

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_new_project(req: ProjectCreateRequest):
    """Create a new surgical annotation project with taxonomy."""
    pid = req.project_id or f"proj_{uuid.uuid4().hex[:8]}"
    project = create_project(
        name=req.name,
        description=req.description,
        label_taxonomy=req.label_taxonomy,
        project_id=pid
    )
    return project

@router.get("/{project_id}")
async def get_project_details(project_id: str):
    """Retrieve project details, taxonomy, and associated videos."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    videos = list_videos(project_id=project_id)
    project["videos"] = videos
    return project

@router.put("/{project_id}")
async def update_project_details(project_id: str, req: ProjectUpdateRequest):
    """Update project metadata or taxonomy."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    updates = req.model_dump(exclude_unset=True)
    updated = update_project(project_id, updates)
    return updated

@router.delete("/{project_id}")
async def remove_project(project_id: str):
    """Delete a surgical project and unbind its videos."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    deleted = delete_project(project_id)
    return {"status": "success", "deleted": deleted}
