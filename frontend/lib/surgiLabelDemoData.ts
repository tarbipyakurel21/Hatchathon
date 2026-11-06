import {
  Project,
  SurgiVideo,
  SurgiAnnotation,
  SurgicalPhaseInterval,
  DEFAULT_SURGICAL_CLASSES,
  UserActivity,
} from "./surgiLabelTypes";

export const DEMO_VIDEO: SurgiVideo = {
  id: "demo_laparoscopy_cholecystectomy",
  project_id: "proj_cholecystectomy",
  filename: "Laparoscopic Cholecystectomy (Clinical Surgery).mp4",
  url: "/api/videos/demo_laparoscopy_cholecystectomy/file",
  thumbnail_url: "/api/videos/demo_laparoscopy_cholecystectomy/thumbnail",
  duration_seconds: 4.8,
  fps: 25.0,
  total_frames: 120,
  width: 640,
  height: 480,
  status: "annotating",
  annotation_count: 480,
  created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
};

export const DEMO_PROJECT: Project = {
  id: "proj_cholecystectomy",
  name: "Laparoscopic Cholecystectomy Annotation",
  description:
    "High-fidelity surgical dataset capturing instrument retraction, electrocautery Hook dissection, and hepatobiliary boundary segmentation during laparoscopic cholecystectomy.",
  status: "in_progress",
  classes: DEFAULT_SURGICAL_CLASSES,
  videos: [DEMO_VIDEO],
  annotated_frames_count: 120,
  total_frames_count: 120,
  annotation_progress: 85,
  created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
  updated_at: new Date().toISOString(),
};

