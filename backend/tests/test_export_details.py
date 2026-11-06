import os
import io
import json
import zipfile
import pytest
import numpy as np
import cv2
from PIL import Image

from backend.app.services.database import (
    create_dataset,
    create_image,
    save_annotations_for_image,
    init_db
)
from backend.app.services.export_service import export_dataset_zip
from backend.app.services.image_io import ensure_storage_dirs

@pytest.fixture(scope="session", autouse=True)
def setup_dirs():
    os.environ["DATA_DIR"] = "/tmp/biolabel_test_export_details"
    ensure_storage_dirs()
    init_db()

def test_export_coco_structure_and_masks():
    # 1. Create dataset
    dataset = create_dataset("COCO Export Detailed Test", "Detailed verification of COCO schema")
    d_id = dataset["id"]

    # 2. Create sample image
    w, h = 200, 200
    img_path = "/tmp/test_export_img.png"
    Image.new("RGB", (w, h), color=(20, 30, 40)).save(img_path)

    img_rec = create_image(
        dataset_id=d_id,
        filename="cell_field_01.png",
        file_path=img_path,
        thumbnail_path=None,
        file_format="png",
        file_size_bytes=os.path.getsize(img_path),
        width=w,
        height=h,
        channels=3
    )

    # 3. Add 2 annotations (triangle and square)
    ann1 = {
        "label": "Cell 001",
        "category": "cell",
        "color": "#06B6D4",
        "polygon": [[20.0, 20.0], [50.0, 20.0], [35.0, 50.0]],
        "bbox": [20.0, 20.0, 30.0, 30.0],
        "area": 450.0,
        "is_visible": True,
        "model_name": "watershed"
    }
    ann2 = {
        "label": "Cell 002",
        "category": "nucleus",
        "color": "#8B5CF6",
        "polygon": [[100.0, 100.0], [140.0, 100.0], [140.0, 140.0], [100.0, 140.0]],
        "bbox": [100.0, 100.0, 40.0, 40.0],
        "area": 1600.0,
        "is_visible": True,
        "model_name": "fastsam-s"
    }
    save_annotations_for_image(img_rec["id"], [ann1, ann2])

    # 4. Generate export zip
    zip_path = export_dataset_zip(d_id)
    assert os.path.exists(zip_path)
    assert zip_path.endswith(".zip")

    # 5. Inspect zip contents
    with zipfile.ZipFile(zip_path, "r") as zf:
        namelist = zf.namelist()
        
        # Verify required directories and files
        assert "biolabel-dataset/metadata.json" in namelist
        assert "biolabel-dataset/annotations/annotations.json" in namelist
        assert "biolabel-dataset/images/image_001.png" in namelist
        assert "biolabel-dataset/masks/image_001.png" in namelist

        # Verify metadata.json
        meta_bytes = zf.read("biolabel-dataset/metadata.json")
        meta = json.loads(meta_bytes.decode("utf-8"))
        assert meta["dataset_name"] == "COCO Export Detailed Test"
        assert meta["total_images"] == 1
        assert meta["total_annotations"] == 2
        assert "COCO" in meta["format"]

        # Verify COCO annotations.json
        coco_bytes = zf.read("biolabel-dataset/annotations/annotations.json")
        coco = json.loads(coco_bytes.decode("utf-8"))
        
        # Check standard COCO keys
        assert "info" in coco
        assert "licenses" in coco
        assert "images" in coco
        assert "annotations" in coco
        assert "categories" in coco

        assert len(coco["images"]) == 1
        assert coco["images"][0]["file_name"] == "image_001.png"
        assert coco["images"][0]["width"] == 200
        assert coco["images"][0]["height"] == 200

        assert len(coco["annotations"]) == 2
        for ann in coco["annotations"]:
            assert "id" in ann
            assert "image_id" in ann
            assert "category_id" in ann
            assert "segmentation" in ann
            assert len(ann["segmentation"]) == 1
            # Check flattened segmentation coordinates length >= 6
            assert len(ann["segmentation"][0]) >= 6
            assert "area" in ann
            assert ann["area"] > 0
            assert "bbox" in ann
            assert len(ann["bbox"]) == 4

        # Verify instance mask integrity (16-bit integer IDs)
        mask_bytes = zf.read("biolabel-dataset/masks/image_001.png")
        mask_arr = cv2.imdecode(np.frombuffer(mask_bytes, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
        
        # Cell 1 should have pixel ID 1
        # Inside triangle point (35, 30)
        assert mask_arr[30, 35] == 1
        # Cell 2 should have pixel ID 2
        # Inside square point (120, 120)
        assert mask_arr[120, 120] == 2
        # Background pixel (0, 0)
        assert mask_arr[0, 0] == 0
