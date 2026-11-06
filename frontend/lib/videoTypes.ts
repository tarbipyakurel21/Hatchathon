export type SurgicalCategory = "instrument" | "tissue" | "organ" | "lesion";

export interface VideoItem {
  id: string;
  filename: string;
  file_path: string;
  thumbnail_path?: string | null;
  duration_seconds: number;
  fps: number;
  total_frames: number;
  width: number;
  height: number;
  file_size_bytes: number;
  status: string;
  created_at: string;
  updated_at: string;
  track_count?: number;
  frame_annotation_count?: number;
}

export interface VideoTrack {
  id?: string;
  video_id?: string;
  track_id: number;
  label: string;
  category: SurgicalCategory;
  color: string;
  created_at?: string;
  updated_at?: string;
}

export interface VideoFrameAnnotation {
  id?: string;
  video_id?: string;
  track_id: number;
  frame_idx: number;
  polygon: [number, number][];
  bbox: [number, number, number, number]; // [x, y, w, h]
  area: number;
  is_keyframe: boolean;
  confidence?: number;
  created_at?: string;
  updated_at?: string;
}

export interface VideoTracksResponse {
  video_id: string;
  tracks: VideoTrack[];
  annotations: VideoFrameAnnotation[];
}

export interface TrackPromptResult {
  status: string;
  model: string;
  track: VideoTrack;
  tracked_frames_count: number;
  inference_time_ms: number;
  fps_speed: number;
  annotations: VideoFrameAnnotation[];
}
