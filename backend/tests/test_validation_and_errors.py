import pytest
import os
import io
from PIL import Image
from fastapi.testclient import TestClient
from backend.app.main import app
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

def test_get_nonexistent_dataset_404(client):
    res = client.get("/api/datasets/nonexistent-id-12345")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()

def test_get_nonexistent_image_404(client):
    res = client.get("/api/images/nonexistent-image-12345")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()

def test_get_nonexistent_image_file_404(client):
    res = client.get("/api/images/nonexistent-image-12345/file")
    assert res.status_code == 404

def test_upload_to_nonexistent_dataset_404(client):
    buf = io.BytesIO(b"fake image data")
    res = client.post(
        "/api/images/upload",
        data={"dataset_id": "nonexistent-dataset-id"},
        files={"files": ("test.png", buf.getvalue(), "image/png")}
    )
    assert res.status_code == 404

def test_upload_invalid_file_extension_400(client):
    # First create a valid dataset
    create_res = client.post("/api/datasets", json={"name": "Upload Test Dataset"})
    assert create_res.status_code == 201
    dataset_id = create_res.json()["id"]

    # Try uploading a .exe or .txt file
    res = client.post(
        "/api/images/upload",
        data={"dataset_id": dataset_id},
        files={"files": ("script.sh", b"#!/bin/bash\necho test", "text/plain")}
    )
    assert res.status_code == 400
    assert "unsupported" in res.json()["detail"].lower()

def test_upload_corrupt_image_400(client):
    create_res = client.post("/api/datasets", json={"name": "Corrupt Image Test"})
    dataset_id = create_res.json()["id"]

    res = client.post(
        "/api/images/upload",
        data={"dataset_id": dataset_id},
        files={"files": ("broken.png", b"not-a-png-header-content", "image/png")}
    )
    assert res.status_code == 400
    assert "corrupted" in res.json()["detail"].lower() or "invalid" in res.json()["detail"].lower()

def test_export_nonexistent_dataset_404(client):
    res = client.post("/api/datasets/nonexistent-id-export/export")
    assert res.status_code == 404

def test_download_nonexistent_export_file_404(client):
    res = client.get("/api/datasets/export/download/nonexistent_archive_123.zip")
    assert res.status_code == 404

def test_delete_image_success_and_subsequent_404(client):
    # 1. Create dataset and upload image
    d_res = client.post("/api/datasets", json={"name": "Delete Image Dataset"})
    d_id = d_res.json()["id"]

    img = Image.new("RGB", (100, 100), color=(50, 60, 70))
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    up_res = client.post(
        "/api/images/upload",
        data={"dataset_id": d_id},
        files={"files": ("to_delete.png", buf.getvalue(), "image/png")}
    )
    assert up_res.status_code == 201
    img_id = up_res.json()[0]["id"]

    # 2. Delete it
    del_res = client.delete(f"/api/images/{img_id}")
    assert del_res.status_code == 200

    # 3. Subsequent GET must return 404
    get_res = client.get(f"/api/images/{img_id}")
    assert get_res.status_code == 404
