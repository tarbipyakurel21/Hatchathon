import os
import time
import uuid
import logging
from typing import Dict, Any, List, Optional
import numpy as np
import cv2

from backend.app.services.segmentation.base import BaseSegmentationModel
from backend.app.services.segmentation.watershed import CELL_PALETTE

logger = logging.getLogger("biolabel.fastsam")

DATA_DIR = os.environ.get("DATA_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data")))
MODELS_DIR = os.path.join(DATA_DIR, "models")
WEIGHTS_PATH = os.path.join(MODELS_DIR, "FastSAM-s.pt")
WEIGHTS_URL = "https://github.com/CASIA-IVA-Lab/FastSAM/releases/download/v0.1.1/FastSAM-s.pt"

class FastSAMModel(BaseSegmentationModel):
    def __init__(self):
        self._model = None
        self._is_torch_available = False
        try:
            import torch
            import ultralytics
            self._is_torch_available = True
        except ImportError:
            self._is_torch_available = False

    @property
    def id(self) -> str:
        return "fastsam-s"

    @property
    def name(self) -> str:
        return "FastSAM-s (Zero-Shot Deep Learning)"

    @property
    def description(self) -> str:
        return (
            "Fast Segment Anything Model (FastSAM-s) based on YOLOv8x CNN backbone. "
            "Lightweight zero-shot instance segmentation running on CPU. "
            "General-purpose object detector capable of identifying heterogeneous cells."
        )

    @property
    def architecture(self) -> str:
        return "YOLOv8 CNN Instance Segmentation (FastSAM-s, 138MB)"

    @property
    def is_microscopy_specialized(self) -> bool:
        return False

    @property
    def speed_rating(self) -> str:
        return "Moderate CPU (~400-900ms)"

    @property
    def recommended_for(self) -> List[str]:
        return [
            "Heterogeneous Cell Colonies",
            "Complex Histology / Pathology",
            "General Bio-Structures",
            "Unstained Brightfield Specimens"
        ]

    def is_available(self) -> bool:
        return self._is_torch_available

    def _ensure_weights(self) -> str:
        os.makedirs(MODELS_DIR, exist_ok=True)
        if os.path.exists(WEIGHTS_PATH) and os.path.getsize(WEIGHTS_PATH) > 10_000_000:
            return WEIGHTS_PATH

        logger.info(f"Downloading FastSAM-s weights from {WEIGHTS_URL} to {WEIGHTS_PATH}...")
        import urllib.request
        try:
            urllib.request.urlretrieve(WEIGHTS_URL, WEIGHTS_PATH)
            logger.info("FastSAM-s weights downloaded successfully.")
            return WEIGHTS_PATH
        except Exception as e:
            logger.error(f"Failed to download FastSAM weights: {e}")
            if os.path.exists(WEIGHTS_PATH):
                os.remove(WEIGHTS_PATH)
            raise RuntimeError(f"Could not download FastSAM-s weights: {e}")

    def _get_model(self):
        if self._model is not None:
            return self._model

        if not self._is_torch_available:
            raise RuntimeError("PyTorch or Ultralytics is not installed in the current environment.")

        os.makedirs(MODELS_DIR, exist_ok=True)
        from ultralytics import FastSAM
        logger.info("Initializing FastSAM-s model on CPU...")
        
        # Check if local weights exist in MODELS_DIR
        local_weights = os.path.join(MODELS_DIR, "FastSAM-s.pt")
        if os.path.exists(local_weights) and os.path.getsize(local_weights) > 10_000_000:
            self._model = FastSAM(local_weights)
        else:
            # Ultralytics natively downloads FastSAM-s.pt from official ultralytics/assets release
            try:
                self._model = FastSAM("FastSAM-s.pt")
                # If downloaded into current directory, move/link to MODELS_DIR
                if os.path.exists("FastSAM-s.pt") and not os.path.exists(local_weights):
                    import shutil
                    shutil.copy2("FastSAM-s.pt", local_weights)
            except Exception as e:
                # Direct download fallback from official Ultralytics assets release
                fallback_url = "https://github.com/ultralytics/assets/releases/download/v8.2.0/FastSAM-s.pt"
                logger.info(f"Downloading from Ultralytics assets: {fallback_url}")
                import urllib.request
                urllib.request.urlretrieve(fallback_url, local_weights)
                self._model = FastSAM(local_weights)

        return self._model

    def predict(
        self,
        image_rgb: np.ndarray,
        min_area: int = 25,
        max_area: int = 100000,
        threshold: float = 0.4,
        **kwargs
    ) -> Dict[str, Any]:
        start_time = time.perf_counter()
        h, w = image_rgb.shape[:2]

        model = self._get_model()

        # Run real CPU inference
        # imgsz=512 balances CPU speed and segmentation resolution for M3 / 8GB
        results = model(
            image_rgb,
            device="cpu",
            retina_masks=True,
            imgsz=512,
            conf=float(threshold),
            iou=0.7,
            verbose=False
        )

        annotations = []
        cell_index = 1

        if results and len(results) > 0 and results[0].masks is not None:
            masks_data = results[0].masks.data.cpu().numpy() # Shape: (N, H, W)
            
            for i in range(len(masks_data)):
                raw_mask = masks_data[i]
                
                # Resize mask to original image dimensions if needed
                if raw_mask.shape != (h, w):
                    mask_uint8 = cv2.resize(
                        (raw_mask > 0.5).astype(np.uint8) * 255,
                        (w, h),
                        interpolation=cv2.INTER_NEAREST
                    )
                else:
                    mask_uint8 = (raw_mask > 0.5).astype(np.uint8) * 255

                # Find contours
                contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                if not contours:
                    continue

                cnt = max(contours, key=cv2.contourArea)
                area = float(cv2.contourArea(cnt))

                if area < min_area or area > max_area:
                    continue

                epsilon = max(1.0, 0.008 * cv2.arcLength(cnt, True))
                approx = cv2.approxPolyDP(cnt, epsilon, True)

                if len(approx) < 3:
                    continue

                polygon = approx.reshape(-1, 2).astype(float).tolist()
                x, y, bw, bh = cv2.boundingRect(cnt)
                bbox = [float(x), float(y), float(bw), float(bh)]

                color = CELL_PALETTE[(cell_index - 1) % len(CELL_PALETTE)]

                annotations.append({
                    "id": str(uuid.uuid4()),
                    "label": f"Cell {cell_index:03d}",
                    "category": "cell",
                    "color": color,
                    "polygon": polygon,
                    "bbox": bbox,
                    "area": round(area, 1),
                    "is_visible": True,
                    "model_name": self.name
                })
                cell_index += 1

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return {
            "model_id": self.id,
            "model_name": self.name,
            "detected_count": len(annotations),
            "inference_time_ms": elapsed_ms,
            "annotations": annotations,
            "metadata": {
                "architecture": self.architecture,
                "image_shape": [h, w],
                "confidence_threshold": threshold,
                "imgsz": 512,
                "device": "cpu"
            }
        }
