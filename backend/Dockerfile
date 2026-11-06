FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DATA_DIR=/app/data \
    MODELS_DIR=/app/data/models \
    PORT=8000

WORKDIR /app

# Install system dependencies for OpenCV and scientific image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU and dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu || true && \
    pip install --no-cache-dir -r /app/backend/requirements.txt

# Create data directories
RUN mkdir -p /app/data/models /app/data/uploads /app/data/thumbnails /app/data/masks /app/data/exports /app/demo/images

# Copy application code
COPY backend /app/backend
COPY demo /app/demo

EXPOSE 8000

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
