import { create } from "zustand";
import {
  Project,
  SurgiVideo,
  SurgiAnnotation,
  SurgicalPhaseInterval,
  AnnotationTool,
  ReviewStatus,
  PriorityTier,
  ReviewQueueItem,
  DEFAULT_SURGICAL_CLASSES,
} from "@/lib/surgiLabelTypes";
import {
  DEMO_PROJECT,
  SECONDARY_PROJECTS,
  DEMO_PHASE_INTERVALS,
  generateDemoAnnotations,
  generateDemoReviewQueue,
} from "@/lib/surgiLabelDemoData";

interface SurgiLabelState {
  projects: Project[];
  currentProjectId: string;
  currentVideoId: string;
  annotations: SurgiAnnotation[];
  phaseIntervals: SurgicalPhaseInterval[];

  // Review Queue state
  reviewQueue: ReviewQueueItem[];
  activeReviewItem: ReviewQueueItem | null;
  reviewPriorityFilter: "all" | "high" | "medium" | "low";
  reviewStatusFilter: "all" | "unreviewed" | "approved" | "corrected" | "rejected";

  // AI inference state
  isAiProcessing: boolean;
  aiStatusMessage: string;

  // Workspace active state
  activeTool: AnnotationTool;
  currentFrame: number;
  selectedAnnotationId: string | null;
  selectedClassId: string;
  isPlaying: boolean;
  playbackSpeed: number;
  maskOpacity: number;
  showBoundingBoxes: boolean;
  showLabels: boolean;
  showAnnotations: boolean;
  zoom: number;
  pan: { x: number; y: number };

  // Undo / Redo
  past: SurgiAnnotation[][];
  future: SurgiAnnotation[][];

  // Actions
  setCurrentProject: (projectId: string) => void;
  setCurrentVideo: (videoId: string) => void;
  setCurrentFrame: (frame: number) => void;
  setActiveTool: (tool: AnnotationTool) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  setSelectedClassId: (classId: string) => void;

  setPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setMaskOpacity: (opacity: number) => void;
  setShowBoundingBoxes: (show: boolean) => void;
  setShowLabels: (show: boolean) => void;
  setShowAnnotations: (show: boolean) => void;

  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  resetView: () => void;

  // Review Queue Actions
  loadReviewQueue: (videoId?: string) => Promise<void>;
  submitReviewAction: (
    annotationId: string,
    action: ReviewStatus,
    correctedPoly?: [number, number][],
    correctedBbox?: [number, number, number, number],
    notes?: string
  ) => Promise<void>;
  batchApproveReviewQueue: (ids: string[]) => Promise<void>;
  setActiveReviewItem: (item: ReviewQueueItem | null) => void;
  setReviewPriorityFilter: (filter: "all" | "high" | "medium" | "low") => void;
  setReviewStatusFilter: (filter: "all" | "unreviewed" | "approved" | "corrected" | "rejected") => void;

  // AI Inference Actions
  runAiDetector: (frameIdx: number) => Promise<void>;
  runAiSegmentation: (frameIdx: number, promptType: "box" | "point", promptData: any) => Promise<void>;
  runAiPropagation: (keyframeIdx: number, promptType?: string, promptData?: any) => Promise<void>;

  // Project Actions
  addProject: (project: Omit<Project, "id" | "created_at" | "updated_at">) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  // Video Actions
  addVideoToProject: (projectId: string, video: Omit<SurgiVideo, "id" | "project_id" | "created_at">) => SurgiVideo;
  deleteVideo: (videoId: string) => void;

  // Annotation Actions
  addAnnotation: (ann: Omit<SurgiAnnotation, "id" | "created_at" | "updated_at">) => void;
  updateAnnotation: (id: string, updates: Partial<SurgiAnnotation>) => void;
  deleteAnnotation: (id: string) => void;
  setAnnotationReviewStatus: (id: string, status: ReviewStatus, notes?: string) => void;
  batchSetReviewStatus: (ids: string[], status: ReviewStatus) => void;

  // Phase Intervals
  addPhaseInterval: (interval: Omit<SurgicalPhaseInterval, "id">) => void;
  updatePhaseInterval: (id: string, updates: Partial<SurgicalPhaseInterval>) => void;
  deletePhaseInterval: (id: string) => void;

  // History
  undo: () => void;
  redo: () => void;
}

