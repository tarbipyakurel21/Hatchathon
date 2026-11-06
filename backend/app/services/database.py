import sqlite3
import os
import json
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

DATA_DIR = os.environ.get("DATA_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data")))
DB_PATH = os.path.join(DATA_DIR, "biolabel.db")

def get_connection():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        thumbnail_path TEXT,
        file_format TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        channels INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS annotations (
        id TEXT PRIMARY KEY,
        image_id TEXT NOT NULL,
        label TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'cell',
        color TEXT NOT NULL DEFAULT '#06B6D4',
        polygon TEXT NOT NULL, -- JSON array of [x, y]
        bbox TEXT NOT NULL,    -- JSON array of [x, y, w, h]
        area REAL NOT NULL,
        is_visible INTEGER NOT NULL DEFAULT 1,
        model_name TEXT DEFAULT 'manual',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_images_dataset_id ON images(dataset_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_annotations_image_id ON annotations(image_id);")

    conn.commit()
    conn.close()

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# Datasets
def create_dataset(name: str, description: Optional[str] = None) -> Dict[str, Any]:
    conn = get_connection()
    dataset_id = str(uuid.uuid4())
    ts = now_iso()
    conn.execute(
        "INSERT INTO datasets (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (dataset_id, name, description, ts, ts)
    )
    conn.commit()
    conn.close()
    return get_dataset(dataset_id)

def get_dataset(dataset_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    row = conn.execute(
        """
        SELECT d.*, 
               (SELECT COUNT(*) FROM images i WHERE i.dataset_id = d.id) as image_count,
               (SELECT COUNT(*) FROM annotations a JOIN images i ON a.image_id = i.id WHERE i.dataset_id = d.id) as annotation_count
        FROM datasets d WHERE d.id = ?
        """,
        (dataset_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return dict(row)

def list_datasets() -> List[Dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT d.*, 
               (SELECT COUNT(*) FROM images i WHERE i.dataset_id = d.id) as image_count,
               (SELECT COUNT(*) FROM annotations a JOIN images i ON a.image_id = i.id WHERE i.dataset_id = d.id) as annotation_count
        FROM datasets d ORDER BY d.created_at DESC
        """
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Images
def create_image(
    dataset_id: str,
    filename: str,
    file_path: str,
    thumbnail_path: Optional[str],
    file_format: str,
    file_size_bytes: int,
    width: int,
    height: int,
    channels: int
) -> Dict[str, Any]:
    conn = get_connection()
    image_id = str(uuid.uuid4())
    ts = now_iso()
    conn.execute(
        """
        INSERT INTO images 
        (id, dataset_id, filename, file_path, thumbnail_path, file_format, file_size_bytes, width, height, channels, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (image_id, dataset_id, filename, file_path, thumbnail_path, file_format, file_size_bytes, width, height, channels, ts, ts)
    )
    conn.commit()
    conn.close()
    return get_image(image_id)

def get_image(image_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    row = conn.execute(
        """
        SELECT i.*, 
               (SELECT COUNT(*) FROM annotations a WHERE a.image_id = i.id) as annotation_count
        FROM images i WHERE i.id = ?
        """,
        (image_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return dict(row)

def list_images_for_dataset(dataset_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT i.*, 
               (SELECT COUNT(*) FROM annotations a WHERE a.image_id = i.id) as annotation_count
        FROM images i WHERE i.dataset_id = ? ORDER BY i.created_at ASC
        """,
        (dataset_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_image(image_id: str) -> bool:
    conn = get_connection()
    cursor = conn.execute("DELETE FROM images WHERE id = ?", (image_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted

# Annotations
def get_annotations_for_image(image_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM annotations WHERE image_id = ? ORDER BY created_at ASC",
        (image_id,)
    ).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        d["polygon"] = json.loads(d["polygon"])
        d["bbox"] = json.loads(d["bbox"])
        d["is_visible"] = bool(d["is_visible"])
        results.append(d)
    return results

def save_annotations_for_image(image_id: str, annotations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    # Replace all annotations for this image atomically
    cursor.execute("DELETE FROM annotations WHERE image_id = ?", (image_id,))
    
    ts = now_iso()
    inserted = []
    for ann in annotations:
        ann_id = ann.get("id") or str(uuid.uuid4())
        label = ann.get("label", "Cell")
        category = ann.get("category", "cell")
        color = ann.get("color", "#06B6D4")
        polygon_json = json.dumps(ann.get("polygon", []))
        bbox_json = json.dumps(ann.get("bbox", [0, 0, 0, 0]))
        area = float(ann.get("area", 0.0))
        is_visible = 1 if ann.get("is_visible", True) else 0
        model_name = ann.get("model_name", "manual")
        
        cursor.execute(
            """
            INSERT INTO annotations 
            (id, image_id, label, category, color, polygon, bbox, area, is_visible, model_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (ann_id, image_id, label, category, color, polygon_json, bbox_json, area, is_visible, model_name, ts, ts)
        )
        inserted.append(ann_id)
        
    conn.commit()
    conn.close()
    return get_annotations_for_image(image_id)
