export type SurgicalCategory = "instrument" | "tissue" | "organ" | "lesion";

export type AnnotationTool =
  | "select"
  | "bbox"
  | "polygon"
  | "point"
  | "pan"
  | "zoom"
  | "delete";

export type ReviewStatus =
  | "unreviewed"
  | "pending_review"
  | "approved"
  | "corrected"
  | "rejected"
  | "skipped";

export type PriorityTier = "high" | "medium" | "low";

export interface AnnotationClass {
  id: string;
  name: string;
  color: string;
  category: SurgicalCategory;
}

export interface UncertaintySignals {
  detection_uncertainty: number;
  temporal_instability: number;
  tracking_inconsistency: number;
  shape_anomaly: number;
  overall_review_priority: number;
  priority_tier: PriorityTier;
  reasons: string[];
}

export interface SurgiAnnotation {
  id: string;
  video_id: string;
  track_id: number;
  frame_idx: number;
  class_id: string;
  label: string;
  color: string;
  type: "bbox" | "polygon" | "point";
  bbox: [number, number, number, number]; // [x, y, width, height] in video space
  polygon: [number, number][]; // [[x, y], ...] in video space
  is_keyframe: boolean;
  confidence: number;
  source: "manual" | "ai" | "ai_detector" | "ai_sam2" | "ai_propagated";
  review_status: ReviewStatus;
  review_notes?: string;
  uncertainty_score?: number;
  priority_tier?: PriorityTier;
  flag_reasons?: string[];
  created_at: string;
  updated_at: string;
}

export interface ReviewQueueItem {
  id: string;
  annotation_id: string;
  video_id: string;
  video_title?: string;
  frame_idx: number;
  timestamp_seconds: number;
  track_id: number;
  label: string;
  category: SurgicalCategory;
  color: string;
  bbox: [number, number, number, number];
  polygon: [number, number][];
  confidence: number;
  overall_review_priority: number;
  priority_tier: PriorityTier;
  review_status: ReviewStatus;
  reasons: string[];
  detection_uncertainty?: number;
  temporal_instability?: number;
  tracking_inconsistency?: number;
  shape_anomaly?: number;
  source?: string;
}

export interface SurgicalPhaseInterval {
  id: string;
  video_id: string;
  phase_name: string;
  start_frame: number;
  end_frame: number;
  color: string;
  notes?: string;
}

export interface SurgiVideo {
  id: string;
  project_id: string;
  filename: string;
  url: string;
  thumbnail_url?: string;
  duration_seconds: number;
  fps: number;
  total_frames: number;
  width: number;
  height: number;
  status: "uploaded" | "annotating" | "reviewed" | "completed";
  annotation_count: number;
  pending_reviews?: number;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "in_progress" | "review" | "completed";
  classes: AnnotationClass[];
  videos: SurgiVideo[];
  annotated_frames_count: number;
  total_frames_count: number;
  annotation_progress: number;
  pending_reviews?: number;
  created_at: string;
  updated_at: string;
}

export interface UserActivity {
  id: string;
  user_name: string;
  user_avatar?: string;
  action: string;
  target: string;
  timestamp: string;
  type: "annotation" | "review" | "upload" | "export";
}

export interface UncertaintySettings {
  w_detection: number;
  w_temporal: number;
  w_tracking: number;
  w_shape: number;
  threshold_high: number;
  threshold_medium: number;
}

export const DEFAULT_SURGICAL_CLASSES: AnnotationClass[] = [
  { id: "c_grasper", name: "Laparoscopic Grasper", color: "#3B82F6", category: "instrument" },
  { id: "c_hook", name: "Electrocautery Hook", color: "#EF4444", category: "instrument" },
  { id: "c_fundus", name: "Gallbladder Fundus", color: "#10B981", category: "organ" },
  { id: "c_liver", name: "Liver Parenchyma", color: "#F59E0B", category: "tissue" },
  { id: "c_scissors", name: "Surgical Scissors", color: "#8B5CF6", category: "instrument" },
  { id: "c_clip", name: "Clip Applier", color: "#06B6D4", category: "instrument" },
  { id: "c_irrigator", name: "Irrigator / Suction", color: "#38BDF8", category: "instrument" },
  { id: "c_bag", name: "Specimen Bag", color: "#F97316", category: "instrument" },
  { id: "c_other", name: "Other Instrument", color: "#94A3B8", category: "instrument" },
];

export const DEFAULT_SURGICAL_PHASES = [
  { name: "Preparation", color: "#64748B" },
  { name: "Dissection", color: "#F59E0B" },
  { name: "Clipping", color: "#10B981" },
  { name: "Cutting", color: "#3B82F6" },
  { name: "Extraction", color: "#8B5CF6" },
  { name: "Closure", color: "#06B6D4" },
];
