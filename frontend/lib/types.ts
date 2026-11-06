export type Point = [number, number];

export interface Annotation {
  id: string;
  image_id?: string;
  label: string;
  category: string;
  color: string;
  polygon: Point[];
  bbox: [number, number, number, number]; // [x, y, w, h]
  area: number;
  is_visible: boolean;
  model_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ImageItem {
  id: string;
  dataset_id: string;
  filename: string;
  file_format: string;
  file_size_bytes: number;
  width: number;
  height: number;
  channels: number;
  annotation_count: number;
  created_at: string;
  updated_at: string;
  annotations?: Annotation[];
}

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  image_count: number;
  annotation_count: number;
  created_at: string;
  updated_at: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  display_name: string;
  description: string;
  architecture: string;
  is_available: boolean;
  is_microscopy_specialized: boolean;
  speed_rating: string;
  recommended_for: string[];
  parameters: {
    min_area?: { type: string; default: number; min: number; max: number };
    max_area?: { type: string; default: number; min: number; max: number };
    threshold?: { type: string; default: number; min: number; max: number };
  };
}

export interface SegmentationResult {
  image_id: string;
  model_id: string;
  model_name: string;
  detected_count: number;
  inference_time_ms: number;
  annotations: Annotation[];
  metadata?: Record<string, any>;
}

export interface BenchmarkModelResult {
  model_id: string;
  model_name: string;
  detected_count: number;
  inference_time_ms: number;
  mean_object_area: number;
  notes: string;
}

export interface BenchmarkResponse {
  image_id: string;
  results: BenchmarkModelResult[];
  recommendation: string;
}

export type ToolType = "select" | "box" | "polygon" | "pan";
