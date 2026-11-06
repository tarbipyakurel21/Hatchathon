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
    conn = sqlite3.connect(DB_PATH, timeout=30.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 10000;")
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

    # ------------------------------------------
    # SurgiLabel: Projects, Videos, Tracks, Reviews
    # ------------------------------------------
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        label_taxonomy TEXT NOT NULL, -- JSON array of {id, name, color, category}
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        thumbnail_path TEXT,
        duration_seconds REAL NOT NULL,
        fps REAL NOT NULL,
        total_frames INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'ready',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS video_tracks (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        track_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'instrument',
        color TEXT NOT NULL DEFAULT '#06B6D4',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS video_frame_annotations (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        track_id INTEGER NOT NULL,
        frame_idx INTEGER NOT NULL,
        polygon TEXT NOT NULL, -- JSON array of [x, y]
        bbox TEXT NOT NULL,    -- JSON array of [x, y, w, h]
        area REAL NOT NULL,
        is_keyframe INTEGER NOT NULL DEFAULT 0,
        confidence REAL NOT NULL DEFAULT 1.0,
        review_status TEXT NOT NULL DEFAULT 'unreviewed', -- unreviewed, pending_review, approved, corrected, rejected
        uncertainty_score REAL NOT NULL DEFAULT 0.0,
        priority_tier TEXT NOT NULL DEFAULT 'low',        -- high, medium, low
        flag_reasons TEXT NOT NULL DEFAULT '[]',          -- JSON array of strings
        source TEXT NOT NULL DEFAULT 'manual',            -- manual, ai_detector, ai_sam2, ai_propagated
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS uncertainty_records (
        id TEXT PRIMARY KEY,
        annotation_id TEXT NOT NULL,
        video_id TEXT NOT NULL,
        frame_idx INTEGER NOT NULL,
        track_id INTEGER NOT NULL,
        detection_uncertainty REAL NOT NULL DEFAULT 0.0,
        temporal_instability REAL NOT NULL DEFAULT 0.0,
        tracking_inconsistency REAL NOT NULL DEFAULT 0.0,
        shape_anomaly REAL NOT NULL DEFAULT 0.0,
        overall_review_priority REAL NOT NULL DEFAULT 0.0,
        priority_tier TEXT NOT NULL DEFAULT 'low',
        reasons TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        annotation_id TEXT NOT NULL,
        video_id TEXT NOT NULL,
        frame_idx INTEGER NOT NULL,
        track_id INTEGER NOT NULL,
        original_prediction TEXT NOT NULL, -- JSON {polygon, bbox, confidence}
        corrected_annotation TEXT,        -- JSON {polygon, bbox} or NULL
        review_action TEXT NOT NULL,       -- approved, corrected, rejected, skipped
        reviewer_notes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    # Safe column alterations for existing databases
    for table, col in [
        ("videos", "project_id TEXT"),
        ("video_frame_annotations", "review_status TEXT NOT NULL DEFAULT 'unreviewed'"),
        ("video_frame_annotations", "uncertainty_score REAL NOT NULL DEFAULT 0.0"),
        ("video_frame_annotations", "priority_tier TEXT NOT NULL DEFAULT 'low'"),
        ("video_frame_annotations", "flag_reasons TEXT NOT NULL DEFAULT '[]'"),
        ("video_frame_annotations", "source TEXT NOT NULL DEFAULT 'manual'"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col};")
        except sqlite3.OperationalError:
            pass

    # Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_videos_project_id ON videos(project_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_video_tracks_video_id ON video_tracks(video_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_video_frame_annotations ON video_frame_annotations(video_id, frame_idx);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_video_track_frame ON video_frame_annotations(video_id, track_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_uncertainty_video_priority ON uncertainty_records(video_id, overall_review_priority);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_uncertainty_annotation ON uncertainty_records(annotation_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reviews_video ON reviews(video_id);")

    conn.commit()
    conn.close()

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# ------------------------------------------
# Projects
# ------------------------------------------
DEFAULT_TAXONOMY = [
    {"id": "cls_grasper", "name": "Laparoscopic Grasper", "category": "instrument", "color": "#3B82F6"},
    {"id": "cls_hook", "name": "Electrocautery Hook", "category": "instrument", "color": "#EF4444"},
    {"id": "cls_fundus", "name": "Gallbladder Fundus", "category": "organ", "color": "#10B981"},
    {"id": "cls_liver", "name": "Liver Parenchyma", "category": "organ", "color": "#F59E0B"},
    {"id": "cls_scissors", "name": "Surgical Scissors", "category": "instrument", "color": "#8B5CF6"},
    {"id": "cls_clip", "name": "Clip Applier", "category": "instrument", "color": "#06B6D4"},
    {"id": "cls_irrigator", "name": "Irrigator / Suction", "category": "instrument", "color": "#38BDF8"},
    {"id": "cls_bag", "name": "Specimen Bag", "category": "instrument", "color": "#F97316"}
]

def create_project(
    name: str,
    description: Optional[str] = None,
    label_taxonomy: Optional[List[Dict[str, Any]]] = None,
    project_id: Optional[str] = None
) -> Dict[str, Any]:
    conn = get_connection()
    pid = project_id or str(uuid.uuid4())
    ts = now_iso()
    tax = label_taxonomy or DEFAULT_TAXONOMY
    conn.execute(
        """
        INSERT OR REPLACE INTO projects (id, name, description, label_taxonomy, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (pid, name, description, json.dumps(tax), ts, ts)
    )
    conn.commit()
    conn.close()
    return get_project(pid)

def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    row = conn.execute(
        """
        SELECT p.*,
               (SELECT COUNT(*) FROM videos v WHERE v.project_id = p.id) as video_count,
               (SELECT COALESCE(SUM(v.total_frames), 0) FROM videos v WHERE v.project_id = p.id) as total_frames,
               (SELECT COUNT(*) FROM video_frame_annotations fa JOIN videos v ON fa.video_id = v.id WHERE v.project_id = p.id) as annotated_frames,
               (SELECT COUNT(*) FROM video_frame_annotations fa JOIN videos v ON fa.video_id = v.id WHERE v.project_id = p.id AND fa.review_status IN ('unreviewed', 'pending_review')) as pending_reviews
        FROM projects p WHERE p.id = ?
        """,
        (project_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["label_taxonomy"] = json.loads(d["label_taxonomy"]) if d.get("label_taxonomy") else DEFAULT_TAXONOMY
    return d

def list_projects() -> List[Dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT p.*,
               (SELECT COUNT(*) FROM videos v WHERE v.project_id = p.id) as video_count,
               (SELECT COALESCE(SUM(v.total_frames), 0) FROM videos v WHERE v.project_id = p.id) as total_frames,
               (SELECT COUNT(*) FROM video_frame_annotations fa JOIN videos v ON fa.video_id = v.id WHERE v.project_id = p.id) as annotated_frames,
               (SELECT COUNT(*) FROM video_frame_annotations fa JOIN videos v ON fa.video_id = v.id WHERE v.project_id = p.id AND fa.review_status IN ('unreviewed', 'pending_review')) as pending_reviews
        FROM projects p ORDER BY p.updated_at DESC
        """
    ).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        d["label_taxonomy"] = json.loads(d["label_taxonomy"]) if d.get("label_taxonomy") else DEFAULT_TAXONOMY
        results.append(d)
    return results

def update_project(project_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    ts = now_iso()
    fields = []
    values = []
    if "name" in updates:
        fields.append("name = ?")
        values.append(updates["name"])
    if "description" in updates:
        fields.append("description = ?")
        values.append(updates["description"])
    if "label_taxonomy" in updates:
        fields.append("label_taxonomy = ?")
        values.append(json.dumps(updates["label_taxonomy"]))
    fields.append("updated_at = ?")
    values.append(ts)
    values.append(project_id)

    conn.execute(f"UPDATE projects SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return get_project(project_id)

def delete_project(project_id: str) -> bool:
    conn = get_connection()
    cursor = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted

# ------------------------------------------
# Datasets (Microscopy)
# ------------------------------------------
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

# ------------------------------------------
# Images
# ------------------------------------------
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

# ------------------------------------------
# Microscopy Annotations
# ------------------------------------------
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
            INSERT OR REPLACE INTO annotations 
            (id, image_id, label, category, color, polygon, bbox, area, is_visible, model_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (ann_id, image_id, label, category, color, polygon_json, bbox_json, area, is_visible, model_name, ts, ts)
        )
        inserted.append(ann_id)
        
    conn.commit()
    conn.close()
    return get_annotations_for_image(image_id)

# ------------------------------------------
# SurgiLabel: Video & Tracking DB Helpers
# ------------------------------------------
def create_video(
    filename: str,
    file_path: str,
    thumbnail_path: Optional[str],
    duration_seconds: float,
    fps: float,
    total_frames: int,
    width: int,
    height: int,
    file_size_bytes: int,
    video_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> Dict[str, Any]:
    conn = get_connection()
    vid_id = video_id or str(uuid.uuid4())
    ts = now_iso()
    conn.execute(
        """
        INSERT OR REPLACE INTO videos
        (id, project_id, filename, file_path, thumbnail_path, duration_seconds, fps, total_frames, width, height, file_size_bytes, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?)
        """,
        (vid_id, project_id, filename, file_path, thumbnail_path, duration_seconds, fps, total_frames, width, height, file_size_bytes, ts, ts)
    )
    conn.commit()
    conn.close()
    return get_video(vid_id)

def get_video(video_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    row = conn.execute(
        """
        SELECT v.*,
               (SELECT COUNT(*) FROM video_tracks t WHERE t.video_id = v.id) as track_count,
               (SELECT COUNT(*) FROM video_frame_annotations fa WHERE fa.video_id = v.id) as frame_annotation_count,
               (SELECT COUNT(*) FROM video_frame_annotations fa WHERE fa.video_id = v.id AND fa.review_status IN ('unreviewed', 'pending_review')) as pending_reviews
        FROM videos v WHERE v.id = ?
        """,
        (video_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return dict(row)

def list_videos(project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    query = """
    SELECT v.*,
           (SELECT COUNT(*) FROM video_tracks t WHERE t.video_id = v.id) as track_count,
           (SELECT COUNT(*) FROM video_frame_annotations fa WHERE fa.video_id = v.id) as frame_annotation_count,
           (SELECT COUNT(*) FROM video_frame_annotations fa WHERE fa.video_id = v.id AND fa.review_status IN ('unreviewed', 'pending_review')) as pending_reviews
    FROM videos v
    """
    params = []
    if project_id:
        query += " WHERE v.project_id = ?"
        params.append(project_id)
    query += " ORDER BY v.created_at DESC"

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_video(video_id: str) -> bool:
    conn = get_connection()
    cursor = conn.execute("DELETE FROM videos WHERE id = ?", (video_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted

def save_video_tracks_and_annotations(
    video_id: str,
    tracks: List[Dict[str, Any]],
    annotations: List[Dict[str, Any]]
) -> Dict[str, Any]:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        ts = now_iso()

        # Clear previous tracks & annotations for this video
        cursor.execute("DELETE FROM video_tracks WHERE video_id = ?", (video_id,))
        cursor.execute("DELETE FROM video_frame_annotations WHERE video_id = ?", (video_id,))

        for tr in tracks:
            track_pk = tr.get("id") or str(uuid.uuid4())
            track_id = int(tr.get("track_id", 1))
            label = tr.get("label", f"Track {track_id}")
            category = tr.get("category", "instrument")
            color = tr.get("color", "#06B6D4")

            cursor.execute(
                """
                INSERT INTO video_tracks (id, video_id, track_id, label, category, color, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (track_pk, video_id, track_id, label, category, color, ts, ts)
            )

        for fa in annotations:
            fa_id = fa.get("id") or str(uuid.uuid4())
            track_id = int(fa.get("track_id", 1))
            frame_idx = int(fa.get("frame_idx", 0))
            polygon_json = json.dumps(fa.get("polygon", []))
            bbox_json = json.dumps(fa.get("bbox", [0, 0, 0, 0]))
            area = float(fa.get("area", 0.0))
            is_keyframe = 1 if fa.get("is_keyframe", False) else 0
            confidence = float(fa.get("confidence", 1.0))
            review_status = fa.get("review_status", "unreviewed")
            uncertainty_score = float(fa.get("uncertainty_score", 0.0))
            priority_tier = fa.get("priority_tier", "low")
            flag_reasons = json.dumps(fa.get("flag_reasons", []))
            source = fa.get("source", "manual")

            cursor.execute(
                """
                INSERT INTO video_frame_annotations
                (id, video_id, track_id, frame_idx, polygon, bbox, area, is_keyframe, confidence,
                 review_status, uncertainty_score, priority_tier, flag_reasons, source, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (fa_id, video_id, track_id, frame_idx, polygon_json, bbox_json, area, is_keyframe, confidence,
                 review_status, uncertainty_score, priority_tier, flag_reasons, source, ts, ts)
            )

        conn.commit()
    finally:
        conn.close()
    return get_video_tracks_and_annotations(video_id)

def get_video_tracks_and_annotations(video_id: str) -> Dict[str, Any]:
    conn = get_connection()
    track_rows = conn.execute(
        "SELECT * FROM video_tracks WHERE video_id = ? ORDER BY track_id ASC",
        (video_id,)
    ).fetchall()
    
    fa_rows = conn.execute(
        "SELECT * FROM video_frame_annotations WHERE video_id = ? ORDER BY frame_idx ASC, track_id ASC",
        (video_id,)
    ).fetchall()
    conn.close()

    tracks = [dict(t) for t in track_rows]
    annotations = []
    for r in fa_rows:
        d = dict(r)
        d["polygon"] = json.loads(d["polygon"]) if d.get("polygon") else []
        d["bbox"] = json.loads(d["bbox"]) if d.get("bbox") else [0, 0, 0, 0]
        d["is_keyframe"] = bool(d["is_keyframe"])
        d["flag_reasons"] = json.loads(d["flag_reasons"]) if d.get("flag_reasons") else []
        annotations.append(d)

    return {
        "video_id": video_id,
        "tracks": tracks,
        "annotations": annotations
    }

def delete_video_track(video_id: str, track_id: int) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM video_tracks WHERE video_id = ? AND track_id = ?", (video_id, track_id))
    cursor.execute("DELETE FROM video_frame_annotations WHERE video_id = ? AND track_id = ?", (video_id, track_id))
    cursor.execute("DELETE FROM uncertainty_records WHERE video_id = ? AND track_id = ?", (video_id, track_id))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted

def get_annotation_by_id(annotation_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM video_frame_annotations WHERE id = ?", (annotation_id,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["polygon"] = json.loads(d["polygon"]) if d.get("polygon") else []
    d["bbox"] = json.loads(d["bbox"]) if d.get("bbox") else [0, 0, 0, 0]
    d["is_keyframe"] = bool(d["is_keyframe"])
    d["flag_reasons"] = json.loads(d["flag_reasons"]) if d.get("flag_reasons") else []
    return d

def update_annotation_by_id(annotation_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    ts = now_iso()
    fields = []
    values = []
    for k in ["polygon", "bbox", "area", "review_status", "confidence", "is_keyframe", "uncertainty_score", "priority_tier", "flag_reasons", "source"]:
        if k in updates:
            fields.append(f"{k} = ?")
            val = updates[k]
            if k in ["polygon", "bbox", "flag_reasons"] and isinstance(val, (list, dict)):
                val = json.dumps(val)
            elif k == "is_keyframe":
                val = 1 if val else 0
            values.append(val)
    if not fields:
        conn.close()
        return get_annotation_by_id(annotation_id)

    fields.append("updated_at = ?")
    values.append(ts)
    values.append(annotation_id)

    conn.execute(f"UPDATE video_frame_annotations SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return get_annotation_by_id(annotation_id)

# ------------------------------------------
# Reviews & Audit Trail
# ------------------------------------------
def save_review_record(
    annotation_id: str,
    video_id: str,
    frame_idx: int,
    track_id: int,
    review_action: str,
    original_prediction: Dict[str, Any],
    corrected_annotation: Optional[Dict[str, Any]] = None,
    reviewer_notes: Optional[str] = None
) -> Dict[str, Any]:
    conn = get_connection()
    rev_id = str(uuid.uuid4())
    ts = now_iso()
    orig_json = json.dumps(original_prediction)
    corr_json = json.dumps(corrected_annotation) if corrected_annotation else None

    # Insert into reviews audit log
    conn.execute(
        """
        INSERT INTO reviews (id, annotation_id, video_id, frame_idx, track_id, original_prediction, corrected_annotation, review_action, reviewer_notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (rev_id, annotation_id, video_id, frame_idx, track_id, orig_json, corr_json, review_action, reviewer_notes, ts)
    )

    # Update annotation status in video_frame_annotations
    new_status = review_action  # 'approved', 'corrected', 'rejected', 'skipped'
    cursor = conn.cursor()
    if corrected_annotation:
        new_poly = json.dumps(corrected_annotation.get("polygon", []))
        new_bbox = json.dumps(corrected_annotation.get("bbox", [0, 0, 0, 0]))
        new_area = float(corrected_annotation.get("area", 0.0))
        cursor.execute(
            """
            UPDATE video_frame_annotations
            SET review_status = ?, polygon = ?, bbox = ?, area = ?, uncertainty_score = 0.0, priority_tier = 'low', updated_at = ?
            WHERE id = ?
            """,
            (new_status, new_poly, new_bbox, new_area, ts, annotation_id)
        )
    else:
        cursor.execute(
            """
            UPDATE video_frame_annotations
            SET review_status = ?, updated_at = ?
            WHERE id = ?
            """,
            (new_status, ts, annotation_id)
        )

    conn.commit()
    conn.close()
    return {
        "id": rev_id,
        "annotation_id": annotation_id,
        "video_id": video_id,
        "frame_idx": frame_idx,
        "track_id": track_id,
        "review_action": review_action,
        "reviewer_notes": reviewer_notes,
        "created_at": ts
    }

def get_reviews_for_video(video_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM reviews WHERE video_id = ? ORDER BY created_at DESC", (video_id,)).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        d["original_prediction"] = json.loads(d["original_prediction"]) if d.get("original_prediction") else {}
        d["corrected_annotation"] = json.loads(d["corrected_annotation"]) if d.get("corrected_annotation") else None
        results.append(d)
    return results
