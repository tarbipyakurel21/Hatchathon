import os
import uuid
import math
import numpy as np
import cv2
from typing import Dict, Any, Tuple, List, Optional

DATA_DIR = os.environ.get("DATA_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data")))
VIDEOS_DIR = os.path.join(DATA_DIR, "videos")
VIDEO_FRAMES_DIR = os.path.join(DATA_DIR, "video_frames")
VIDEO_MASKS_DIR = os.path.join(DATA_DIR, "video_masks")
VIDEO_EXPORTS_DIR = os.path.join(DATA_DIR, "video_exports")

def ensure_video_storage_dirs():
    for d in [VIDEOS_DIR, VIDEO_FRAMES_DIR, VIDEO_MASKS_DIR, VIDEO_EXPORTS_DIR]:
        os.makedirs(d, exist_ok=True)

def probe_video(file_path: str) -> Dict[str, Any]:
    """Inspect video file metadata using OpenCV."""
    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video file: {file_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 360
    duration_seconds = total_frames / fps
    cap.release()

    file_size_bytes = os.path.getsize(file_path) if os.path.exists(file_path) else 0

    return {
        "fps": round(fps, 2),
        "total_frames": total_frames,
        "width": width,
        "height": height,
        "duration_seconds": round(duration_seconds, 2),
        "file_size_bytes": file_size_bytes,
    }

def extract_frame_rgb(video_path: str, frame_idx: int) -> np.ndarray:
    """Extract a specific frame from video as an RGB NumPy array."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame_bgr = cap.read()
    cap.release()

    if not ret or frame_bgr is None:
        raise ValueError(f"Failed to read frame {frame_idx} from {video_path}")

    return cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

def extract_thumbnail(video_path: str, thumbnail_path: str, frame_idx: int = 0) -> str:
    """Extract and save a thumbnail JPEG for the video."""
    os.makedirs(os.path.dirname(thumbnail_path), exist_ok=True)
    frame_rgb = extract_frame_rgb(video_path, frame_idx)
    
    # Resize to standard thumbnail height 180px
    h, w = frame_rgb.shape[:2]
    target_h = 180
    target_w = int((w / h) * target_h)
    resized = cv2.resize(frame_rgb, (target_w, target_h), interpolation=cv2.INTER_AREA)

    frame_bgr = cv2.cvtColor(resized, cv2.COLOR_RGB2BGR)
    cv2.imwrite(thumbnail_path, frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return thumbnail_path

def generate_demo_surgical_video(output_mp4_path: str) -> Tuple[str, List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Synthesize a realistic laparoscopic surgical video clip (90 frames @ 30 FPS, 640x360).
    Features:
      - Peritoneal abdominal cavity background with textured liver lobe
      - Track 1: Articulating Laparoscopic Grasper (instrument, cyan)
      - Track 2: Cautery L-Hook (instrument, amber)
      - Track 3: Gallbladder target anatomy (organ, emerald)
    Returns: (output_path, tracks_meta, frame_annotations)
    """
    os.makedirs(os.path.dirname(output_mp4_path), exist_ok=True)

    width, height = 640, 360
    fps = 30
    total_frames = 90

    # Video Writer
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(output_mp4_path, fourcc, fps, (width, height))

    tracks = [
        {"track_id": 1, "label": "Laparoscopic Grasper", "category": "instrument", "color": "#06B6D4"},
        {"track_id": 2, "label": "Cautery Hook", "category": "instrument", "color": "#F59E0B"},
        {"track_id": 3, "label": "Gallbladder", "category": "organ", "color": "#10B981"},
    ]

    frame_annotations = []

    # Gallbladder fixed base position
    gb_center_x = 310
    gb_center_y = 190
    gb_r_x = 55
    gb_r_y = 40

    for f in range(total_frames):
        t = f / float(total_frames)

        # 1. Base abdominal cavity background
        frame = np.zeros((height, width, 3), dtype=np.uint8)

        # Gradient background (deep red-brown liver tissue and peritoneum)
        yy, xx = np.mgrid[:height, :width]
        peritoneum_r = np.clip(120 + 25 * np.sin(xx / 80.0) + 15 * np.cos(yy / 60.0), 90, 160).astype(np.uint8)
        peritoneum_g = np.clip(45 + 10 * np.sin(xx / 70.0), 30, 65).astype(np.uint8)
        peritoneum_b = np.clip(45 + 10 * np.cos(yy / 70.0), 30, 65).astype(np.uint8)
        frame[..., 0] = peritoneum_b
        frame[..., 1] = peritoneum_g
        frame[..., 2] = peritoneum_r

        # Liver lobe top-left texture
        liver_mask = (xx * 0.7 + yy * 0.4 < 180)
        frame[liver_mask, 0] = np.clip(frame[liver_mask, 0] * 0.6, 20, 50).astype(np.uint8)
        frame[liver_mask, 1] = np.clip(frame[liver_mask, 1] * 0.7, 20, 50).astype(np.uint8)
        frame[liver_mask, 2] = np.clip(frame[liver_mask, 2] * 1.3, 140, 200).astype(np.uint8)

        # Fine blood vessels texture (curved lines)
        cv2.ellipse(frame, (200, 120), (140, 80), 25, 0, 180, (20, 15, 90), 2, cv2.LINE_AA)
        cv2.ellipse(frame, (380, 260), (120, 60), -20, 0, 160, (25, 20, 100), 1, cv2.LINE_AA)

        # 2. Draw Gallbladder (Organ Track 3)
        # Slight respiratory motion
        curr_gb_x = int(gb_center_x + 6 * math.sin(t * math.pi * 2))
        curr_gb_y = int(gb_center_y + 4 * math.cos(t * math.pi * 2))
        cv2.ellipse(frame, (curr_gb_x, curr_gb_y), (gb_r_x, gb_r_y), -15, 0, 360, (35, 120, 85), -1, cv2.LINE_AA)
        # Highlight
        cv2.ellipse(frame, (curr_gb_x - 12, curr_gb_y - 10), (gb_r_x // 3, gb_r_y // 3), -15, 0, 360, (60, 160, 110), -1, cv2.LINE_AA)

        # Generate contour for Track 3
        gb_pts = []
        for deg in range(0, 360, 20):
            rad = math.radians(deg)
            # rotated ellipse
            ex = gb_r_x * math.cos(rad)
            ey = gb_r_y * math.sin(rad)
            rot_rad = math.radians(-15)
            rx = ex * math.cos(rot_rad) - ey * math.sin(rot_rad)
            ry = ex * math.sin(rot_rad) + ey * math.cos(rot_rad)
            gb_pts.append([round(curr_gb_x + rx, 1), round(curr_gb_y + ry, 1)])

        gb_bbox = [curr_gb_x - gb_r_x, curr_gb_y - gb_r_y, gb_r_x * 2, gb_r_y * 2]
        gb_area = math.pi * gb_r_x * gb_r_y

        frame_annotations.append({
            "track_id": 3,
            "frame_idx": f,
            "polygon": gb_pts,
            "bbox": gb_bbox,
            "area": round(gb_area, 1),
            "is_keyframe": f == 0 or f == 45,
            "confidence": 0.98,
        })

        # 3. Draw Laparoscopic Grasper (Instrument Track 1)
        # Moves from top-left toward gallbladder and articulates jaws
        grasper_tip_x = int(140 + t * 140 + 5 * math.sin(t * 10))
        grasper_tip_y = int(100 + t * 80 + 3 * math.cos(t * 10))
        shaft_base_x = 0
        shaft_base_y = 0

        # Draw metallic shaft
        cv2.line(frame, (shaft_base_x, shaft_base_y), (grasper_tip_x, grasper_tip_y), (180, 190, 200), 12, cv2.LINE_AA)
        cv2.line(frame, (shaft_base_x, shaft_base_y), (grasper_tip_x, grasper_tip_y), (220, 230, 240), 4, cv2.LINE_AA)

        # Draw jaws (open then close)
        jaw_angle = 25 * (1.0 - math.sin(t * math.pi))
        j1_rad = math.radians(35 - jaw_angle)
        j2_rad = math.radians(35 + jaw_angle)
        jaw_len = 28
        j1_x = int(grasper_tip_x + jaw_len * math.cos(j1_rad))
        j1_y = int(grasper_tip_y + jaw_len * math.sin(j1_rad))
        j2_x = int(grasper_tip_x + jaw_len * math.cos(j2_rad))
        j2_y = int(grasper_tip_y + jaw_len * math.sin(j2_rad))

        cv2.line(frame, (grasper_tip_x, grasper_tip_y), (j1_x, j1_y), (210, 220, 230), 4, cv2.LINE_AA)
        cv2.line(frame, (grasper_tip_x, grasper_tip_y), (j2_x, j2_y), (210, 220, 230), 4, cv2.LINE_AA)

        # Grasper polygon contour
        grasper_poly = [
            [max(0, shaft_base_x), max(0, shaft_base_y)],
            [grasper_tip_x - 8, grasper_tip_y - 8],
            [j1_x, j1_y],
            [grasper_tip_x + 6, grasper_tip_y + 4],
            [j2_x, j2_y],
            [grasper_tip_x - 4, grasper_tip_y + 8],
        ]
        gx_vals = [p[0] for p in grasper_poly]
        gy_vals = [p[1] for p in grasper_poly]
        g_bbox = [min(gx_vals), min(gy_vals), max(gx_vals) - min(gx_vals), max(gy_vals) - min(gy_vals)]

        frame_annotations.append({
            "track_id": 1,
            "frame_idx": f,
            "polygon": grasper_poly,
            "bbox": g_bbox,
            "area": 950.0,
            "is_keyframe": f == 0,
            "confidence": 0.99,
        })

        # 4. Draw Cautery Hook (Instrument Track 2)
        # Enters from top-right and dissects tissue margin
        hook_tip_x = int(520 - t * 120 + 4 * math.cos(t * 8))
        hook_tip_y = int(80 + t * 95 + 3 * math.sin(t * 8))
        hook_base_x = 640
        hook_base_y = 10

        # Shaft
        cv2.line(frame, (hook_base_x, hook_base_y), (hook_tip_x, hook_tip_y), (140, 150, 160), 10, cv2.LINE_AA)
        # Ceramic insulator tip
        cv2.circle(frame, (hook_tip_x, hook_tip_y), 5, (230, 230, 240), -1, cv2.LINE_AA)
        # L-hook tip
        hook_end_x = hook_tip_x - 14
        hook_end_y = hook_tip_y + 12
        cv2.line(frame, (hook_tip_x, hook_tip_y), (hook_end_x, hook_end_y), (210, 180, 50), 3, cv2.LINE_AA)

        hook_poly = [
            [hook_base_x, hook_base_y],
            [hook_tip_x + 6, hook_tip_y - 6],
            [hook_end_x, hook_end_y],
            [hook_tip_x - 6, hook_tip_y + 6],
        ]
        hx_vals = [p[0] for p in hook_poly]
        hy_vals = [p[1] for p in hook_poly]
        h_bbox = [min(hx_vals), min(hy_vals), max(hx_vals) - min(hx_vals), max(hy_vals) - min(hy_vals)]

        frame_annotations.append({
            "track_id": 2,
            "frame_idx": f,
            "polygon": hook_poly,
            "bbox": h_bbox,
            "area": 820.0,
            "is_keyframe": f == 0,
            "confidence": 0.97,
        })

        # Subtle surgical vignetting
        writer.write(frame)

    writer.release()
    return output_mp4_path, tracks, frame_annotations
