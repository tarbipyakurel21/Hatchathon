import pytest
import numpy as np
import os
import json
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.segmentation.watershed import MicroscopyWatershedModel
from backend.app.services.image_io import ensure_storage_dirs
from backend.app.services.database import init_db

@pytest.fixture(scope="session", autouse=True)
def setup_test_env():
    os.environ["DATA_DIR"] = "/tmp/biolabel_test_data"
    ensure_storage_dirs()
    init_db()

@pytest.fixture
def client():
    return TestClient(app)

def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "hardware" in data
    assert "models" in data

def test_list_models(client):
    response = client.get("/api/models")
    assert response.status_code == 200
    models = response.json()
    assert len(models) >= 1
    ids = [m["id"] for m in models]
    assert "microscopy-watershed" in ids

def test_microscopy_watershed_inference():
    # Test real segmentation model on synthetic cell image
    model = MicroscopyWatershedModel()
    assert model.is_available() is True
    
    # Create synthetic fluorescence cell field (dark background, 4 distinct bright cells)
    h, w = 256, 256
    img = np.zeros((h, w, 3), dtype=np.uint8)
    centers = [(60, 60), (60, 180), (180, 60), (180, 180)]
    for cx, cy in centers:
        cv2 = pytest.importorskip("cv2")
        cv2.circle(img, (cx, cy), 20, (50, 200, 240), -1)

    result = model.predict(img, min_area=10, max_area=50000, threshold=0.4)
    
    assert result["model_id"] == "microscopy-watershed"
    assert result["detected_count"] >= 3  # Should detect the cells
    assert result["inference_time_ms"] > 0
    assert len(result["annotations"]) == result["detected_count"]
    
    first_ann = result["annotations"][0]
    assert "polygon" in first_ann
    assert len(first_ann["polygon"]) >= 3
    assert "bbox" in first_ann
    assert "area" in first_ann
    assert first_ann["area"] > 0

def test_dataset_lifecycle(client):
    # 1. Create dataset
    create_res = client.post("/api/datasets", json={
        "name": "Unit Test Cell Dataset",
        "description": "Dataset for automated integration verification"
    })
    assert create_res.status_code == 201
    dataset = create_res.json()
    dataset_id = dataset["id"]
    assert dataset["name"] == "Unit Test Cell Dataset"

    # 2. Get dataset
    get_res = client.get(f"/api/datasets/{dataset_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == dataset_id

    # 3. List datasets
    list_res = client.get("/api/datasets")
    assert list_res.status_code == 200
    assert any(d["id"] == dataset_id for d in list_res.json())

    # 4. Upload an image to dataset
    # Create simple PNG bytes in-memory
    from PIL import Image
    import io
    test_img = Image.new("RGB", (200, 200), color=(10, 20, 30))
    buf = io.BytesIO()
    test_img.save(buf, format="PNG")
    buf.seek(0)

    upload_res = client.post(
        "/api/images/upload",
        data={"dataset_id": dataset_id},
        files={"files": ("test_cell_sample.png", buf.getvalue(), "image/png")}
    )
    assert upload_res.status_code == 201
    images = upload_res.json()
    assert len(images) == 1
    image_id = images[0]["id"]
    assert images[0]["width"] == 200
    assert images[0]["height"] == 200

    # 5. Segment image
    seg_res = client.post(f"/api/images/{image_id}/segment", json={"model_id": "microscopy-watershed"})
    assert seg_res.status_code == 200
    seg_data = seg_res.json()
    assert seg_data["image_id"] == image_id

    # 6. Save manual annotations (simulate user edits)
    dummy_annotation = {
        "label": "Manual Nucleus 001",
        "category": "nucleus",
        "color": "#8B5CF6",
        "polygon": [[50.0, 50.0], [80.0, 50.0], [80.0, 80.0], [50.0, 80.0]],
        "bbox": [50.0, 50.0, 30.0, 30.0],
        "area": 900.0,
        "is_visible": True,
        "model_name": "manual"
    }
    update_res = client.put(f"/api/images/{image_id}/annotations", json={"annotations": [dummy_annotation]})
    assert update_res.status_code == 200
    updated_anns = update_res.json()
    assert len(updated_anns) == 1
    assert updated_anns[0]["label"] == "Manual Nucleus 001"

    # 7. SAM-style Box Prompt segmentation
    box_res = client.post(
        f"/api/images/{image_id}/segment-box",
        json={"bbox": [10.0, 10.0, 100.0, 100.0], "threshold": 0.4}
    )
    assert box_res.status_code == 200

    # 8. SAM-style Clear All annotations
    clear_res = client.delete(f"/api/images/{image_id}/annotations")
    assert clear_res.status_code == 200
    assert len(clear_res.json()) == 0

    # Re-save dummy annotation for export verification
    client.put(f"/api/images/{image_id}/annotations", json={"annotations": [dummy_annotation]})

    # 9. Export dataset
    export_res = client.post(f"/api/datasets/{dataset_id}/export")
    assert export_res.status_code == 200
    export_data = export_res.json()
    assert export_data["status"] == "success"
    assert "download_url" in export_data

    # 10. Download export zip
    download_res = client.get(export_data["download_url"])
    assert download_res.status_code == 200
    assert download_res.headers["content-type"] == "application/zip"
