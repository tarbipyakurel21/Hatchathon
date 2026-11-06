import os
import uuid
import numpy as np
from PIL import Image
import cv2
import tifffile
from typing import Tuple, Dict, Any, Optional

DATA_DIR = os.environ.get("DATA_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data")))
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
THUMBNAILS_DIR = os.path.join(DATA_DIR, "thumbnails")
MASKS_DIR = os.path.join(DATA_DIR, "masks")
EXPORTS_DIR = os.path.join(DATA_DIR, "exports")

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB
MAX_DIMENSION = 4096

def ensure_storage_dirs():
    for d in [UPLOADS_DIR, THUMBNAILS_DIR, MASKS_DIR, EXPORTS_DIR]:
        os.makedirs(d, exist_ok=True)

def sanitize_filename(filename: str) -> str:
    # Strip any directory path components to prevent path traversal
    base = os.path.basename(filename)
    safe_chars = [c for c in base if c.isalnum() or c in "._- "]
    cleaned = "".join(safe_chars).strip()
    return cleaned if cleaned else f"image_{uuid.uuid4().hex[:8]}.png"

def load_image_rgb(file_path: str) -> np.ndarray:
    """
    Safely load image file (PNG, JPG, TIFF) as an 8-bit RGB NumPy array.
    Handles 8-bit, 16-bit grayscale/RGB, and multi-channel TIFFs.
    """
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext in [".tif", ".tiff"]:
        # Use tifffile for robust scientific microscopy TIFF loading
        img = tifffile.imread(file_path)
        
        # Handle multi-page or 3D stacks by taking middle slice or max projection
        if img.ndim == 3 and img.shape[0] not in [3, 4] and img.shape[2] not in [3, 4]:
            # Likely Z-stack: take maximum intensity projection
            img = np.max(img, axis=0)
        elif img.ndim == 4:
            img = np.max(img, axis=(0, 1))

        # Handle 16-bit or float TIFF normalization to 8-bit
        if img.dtype == np.uint16:
            img = (img / 256.0).clip(0, 255).astype(np.uint8)
        elif np.issubdtype(img.dtype, np.floating):
            min_val, max_val = img.min(), img.max()
            if max_val > min_val:
                img = ((img - min_val) / (max_val - min_val) * 255.0).astype(np.uint8)
            else:
                img = np.zeros_like(img, dtype=np.uint8)
        else:
            img = img.astype(np.uint8)

        # Ensure 3-channel RGB
        if img.ndim == 2:
            img_rgb = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
        elif img.ndim == 3:
            if img.shape[2] == 4:
                img_rgb = cv2.cvtColor(img, cv2.COLOR_RGBA2RGB)
            elif img.shape[2] == 3:
                img_rgb = img
            elif img.shape[0] in [3, 4]: # Channel-first format (C, H, W)
                img = np.transpose(img, (1, 2, 0))
                img_rgb = img[:, :, :3]
            else:
                img_rgb = cv2.cvtColor(img[:, :, 0], cv2.COLOR_GRAY2RGB)
        else:
            raise ValueError(f"Unsupported TIFF dimensions: {img.shape}")
            
        return img_rgb

    # Standard formats: PNG, JPG, JPEG
    pil_img = Image.open(file_path)
    if pil_img.mode != "RGB":
        pil_img = pil_img.convert("RGB")
    return np.array(pil_img)

def save_uploaded_file(file_bytes: bytes, original_filename: str) -> Dict[str, Any]:
    ensure_storage_dirs()

    if len(file_bytes) > MAX_UPLOAD_SIZE:
        raise ValueError(f"File size exceeds maximum allowed ({MAX_UPLOAD_SIZE // (1024*1024)} MB)")

    clean_name = sanitize_filename(original_filename)
    ext = os.path.splitext(clean_name)[1].lower()
    
    if ext not in [".png", ".jpg", ".jpeg", ".tif", ".tiff"]:
        raise ValueError(f"Unsupported file format '{ext}'. Allowed: PNG, JPG, TIFF.")

    file_id = str(uuid.uuid4())
    stored_filename = f"{file_id}_{clean_name}"
    file_path = os.path.join(UPLOADS_DIR, stored_filename)

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # Validate image can be loaded and check dimensions
    try:
        img_rgb = load_image_rgb(file_path)
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise ValueError(f"Corrupted or invalid image file: {e}")

    h, w = img_rgb.shape[:2]
    if h > MAX_DIMENSION or w > MAX_DIMENSION:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise ValueError(f"Image dimensions ({w}x{h}) exceed maximum allowed {MAX_DIMENSION}x{MAX_DIMENSION}")

    channels = img_rgb.shape[2] if len(img_rgb.shape) == 3 else 1

    # Generate thumbnail
    thumb_filename = f"thumb_{file_id}.png"
    thumb_path = os.path.join(THUMBNAILS_DIR, thumb_filename)
    
    # Resize preserving aspect ratio (max 256x256)
    scale = min(256.0 / w, 256.0 / h, 1.0)
    thumb_w, thumb_h = max(1, int(w * scale)), max(1, int(h * scale))
    thumb_img = cv2.resize(img_rgb, (thumb_w, thumb_h), interpolation=cv2.INTER_AREA)
    cv2.imwrite(thumb_path, cv2.cvtColor(thumb_img, cv2.COLOR_RGB2BGR))

    return {
        "filename": clean_name,
        "file_path": file_path,
        "thumbnail_path": thumb_path,
        "file_format": ext.lstrip("."),
        "file_size_bytes": len(file_bytes),
        "width": w,
        "height": h,
        "channels": channels
    }
