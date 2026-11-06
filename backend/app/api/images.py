import os
import io
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import FileResponse, Response
from typing import List, Optional
from PIL import Image

from backend.app.schemas.image import ImageResponse, ImageDetailResponse
from backend.app.schemas.annotation import AnnotationResponse, AnnotationBatchUpdate
from backend.app.schemas.segmentation import SegmentationRequest, SegmentationResponse
from backend.app.services.database import (
    create_image,
    get_image,
    delete_image,
    get_annotations_for_image,
    save_annotations_for_image,
    get_dataset
)
from backend.app.services.image_io import (
    save_uploaded_file,
    load_image_rgb,
    UPLOADS_DIR,
    THUMBNAILS_DIR
)
from backend.app.services.segmentation.registry import registry

router = APIRouter(prefix="/api/images", tags=["Images"])

@router.post("/upload", response_model=List[ImageResponse], status_code=201)
async def upload_images(
    dataset_id: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """
    Upload one or more microscopy images (PNG, JPG, TIFF) to a dataset.
    Validates file format, size, and dimensions, and generates gallery thumbnails.
    """
    dataset = get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    created_images = []
    errors = []

    for file in files:
        try:
            content = await file.read()
            file_meta = save_uploaded_file(content, file.filename)
            img_rec = create_image(
                dataset_id=dataset_id,
                filename=file_meta["filename"],
                file_path=file_meta["file_path"],
                thumbnail_path=file_meta["thumbnail_path"],
                file_format=file_meta["file_format"],
                file_size_bytes=file_meta["file_size_bytes"],
                width=file_meta["width"],
                height=file_meta["height"],
                channels=file_meta["channels"]
            )
            created_images.append(img_rec)
        except ValueError as ve:
            errors.append(f"{file.filename}: {str(ve)}")
        except Exception as e:
            errors.append(f"{file.filename}: unexpected error {str(e)}")

    if not created_images and errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    return created_images

@router.get("/{id}", response_model=ImageDetailResponse)
async def get_image_details(id: str):
    """Retrieve metadata and annotations for an image."""
    img = get_image(id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
        
    annotations = get_annotations_for_image(id)
    return {**img, "annotations": annotations}

@router.delete("/{id}")
async def remove_image(id: str):
    """Delete an image and its associated annotations."""
    img = get_image(id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
        
    # Remove files
    if os.path.exists(img["file_path"]):
        os.remove(img["file_path"])
    if img.get("thumbnail_path") and os.path.exists(img["thumbnail_path"]):
        os.remove(img["thumbnail_path"])

    delete_image(id)
    return {"status": "success", "message": "Image deleted"}

@router.get("/{id}/file")
async def get_image_file(id: str):
    """
    Serve image binary. Normalizes TIFF / 16-bit to standard PNG format for browser canvas.
    """
    img = get_image(id)
    if not img or not os.path.exists(img["file_path"]):
        raise HTTPException(status_code=404, detail="Image file not found")

    ext = img["file_format"].lower()
    
    # Direct pass-through for standard browser formats
    if ext in ["png", "jpg", "jpeg", "webp"]:
        media_type = "image/png" if ext == "png" else "image/jpeg"
        return FileResponse(img["file_path"], media_type=media_type)

    # For TIFF or other non-standard formats, convert to PNG stream on the fly
    try:
        rgb = load_image_rgb(img["file_path"])
        pil_img = Image.fromarray(rgb)
        buf = io.BytesIO()
        pil_img.save(buf, format="PNG")
        return Response(content=buf.getvalue(), media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render image: {str(e)}")

@router.get("/{id}/thumbnail")
async def get_image_thumbnail(id: str):
    """Serve thumbnail image for dataset gallery."""
    img = get_image(id)
    if not img or not img.get("thumbnail_path") or not os.path.exists(img["thumbnail_path"]):
        # Fallback to full file
        return await get_image_file(id)

    return FileResponse(img["thumbnail_path"], media_type="image/png")

@router.post("/{id}/segment", response_model=SegmentationResponse)
async def segment_image(id: str, req: SegmentationRequest = SegmentationRequest()):
    """
    Run real AI segmentation inference on the image.
    Uses CPU-only inference with concurrency protection (1 job at a time).
    Automatically saves generated masks and returns annotation objects with timing.
    """
    img = get_image(id)
    if not img or not os.path.exists(img["file_path"]):
        raise HTTPException(status_code=404, detail="Image not found")

    # Select model
    model = registry.get_model(req.model_id)

    # Acquire concurrency lock to protect CPU & memory
    async with registry.semaphore:
        try:
            # Load image array
            img_rgb = load_image_rgb(img["file_path"])

            # Run inference
            result = model.predict(
                img_rgb,
                min_area=req.min_area,
                max_area=req.max_area,
                threshold=req.threshold
            )

            # Persist newly generated annotations in the database
            saved_annotations = save_annotations_for_image(id, result["annotations"])

            return {
                "image_id": id,
                "model_id": result["model_id"],
                "model_name": result["model_name"],
                "detected_count": result["detected_count"],
                "inference_time_ms": result["inference_time_ms"],
                "annotations": saved_annotations,
                "metadata": result.get("metadata", {})
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Segmentation failed: {str(e)}")

@router.get("/{id}/annotations", response_model=List[AnnotationResponse])
async def get_annotations(id: str):
    """Retrieve currently stored annotations for an image."""
    img = get_image(id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    return get_annotations_for_image(id)

@router.put("/{id}/annotations", response_model=List[AnnotationResponse])
async def update_annotations(id: str, payload: AnnotationBatchUpdate):
    """
    Save / update the annotations for an image after user editing.
    Replaces existing annotations with the validated updated set.
    """
    img = get_image(id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    dict_annotations = [ann.model_dump() for ann in payload.annotations]
    return save_annotations_for_image(id, dict_annotations)
