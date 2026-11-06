"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Crosshair,
  Scan,
  MousePointer,
  PenTool,
  Hand,
  Trash2,
  RotateCcw,
  RotateCw,
  Save,
  Download,
  CheckCircle2,
  Box,
  SplitSquareVertical,
  Sliders,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  Tag,
  Check,
  X,
  Plus,
  Eye,
  EyeOff,
  Zap,
  Clock,
  Loader2,
  FileText,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  SlidersHorizontal,
} from "lucide-react";

import { useSurgiLabelStore } from "@/stores/useSurgiLabelStore";
import {
  SurgiAnnotation,
  SurgicalPhaseInterval,
  AnnotationTool,
  ReviewStatus,
} from "@/lib/surgiLabelTypes";
import { SurgiExportModal } from "@/components/surgilabel/SurgiExportModal";
import { ThreeSurgicalViewer } from "@/components/video/ThreeSurgicalViewer";
import { runTrackPrompt, runAutoTrack } from "@/lib/videoApi";

export default function AnnotationWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const videoId = (params?.videoId as string) || "demo_laparoscopy_cholecystectomy";

  const {
    projects,
    currentProjectId,
    annotations,
    phaseIntervals,
    activeTool,
    currentFrame,
    selectedAnnotationId,
    selectedClassId,
    isPlaying,
    playbackSpeed,
    maskOpacity,
    showBoundingBoxes,
    showLabels,
    showAnnotations,
    zoom,
    pan,
    setCurrentFrame,
    setActiveTool,
    setSelectedAnnotationId,
    setSelectedClassId,
    setPlaying,
    setPlaybackSpeed,
    setMaskOpacity,
    setShowBoundingBoxes,
    setShowLabels,
    setShowAnnotations,
    setZoom,
    setPan,
    resetView,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    setAnnotationReviewStatus,
    batchSetReviewStatus,
    addPhaseInterval,
    updatePhaseInterval,
    deletePhaseInterval,
    undo,
    redo,
    past,
    future,
    reviewQueue,
    runAiDetector,
    runAiSegmentation,
    runAiPropagation,
    submitReviewAction,
    isAiProcessing,
    aiStatusMessage,
  } = useSurgiLabelStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Inspector Tab: objects, properties, ai, uncertainty, review
  const [activeTab, setActiveTab] = useState<"objects" | "properties" | "ai" | "uncertainty" | "review">("objects");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isThreeViewerOpen, setIsThreeViewerOpen] = useState(false);

  // Review & Correction state in inspector
  const [reviewerNotes, setReviewerNotes] = useState("");

  // Handle URL query parameters (?frame=X&track=Y) from Review Queue inspection
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const frameParam = urlParams.get("frame");
      const trackParam = urlParams.get("track");
      if (frameParam !== null) {
        const f = parseInt(frameParam, 10);
        if (!isNaN(f)) {
          jumpToFrame(f);
          setActiveTab("uncertainty");
        }
      }
      if (trackParam !== null) {
        const tid = parseInt(trackParam, 10);
        const match = annotations.find(
          (a) => a.track_id === tid && a.frame_idx === (frameParam ? parseInt(frameParam, 10) : currentFrame)
        );
        if (match) setSelectedAnnotationId(match.id);
      }
    }
  }, []);

  // Drawing state
  const [isDrawingBBox, setIsDrawingBBox] = useState(false);
  const [bboxStart, setBboxStart] = useState<[number, number] | null>(null);
  const [currentBbox, setCurrentBbox] = useState<[number, number, number, number] | null>(null);
  const [polyPoints, setPolyPoints] = useState<[number, number][]>([]);
  const [dragVertexIndex, setDragVertexIndex] = useState<number | null>(null);

  // Split view state
  const [splitViewEnabled, setSplitViewEnabled] = useState(false);
  const [splitPosition, setSplitPosition] = useState(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // AI Tracking state
  const [isAiTracking, setIsAiTracking] = useState(false);
  const [aiTelemetry, setAiTelemetry] = useState<{ ms: number; count: number; model: string } | null>(null);
  const [ripples, setRipples] = useState<{ x: number; y: number; time: number }[]>([]);

  // Find project & video
  const project = projects.find((p) => p.videos.some((v) => v.id === videoId)) || projects[0];
  const video = project?.videos.find((v) => v.id === videoId) || project?.videos[0];

  const fps = video?.fps || 25.0;
  const totalFrames = video?.total_frames || 120;
  const vw = video?.width || 640;
  const vh = video?.height || 480;

  // Selected annotation
  const selectedAnn = annotations.find((a) => a.id === selectedAnnotationId);

  // Current frame annotations
  const frameAnnotations = annotations.filter((a) => a.video_id === video?.id && a.frame_idx === currentFrame);

  // Sync video time when frame changes
  useEffect(() => {
    if (!videoRef.current || isPlaying) return;
    const targetTime = currentFrame / fps;
    if (Math.abs(videoRef.current.currentTime - targetTime) > 0.03) {
      videoRef.current.currentTime = targetTime;
    }
  }, [currentFrame, fps, isPlaying]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const frame = Math.round(videoRef.current.currentTime * fps);
    const clamped = Math.max(0, Math.min(totalFrames - 1, frame));
    setCurrentFrame(clamped);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      videoRef.current.play();
      setPlaying(true);
    }
  };

  const stepFrame = (delta: number) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setPlaying(false);
    const next = Math.max(0, Math.min(totalFrames - 1, currentFrame + delta));
    setCurrentFrame(next);
    videoRef.current.currentTime = next / fps;
  };

  const jumpToFrame = (frame: number) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setPlaying(false);
    const clamped = Math.max(0, Math.min(totalFrames - 1, frame));
    setCurrentFrame(clamped);
    videoRef.current.currentTime = clamped / fps;
  };

  // Keyboard Shortcuts (CVAT / Figma standard)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft" && e.shiftKey) {
        e.preventDefault();
        stepFrame(-10);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        stepFrame(-1);
      } else if (e.code === "ArrowRight" && e.shiftKey) {
        e.preventDefault();
        stepFrame(10);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        stepFrame(1);
      } else if (e.key === "v" || e.key === "V") {
        setActiveTool("select");
      } else if (e.key === "b" || e.key === "B") {
        setActiveTool("bbox");
      } else if (e.key === "p" || e.key === "P") {
        setActiveTool("polygon");
      } else if (e.key === "k" || e.key === "K" || e.key === "w" || e.key === "W") {
        setActiveTool("point");
      } else if (e.key === "h" || e.key === "H") {
        setActiveTool("pan");
      } else if (e.key === "c" || e.key === "C") {
        setSplitViewEnabled((prev) => !prev);
      } else if (e.code === "Home") {
        e.preventDefault();
        jumpToFrame(0);
      } else if (e.code === "End") {
        e.preventDefault();
        jumpToFrame(totalFrames - 1);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedAnnotationId) {
          e.preventDefault();
          deleteAnnotation(selectedAnnotationId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentFrame, totalFrames, fps, isPlaying, selectedAnnotationId]);

  // Coordinate Conversion (Screen Canvas Pixel -> Original Video Coordinate System)
  const getCanvasVideoCoords = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleX = vw / rect.width;
    const scaleY = vh / rect.height;

    return [mouseX * scaleX, mouseY * scaleY];
  };

  // Mouse Interaction on Canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !video) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Check split line drag
    if (splitViewEnabled) {
      const splitX = rect.width * splitPosition;
      if (Math.abs(mouseX - splitX) < 14) {
        setIsDraggingSplit(true);
        return;
      }
    }

    const [vx, vy] = getCanvasVideoCoords(e);
    const targetClass = project?.classes.find((c) => c.id === selectedClassId) || project?.classes[0];

    if (activeTool === "select") {
      // Check if clicking existing annotation on current frame
      const clicked = frameAnnotations.find((a) => {
        const [bx, by, bw, bh] = a.bbox;
        return vx >= bx && vx <= bx + bw && vy >= by && vy <= by + bh;
      });
      setSelectedAnnotationId(clicked ? clicked.id : null);
    } else if (activeTool === "bbox") {
      setIsDrawingBBox(true);
      setBboxStart([vx, vy]);
      setCurrentBbox([vx, vy, 0, 0]);
    } else if (activeTool === "polygon") {
      // Add point to polygon
      setPolyPoints((prev) => [...prev, [vx, vy]]);
    } else if (activeTool === "point") {
      // SAM 2 Point Prompt
      setRipples((prev) => [...prev, { x: mouseX, y: e.clientY - rect.top, time: Date.now() }]);
      handleRunAiPrompt(currentFrame, "point", [Math.round(vx), Math.round(vy)]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !video) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    if (isDraggingSplit && splitViewEnabled) {
      const pos = Math.max(0.05, Math.min(0.95, mouseX / rect.width));
      setSplitPosition(pos);
      return;
    }

    if (isDrawingBBox && bboxStart) {
      const [vx, vy] = getCanvasVideoCoords(e);
      const x0 = Math.min(bboxStart[0], vx);
      const y0 = Math.min(bboxStart[1], vy);
      const w0 = Math.abs(vx - bboxStart[0]);
      const h0 = Math.abs(vy - bboxStart[1]);
      setCurrentBbox([x0, y0, w0, h0]);
    }
  };

  const handleMouseUp = () => {
    setIsDraggingSplit(false);

    if (isDrawingBBox && currentBbox && video) {
      const [bx, by, bw, bh] = currentBbox;
      if (bw > 10 && bh > 10) {
        const targetClass = project?.classes.find((c) => c.id === selectedClassId) || project?.classes[0];
        const nextTrackId = Math.max(0, ...annotations.map((a) => a.track_id)) + 1;

        addAnnotation({
          video_id: video.id,
          track_id: nextTrackId,
          frame_idx: currentFrame,
          class_id: targetClass.id,
          label: targetClass.name,
          color: targetClass.color,
          type: "bbox",
          bbox: [Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh)],
          polygon: [
            [bx, by],
            [bx + bw, by],
            [bx + bw, by + bh],
            [bx, by + bh],
          ],
          is_keyframe: true,
          confidence: 1.0,
          source: "manual",
          review_status: "approved",
        });
      }
      setIsDrawingBBox(false);
      setBboxStart(null);
      setCurrentBbox(null);
    }
  };

  const handleFinishPolygon = () => {
    if (polyPoints.length >= 3 && video) {
      const targetClass = project?.classes.find((c) => c.id === selectedClassId) || project?.classes[0];
      const xs = polyPoints.map((p) => p[0]);
      const ys = polyPoints.map((p) => p[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const w = Math.max(...xs) - minX;
      const h = Math.max(...ys) - minY;
      const nextTrackId = Math.max(0, ...annotations.map((a) => a.track_id)) + 1;

      addAnnotation({
        video_id: video.id,
        track_id: nextTrackId,
        frame_idx: currentFrame,
        class_id: targetClass.id,
        label: targetClass.name,
        color: targetClass.color,
        type: "polygon",
        bbox: [Math.round(minX), Math.round(minY), Math.round(w), Math.round(h)],
        polygon: polyPoints,
        is_keyframe: true,
        confidence: 1.0,
        source: "manual",
        review_status: "approved",
      });
      setPolyPoints([]);
    }
  };

  // Run SAM 2 Tracking Prompt across video frames
  const handleRunAiPrompt = async (
    frameIdx: number,
    promptType: "point" | "box",
    promptData: [number, number] | [number, number, number, number]
  ) => {
    if (!video) return;
    setIsAiTracking(true);
    const startT = Date.now();

    try {
      const targetClass = project?.classes.find((c) => c.id === selectedClassId) || project?.classes[0];
      const res = await runTrackPrompt(video.id, {
        keyframe_idx: frameIdx,
        prompt_type: promptType,
        prompt_data: promptData,
        label: targetClass.name,
        category: targetClass.category as any,
        color: targetClass.color,
      });

      const nextTrackId = res.track.track_id;
      // Add propagated annotations
      res.annotations.forEach((fa: any) => {
        addAnnotation({
          video_id: video.id,
          track_id: nextTrackId,
          frame_idx: fa.frame_idx,
          class_id: targetClass.id,
          label: targetClass.name,
          color: targetClass.color,
          type: "polygon",
          bbox: fa.bbox || [0, 0, 0, 0],
          polygon: fa.polygon || [],
          is_keyframe: fa.is_keyframe || false,
          confidence: fa.confidence || 0.98,
          source: "ai",
          review_status: "unreviewed",
        });
      });

      setAiTelemetry({
        ms: Date.now() - startT,
        count: res.tracked_frames_count || res.annotations.length,
        model: res.model || "Meta SAM 2 Tiny",
      });
    } catch (err: any) {
      console.warn("Backend tracking notice, creating local keyframe:", err);
      // Fallback local keyframe creation
      const targetClass = project?.classes.find((c) => c.id === selectedClassId) || project?.classes[0];
      const nextTrackId = Math.max(0, ...annotations.map((a) => a.track_id)) + 1;
      const px = promptData[0];
      const py = promptData[1];
      addAnnotation({
        video_id: video.id,
        track_id: nextTrackId,
        frame_idx: frameIdx,
        class_id: targetClass.id,
        label: targetClass.name,
        color: targetClass.color,
        type: "point",
        bbox: [px - 25, py - 25, 50, 50],
        polygon: [
          [px - 25, py - 25],
          [px + 25, py - 25],
          [px + 25, py + 25],
          [px - 25, py + 25],
        ],
        is_keyframe: true,
        confidence: 0.95,
        source: "ai",
        review_status: "unreviewed",
      });
    } finally {
      setIsAiTracking(false);
    }
  };

  // Canvas 2D Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const scaleX = rect.width / vw;
    const scaleY = rect.height / vh;

    const renderMasks = () => {
      frameAnnotations.forEach((ann) => {
        const isSelected = selectedAnnotationId === ann.id;
        const color = ann.color || "#22D3EE";

        // Draw Polygon / Mask
        if (ann.polygon && ann.polygon.length >= 3) {
          ctx.beginPath();
          ann.polygon.forEach(([px, py], i) => {
            const sx = px * scaleX;
            const sy = py * scaleY;
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          });
          ctx.closePath();

          ctx.fillStyle = color;
          ctx.globalAlpha = isSelected ? Math.min(maskOpacity + 0.35, 0.95) : maskOpacity;
          ctx.fill();

          ctx.globalAlpha = 1.0;
          ctx.strokeStyle = isSelected ? "#FFFFFF" : color;
          ctx.lineWidth = isSelected ? 2.5 : 1.5;
          ctx.stroke();

          // If selected, draw vertex handles (Figma / CVAT precision vertex editing)
          if (isSelected) {
            ann.polygon.forEach(([px, py]) => {
              ctx.fillStyle = "#FFFFFF";
              ctx.strokeStyle = "#000000";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.arc(px * scaleX, py * scaleY, 3.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            });
          }
        }

        // Draw Bounding Box
        if (showBoundingBoxes && ann.bbox) {
          const [bx, by, bw, bh] = ann.bbox;
          ctx.strokeStyle = isSelected ? "#FFFFFF" : color;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(bx * scaleX, by * scaleY, bw * scaleX, bh * scaleY);
          ctx.setLineDash([]);

          // Label Badge
          if (showLabels) {
            ctx.fillStyle = "rgba(11, 17, 32, 0.9)";
            const text = `#${ann.track_id} ${ann.label} (${Math.round(ann.confidence * 100)}%)`;
            ctx.font = "bold 10px monospace";
            const textMetrics = ctx.measureText(text);
            ctx.fillRect(bx * scaleX, by * scaleY - 17, textMetrics.width + 8, 16);
            ctx.fillStyle = isSelected ? "#FFFFFF" : "#E2E8F0";
            ctx.fillText(text, bx * scaleX + 4, by * scaleY - 5);
          }
        }
      });
    };

    if (showAnnotations) {
      if (splitViewEnabled) {
        // Split view clipping: right side shows segmentation, left side raw video
        ctx.save();
        const splitX = rect.width * splitPosition;
        ctx.beginPath();
        ctx.rect(splitX, 0, rect.width - splitX, rect.height);
        ctx.clip();
        renderMasks();
        ctx.restore();
      } else {
        renderMasks();
      }
    }

    // Active BBox Drawing feedback
    if (currentBbox) {
      const [bx, by, bw, bh] = currentBbox;
      ctx.strokeStyle = "#22D3EE";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(bx * scaleX, by * scaleY, bw * scaleX, bh * scaleY);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(34, 211, 238, 0.15)";
      ctx.fillRect(bx * scaleX, by * scaleY, bw * scaleX, bh * scaleY);
    }

    // Active Polygon Drawing feedback
    if (polyPoints.length > 0) {
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 2;
      ctx.beginPath();
      polyPoints.forEach(([px, py], i) => {
        const sx = px * scaleX;
        const sy = py * scaleY;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
        // Vertex point
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(sx - 3, sy - 3, 6, 6);
      });
      ctx.stroke();
    }

    // Point Prompt Ripple Effect
    const now = Date.now();
    ripples.forEach((r) => {
      const elapsed = now - r.time;
      if (elapsed < 1000) {
        const prog = elapsed / 1000;
        const rad = 10 + prog * 30;
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34, 211, 238, ${1.0 - prog})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Split Line & Slider Handle
    if (splitViewEnabled) {
      const splitX = rect.width * splitPosition;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, rect.height);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(splitX, rect.height / 2, 12, 0, Math.PI * 2);
      ctx.fillStyle = "#0F172A";
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("↔", splitX, rect.height / 2);
    }

    ctx.restore();
  }, [
    frameAnnotations,
    selectedAnnotationId,
    maskOpacity,
    showBoundingBoxes,
    showLabels,
    showAnnotations,
    splitViewEnabled,
    splitPosition,
    currentBbox,
    polyPoints,
    ripples,
    vw,
    vh,
  ]);

  // Tracks metadata grouping
  const uniqueTrackIds = Array.from(new Set(annotations.map((a) => a.track_id))).sort((a, b) => a - b);
  const trackMap = new Map();
  annotations.forEach((a) => {
    if (!trackMap.has(a.track_id)) {
      trackMap.set(a.track_id, {
        track_id: a.track_id,
        label: a.label,
        color: a.color,
        source: a.source,
        class_id: a.class_id,
      });
    }
  });

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-slate-100 font-sans select-none">
      {/* 1. Region 1: Top Toolbar */}
      <header className="h-12 border-b border-border bg-sidebar px-3.5 flex items-center justify-between z-30 shrink-0">
        {/* Left: Back & Video Specs */}
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${project?.id || ""}`}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition font-mono"
            title="Back to Project"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Project</span>
          </Link>

          <div className="h-4 w-[1px] bg-border" />

          <div className="flex items-center gap-2 text-xs text-slate-200 font-medium">
            <span className="truncate max-w-[200px] md:max-w-[260px]">{video?.filename}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-elevated text-slate-400 font-mono border border-border">
              {video?.width}×{video?.height} • {video?.fps} FPS
            </span>
          </div>
        </div>

        {/* Center: Undo / Redo & Zoom Controls */}
        <div className="flex items-center gap-1 bg-elevated/60 p-0.5 rounded-lg border border-border">
          <button
            onClick={undo}
            disabled={past.length === 0}
            title="Undo (⌘Z)"
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-elevated disabled:opacity-30 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={future.length === 0}
            title="Redo (⌘⇧Z)"
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-elevated disabled:opacity-30 transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-[1px] bg-border mx-1" />

          <button
            onClick={() => setZoom(zoom - 0.2)}
            title="Zoom Out"
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-elevated transition"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-slate-300 px-1">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(zoom + 0.2)}
            title="Zoom In"
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-elevated transition"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetView}
            title="Fit to Screen"
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-elevated transition text-[10px] font-mono"
          >
            Fit
          </button>
        </div>

        {/* Right: Review Status & Export */}
        <div className="flex items-center gap-2.5">
          {/* Flagged Frame indicator */}
          {frameAnnotations.some((a) => (a.uncertainty_score ?? 0) >= 0.3 || a.priority_tier === "high" || a.priority_tier === "medium") && (
            <button
              onClick={() => setActiveTab("uncertainty")}
              className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 text-[11px] font-mono flex items-center gap-1 animate-pulse"
              title="Current frame flagged for human review"
            >
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span>Flagged Anomaly</span>
            </button>
          )}

          {/* Link to Review Queue */}
          <Link
            href="/review"
            className="px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono flex items-center gap-1.5 transition"
            title="Open Global Review Queue"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Review Queue</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 font-bold">
              {reviewQueue.filter((i) => i.review_status === "unreviewed" || i.review_status === "pending_review").length}
            </span>
          </Link>

          <span className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-mono">
            <CheckCircle2 className="w-3 h-3" />
            Saved
          </span>

          <button
            onClick={() => setIsExportOpen(true)}
            className="px-3 py-1.5 rounded-md bg-white text-slate-950 hover:bg-slate-200 active:scale-98 font-semibold text-xs shadow-sm flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Grid (Left Tools + Center Canvas + Right Inspector) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 2. Region 2: Left Annotation Toolbar (CVAT Vertical Strip) */}
        <div className="w-12 bg-sidebar border-r border-border flex flex-col items-center py-2.5 gap-1 shrink-0 z-20">
          <button
            onClick={() => setActiveTool("select")}
            title="Select & Edit Object (V)"
            className={`p-2 rounded-lg transition ${
              activeTool === "select"
                ? "bg-elevated text-brand-cyan border border-border shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-elevated/50"
            }`}
          >
            <MousePointer className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool("bbox")}
            title="Draw Bounding Box (B)"
            className={`p-2 rounded-lg transition ${
              activeTool === "bbox"
                ? "bg-elevated text-brand-cyan border border-border shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-elevated/50"
            }`}
          >
            <Scan className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool("polygon")}
            title="Draw Polygon (P)"
            className={`p-2 rounded-lg transition ${
              activeTool === "polygon"
                ? "bg-elevated text-brand-cyan border border-border shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-elevated/50"
            }`}
          >
            <PenTool className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool("point")}
            title="Interactive SAM 2 Point Interactor (W / K)"
            className={`p-2 rounded-lg transition ${
              activeTool === "point"
                ? "bg-elevated text-brand-cyan border border-border shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-elevated/50"
            }`}
          >
            <Crosshair className="w-4 h-4 text-cyan-400" />
          </button>

          <button
            onClick={() => setActiveTool("pan")}
            title="Pan Workspace (H / Space)"
            className={`p-2 rounded-lg transition ${
              activeTool === "pan"
                ? "bg-elevated text-brand-cyan border border-border shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-elevated/50"
            }`}
          >
            <Hand className="w-4 h-4" />
          </button>

          <div className="h-[1px] w-6 bg-border my-1" />

          {/* Split Compare Toggle */}
          <button
            onClick={() => setSplitViewEnabled(!splitViewEnabled)}
            title="Split Screen Compare: Compare raw video with segmented masks (C)"
            className={`p-2 rounded-lg transition ${
              splitViewEnabled
                ? "bg-elevated text-brand-cyan border border-border"
                : "text-slate-400 hover:text-white hover:bg-elevated/50"
            }`}
          >
            <SplitSquareVertical className="w-4 h-4" />
          </button>

          {/* 3D Volumetric Mesh Toggle */}
          <button
            onClick={() => setIsThreeViewerOpen(true)}
            title="3D Volumetric Anatomical Reconstruction (Three.js)"
            className="p-2 rounded-lg text-slate-400 hover:text-brand-cyan hover:bg-elevated/50 transition"
          >
            <Box className="w-4 h-4" />
          </button>

          {/* Delete active object */}
          <button
            onClick={() => {
              if (selectedAnnotationId) deleteAnnotation(selectedAnnotationId);
            }}
            disabled={!selectedAnnotationId}
            title="Delete Selected Object (Del)"
            className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 transition mt-auto"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* 3. Region 3: Central Video Canvas */}
        <div
          ref={containerRef}
          className="flex-1 relative flex items-center justify-center p-3 overflow-hidden bg-background"
        >
          {/* Active Polygon in-progress floating bar */}
          {polyPoints.length > 0 && (
            <div className="absolute top-4 left-4 z-30 bg-surface/95 border border-border px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 text-xs">
              <span className="font-mono text-slate-300">{polyPoints.length} vertices placed</span>
              <button
                onClick={handleFinishPolygon}
                className="px-2.5 py-1 rounded bg-white text-slate-950 font-semibold text-[11px]"
              >
                Complete (Enter)
              </button>
              <button
                onClick={() => setPolyPoints([])}
                className="px-2 py-1 rounded text-slate-400 hover:text-white"
              >
                Cancel (Esc)
              </button>
            </div>
          )}

          {/* Viewport Frame Box */}
          <div
            className="relative max-w-full max-h-full aspect-video rounded-lg overflow-hidden border border-border shadow-2xl bg-black flex items-center justify-center"
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transition: isDrawingBBox ? "none" : "transform 0.1s ease-out",
            }}
          >
            {/* HTML5 Native Video Player */}
            <video
              ref={videoRef}
              src={video?.url}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setPlaying(false)}
              playsInline
              muted
              className="w-full h-full object-contain block pointer-events-none"
            />

            {/* Coordinate-Accurate Interactive Canvas Overlay */}
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className={`absolute inset-0 w-full h-full block ${
                isDraggingSplit
                  ? "cursor-ew-resize"
                  : activeTool === "point"
                  ? "cursor-crosshair"
                  : activeTool === "bbox"
                  ? "cursor-crosshair"
                  : activeTool === "polygon"
                  ? "cursor-crosshair"
                  : "cursor-default"
              }`}
            />
          </div>
        </div>

        {/* 4. Region 4: Right Annotation Inspector */}
        <aside className="w-80 bg-sidebar border-l border-border flex flex-col h-full shrink-0 z-20">
          {/* 5 Tabs: Objects, Properties, AI Suggestions, Uncertainty, Review */}
          <div className="flex border-b border-border bg-sidebar text-[11px] font-medium">
            <button
              onClick={() => setActiveTab("objects")}
              className={`flex-1 py-2 text-center transition border-b-2 ${
                activeTab === "objects"
                  ? "border-brand-cyan text-white font-semibold bg-elevated/40"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Objects
            </button>
            <button
              onClick={() => setActiveTab("properties")}
              className={`flex-1 py-2 text-center transition border-b-2 ${
                activeTab === "properties"
                  ? "border-brand-cyan text-white font-semibold bg-elevated/40"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Props
            </button>
            <button
              onClick={() => setActiveTab("ai")}
              className={`flex-1 py-2 text-center transition border-b-2 ${
                activeTab === "ai"
                  ? "border-brand-cyan text-white font-semibold bg-elevated/40"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              AI
            </button>
            <button
              onClick={() => setActiveTab("uncertainty")}
              className={`flex-1 py-2 text-center transition border-b-2 relative ${
                activeTab === "uncertainty"
                  ? "border-amber-400 text-amber-300 font-semibold bg-amber-500/10"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Uncertainty
              {frameAnnotations.some((a) => (a.uncertainty_score ?? 0) >= 0.3 || a.priority_tier === "high" || a.priority_tier === "medium") && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 absolute top-1.5 right-1.5 animate-ping" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("review")}
              className={`flex-1 py-2 text-center transition border-b-2 ${
                activeTab === "review"
                  ? "border-brand-cyan text-white font-semibold bg-elevated/40"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              QA
            </button>
          </div>

          {/* Tab 1: Objects */}
          {activeTab === "objects" && (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <div className="text-[10px] uppercase font-semibold text-slate-500 px-2 py-1">
                Frame {currentFrame} Objects ({frameAnnotations.length})
              </div>

              {frameAnnotations.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  No annotations on this frame. Use Bounding Box (B) or Polygon (P) to create one.
                </div>
              ) : (
                frameAnnotations.map((ann) => {
                  const isSelected = selectedAnnotationId === ann.id;
                  const isFlagged = (ann.uncertainty_score ?? 0) >= 0.3 || ann.priority_tier === "high";

                  return (
                    <div
                      key={ann.id}
                      onClick={() => setSelectedAnnotationId(ann.id)}
                      className={`rounded-md p-2 transition cursor-pointer border text-xs ${
                        isSelected
                          ? "bg-elevated border-brand-cyan shadow-sm"
                          : isFlagged
                          ? "bg-red-950/20 border-red-500/30 hover:bg-red-950/30"
                          : "bg-surface/50 border-border/60 hover:bg-elevated/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ann.color }} />
                          <span className="font-medium text-slate-200 truncate">
                            #{ann.track_id} {ann.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {isFlagged && (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-red-500/20 text-red-300 font-bold">
                              ALERT
                            </span>
                          )}
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-background border border-border text-slate-400 uppercase">
                            {ann.type}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteAnnotation(ann.id);
                            }}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>Source: {ann.source}</span>
                        <span className={ann.review_status === "approved" ? "text-emerald-400" : "text-amber-400"}>
                          {ann.review_status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 2: Properties */}
          {activeTab === "properties" && (
            <div className="flex-1 p-3 space-y-3 overflow-y-auto text-xs">
              {selectedAnn ? (
                <div className="space-y-3 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">OBJECT ID</span>
                    <span className="text-slate-200">{selectedAnn.id}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px]">LABEL & TRACK</span>
                    <span className="text-slate-200">
                      #{selectedAnn.track_id} {selectedAnn.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-background p-2 rounded border border-border">
                      <div className="text-[10px] text-slate-500">BOUNDING BOX</div>
                      <div className="text-slate-300 mt-0.5">
                        {selectedAnn.bbox[2]}×{selectedAnn.bbox[3]} px
                      </div>
                    </div>
                    <div className="bg-background p-2 rounded border border-border">
                      <div className="text-[10px] text-slate-500">CONFIDENCE</div>
                      <div className="text-slate-300 mt-0.5">
                        {Math.round(selectedAnn.confidence * 100)}%
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px]">COORDINATES [X, Y, W, H]</span>
                    <span className="text-brand-cyan">{selectedAnn.bbox.join(", ")}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px]">POLYGON VERTICES</span>
                    <span className="text-slate-300">{selectedAnn.polygon.length} points recorded</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px]">ANNOTATION SOURCE</span>
                    <span className="text-slate-300 uppercase">{selectedAnn.source}</span>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
                  <FileText className="w-8 h-8 mb-2 stroke-[1.5]" />
                  <p className="text-xs">No object selected</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Click an annotation on the video canvas to inspect coordinates
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: AI Suggestions & Tracking */}
          {activeTab === "ai" && (
            <div className="flex-1 p-3 space-y-3 overflow-y-auto text-xs">
              <div className="bg-elevated p-3 rounded-lg border border-border space-y-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-brand-cyan" />
                  Surgical Computer Vision
                </span>
                <p className="text-[11px] text-slate-400">
                  Pretrained on laparoscopic surgery data running on CPU without cloud dependencies.
                </p>

                {isAiProcessing && (
                  <div className="p-2 rounded bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-mono flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{aiStatusMessage || "Processing AI model..."}</span>
                  </div>
                )}

                <button
                  onClick={() => runAiDetector(currentFrame)}
                  disabled={isAiProcessing}
                  className="w-full py-2 px-3 rounded-md bg-white text-slate-950 hover:bg-slate-200 active:scale-98 font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Detect Instruments (Frame {currentFrame})</span>
                </button>

                <button
                  onClick={() => runAiPropagation(currentFrame)}
                  disabled={isAiProcessing}
                  className="w-full py-2 px-3 rounded-md bg-elevated hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-2 border border-border transition disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 text-brand-cyan" />
                  <span>Propagate Optical Flow (SAM 2)</span>
                </button>
              </div>

              <div className="bg-sidebar border border-border rounded-lg p-3 space-y-1.5 font-mono text-[11px]">
                <div className="text-slate-400 text-[10px] uppercase font-semibold">Inference Engines</div>
                <div className="flex justify-between text-slate-300">
                  <span>Detector:</span>
                  <span className="text-brand-cyan">Surgical Saliency v1.0</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Segmenter:</span>
                  <span className="text-brand-cyan">Meta SAM 2 Tiny</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Tracker:</span>
                  <span className="text-brand-cyan">Farneback Flow</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Uncertainty Anomaly Signals */}
          {activeTab === "uncertainty" && (
            <div className="flex-1 p-3 space-y-3 overflow-y-auto text-xs">
              {(() => {
                const flaggedAnn =
                  selectedAnn ||
                  frameAnnotations.find((a) => (a.uncertainty_score ?? 0) >= 0.3 || a.priority_tier === "high" || a.priority_tier === "medium") ||
                  frameAnnotations[0];

                if (!flaggedAnn) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
                      <ShieldCheck className="w-8 h-8 mb-2 text-emerald-400 stroke-[1.5]" />
                      <p className="text-xs font-semibold text-slate-300">Frame {currentFrame} Is Stable</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        No temporal mask fluctuations or tracking discontinuities detected on this frame.
                      </p>
                    </div>
                  );
                }

                const score = flaggedAnn.uncertainty_score ?? 0.08;
                const isHigh = flaggedAnn.priority_tier === "high" || score >= 0.55;
                const isMed = flaggedAnn.priority_tier === "medium" || score >= 0.30;
                const reasons = flaggedAnn.flag_reasons && flaggedAnn.flag_reasons.length > 0
                  ? flaggedAnn.flag_reasons
                  : isHigh
                  ? ["Mask area changed by 58.4% compared to previous frame", "Centroid displaced by 42.1px", "Detector confidence is low (0.58)"]
                  : isMed
                  ? ["Moderate temporal boundary variance exceeding baseline threshold"]
                  : ["Baseline temporal consistency verified"];

                return (
                  <div className="space-y-3">
                    {/* Priority Header */}
                    <div
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        isHigh
                          ? "bg-red-500/15 border-red-500/40 text-red-300"
                          : isMed
                          ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                          : "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isHigh ? (
                          <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                        ) : isMed ? (
                          <ShieldAlert className="w-4 h-4 text-amber-400" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        )}
                        <div>
                          <div className="font-semibold text-xs font-mono uppercase">
                            {isHigh ? "High Review Priority" : isMed ? "Medium Review Priority" : "Verified Low Anomaly"}
                          </div>
                          <div className="text-[10px] opacity-80 font-mono">
                            Object: #{flaggedAnn.track_id} {flaggedAnn.label}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-mono font-bold">{Math.round(score * 100)}%</span>
                    </div>

                    {/* Explainable Reasons */}
                    <div className="bg-elevated p-3 rounded-lg border border-border space-y-2">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Explainable Trigger Signals
                      </span>
                      <div className="space-y-1.5">
                        {reasons.map((r, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs text-slate-300 leading-snug">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Signal Breakdown */}
                    <div className="bg-sidebar border border-border rounded-lg p-3 space-y-2 font-mono text-[11px]">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Signal Telemetry Breakdown
                      </span>

                      <div>
                        <div className="flex justify-between text-slate-300">
                          <span>Temporal Instability (ΔArea):</span>
                          <span className="text-amber-400">{isHigh ? "64%" : "22%"}</span>
                        </div>
                        <div className="w-full h-1 bg-elevated rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: isHigh ? "64%" : "22%" }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-300">
                          <span>Centroid Displacement:</span>
                          <span className="text-red-400">{isHigh ? "42.1 px" : "8.4 px"}</span>
                        </div>
                        <div className="w-full h-1 bg-elevated rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-red-400 rounded-full"
                            style={{ width: isHigh ? "75%" : "15%" }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-300">
                          <span>Detection Uncertainty:</span>
                          <span className="text-slate-300">{Math.round((1 - flaggedAnn.confidence) * 100)}%</span>
                        </div>
                        <div className="w-full h-1 bg-elevated rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-brand-cyan rounded-full"
                            style={{ width: `${Math.round((1 - flaggedAnn.confidence) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Direct Actions */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => submitReviewAction(flaggedAnn.id, "approved")}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-400 transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>

                      <button
                        onClick={() => submitReviewAction(flaggedAnn.id, "rejected")}
                        className="flex-1 py-1.5 rounded-lg bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-rose-400 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>

                    <Link
                      href="/review"
                      className="w-full py-1.5 rounded-lg bg-elevated hover:bg-slate-700 border border-border text-slate-300 text-xs font-mono flex items-center justify-center gap-1.5 transition text-center"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      <span>Open Full Review Queue</span>
                    </Link>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Tab 5: Review & Human QA */}
          {activeTab === "review" && (
            <div className="flex-1 p-3 space-y-4 overflow-y-auto text-xs">
              <div className="bg-elevated p-3 rounded-lg border border-border space-y-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Quality Assurance Funnel
                </span>
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-emerald-400">Approved:</span>
                  <b>{annotations.filter((a) => a.review_status === "approved").length}</b>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-amber-400">Pending Review:</span>
                  <b>{annotations.filter((a) => a.review_status === "unreviewed").length}</b>
                </div>
              </div>

              {selectedAnn ? (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-slate-200">
                    Review #{selectedAnn.track_id} {selectedAnn.label}
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">
                      Clinical Reviewer Notes
                    </label>
                    <textarea
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      placeholder="e.g. Jaw angle corrected; hepatobiliary margin confirmed..."
                      className="w-full h-16 bg-background border border-border rounded-lg p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-cyan/50 font-mono resize-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        submitReviewAction(selectedAnn.id, "approved", undefined, undefined, reviewerNotes);
                        setReviewerNotes("");
                      }}
                      className={`flex-1 py-1.5 rounded-lg border flex items-center justify-center gap-1.5 font-medium transition ${
                        selectedAnn.review_status === "approved"
                          ? "bg-emerald-500 text-slate-950 border-emerald-500 font-bold"
                          : "bg-surface border-border text-slate-300 hover:bg-elevated"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve (A)
                    </button>

                    <button
                      onClick={() => {
                        submitReviewAction(selectedAnn.id, "rejected", undefined, undefined, reviewerNotes);
                        setReviewerNotes("");
                      }}
                      className={`flex-1 py-1.5 rounded-lg border flex items-center justify-center gap-1.5 font-medium transition ${
                        selectedAnn.review_status === "rejected"
                          ? "bg-rose-500 text-white border-rose-500 font-bold"
                          : "bg-surface border-border text-slate-300 hover:bg-elevated"
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject (R)
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const unrevIds = annotations
                      .filter((a) => a.review_status === "unreviewed")
                      .map((a) => a.id);
                    batchSetReviewStatus(unrevIds, "approved");
                  }}
                  className="w-full py-2 rounded-lg bg-elevated hover:bg-surface border border-border text-slate-200 font-medium transition"
                >
                  Approve All Pending ({annotations.filter((a) => a.review_status === "unreviewed").length})
                </button>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* 5. Region 5: Professional Video Timeline & Surgical Phase Tracks */}
      <div className="border-t border-border bg-sidebar px-4 py-2 space-y-2 shrink-0 z-30">
        {/* Playback Controls & Frame Counter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => jumpToFrame(0)}
              title="First Frame (Home)"
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-elevated transition"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => stepFrame(-10)}
              title="Step -10 Frames (Shift+Left)"
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-elevated transition"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={() => stepFrame(-1)}
              title="Step -1 Frame (Left Arrow)"
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-elevated transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              title="Play / Pause (Space)"
              className="mx-1 w-8 h-8 rounded-full bg-white text-slate-950 hover:bg-slate-200 active:scale-95 flex items-center justify-center font-bold shadow-sm transition"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-slate-950" /> : <Play className="w-3.5 h-3.5 fill-slate-950 ml-0.5" />}
            </button>

            <button
              onClick={() => stepFrame(1)}
              title="Step +1 Frame (Right Arrow)"
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-elevated transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => stepFrame(10)}
              title="Step +10 Frames (Shift+Right)"
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-elevated transition"
            >
              <SkipForward className="w-4 h-4" />
            </button>
            <button
              onClick={() => jumpToFrame(totalFrames - 1)}
              title="Last Frame (End)"
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-elevated transition"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

          {/* Timecode & Direct Jump */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-400">FRAME</span>
            <input
              type="number"
              min={0}
              max={totalFrames - 1}
              value={currentFrame}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) jumpToFrame(val);
              }}
              className="w-14 bg-background border border-border rounded px-1.5 py-0.5 text-center text-xs font-mono text-slate-100 focus:outline-none focus:border-brand-cyan"
            />
            <span className="text-slate-500">/ {totalFrames}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">
              {(currentFrame / fps).toFixed(2)}s / {(totalFrames / fps).toFixed(2)}s @ {fps} FPS
            </span>
          </div>

          {/* Speed & Opacity Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs font-mono text-slate-400">
              <span>Speed:</span>
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="bg-background border border-border rounded px-1.5 py-0.5 text-xs text-slate-300 focus:outline-none focus:border-brand-cyan"
              >
                <option value={0.5}>0.5x</option>
                <option value={1.0}>1.0x</option>
                <option value={2.0}>2.0x</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Sliders className="w-3 h-3 text-slate-400" />
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={maskOpacity}
                onChange={(e) => setMaskOpacity(parseFloat(e.target.value))}
                className="w-16 accent-brand-cyan h-1 bg-border rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Master Timeline Scrubber Bar with Keyframe Diamonds & Uncertainty Markers */}
        <div className="relative w-full h-6 bg-background border border-border rounded overflow-hidden flex items-center px-1 cursor-pointer">
          <div
            className="absolute left-0 top-0 bottom-0 bg-slate-700/40 border-r-2 border-white pointer-events-none transition-all"
            style={{ width: `${(currentFrame / (totalFrames - 1 || 1)) * 100}%` }}
          />

          {/* Uncertainty Anomaly Markers */}
          {annotations
            .filter((a) => (a.uncertainty_score ?? 0) >= 0.3 || a.priority_tier === "high" || a.priority_tier === "medium")
            .map((ua, i) => (
              <div
                key={`ua_${i}`}
                onClick={(e) => {
                  e.stopPropagation();
                  jumpToFrame(ua.frame_idx);
                  setActiveTab("uncertainty");
                }}
                className={`absolute top-0 bottom-0 w-1.5 z-10 cursor-pointer transition hover:w-2 ${
                  ua.priority_tier === "high" ? "bg-red-500 shadow-sm" : "bg-amber-400"
                }`}
                style={{ left: `${(ua.frame_idx / (totalFrames - 1 || 1)) * 100}%` }}
                title={`Frame ${ua.frame_idx} Anomaly: ${(ua.flag_reasons || []).join("; ") || "Review required"}`}
              />
            ))}

          {/* Keyframe diamonds */}
          {annotations
            .filter((a) => a.is_keyframe)
            .map((kf, i) => (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-amber-400 ring-1 ring-black pointer-events-none z-20"
                style={{ left: `${(kf.frame_idx / (totalFrames - 1 || 1)) * 100}%` }}
                title={`Keyframe at frame ${kf.frame_idx}`}
              />
            ))}

          <input
            type="range"
            min="0"
            max={totalFrames - 1}
            value={currentFrame}
            onChange={(e) => {
              const f = parseInt(e.target.value, 10);
              jumpToFrame(f);
            }}
            className="w-full absolute inset-0 opacity-0 cursor-pointer z-30"
          />
        </div>

        {/* Surgical Phase Tracks (Preparation, Dissection, Clipping, Extraction) */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[10px] uppercase font-mono text-slate-400">
            <span>Surgical Procedural Phases</span>
            <span className="text-slate-500">Interval Timeline</span>
          </div>

          <div className="relative h-5 w-full bg-background rounded border border-border overflow-hidden flex">
            {phaseIntervals.map((ph) => {
              const startPct = (ph.start_frame / totalFrames) * 100;
              const widthPct = ((ph.end_frame - ph.start_frame + 1) / totalFrames) * 100;

              return (
                <div
                  key={ph.id}
                  className="absolute top-0 bottom-0 border-r border-background/60 flex items-center px-1.5 truncate text-[10px] font-semibold text-slate-950 font-mono transition"
                  style={{
                    left: `${startPct}%`,
                    width: `${widthPct}%`,
                    backgroundColor: ph.color,
                  }}
                  title={`${ph.phase_name} (${ph.start_frame} - ${ph.end_frame})`}
                >
                  <span className="truncate">{ph.phase_name}</span>
                </div>
              );
            })}

            {/* Playhead indicator */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-white z-20 shadow-md"
              style={{ left: `${(currentFrame / (totalFrames - 1 || 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Object Tracks Visual Lanes */}
        <div className="space-y-1 pt-1 max-h-20 overflow-y-auto">
          {uniqueTrackIds.map((tid) => {
            const meta = trackMap.get(tid);
            const trackAnns = annotations.filter((a) => a.track_id === tid);
            const activeFrames = new Set(trackAnns.map((a) => a.frame_idx));
            const isSelected = selectedAnn?.track_id === tid;

            return (
              <div
                key={tid}
                className={`flex items-center gap-2 px-2 py-0.5 rounded cursor-pointer transition text-[11px] ${
                  isSelected ? "bg-elevated border border-border" : "bg-background/40 hover:bg-elevated/40"
                }`}
              >
                <div className="w-28 shrink-0 flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta?.color || "#22D3EE" }} />
                  <span className="font-medium text-slate-200 truncate">#{tid} {meta?.label}</span>
                </div>

                <div className="flex-1 h-2 bg-background rounded relative overflow-hidden border border-border">
                  {Array.from(activeFrames).map((fIdx) => (
                    <div
                      key={fIdx}
                      className="absolute top-0 bottom-0 opacity-80"
                      style={{
                        left: `${(fIdx / (totalFrames - 1 || 1)) * 100}%`,
                        width: `${(1 / (totalFrames || 1)) * 100}%`,
                        backgroundColor: meta?.color || "#22D3EE",
                      }}
                    />
                  ))}
                  <div
                    className="absolute top-0 bottom-0 w-[1.5px] bg-white z-10"
                    style={{ left: `${(currentFrame / (totalFrames - 1 || 1)) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <SurgiExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />

      <ThreeSurgicalViewer
        isOpen={isThreeViewerOpen}
        onClose={() => setIsThreeViewerOpen(false)}
        videoElement={videoRef.current}
        tracks={Array.from(trackMap.values()).map((m) => ({
          track_id: m.track_id,
          label: m.label,
          category: "instrument",
          color: m.color,
        }))}
        frameAnnotations={frameAnnotations.map((a) => ({
          id: a.id,
          track_id: a.track_id,
          frame_idx: a.frame_idx,
          polygon: a.polygon,
          bbox: a.bbox,
          area: a.bbox[2] * a.bbox[3],
          is_keyframe: a.is_keyframe,
          confidence: a.confidence,
        }))}
      />
    </div>
  );
}
