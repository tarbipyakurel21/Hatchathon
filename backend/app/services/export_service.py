import os
import zipfile
import json
import shutil
import uuid
from typing import Dict, Any, List
import numpy as np
import cv2
from PIL import Image

from backend.app.services.database import get_dataset, list_images_for_dataset, get_annotations_for_image, now_iso
from backend.app.services.image_io import load_image_rgb, EXPORTS_DIR

def render_instance_mask(width: int, height: int, annotations: List[Dict[str, Any]]) -> np.ndarray:
    """
    Renders an integer instance mask where pixel value = instance integer ID (1, 2, ...).
    Returns 16-bit unsigned integer array for up to 65,535 distinct cell instances.
    """
    mask = np.zeros((height, width), dtype=np.uint16)
    
    for idx, ann in enumerate(annotations, start=1):
        if not ann.get("is_visible", True):
            continue
        poly = ann.get("polygon", [])
        if len(poly) >= 3:
            pts = np.array(poly, dtype=np.int32).reshape((-1, 1, 2))
            cv2.fillPoly(mask, [pts], idx)
            
    return mask

def export_dataset_zip(dataset_id: str) -> str:
    dataset = get_dataset(dataset_id)
    if not dataset:
        raise ValueError(f"Dataset '{dataset_id}' not found.")

    images = list_images_for_dataset(dataset_id)

    # Prepare temporary staging directory
    export_id = str(uuid.uuid4())
    temp_dir = os.path.join(EXPORTS_DIR, f"temp_{export_id}")
    dataset_folder = os.path.join(temp_dir, "biolabel-dataset")
    
    images_dir = os.path.join(dataset_folder, "images")
    masks_dir = os.path.join(dataset_folder, "masks")
    annotations_dir = os.path.join(dataset_folder, "annotations")
    
    for d in [images_dir, masks_dir, annotations_dir]:
        os.makedirs(d, exist_ok=True)

    coco_images = []
    coco_annotations = []
    ann_global_id = 1
    total_annotations_count = 0

    categories = [
        {"id": 1, "name": "cell", "supercategory": "biomedical_object"},
        {"id": 2, "name": "nucleus", "supercategory": "biomedical_object"}
    ]
    category_map = {"cell": 1, "nucleus": 2}

    for img_idx, img_rec in enumerate(images, start=1):
        clean_img_name = f"image_{img_idx:03d}.png"
        raw_img_path = img_rec["file_path"]
        
        # 1. Copy / Convert Image to images/ folder
        try:
            img_rgb = load_image_rgb(raw_img_path)
            out_img_path = os.path.join(images_dir, clean_img_name)
            Image.fromarray(img_rgb).save(out_img_path)
            h, w = img_rgb.shape[:2]
        except Exception:
            # Fallback direct copy
            h, w = img_rec["height"], img_rec["width"]
            out_img_path = os.path.join(images_dir, clean_img_name)
            shutil.copy2(raw_img_path, out_img_path)

        # 2. Add to COCO images
        coco_images.append({
            "id": img_idx,
            "file_name": clean_img_name,
            "width": w,
            "height": h,
            "original_filename": img_rec["filename"],
            "date_captured": img_rec["created_at"]
        })

        # 3. Retrieve annotations
        annotations = get_annotations_for_image(img_rec["id"])
        total_annotations_count += len(annotations)

        # 4. Render and save instance mask to masks/ folder
        mask_np = render_instance_mask(w, h, annotations)
        mask_path = os.path.join(masks_dir, clean_img_name)
        # Save as 16-bit PNG preserving integer IDs
        cv2.imwrite(mask_path, mask_np)

        # 5. Build COCO annotation objects
        for ann in annotations:
            poly = ann.get("polygon", [])
            bbox = ann.get("bbox", [0, 0, 0, 0])
            area = ann.get("area", 0.0)
            cat_name = ann.get("category", "cell").lower()
            cat_id = category_map.get(cat_name, 1)

            # Flatten polygon to [x1, y1, x2, y2, ...]
            flattened_poly = [coord for pt in poly for coord in pt]

            coco_annotations.append({
                "id": ann_global_id,
                "image_id": img_idx,
                "category_id": cat_id,
                "segmentation": [flattened_poly] if len(flattened_poly) >= 6 else [],
                "area": area,
                "bbox": bbox,
                "iscrowd": 0,
                "attributes": {
                    "label": ann.get("label", ""),
                    "color": ann.get("color", ""),
                    "model_name": ann.get("model_name", "manual")
                }
            })
            ann_global_id += 1

    # 6. Write COCO annotations.json
    coco_data = {
        "info": {
            "description": f"BioLabel Annotations for '{dataset['name']}'",
            "version": "1.0",
            "year": 2026,
            "contributor": "BioLabel AI Platform",
            "date_created": now_iso()
        },
        "licenses": [
            {
                "id": 1,
                "name": "Creative Commons Attribution 4.0",
                "url": "https://creativecommons.org/licenses/by/4.0/"
            }
        ],
        "images": coco_images,
        "annotations": coco_annotations,
        "categories": categories
    }

    with open(os.path.join(annotations_dir, "annotations.json"), "w") as f:
        json.dump(coco_data, f, indent=2)

    # 7. Write metadata.json
    metadata = {
        "dataset_id": dataset["id"],
        "dataset_name": dataset["name"],
        "description": dataset.get("description", ""),
        "total_images": len(images),
        "total_annotations": total_annotations_count,
        "export_date": now_iso(),
        "exported_by": "BioLabel — AI-Powered Biomedical Image Annotation Platform",
        "tagline": "From Microscopy Images to AI-Ready Datasets in Minutes",
        "format": "COCO Instance Segmentation & 16-bit Integer Label Masks"
    }

    with open(os.path.join(dataset_folder, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    # 8. Create ZIP archive
    safe_name = "".join(c for c in dataset["name"] if c.isalnum() or c in "-_").strip() or "dataset"
    zip_filename = f"biolabel_{safe_name}_{export_id[:8]}.zip"
    zip_path = os.path.join(EXPORTS_DIR, zip_filename)

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(dataset_folder):
            for file in files:
                abs_file = os.path.join(root, file)
                rel_path = os.path.relpath(abs_file, temp_dir)
                zipf.write(abs_file, rel_path)

    # Clean up staging directory
    shutil.rmtree(temp_dir, ignore_errors=True)

    return zip_path