export const useSurgiLabelStore = create<SurgiLabelState>((set, get) => {
  const initialProjects: Project[] = [DEMO_PROJECT, ...SECONDARY_PROJECTS];
  const initialAnnotations: SurgiAnnotation[] = generateDemoAnnotations();
  const initialPhases: SurgicalPhaseInterval[] = DEMO_PHASE_INTERVALS;
  const initialReviewQueue: ReviewQueueItem[] = generateDemoReviewQueue();

  return {
    projects: initialProjects,
    currentProjectId: "proj_cholecystectomy",
    currentVideoId: "demo_laparoscopy_cholecystectomy",
    annotations: initialAnnotations,
    phaseIntervals: initialPhases,

    reviewQueue: initialReviewQueue,
    activeReviewItem: null,
    reviewPriorityFilter: "all",
    reviewStatusFilter: "all",

    isAiProcessing: false,
    aiStatusMessage: "",

    activeTool: "select",
    currentFrame: 0,
    selectedAnnotationId: null,
    selectedClassId: "c_grasper",
    isPlaying: false,
    playbackSpeed: 1.0,
    maskOpacity: 0.45,
    showBoundingBoxes: true,
    showLabels: true,
    showAnnotations: true,
    zoom: 1.0,
    pan: { x: 0, y: 0 },

    past: [],
    future: [],

    setCurrentProject: (projectId: string) => {
      const proj = get().projects.find((p) => p.id === projectId);
      const firstVid = proj?.videos[0]?.id || "";
      set({ currentProjectId: projectId, currentVideoId: firstVid, currentFrame: 0 });
    },

    setCurrentVideo: (videoId: string) => {
      set({ currentVideoId: videoId, currentFrame: 0, selectedAnnotationId: null });
    },

    setCurrentFrame: (frame: number) => {
      set({ currentFrame: frame });
    },

    setActiveTool: (tool: AnnotationTool) => {
      set({ activeTool: tool });
    },

    setSelectedAnnotationId: (id: string | null) => {
      set({ selectedAnnotationId: id });
    },

    setSelectedClassId: (classId: string) => {
      set({ selectedClassId: classId });
    },

    setPlaying: (playing: boolean) => set({ isPlaying: playing }),
    setPlaybackSpeed: (speed: number) => set({ playbackSpeed: speed }),
    setMaskOpacity: (opacity: number) => set({ maskOpacity: opacity }),
    setShowBoundingBoxes: (show: boolean) => set({ showBoundingBoxes: show }),
    setShowLabels: (show: boolean) => set({ showLabels: show }),
    setShowAnnotations: (show: boolean) => set({ showAnnotations: show }),

    setZoom: (zoom: number) => set({ zoom: Math.max(0.2, Math.min(5.0, zoom)) }),
    setPan: (pan) => set({ pan }),
    resetView: () => set({ zoom: 1.0, pan: { x: 0, y: 0 } }),

    // Review Queue
    loadReviewQueue: async (videoId) => {
      const vid = videoId || get().currentVideoId;
      try {
        const res = await fetch(`/api/reviews/queue?video_id=${encodeURIComponent(vid)}`);
        if (res.ok) {
          const items: ReviewQueueItem[] = await res.json();
          if (items.length > 0) {
            set({ reviewQueue: items });
            return;
          }
        }
      } catch (err) {
        // Fallback to local computed items
      }
      set({ reviewQueue: generateDemoReviewQueue() });
    },

    submitReviewAction: async (annotationId, action, correctedPoly, correctedBbox, notes) => {
      // 1. Optimistic local update
      set((s) => ({
        annotations: s.annotations.map((a) =>
          a.id === annotationId
            ? {
                ...a,
                review_status: action,
                polygon: correctedPoly || a.polygon,
                bbox: correctedBbox || a.bbox,
                uncertainty_score: action === "approved" || action === "corrected" ? 0.0 : a.uncertainty_score,
                priority_tier: action === "approved" || action === "corrected" ? "low" : a.priority_tier,
                review_notes: notes || a.review_notes,
                updated_at: new Date().toISOString(),
              }
            : a
        ),
        reviewQueue: s.reviewQueue.map((item) =>
          item.annotation_id === annotationId
            ? {
                ...item,
                review_status: action,
                polygon: correctedPoly || item.polygon,
                bbox: correctedBbox || item.bbox,
                overall_review_priority: action === "approved" || action === "corrected" ? 0.0 : item.overall_review_priority,
              }
            : item
        ),
      }));

      // 2. Persist to backend
      try {
        await fetch(`/api/reviews/${encodeURIComponent(annotationId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            review_action: action,
            corrected_polygon: correctedPoly,
            corrected_bbox: correctedBbox,
            reviewer_notes: notes,
          }),
        });
      } catch (err) {
        console.error("Failed to persist review decision to backend:", err);
      }
    },

    batchApproveReviewQueue: async (ids) => {
      const idSet = new Set(ids);
      set((s) => ({
        annotations: s.annotations.map((a) =>
          idSet.has(a.id) ? { ...a, review_status: "approved", priority_tier: "low", uncertainty_score: 0.0 } : a
        ),
        reviewQueue: s.reviewQueue.map((item) =>
          idSet.has(item.annotation_id)
            ? { ...item, review_status: "approved", overall_review_priority: 0.0 }
            : item
        ),
      }));

      try {
        await fetch("/api/reviews/batch/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            annotation_ids: ids,
            review_action: "approved",
          }),
        });
      } catch (err) {
        console.error("Batch review action error:", err);
      }
    },

    setActiveReviewItem: (item) => {
      set({ activeReviewItem: item });
      if (item) {
        set({
          currentFrame: item.frame_idx,
          selectedAnnotationId: item.annotation_id,
        });
      }
    },

    setReviewPriorityFilter: (filter) => set({ reviewPriorityFilter: filter }),
    setReviewStatusFilter: (filter) => set({ reviewStatusFilter: filter }),

    // AI Inference
    runAiDetector: async (frameIdx) => {
      const vid = get().currentVideoId;
      set({ isAiProcessing: true, aiStatusMessage: "Running Surgical Instrument Detector..." });

      try {
        const res = await fetch("/api/inference/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_id: vid, frame_idx: frameIdx, min_confidence: 0.40 }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.detections && data.detections.length > 0) {
            data.detections.forEach((d: any) => {
              get().addAnnotation({
                video_id: vid,
                track_id: Math.floor(Math.random() * 10) + 1,
                frame_idx: frameIdx,
                class_id: "c_grasper",
                label: d.label,
                color: d.color || "#3B82F6",
                type: "bbox",
                bbox: d.bbox,
                polygon: [
                  [d.bbox[0], d.bbox[1]],
                  [d.bbox[0] + d.bbox[2], d.bbox[1]],
                  [d.bbox[0] + d.bbox[2], d.bbox[1] + d.bbox[3]],
                  [d.bbox[0], d.bbox[1] + d.bbox[3]],
                ],
                is_keyframe: true,
                confidence: d.confidence,
                source: "ai_detector",
                review_status: "unreviewed",
                uncertainty_score: 1.0 - d.confidence,
                priority_tier: d.confidence < 0.65 ? "high" : "low",
                flag_reasons: d.confidence < 0.65 ? ["Low detector confidence"] : [],
              });
            });
          }
        }
      } catch (e) {
        console.error("Detector inference error:", e);
      } finally {
        set({ isAiProcessing: false, aiStatusMessage: "" });
      }
    },

    runAiSegmentation: async (frameIdx, promptType, promptData) => {
      const vid = get().currentVideoId;
      set({ isAiProcessing: true, aiStatusMessage: "Generating SAM 2 Mask..." });

      try {
        const res = await fetch("/api/inference/segment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            video_id: vid,
            frame_idx: frameIdx,
            prompt_type: promptType,
            prompt_data: promptData,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          get().addAnnotation({
            video_id: vid,
            track_id: 1,
            frame_idx: frameIdx,
            class_id: "c_grasper",
            label: data.label || "Segmented Instrument",
            color: data.color || "#3B82F6",
            type: "polygon",
            bbox: data.bbox,
            polygon: data.polygon,
            is_keyframe: true,
            confidence: data.confidence || 0.95,
            source: "ai_sam2",
            review_status: "unreviewed",
          });
        }
      } catch (e) {
        console.error("Segmentation inference error:", e);
      } finally {
        set({ isAiProcessing: false, aiStatusMessage: "" });
      }
    },

    runAiPropagation: async (keyframeIdx, promptType = "box", promptData = [100, 100, 150, 120]) => {
      const vid = get().currentVideoId;
      set({ isAiProcessing: true, aiStatusMessage: "Propagating temporal optical flow tracks..." });

      try {
        const res = await fetch("/api/inference/propagate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            video_id: vid,
            keyframe_idx: keyframeIdx,
            prompt_type: promptType,
            prompt_data: promptData,
          }),
        });
        if (res.ok) {
          await get().loadReviewQueue(vid);
        }
      } catch (e) {
        console.error("Propagation inference error:", e);
      } finally {
        set({ isAiProcessing: false, aiStatusMessage: "" });
      }
    },

    addProject: (data) => {
      const now = new Date().toISOString();
      const newProj: Project = {
        ...data,
        id: `proj_${Date.now()}`,
        created_at: now,
        updated_at: now,
      };
      set((s) => ({ projects: [newProj, ...s.projects] }));
      return newProj;
    },

    updateProject: (id, updates) => {
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
        ),
      }));
    },

    deleteProject: (id) => {
      set((s) => ({
        projects: s.projects.filter((p) => p.id !== id),
        currentProjectId: s.currentProjectId === id ? s.projects[0]?.id || "" : s.currentProjectId,
      }));
    },

    addVideoToProject: (projectId, videoData) => {
      const newVid: SurgiVideo = {
        ...videoData,
        id: `vid_${Date.now()}`,
        project_id: projectId,
        created_at: new Date().toISOString(),
      };
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === projectId
            ? { ...p, videos: [...p.videos, newVid], total_frames_count: p.total_frames_count + newVid.total_frames }
            : p
        ),
      }));
      return newVid;
    },

    deleteVideo: (videoId) => {
      set((s) => ({
        projects: s.projects.map((p) => ({
          ...p,
          videos: p.videos.filter((v) => v.id !== videoId),
        })),
        annotations: s.annotations.filter((a) => a.video_id !== videoId),
        phaseIntervals: s.phaseIntervals.filter((ph) => ph.video_id !== videoId),
      }));
    },

    addAnnotation: (annData) => {
      const now = new Date().toISOString();
      const newAnn: SurgiAnnotation = {
        ...annData,
        id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        created_at: now,
        updated_at: now,
      };
      set((s) => ({
        past: [...s.past, s.annotations],
        future: [],
        annotations: [...s.annotations, newAnn],
        selectedAnnotationId: newAnn.id,
      }));
    },

    updateAnnotation: (id, updates) => {
      set((s) => ({
        past: [...s.past, s.annotations],
        future: [],
        annotations: s.annotations.map((a) =>
          a.id === id ? { ...a, ...updates, updated_at: new Date().toISOString() } : a
        ),
      }));
    },

    deleteAnnotation: (id) => {
      set((s) => ({
        past: [...s.past, s.annotations],
        future: [],
        annotations: s.annotations.filter((a) => a.id !== id),
        selectedAnnotationId: s.selectedAnnotationId === id ? null : s.selectedAnnotationId,
      }));
    },

    setAnnotationReviewStatus: (id, status, notes) => {
      get().submitReviewAction(id, status, undefined, undefined, notes);
    },

    batchSetReviewStatus: (ids, status) => {
      get().batchApproveReviewQueue(ids);
    },

    addPhaseInterval: (intervalData) => {
      const newInterval: SurgicalPhaseInterval = {
        ...intervalData,
        id: `ph_${Date.now()}`,
      };
      set((s) => ({ phaseIntervals: [...s.phaseIntervals, newInterval] }));
    },

    updatePhaseInterval: (id, updates) => {
      set((s) => ({
        phaseIntervals: s.phaseIntervals.map((ph) => (ph.id === id ? { ...ph, ...updates } : ph)),
      }));
    },

    deletePhaseInterval: (id) => {
      set((s) => ({
        phaseIntervals: s.phaseIntervals.filter((ph) => ph.id !== id),
      }));
    },

    undo: () => {
      const { past, annotations, future } = get();
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      set({
        past: newPast,
        annotations: previous,
        future: [annotations, ...future],
      });
    },

    redo: () => {
      const { past, annotations, future } = get();
      if (future.length === 0) return;
      const next = future[0];
      const newFuture = future.slice(1);
      set({
        past: [...past, annotations],
        annotations: next,
        future: newFuture,
      });
    },
  };
});
