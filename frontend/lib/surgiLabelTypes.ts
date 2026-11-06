export type SurgicalCategory = "instrument" | "tissue" | "organ" | "lesion";

export type AnnotationTool =
  | "select"
  | "bbox"
  | "polygon"
  | "point"
  | "pan"
  | "zoom"
  | "delete";

export type ReviewStatus = "unreviewed" | "approved" | "rejected";

export interface AnnotationClass {
  id: string;
  name: string;
  color: string;
  category: SurgicalCategory;
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
  source: "manual" | "ai";
  review_status: ReviewStatus;
  review_notes?: string;
  created_at: string;
  updated_at: string;
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

export const DEFAULT_SURGICAL_CLASSES: AnnotationClass[] = [
  { id: "c_grasper", name: "Grasper", color: "#22D3EE", category: "instrument" },
  { id: "c_scissors", name: "Scissors", color: "#3B82F6", category: "instrument" },
  { id: "c_hook", name: "Hook", color: "#F59E0B", category: "instrument" },
  { id: "c_clip", name: "Clip Applier", color: "#10B981", category: "instrument" },
  { id: "c_irrigator", name: "Irrigator", color: "#8B5CF6", category: "instrument" },
  { id: "c_bag", name: "Specimen Bag", color: "#EC4899", category: "instrument" },
  { id: "c_gallbladder", name: "Gallbladder Fundus", color: "#10B981", category: "organ" },
  { id: "c_liver", name: "Liver Parenchyma", color: "#A855F7", category: "tissue" },
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
