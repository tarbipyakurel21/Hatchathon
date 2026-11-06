import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.database import get_video, get_video_tracks_and_annotations

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_projects_crud(client):
    # Create project
    create_res = client.post(
        "/api/projects",
        json={
            "name": "Robotic Cholecystectomy QA",
            "description": "Validation project for laparoscopic cholecystectomy AI models",
            "project_id": "proj_test_001"
        }
    )
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["id"] == "proj_test_001"
    assert data["name"] == "Robotic Cholecystectomy QA"
    assert len(data["label_taxonomy"]) > 0

    # List projects
    list_res = client.get("/api/projects")
    assert list_res.status_code == 200
    projects = list_res.json()
    assert any(p["id"] == "proj_test_001" for p in projects)

    # Get project details
    detail_res = client.get("/api/projects/proj_test_001")
    assert detail_res.status_code == 200
    assert detail_res.json()["name"] == "Robotic Cholecystectomy QA"

    # Update project
    update_res = client.put(
        "/api/projects/proj_test_001",
        json={"name": "Updated Robotic Cholecystectomy QA"}
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Updated Robotic Cholecystectomy QA"

def test_inference_detect_and_segment(client):
    vid_id = "demo_laparoscopy_cholecystectomy"
    video = get_video(vid_id)
    if not video:
        pytest.skip("Demo video not initialized")

    # Detect
    det_res = client.post(
        "/api/inference/detect",
        json={"video_id": vid_id, "frame_idx": 0, "min_confidence": 0.40}
    )
    assert det_res.status_code == 200
    det_data = det_res.json()
    assert det_data["status"] == "success"
    assert "detections" in det_data

    # Segment
    seg_res = client.post(
        "/api/inference/segment",
        json={
            "video_id": vid_id,
            "frame_idx": 0,
            "prompt_type": "box",
            "prompt_data": [50, 50, 100, 100],
            "label": "Laparoscopic Grasper"
        }
    )
    assert seg_res.status_code == 200
    seg_data = seg_res.json()
    assert seg_data["status"] == "success"
    assert len(seg_data["polygon"]) >= 3
    assert seg_data["area"] > 0

def test_review_queue_and_human_action(client):
    vid_id = "demo_laparoscopy_cholecystectomy"
    video = get_video(vid_id)
    if not video:
        pytest.skip("Demo video not initialized")

    # Query review queue
    queue_res = client.get(f"/api/reviews/queue?video_id={vid_id}")
    assert queue_res.status_code == 200
    items = queue_res.json()
    assert isinstance(items, list)

    if items:
        target = items[0]
        ann_id = target["annotation_id"]

        # Human Approval
        appr_res = client.post(
            f"/api/reviews/{ann_id}",
            json={
                "review_action": "approved",
                "reviewer_notes": "Surgical jaw boundary verified by attending surgeon."
            }
        )
        assert appr_res.status_code == 200
        appr_data = appr_res.json()
        assert appr_data["status"] == "success"
        assert appr_data["review"]["review_action"] == "approved"

        # Check history
        hist_res = client.get(f"/api/reviews/history/{vid_id}")
        assert hist_res.status_code == 200
        assert hist_res.json()["review_count"] >= 1

def test_settings_api(client):
    # Get settings
    get_res = client.get("/api/settings")
    assert get_res.status_code == 200
    data = get_res.json()
    assert "uncertainty_weights" in data
    assert "w_temporal" in data["uncertainty_weights"]

    # Update settings
    post_res = client.post(
        "/api/settings",
        json={
            "w_temporal": 0.40,
            "w_detection": 0.20,
            "threshold_high": 0.50,
            "recalculate_existing": False
        }
    )
    assert post_res.status_code == 200
    saved = post_res.json()["uncertainty_weights"]
    assert saved["w_temporal"] == 0.40
    assert saved["w_detection"] == 0.20

    # Reset
    reset_res = client.post("/api/settings/reset")
    assert reset_res.status_code == 200
    assert reset_res.json()["uncertainty_weights"]["w_temporal"] == 0.35

def test_project_export(client):
    # Export project dataset
    exp_res = client.get("/api/export/proj_cholecystectomy?format=surgilabel&scope=all")
    assert exp_res.status_code == 200
    exp_data = exp_res.json()
    assert exp_data["status"] == "success"
    assert "download_url" in exp_data
    assert exp_data["format"] == "surgilabel"
