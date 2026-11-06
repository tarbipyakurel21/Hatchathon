import os
import shutil
import logging
from typing import Dict, Any, List

from backend.app.services.database import create_dataset, list_datasets, create_image, list_images_for_dataset
from backend.app.services.image_io import save_uploaded_file
from backend.app.services.generate_demo_data import generate_demo_microscopy_images, DEMO_DIR

logger = logging.getLogger("biolabel.demo")

DEMO_DATASET_NAME = "Microscopy Cell Demo Dataset"
DEMO_DATASET_DESC = "Pre-bundled benchmark dataset featuring fluorescence cell nuclei (DAPI), phase-contrast brightfield cell culture, and 16-bit multi-channel tissue TIFF."

def ensure_demo_dataset() -> Dict[str, Any]:
    # Check if demo dataset already exists
    datasets = list_datasets()
    for d in datasets:
        if d["name"] == DEMO_DATASET_NAME:
            images = list_images_for_dataset(d["id"])
            if len(images) > 0:
                return d

    # If demo directory is empty, generate sample images
    if not os.path.exists(DEMO_DIR) or len(os.listdir(DEMO_DIR)) == 0:
        logger.info("Generating realistic microscopy benchmark images...")
        generate_demo_microscopy_images()

    # Create dataset
    logger.info(f"Creating demo dataset: '{DEMO_DATASET_NAME}'")
    dataset = create_dataset(DEMO_DATASET_NAME, DEMO_DATASET_DESC)

    # Ingest images from DEMO_DIR
    demo_files = [f for f in sorted(os.listdir(DEMO_DIR)) if f.lower().endswith((".png", ".jpg", ".jpeg", ".tif", ".tiff"))]
    
    for f in demo_files:
        src_path = os.path.join(DEMO_DIR, f)
        with open(src_path, "rb") as fp:
            file_bytes = fp.read()
        
        file_meta = save_uploaded_file(file_bytes, f)
        create_image(
            dataset_id=dataset["id"],
            filename=file_meta["filename"],
            file_path=file_meta["file_path"],
            thumbnail_path=file_meta["thumbnail_path"],
            file_format=file_meta["file_format"],
            file_size_bytes=file_meta["file_size_bytes"],
            width=file_meta["width"],
            height=file_meta["height"],
            channels=file_meta["channels"]
        )

    return dataset
