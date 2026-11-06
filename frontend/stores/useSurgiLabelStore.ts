import { create } from "zustand";
import {
  Project,
  SurgiVideo,
  SurgiAnnotation,
  SurgicalPhaseInterval,
  AnnotationTool,
  AnnotationClass,
  ReviewStatus,
  DEFAULT_SURGICAL_CLASSES,
} from "@/lib/surgiLabelTypes";
import {
  DEMO_PROJECT,
  SECONDARY_PROJECTS,
  DEMO_PHASE_INTERVALS,
  generateDemoAnnotations,
} from "@/lib/surgiLabelDemoData";

interface SurgiLabelState {
  projects: Project[];
  currentProjectId: string;
  currentVideoId: string;
  annotations: SurgiAnnotation[];
  phaseIntervals: SurgicalPhaseInterval[];

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

const STORAGE_KEY = "surgilabel_state_v1";

export const useSurgiLabelStore = create<SurgiLabelState>((set, get) => {
  // Initial state setup with demo fallback
  const initialProjects: Project[] = [DEMO_PROJECT, ...SECONDARY_PROJECTS];
  const initialAnnotations: SurgiAnnotation[] = generateDemoAnnotations();
  const initialPhases: SurgicalPhaseInterval[] = DEMO_PHASE_INTERVALS;

  return {
    projects: initialProjects,
    currentProjectId: "proj_cholecystectomy",
    currentVideoId: "demo_laparoscopy_cholecystectomy",
    annotations: initialAnnotations,
    phaseIntervals: initialPhases,

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
      set((s) => ({
        annotations: s.annotations.map((a) =>
          a.id === id
            ? { ...a, review_status: status, review_notes: notes || a.review_notes, updated_at: new Date().toISOString() }
            : a
        ),
      }));
    },

    batchSetReviewStatus: (ids, status) => {
      const idSet = new Set(ids);
      set((s) => ({
        annotations: s.annotations.map((a) =>
          idSet.has(a.id)
            ? { ...a, review_status: status, updated_at: new Date().toISOString() }
            : a
        ),
      }));
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
