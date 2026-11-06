import pytest
import io
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def create_synthetic_cell_image_bytes():
    """Create a synthetic microscopy image with 3 distinct circular cells."""
    arr = np.zeros((200, 200, 3), dtype=np.uint8)
    yy, xx = np.mgrid[:200, :200]

    # Cell 1 at (50, 50)
    c1 = (xx - 50) ** 2 + (yy - 50) ** 2 < 20 ** 2
    arr[c1] = [200, 220, 255]

    # Cell 2 at (150, 50)
    c2 = (xx - 150) ** 2 + (yy - 50) ** 2 < 18 ** 2
    arr[c2] = [210, 230, 255]

    # Cell 3 at (100, 150)
    c3 = (xx - 100) ** 2 + (yy - 150) ** 2 < 25 ** 2
    arr[c3] = [220, 240, 255]

    img = Image.fromarray(arr)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()


@pytest.fixture
def setup_test_image():
    # 1. Create Dataset
    ds_res = client.post("/api/datasets", json={"name": "Interactive Test Dataset"})
    assert ds_res.status_code == 201
    dataset_id = ds_res.json()["id"]

    # 2. Upload Image
    img_bytes = create_synthetic_cell_image_bytes()
    upload_res = client.post(
        "/api/images/upload",
        data={"dataset_id": dataset_id},
        files={"files": ("interactive_cells.png", img_bytes, "image/png")},
    )
    assert upload_res.status_code == 201
    image_id = upload_res.json()[0]["id"]

    return {"dataset_id": dataset_id, "image_id": image_id}


def test_segment_box_prompt(setup_test_image):
    image_id = setup_test_image["image_id"]

    # Run box prompt around cell 1: bbox [25, 25, 50, 50]
    res = client.post(
        f"/api/images/{image_id}/segment-box",
        json={
            "bbox": [25, 25, 50, 50],
            "model_id": "microscopy-watershed",
            "threshold": 0.3,
            "min_area": 10,
        },
    )
    assert res.status_code == 200
    annotations = res.json()
    assert isinstance(annotations, list)
    assert len(annotations) >= 1

    ann = annotations[0]
    assert "polygon" in ann
    assert len(ann["polygon"]) >= 3
    assert "area" in ann
    assert ann["area"] > 50
    assert "bbox" in ann


def test_update_and_fetch_annotations(setup_test_image):
    image_id = setup_test_image["image_id"]

    # 1. Set custom edited annotations
    custom_anns = [
        {
            "id": "cell_custom_001",
            "image_id": image_id,
            "label": "Macrophage A",
            "category": "cell",
            "color": "#06B6D4",
            "polygon": [[10, 10], [30, 10], [30, 30], [10, 30]],
            "bbox": [10, 10, 20, 20],
            "area": 400.0,
            "is_visible": True,
            "model_name": "manual",
        },
        {
            "id": "cell_custom_002",
            "image_id": image_id,
            "label": "Lymphocyte B",
            "category": "cell",
            "color": "#8B5CF6",
            "polygon": [[50, 50], [70, 50], [70, 70], [50, 70]],
            "bbox": [50, 50, 20, 20],
            "area": 400.0,
            "is_visible": False,
            "model_name": "manual",
        },
    ]

    put_res = client.put(
        f"/api/images/{image_id}/annotations",
        json={"annotations": custom_anns},
    )
    assert put_res.status_code == 200
    saved = put_res.json()
    assert len(saved) == 2

    # 2. Fetch annotations
    get_res = client.get(f"/api/images/{image_id}/annotations")
    assert get_res.status_code == 200
    fetched = get_res.json()
    assert len(fetched) == 2
    assert fetched[0]["label"] == "Macrophage A"
    assert fetched[0]["is_visible"] is True
    assert fetched[1]["label"] == "Lymphocyte B"
    assert fetched[1]["is_visible"] is False


def test_clear_all_annotations(setup_test_image):
    image_id = setup_test_image["image_id"]

    # 1. Put an annotation first
    client.put(
        f"/api/images/{image_id}/annotations",
        json={
            "annotations": [
                {
                    "id": "to_be_cleared",
                    "label": "Cell to clear",
                    "category": "cell",
                    "color": "#10B981",
                    "polygon": [[5, 5], [15, 5], [15, 15], [5, 15]],
                    "bbox": [5, 5, 10, 10],
                    "area": 100.0,
                    "is_visible": True,
                }
            ]
        },
    )

    # 2. Call DELETE /api/images/{id}/annotations
    del_res = client.delete(f"/api/images/{image_id}/annotations")
    assert del_res.status_code == 200
    assert del_res.json() == []

    # 3. Verify it is now empty
    get_res = client.get(f"/api/images/{image_id}/annotations")
    assert get_res.status_code == 200
    assert get_res.json() == []
