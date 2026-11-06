import os
import io
import pytest
import numpy as np
from PIL import Image
import tifffile

from backend.app.services.image_io import (
    sanitize_filename,
    load_image_rgb,
    save_uploaded_file,
    ensure_storage_dirs,
    MAX_DIMENSION
)

@pytest.fixture(scope="session", autouse=True)
def setup_dirs():
    os.environ["DATA_DIR"] = "/tmp/biolabel_test_image_io"
    ensure_storage_dirs()

def test_sanitize_filename():
    assert sanitize_filename("../../etc/passwd") == "passwd"
    assert sanitize_filename("/var/root/cells.png") == "cells.png"
    assert sanitize_filename("cell<test>@image.tif") == "celltestimage.tif"
    assert sanitize_filename("  my_cell_image.png  ") == "my_cell_image.png"

def test_load_standard_png():
    img_arr = np.random.randint(0, 255, (128, 128, 3), dtype=np.uint8)
    tmp_path = "/tmp/test_png.png"
    Image.fromarray(img_arr).save(tmp_path)

    loaded = load_image_rgb(tmp_path)
    assert loaded.shape == (128, 128, 3)
    assert loaded.dtype == np.uint8
    assert np.allclose(loaded, img_arr, atol=2)

def test_load_16bit_multichannel_tiff():
    # Scientific microscopy 16-bit 2-channel TIFF
    ch1 = (np.ones((64, 64), dtype=np.uint16) * 32768) # mid-scale
    ch2 = (np.ones((64, 64), dtype=np.uint16) * 65535) # full-scale
    stack = np.stack([ch1, ch2], axis=0) # (2, 64, 64)
    tmp_tiff = "/tmp/test_16bit_stack.tif"
    tifffile.imwrite(tmp_tiff, stack)

    loaded = load_image_rgb(tmp_tiff)
    assert loaded.shape == (64, 64, 3) # Normalized to RGB 8-bit
    assert loaded.dtype == np.uint8
    assert loaded.max() > 0

def test_reject_oversized_dimensions():
    # Try saving image larger than MAX_DIMENSION (4096)
    huge_img = Image.new("L", (MAX_DIMENSION + 10, 50))
    buf = io.BytesIO()
    huge_img.save(buf, format="PNG")

    with pytest.raises(ValueError) as exc:
        save_uploaded_file(buf.getvalue(), "huge.png")
    assert "exceed maximum allowed" in str(exc.value)

def test_save_and_thumbnail_generation():
    img = Image.new("RGB", (500, 300), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    meta = save_uploaded_file(buf.getvalue(), "cell_culture_sample.png")
    assert meta["width"] == 500
    assert meta["height"] == 300
    assert meta["file_format"] == "png"
    assert os.path.exists(meta["file_path"])
    assert os.path.exists(meta["thumbnail_path"])

    # Thumbnail should be scaled down to max 256
    thumb = Image.open(meta["thumbnail_path"])
    assert max(thumb.size) <= 256