export const SECONDARY_PROJECTS: Project[] = [
  {
    id: "proj_davinci_robotics",
    name: "Robotic DaVinci Partial Nephrectomy",
    description:
      "Multi-arm robotic instrumentation tracking (ProGrasp Forceps, Maryland Bipolar, Monopolar Curved Scissors) with renal arterial clamping phases.",
    status: "in_progress",
    classes: DEFAULT_SURGICAL_CLASSES,
    videos: [
      {
        id: "vid_robotics_01",
        project_id: "proj_davinci_robotics",
        filename: "DaVinci_Xi_Renal_Resection_Clip04.mp4",
        url: "/api/videos/demo_laparoscopy_cholecystectomy/file",
        duration_seconds: 12.5,
        fps: 30.0,
        total_frames: 375,
        width: 1280,
        height: 720,
        status: "annotating",
        annotation_count: 320,
        created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
      },
    ],
    annotated_frames_count: 320,
    total_frames_count: 375,
    annotation_progress: 85,
    created_at: new Date(Date.now() - 3600000 * 96).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: "proj_endoscopic_sinus",
    name: "Endoscopic Sinus Surgery (FESS) Dataset",
    description:
      "Fine instrument tracking for micro-debriders, Blakesley forceps, and suction coagulators in narrow endoscopic mucosal fields.",
    status: "review",
    classes: DEFAULT_SURGICAL_CLASSES,
    videos: [
      {
        id: "vid_fess_02",
        project_id: "proj_endoscopic_sinus",
        filename: "FESS_Ethmoidectomy_Patient12.mp4",
        url: "/api/videos/demo_laparoscopy_cholecystectomy/file",
        duration_seconds: 8.0,
        fps: 25.0,
        total_frames: 200,
        width: 1920,
        height: 1080,
        status: "reviewed",
        annotation_count: 190,
        created_at: new Date(Date.now() - 3600000 * 120).toISOString(),
      },
    ],
    annotated_frames_count: 190,
    total_frames_count: 200,
    annotation_progress: 95,
    created_at: new Date(Date.now() - 3600000 * 140).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
];

export const DEMO_PHASE_INTERVALS: SurgicalPhaseInterval[] = [
  {
    id: "ph_1",
    video_id: "demo_laparoscopy_cholecystectomy",
    phase_name: "Preparation",
    start_frame: 0,
    end_frame: 24,
    color: "#64748B",
    notes: "Abdominal cavity inspection and liver retraction",
  },
  {
    id: "ph_2",
    video_id: "demo_laparoscopy_cholecystectomy",
    phase_name: "Dissection",
    start_frame: 25,
    end_frame: 79,
    color: "#F59E0B",
    notes: "Calot triangle electrocautery hook dissection",
  },
  {
    id: "ph_3",
    video_id: "demo_laparoscopy_cholecystectomy",
    phase_name: "Clipping",
    start_frame: 80,
    end_frame: 104,
    color: "#10B981",
    notes: "Cystic duct identification and titanium clip apposition",
  },
  {
    id: "ph_4",
    video_id: "demo_laparoscopy_cholecystectomy",
    phase_name: "Extraction",
    start_frame: 105,
    end_frame: 119,
    color: "#8B5CF6",
    notes: "Gallbladder bed detachment into endobag",
  },
];

export const DEMO_ACTIVITIES: UserActivity[] = [
  {
    id: "act_1",
    user_name: "Dr. Alexander Ross (Attending)",
    action: "approved",
    target: "120 annotations on Track #1 (Laparoscopic Grasper)",
    timestamp: "8 minutes ago",
    type: "review",
  },
  {
    id: "act_2",
    user_name: "AI Inference Engine (SAM 2 Tiny)",
    action: "propagated",
    target: "optical flow masks for Track #2 (Electrocautery Hook)",
    timestamp: "24 minutes ago",
    type: "annotation",
  },
  {
    id: "act_3",
    user_name: "Elena Rostova (CV Lead)",
    action: "exported",
    target: "Video-COCO and YOLOv8 dataset package",
    timestamp: "2 hours ago",
    type: "export",
  },
  {
    id: "act_4",
    user_name: "Dr. Alexander Ross",
    action: "uploaded",
    target: "Human Laparoscopic Cholecystectomy video (120 frames)",
    timestamp: "5 hours ago",
    type: "upload",
  },
];

// Helper to generate base demo annotations for all 120 frames of the cholecystectomy video
export function generateDemoAnnotations(): SurgiAnnotation[] {
  const anns: SurgiAnnotation[] = [];
  const totalFrames = 120;

  for (let f = 0; f < totalFrames; f++) {
    const t = f / totalFrames;

    // Track 1: Grasper (instrument, cyan #22D3EE)
    const g_cx = 160 + t * 40;
    const g_cy = 180 + t * 20;
    const g_w = 110;
    const g_h = 85;
    anns.push({
      id: `ann_g_${f}`,
      video_id: "demo_laparoscopy_cholecystectomy",
      track_id: 1,
      frame_idx: f,
      class_id: "c_grasper",
      label: "Grasper",
      color: "#22D3EE",
      type: "bbox",
      bbox: [Math.round(g_cx - g_w / 2), Math.round(g_cy - g_h / 2), g_w, g_h],
      polygon: [
        [g_cx - 40, g_cy - 30],
        [g_cx + 45, g_cy - 10],
        [g_cx + 50, g_cy + 25],
        [g_cx - 20, g_cy + 35],
      ],
      is_keyframe: f === 0 || f === 60,
      confidence: 0.99,
      source: "manual",
      review_status: "approved",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Track 2: Hook (instrument, amber #F59E0B)
    const h_cx = 380 - t * 35;
    const h_cy = 200 + t * 25;
    const h_w = 95;
    const h_h = 80;
    anns.push({
      id: `ann_h_${f}`,
      video_id: "demo_laparoscopy_cholecystectomy",
      track_id: 2,
      frame_idx: f,
      class_id: "c_hook",
      label: "Hook",
      color: "#F59E0B",
      type: "bbox",
      bbox: [Math.round(h_cx - h_w / 2), Math.round(h_cy - h_h / 2), h_w, h_h],
      polygon: [
        [h_cx - 30, h_cy - 25],
        [h_cx + 35, h_cy - 15],
        [h_cx + 40, h_cy + 30],
        [h_cx - 15, h_cy + 25],
      ],
      is_keyframe: f === 0,
      confidence: 0.97,
      source: "ai",
      review_status: f < 90 ? "approved" : "unreviewed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Track 3: Gallbladder Fundus (organ, emerald #10B981)
    const gb_cx = 270 + Math.sin(t * Math.PI * 2) * 4;
    const gb_cy = 140 + Math.cos(t * Math.PI * 2) * 3;
    const gb_w = 135;
    const gb_h = 110;
    anns.push({
      id: `ann_gb_${f}`,
      video_id: "demo_laparoscopy_cholecystectomy",
      track_id: 3,
      frame_idx: f,
      class_id: "c_gallbladder",
      label: "Gallbladder Fundus",
      color: "#10B981",
      type: "polygon",
      bbox: [Math.round(gb_cx - gb_w / 2), Math.round(gb_cy - gb_h / 2), gb_w, gb_h],
      polygon: [
        [gb_cx - 55, gb_cy - 35],
        [gb_cx + 45, gb_cy - 40],
        [gb_cx + 60, gb_cy + 30],
        [gb_cx - 10, gb_cy + 50],
        [gb_cx - 50, gb_cy + 20],
      ],
      is_keyframe: f === 0,
      confidence: 0.98,
      source: "manual",
      review_status: "approved",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Track 4: Liver Parenchyma (tissue, violet #A855F7)
    const l_cx = 90;
    const l_cy = 300;
    const l_w = 180;
    const l_h = 120;
    anns.push({
      id: `ann_l_${f}`,
      video_id: "demo_laparoscopy_cholecystectomy",
      track_id: 4,
      frame_idx: f,
      class_id: "c_liver",
      label: "Liver Parenchyma",
      color: "#A855F7",
      type: "polygon",
      bbox: [Math.round(l_cx - l_w / 2), Math.round(l_cy - l_h / 2), l_w, l_h],
      polygon: [
        [l_cx - 70, l_cy - 40],
        [l_cx + 70, l_cy - 20],
        [l_cx + 80, l_cy + 50],
        [l_cx - 60, l_cy + 45],
      ],
      is_keyframe: f === 0,
      confidence: 0.96,
      source: "ai",
      review_status: "approved",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return anns;
}
