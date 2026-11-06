import time
import numpy as np
import cv2
from scipy import ndimage as ndi
from skimage.segmentation import watershed
from skimage.feature import peak_local_max
from typing import Dict, Any, List
import uuid

from backend.app.services.segmentation.base import BaseSegmentationModel

# Curated palette of distinct, vibrant colors for microscopy instances
CELL_PALETTE = [
    "#06B6D4", # Cyan
    "#8B5CF6", # Violet
    "#10B981", # Emerald
    "#F59E0B", # Amber
    "#EC4899", # Pink
    "#3B82F6", # Blue
    "#14B8A6", # Teal
    "#A855F7", # Purple
    "#E11D48", # Rose
    "#6366F1", # Indigo
    "#84CC16", # Lime
    "#F97316", # Orange
]

class MicroscopyWatershedModel(BaseSegmentationModel):
    @property
    def id(self) -> str:
        return "microscopy-watershed"

    @property
    def name(self) -> str:
        return "Microscopy Watershed (Cell-Specific Baseline)"

    @property
    def description(self) -> str:
        return (
            "Classical computer vision pipeline specialized for cellular microscopy. "
            "Combines CLAHE contrast enhancement, Euclidean distance transform, peak marker "
            "detection, and morphological watershed segmentation to resolve touching cells."
        )

    @property
    def architecture(self) -> str:
        return "Classical Morphological Watershed + Distance Transform"

    @property
    def is_microscopy_specialized(self) -> bool:
        return True

    @property
    def speed_rating(self) -> str:
        return "Ultra-Fast (15-40ms)"

    @property
    def recommended_for(self) -> List[str]:
        return [
            "Fluorescence Nuclei (DAPI / Hoechst)",
            "GFP / Membrane Stains",
            "Brightfield Cell Cultures",
            "High-Throughput Assays"
        ]

    def is_available(self) -> bool:
        return True

    def predict(
        self,
        image_rgb: np.ndarray,
        min_area: int = 25,
        max_area: int = 100000,
        threshold: float = 0.4,
        **kwargs
    ) -> Dict[str, Any]:
        start_time = time.perf_counter()

        # 1. Convert to grayscale
        if len(image_rgb.shape) == 3:
            gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
        else:
            gray = image_rgb.copy()

        h, w = gray.shape

        # 2. Contrast Enhancement via CLAHE (essential for biomedical imaging)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        # 3. Detect background polarity: fluorescence (bright cells on dark bg) vs brightfield (dark cells on light bg)
        # We sample image border pixels to estimate background level
        border_pixels = np.concatenate([
            gray[0, :], gray[-1, :], gray[:, 0], gray[:, -1]
        ])
        is_brightfield = np.median(border_pixels) > 128

        if is_brightfield:
            # Invert so cells are bright on dark background
            proc_img = cv2.bitwise_not(enhanced)
        else:
            proc_img = enhanced

        # 4. Noise reduction with Gaussian blur
        blurred = cv2.GaussianBlur(proc_img, (5, 5), 0)

        # 5. Adaptive + Otsu Binarization
        otsu_val, _ = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Modulate threshold with sensitivity parameter
        # threshold param: 0.1 (sensitive, lower thresh) to 0.9 (conservative, higher thresh)
        thresh_factor = 1.0 - (threshold - 0.4) * 0.6
        adjusted_thresh = np.clip(otsu_val * thresh_factor, 10, 245)
        
        _, binary = cv2.threshold(blurred, int(adjusted_thresh), 255, cv2.THRESH_BINARY)

        # 6. Morphological cleanup: remove speckle noise and fill small gaps
        kernel_3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        kernel_5 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        
        opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_3, iterations=1)
        cleaned = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel_5, iterations=1)

        # 7. Euclidean Distance Transform to separate touching cells
        dist_transform = cv2.distanceTransform(cleaned, cv2.DIST_L2, 5)

        # 8. Detect seed markers at local maxima
        # Dynamic min_distance based on estimated cell radius from image size
        est_min_dist = max(5, int(min(h, w) * 0.015))
        
        # Normalized distance for peak thresholding
        max_dist = dist_transform.max()
        if max_dist > 0:
            coords = peak_local_max(
                dist_transform,
                min_distance=est_min_dist,
                threshold_rel=0.18,
                labels=cleaned
            )
        else:
            coords = np.empty((0, 2), dtype=int)

        # 9. Watershed segmentation
        mask_markers = np.zeros(dist_transform.shape, dtype=bool)
        if len(coords) > 0:
            mask_markers[tuple(coords.T)] = True
            markers, _ = ndi.label(mask_markers)
            labels = watershed(-dist_transform, markers, mask=cleaned)
        else:
            # Fallback to connected components if no distinct peaks found
            _, labels = cv2.connectedComponents(cleaned)

        # 10. Extract individual object polygons and bounding boxes
        unique_labels = np.unique(labels)
        annotations = []
        cell_index = 1

        for label_id in unique_labels:
            if label_id == 0:
                continue  # Background

            # Create binary mask for this cell
            cell_mask = (labels == label_id).astype(np.uint8) * 255
            
            # Find contours
            contours, _ = cv2.findContours(cell_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                continue

            # Pick largest contour for this instance
            cnt = max(contours, key=cv2.contourArea)
            area = float(cv2.contourArea(cnt))

            # Filter by size
            if area < min_area or area > max_area:
                continue

            # Approximate contour to polygon (Douglas-Peucker algorithm)
            epsilon = max(1.0, 0.008 * cv2.arcLength(cnt, True))
            approx = cv2.approxPolyDP(cnt, epsilon, True)

            # Need at least 3 points for a valid polygon
            if len(approx) < 3:
                continue

            # Convert to list of [x, y] coordinates
            polygon = approx.reshape(-1, 2).astype(float).tolist()

            # Bounding box [x, y, w, h]
            x, y, bw, bh = cv2.boundingRect(cnt)
            bbox = [float(x), float(y), float(bw), float(bh)]

            # Color from palette
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
                "detected_background": "brightfield" if is_brightfield else "fluorescence",
                "markers_count": len(coords) if len(coords) > 0 else 0,
                "sensitivity": threshold,
            }
        }
