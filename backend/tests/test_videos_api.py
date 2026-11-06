import pytest
import os
from fastapi.testclient import TestClient

from backend.app.services.database import init_db
from backend.app.main import app

# Ensure tables exist
init_db()
client = TestClient(app)

def test_load_demo_surgical_video():
    """Verify loading laparoscopic surgical demo video with pre-tracked masks."""
    res = client.post("/api/videos/demo/load")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "video" in data
    video = data["video"]
    assert video["id"] == "demo_laparoscopy_cholecystectomy"
    assert video["width"] == 640
    assert video["height"] in [360, 480]
    assert video["fps"] in [25.0, 30.0]
    assert video["total_frames"] in [90, 120]
    assert data["track_count"] >= 3
    assert data["annotation_count"] > 100

def test_get_video_tracks_and_annotations():
    """Verify retrieving frame-by-frame tracked annotations for video."""
    video_id = "demo_laparoscopy_cholecystectomy"
    res = client.get(f"/api/videos/{video_id}/tracks")
    assert res.status_code == 200
    data = res.json()
    assert data["video_id"] == video_id
    assert len(data["tracks"]) >= 3
    assert len(data["annotations"]) >= 90

    first_ann = data["annotations"][0]
    assert "polygon" in first_ann
    assert len(first_ann["polygon"]) >= 3
    assert "bbox" in first_ann
    assert "frame_idx" in first_ann
    assert "track_id" in first_ann

def test_track_prompt_propagation():
    """Verify SAM 2 Tiny point prompt and temporal mask propagation."""
    video_id = "demo_laparoscopy_cholecystectomy"
    res = client.post(
        f"/api/videos/{video_id}/track-prompt",
        json={
            "keyframe_idx": 10,
            "prompt_type": "point",
            "prompt_data": [310, 190],
            "label": "Prompted Tissue Margin",
            "category": "tissue",
            "color": "#A855F7"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["tracked_frames_count"] > 10
    assert data["track"]["label"] == "Prompted Tissue Margin"
    assert "fps_speed" in data

def test_export_video_dataset_zip():
    """Verify exporting Video-COCO and frame masks as downloadable ZIP."""
    video_id = "demo_laparoscopy_cholecystectomy"
    res = client.post(f"/api/videos/{video_id}/export")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "filename" in data
    assert data["filename"].endswith(".zip")
    assert "download_url" in data

    # Test download
    dl_res = client.get(data["download_url"])
    assert dl_res.status_code == 200
    assert dl_res.headers.get("content-type") == "application/zip"
    assert len(dl_res.content) > 1000

def test_delete_track():
    """Verify deleting a specific track."""
    video_id = "demo_laparoscopy_cholecystectomy"
    res = client.delete(f"/api/videos/{video_id}/tracks/999")
    assert res.status_code == 200
