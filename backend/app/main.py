import os
import platform
import psutil
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.services.database import (
    init_db,
    get_project,
    create_project,
    get_video,
    save_video_tracks_and_annotations
)
from backend.app.services.image_io import ensure_storage_dirs
from backend.app.services.video_io import ensure_video_storage_dirs, VIDEOS_DIR, generate_real_surgical_demo, probe_video
from backend.app.services.demo_service import ensure_demo_dataset
from backend.app.services.segmentation.registry import registry
from backend.app.services.uncertainty_service import recalculate_video_uncertainty

from backend.app.api.datasets import router as datasets_router
from backend.app.api.images import router as images_router
from backend.app.api.models import router as models_router
from backend.app.api.benchmark import router as benchmark_router
from backend.app.api.videos import router as videos_router
from backend.app.api.projects import router as projects_router
from backend.app.api.inference import router as inference_router
from backend.app.api.reviews import router as reviews_router
from backend.app.api.settings import router as settings_router
from backend.app.api.annotations import router as annotations_router
from backend.app.api.export import router as export_router

def ensure_demo_surgilabel_project():
    """Ensure baseline surgical project and authentic video dataset with uncertainty records are seeded."""
    pid = "proj_cholecystectomy"
    existing = get_project(pid)
    if not existing:
        create_project(
            name="Laparoscopic Cholecystectomy Video Dataset",
            description="Clinical human laparoscopic cholecystectomy for surgical instrument detection, phase segmentation, and AI uncertainty review.",
            project_id=pid
        )

    # Check demo video
    vid_id = "demo_laparoscopy_cholecystectomy"
    vid = get_video(vid_id)
    real_video_path = os.path.join(VIDEOS_DIR, "real_laparoscopy_cholecystectomy.mp4")

    if os.path.exists(real_video_path):
        from backend.app.services.database import create_video
        meta = probe_video(real_video_path)
        if not vid or vid.get("project_id") != pid:
            create_video(
                filename="Human Laparoscopic Cholecystectomy (Clinical Surgery)",
                file_path=real_video_path,
                thumbnail_path=None,
                duration_seconds=meta["duration_seconds"],
                fps=meta["fps"],
                total_frames=meta["total_frames"],
                width=meta["width"],
                height=meta["height"],
                file_size_bytes=meta["file_size_bytes"],
                video_id=vid_id,
                project_id=pid
            )
            _, tracks, annotations = generate_real_surgical_demo(real_video_path)
            save_video_tracks_and_annotations(vid_id, tracks, annotations)
            try:
                recalculate_video_uncertainty(vid_id)
            except Exception as e:
                print(f"Demo uncertainty initialization notice: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    ensure_storage_dirs()
    ensure_video_storage_dirs()
    init_db()
    try:
        ensure_demo_dataset()
    except Exception as e:
        print(f"Warning: Demo dataset initialization error: {e}")

    try:
        ensure_demo_surgilabel_project()
    except Exception as e:
        print(f"Warning: SurgiLabel demo initialization error: {e}")

    yield
    # Shutdown

app = FastAPI(
    title="SurgiLabel & BioLabel Unified API",
    description="Backend AI inference, temporal tracking, and uncertainty-aware human review for Surgical Videos & Biomedical Imagery.",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoint
@app.get("/api/health", tags=["System"])
async def health_check():
    """System health check and hardware diagnostic status."""
    mem = psutil.virtual_memory() if hasattr(psutil, "virtual_memory") else None
    
    return {
        "status": "healthy",
        "service": "SurgiLabel & BioLabel Backend",
        "version": "2.0.0",
        "platform": platform.platform(),
        "architecture": platform.machine(),
        "python_version": platform.python_version(),
        "hardware": {
            "total_ram_gb": round(mem.total / (1024**3), 2) if mem else "N/A",
            "available_ram_gb": round(mem.available / (1024**3), 2) if mem else "N/A",
            "cpu_count": os.cpu_count(),
            "cpu_inference_concurrency_limit": 1
        },
        "models": [m.id for m in registry.list_models() if m.is_available] + ["Surgical Saliency Detector", "SAM 2 Tiny", "Farneback Flow"]
    }

# Register API routes
app.include_router(projects_router)
app.include_router(inference_router)
app.include_router(reviews_router)
app.include_router(settings_router)
app.include_router(annotations_router)
app.include_router(export_router)
app.include_router(videos_router)
app.include_router(datasets_router)
app.include_router(images_router)
app.include_router(models_router)
app.include_router(benchmark_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
