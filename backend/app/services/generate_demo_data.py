"""
Script to create real microscopy demo images:
1. Fluorescence DAPI stained nuclei
2. Phase-contrast / Brightfield cell culture
3. Histology / Multi-channel tissue TIFF
"""
import os
import numpy as np
import cv2
from PIL import Image
import tifffile

DEMO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../demo/images"))
os.makedirs(DEMO_DIR, exist_ok=True)

def generate_demo_microscopy_images():
    # 1. Fluorescence Cell Nuclei (DAPI / Hoechst)
    # Synthetic / Realistic microscopy model of cell nuclei with Poisson-Gaussian shot noise,
    # heterogeneous intensity, chromatin texture, and realistic cellular morphology.
    np.random.seed(42)
    w, h = 800, 800
    fluo_img = np.zeros((h, w), dtype=np.float32)

    # Generate 35 realistic elliptical cell nuclei with varying orientations and sizes
    n_cells = 36
    xs = np.random.randint(60, w - 60, n_cells)
    ys = np.random.randint(60, h - 60, n_cells)
    
    # Create spatial grid
    Y, X = np.ogrid[:h, :w]

    for i in range(n_cells):
        cx, cy = xs[i], ys[i]
        rx = np.random.uniform(18, 38)
        ry = np.random.uniform(14, 30)
        theta = np.random.uniform(0, np.pi)
        
        cos_t, sin_t = np.cos(theta), np.sin(theta)
        x_rot = (X - cx) * cos_t + (Y - cy) * sin_t
        y_rot = -(X - cx) * sin_t + (Y - cy) * cos_t
        
        # Elliptical distance with soft Gaussian membrane falloff
        dist_sq = (x_rot / rx) ** 2 + (y_rot / ry) ** 2
        intensity = np.random.uniform(160, 240)
        
        # Core nucleus with chromatin texture
        mask = dist_sq < 1.0
        gradient = np.exp(-1.5 * dist_sq) * intensity
        
        # Add internal texture (heterochromatin spots)
        texture = np.random.normal(0, 15, (h, w))
        cell_profile = (gradient + texture) * (dist_sq < 1.6)
        fluo_img = np.maximum(fluo_img, cell_profile)

    # Background autofluorescence and dark current noise
    bg_gradient = 15 + 10 * np.sin(X / 200.0) * np.cos(Y / 200.0)
    fluo_img += bg_gradient
    # Poisson shot noise
    shot_noise = np.random.poisson(np.clip(fluo_img, 0, 255)).astype(np.float32)
    fluo_final = np.clip(shot_noise, 0, 255).astype(np.uint8)

    # Colorize to scientific DAPI cyan / electric blue
    fluo_rgb = np.zeros((h, w, 3), dtype=np.uint8)
    fluo_rgb[:, :, 0] = (fluo_final * 0.15).astype(np.uint8) # Low red
    fluo_rgb[:, :, 1] = (fluo_final * 0.65).astype(np.uint8) # Mid green
    fluo_rgb[:, :, 2] = fluo_final                           # High blue

    fluo_path = os.path.join(DEMO_DIR, "fluorescence_nuclei_dapi.png")
    Image.fromarray(fluo_rgb).save(fluo_path)
    print(f"Created: {fluo_path}")

    # 2. Brightfield / Phase-contrast cell culture (adherent cells with halo)
    np.random.seed(101)
    bf_img = np.full((h, w), 205.0, dtype=np.float32) # Bright field background
    
    n_adherent = 28
    xs_bf = np.random.randint(70, w - 70, n_adherent)
    ys_bf = np.random.randint(70, h - 70, n_adherent)

    for i in range(n_adherent):
        cx, cy = xs_bf[i], ys_bf[i]
        r = np.random.uniform(22, 45)
        # Non-spherical pseudopodia elongation
        n_lobes = np.random.randint(3, 7)
        angle = np.arctan2(Y - cy, X - cx)
        radius_var = r * (1.0 + 0.25 * np.sin(n_lobes * angle + np.random.uniform(0, 2*np.pi)))
        
        dist = np.sqrt((X - cx)**2 + (Y - cy)**2)
        # Phase halo: bright ring, dark interior
        cell_interior = dist < radius_var
        halo_ring = (dist >= radius_var) & (dist < radius_var + 6)
        
        bf_img[cell_interior] -= np.random.uniform(65, 110) * (1.0 - (dist[cell_interior] / radius_var[cell_interior])**2)
        bf_img[halo_ring] += np.random.uniform(25, 40)

    # Illumination vignette (common in microscopy optics)
    dist_center = np.sqrt((X - w/2)**2 + (Y - h/2)**2)
    vignette = 1.0 - 0.15 * (dist_center / (w / 1.414))**2
    bf_img = bf_img * vignette
    bf_img += np.random.normal(0, 4, (h, w)) # Sensor noise
    bf_final = np.clip(bf_img, 0, 255).astype(np.uint8)
    
    bf_rgb = cv2.cvtColor(bf_final, cv2.COLOR_GRAY2RGB)
    bf_path = os.path.join(DEMO_DIR, "brightfield_cell_culture.png")
    Image.fromarray(bf_rgb).save(bf_path)
    print(f"Created: {bf_path}")

    # 3. Scientific 16-bit Multi-channel TIFF
    tiff_path = os.path.join(DEMO_DIR, "histology_tissue_sample.tif")
    # 2-channel 16-bit stack: Channel 1: nuclei, Channel 2: cytoplasm/membrane
    ch1 = (fluo_final.astype(np.float32) * 256.0).clip(0, 65535).astype(np.uint16)
    ch2 = ((255 - bf_final).astype(np.float32) * 200.0).clip(0, 65535).astype(np.uint16)
    stack_16bit = np.stack([ch1, ch2], axis=0) # Shape: (2, H, W)
    tifffile.imwrite(tiff_path, stack_16bit)
    print(f"Created: {tiff_path}")

if __name__ == "__main__":
    generate_demo_microscopy_images()
