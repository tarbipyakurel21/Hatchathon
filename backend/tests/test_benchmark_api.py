import pytest
import os
import io
from PIL import Image
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.image_io import ensure_storage_dirs
from backend.app.services.database import init_db

@pytest.fixture(scope="session", autouse=True)
def setup_dirs():
    os.environ["DATA_DIR"] = "/tmp/biolabel_test_benchmark"
    ensure_storage_dirs()
    init_db()

@pytest.fixture
def client():
    return TestClient(app)

def test_benchmark_api_execution(client):
    # 1. Create dataset and upload image
    d_res = client.post("/api/datasets", json={"name": "Benchmark Test Dataset"})
    assert d_res.status_code == 201
    d_id = d_res.json()["id"]

    img = Image.new("RGB", (150, 150), color=(10, 20, 30))
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    up_res = client.post(
        "/api/images/upload",
        data={"dataset_id": d_id},
        files={"files": ("bench_sample.png", buf.getvalue(), "image/png")}
    )
    assert up_res.status_code == 201
    img_id = up_res.json()[0]["id"]

    # 2. Run benchmark
    bench_res = client.post("/api/benchmark", json={"image_id": img_id})
    assert bench_res.status_code == 200
    data = bench_res.json()

    assert data["image_id"] == img_id
    assert "results" in data
    assert len(data["results"]) >= 1
    assert "recommendation" in data
    assert len(data["recommendation"]) > 0

    first_result = data["results"][0]
    assert "model_id" in first_result
    assert "model_name" in first_result
    assert "inference_time_ms" in first_result
    assert "detected_count" in first_result

def test_demo_load_endpoint(client):
    res = client.post("/api/demo/load")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "dataset" in data
    assert "images" in data
    assert len(data["images"]) >= 3
    assert data["first_image_id"] is not None
