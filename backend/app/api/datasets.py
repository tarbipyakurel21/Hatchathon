import os
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from typing import List

from backend.app.schemas.dataset import DatasetCreate, DatasetResponse
from backend.app.schemas.image import ImageResponse
from backend.app.services.database import create_dataset, list_datasets, get_dataset, list_images_for_dataset
from backend.app.services.export_service import export_dataset_zip
from backend.app.services.demo_service import ensure_demo_dataset
from backend.app.services.image_io import EXPORTS_DIR

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])

@router.get("", response_model=List[DatasetResponse])
async def get_all_datasets():
    """Retrieve all datasets with image and annotation counts."""
    return list_datasets()

@router.post("", response_model=DatasetResponse, status_code=201)
async def create_new_dataset(dataset_in: DatasetCreate):
    """Create a new dataset collection."""
    return create_dataset(dataset_in.name, dataset_in.description)

@router.get("/{id}", response_model=DatasetResponse)
async def get_dataset_by_id(id: str):
    """Retrieve details of a single dataset."""
    dataset = get_dataset(id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset

@router.get("/{id}/images", response_model=List[ImageResponse])
async def get_dataset_images(id: str):
    """Retrieve all images belonging to a dataset."""
    dataset = get_dataset(id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return list_images_for_dataset(id)

@router.post("/{id}/export")
async def export_dataset(id: str):
    """
    Export the dataset as an AI-ready ZIP package with:
    - images/
    - masks/ (16-bit integer instance segmentation masks)
    - annotations/ (COCO instance annotations JSON)
    - metadata.json
    """
    dataset = get_dataset(id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        zip_path = export_dataset_zip(id)
        filename = os.path.basename(zip_path)
        return {
            "status": "success",
            "message": "Dataset exported successfully",
            "filename": filename,
            "download_url": f"/api/datasets/export/download/{filename}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@router.get("/export/download/{filename}")
async def download_export(filename: str):
    """Download an exported dataset ZIP archive."""
    # Sanitize filename
    clean_name = os.path.basename(filename)
    file_path = os.path.join(EXPORTS_DIR, clean_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Export file not found or expired")
        
    return FileResponse(
        path=file_path,
        media_type="application/zip",
        filename=clean_name
    )
