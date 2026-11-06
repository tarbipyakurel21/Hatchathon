import os
import platform
import psutil
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.services.database import init_db
from backend.app.services.image_io import ensure_storage_dirs
from backend.app.services.demo_service import ensure_demo_dataset
from backend.app.services.segmentation.registry import registry
from backend.app.api.datasets import router as datasets_router
from backend.app.api.images import router as images_router
from backend.app.api.models import router as models_router
from backend.app.api.benchmark import router as benchmark_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    ensure_storage_dirs()
    init_db()
    try:
        # Pre-seed demo microscopy dataset
        ensure_demo_dataset()
    except Exception as e:
        print(f"Warning: Demo dataset initialization error: {e}")
    yield
    # Shutdown

app = FastAPI(
    title="BioLabel API",
    description="Backend inference & annotation persistence for BioLabel — AI-Powered Biomedical Image Annotation Platform.",
    version="1.0.0",
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
        "service": "BioLabel Backend",
        "version": "1.0.0",
        "platform": platform.platform(),
        "architecture": platform.machine(),
        "python_version": platform.python_version(),
        "hardware": {
            "total_ram_gb": round(mem.total / (1024**3), 2) if mem else "N/A",
            "available_ram_gb": round(mem.available / (1024**3), 2) if mem else "N/A",
            "cpu_count": os.cpu_count(),
            "cpu_inference_concurrency_limit": 1
        },
        "models": [m.id for m in registry.list_models() if m.is_available]
    }

# Register API routes
app.include_router(datasets_router)
app.include_router(images_router)
app.include_router(models_router)
app.include_router(benchmark_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
