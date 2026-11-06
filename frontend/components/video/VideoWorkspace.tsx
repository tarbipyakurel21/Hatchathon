"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  VideoItem,
  VideoTrack,
  VideoFrameAnnotation,
} from "@/lib/videoTypes";
import { getVideoFileUrl } from "@/lib/videoApi";
import { ThreeSurgicalViewer } from "./ThreeSurgicalViewer";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Scan,
  MousePointer,
  Box,
  SplitSquareVertical,
  Sliders,
  Maximize2,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  Zap,
} from "lucide-react";

interface VideoWorkspaceProps {
  video: VideoItem | null;
  tracks: VideoTrack[];
  annotations: VideoFrameAnnotation[];
  currentFrame: number;
  setCurrentFrame: (frame: number) => void;
  onPrompt: (
    keyframeIdx: number,
    promptType: "point" | "box",
    promptData: [number, number] | [number, number, number, number]
  ) => void;
  isTracking: boolean;
  activeTool: "select" | "point" | "box";
  setActiveTool: (tool: "select" | "point" | "box") => void;
  selectedTrackId: number | null;
  onSelectTrack: (trackId: number | null) => void;
}

export const VideoWorkspace: React.FC<VideoWorkspaceProps> = ({
  video,
  tracks,
  annotations,
  currentFrame,
  setCurrentFrame,
  onPrompt,
  isTracking,
  activeTool,
  setActiveTool,
  selectedTrackId,
  onSelectTrack,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [maskOpacity, setMaskOpacity] = useState<number>(0.4);
  const [showAnnotations, setShowAnnotations] = useState<boolean>(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);

  // Split view state
  const [splitViewEnabled, setSplitViewEnabled] = useState<boolean>(false);
  const [splitPosition, setSplitPosition] = useState<number>(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);

  // Prompt interaction
  const [boxStart, setBoxStart] = useState<[number, number] | null>(null);
  const [currentBox, setCurrentBox] = useState<[number, number, number, number] | null>(null);
  const [ripples, setRipples] = useState<{ x: number; y: number; time: number }[]>([]);

  // Three.js 3D Viewer modal
  const [isThreeViewerOpen, setIsThreeViewerOpen] = useState<boolean>(false);

  const fps = video?.fps || 25.0;
  const totalFrames = video?.total_frames || 120;

  // Sync Video time when currentFrame changes externally
  useEffect(() => {
    if (!videoRef.current || isPlaying) return;
    const targetTime = currentFrame / fps;
    if (Math.abs(videoRef.current.currentTime - targetTime) > 0.03) {
      videoRef.current.currentTime = targetTime;
    }
  }, [currentFrame, fps, isPlaying]);

  // Handle Playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Video timeupdate syncs currentFrame
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
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const stepFrame = (delta: number) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    const next = Math.max(0, Math.min(totalFrames - 1, currentFrame + delta));
    setCurrentFrame(next);
    videoRef.current.currentTime = next / fps;
  };

  const jumpToFrame = (frame: number) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    const clamped = Math.max(0, Math.min(totalFrames - 1, frame));
    setCurrentFrame(clamped);
    videoRef.current.currentTime = clamped / fps;
  };

  // Keyboard Navigation Shortcuts (CVAT Style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
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
      } else if (e.key === "w" || e.key === "W") {
        setActiveTool("point");
      } else if (e.key === "b" || e.key === "B") {
        setActiveTool("box");
      } else if (e.key === "c" || e.key === "C") {
        setSplitViewEnabled((prev) => !prev);
      } else if (e.code === "Home") {
        e.preventDefault();
        jumpToFrame(0);
      } else if (e.code === "End") {
        e.preventDefault();
        jumpToFrame(totalFrames - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentFrame, totalFrames, fps, isPlaying]);

  // Convert canvas mouse coordinates to original video resolution coordinates
  const getCanvasVideoCoords = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas || !video) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const vw = video.width || 640;
    const vh = video.height || 480;

    const scaleX = vw / rect.width;
    const scaleY = vh / rect.height;

    return [mouseX * scaleX, mouseY * scaleY];
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !video) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Check if dragging split slider handle
    if (splitViewEnabled) {
      const splitX = rect.width * splitPosition;
      if (Math.abs(mouseX - splitX) < 14) {
        setIsDraggingSplit(true);
        return;
      }
    }

    const [vx, vy] = getCanvasVideoCoords(e);

    if (activeTool === "point") {
      // Add ripple animation
      setRipples((prev) => [...prev, { x: mouseX, y: e.clientY - rect.top, time: Date.now() }]);
      onPrompt(currentFrame, "point", [Math.round(vx), Math.round(vy)]);
    } else if (activeTool === "box") {
      setBoxStart([vx, vy]);
      setCurrentBox([vx, vy, 0, 0]);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !video) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    if (isDraggingSplit && splitViewEnabled) {
      const pos = Math.max(0.05, Math.min(0.95, mouseX / rect.width));
      setSplitPosition(pos);
      return;
    }

    if (boxStart && activeTool === "box") {
      const [vx, vy] = getCanvasVideoCoords(e);
      const x0 = Math.min(boxStart[0], vx);
      const y0 = Math.min(boxStart[1], vy);
      const w0 = Math.abs(vx - boxStart[0]);
      const h0 = Math.abs(vy - boxStart[1]);
      setCurrentBox([x0, y0, w0, h0]);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingSplit(false);
    if (boxStart && currentBox && activeTool === "box") {
      const [, , w, h] = currentBox;
      if (w > 15 && h > 15) {
        onPrompt(currentFrame, "box", [
          Math.round(currentBox[0]),
          Math.round(currentBox[1]),
          Math.round(currentBox[2]),
          Math.round(currentBox[3]),
        ]);
      }
      setBoxStart(null);
      setCurrentBox(null);
    }
  };

  // Render Canvas Overlays (Track Masks, Polygons, Bounding Boxes)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const vw = video.width || 640;
    const vh = video.height || 480;

    // Handle high DPI
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

    // Filter annotations for CURRENT frame
    const currentFrameAnns = annotations.filter((a) => a.frame_idx === currentFrame);
    const trackMap = new Map(tracks.map((t) => [t.track_id, t]));

    // Render Masks function
    const renderMasks = () => {
      currentFrameAnns.forEach((ann) => {
        if (!ann.polygon || ann.polygon.length < 3) return;
        const track = trackMap.get(ann.track_id);
        const color = track?.color || "#06B6D4";
        const isSelected = selectedTrackId === ann.track_id;

        ctx.beginPath();
        ann.polygon.forEach(([px, py], i) => {
          const sx = px * scaleX;
          const sy = py * scaleY;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.closePath();

        // Semi-transparent mask fill (CVAT style)
        ctx.fillStyle = color;
        ctx.globalAlpha = isSelected ? Math.min(maskOpacity + 0.35, 0.95) : maskOpacity;
        ctx.fill();

        // Contour stroke
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = isSelected ? "#FFFFFF" : color;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();

        // If selected, draw vertex handles (CVAT vertex editor)
        if (isSelected) {
          ann.polygon.forEach(([px, py]) => {
            ctx.fillStyle = "#FFFFFF";
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(px * scaleX, py * scaleY, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
        }

        // Bounding box
        if (showBoundingBoxes && ann.bbox) {
          const [bx, by, bw, bh] = ann.bbox;
          ctx.strokeStyle = isSelected ? "#FFFFFF" : color;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(bx * scaleX, by * scaleY, bw * scaleX, bh * scaleY);
          ctx.setLineDash([]);

          // Label badge (CVAT clean tag)
          if (track) {
            ctx.fillStyle = "rgba(10, 10, 12, 0.9)";
            const text = `#${track.track_id} ${track.label}`;
            ctx.font = "bold 10px monospace";
            const textMetrics = ctx.measureText(text);
            ctx.fillRect(bx * scaleX, by * scaleY - 17, textMetrics.width + 8, 16);
            ctx.fillStyle = isSelected ? "#FFFFFF" : "#E4E4E7";
            ctx.fillText(text, bx * scaleX + 4, by * scaleY - 5);
          }
        }
      });
    };

    if (showAnnotations) {
      if (splitViewEnabled) {
        // Only render on right half of split
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

    // Live SAM 2 Box Prompt
    if (currentBox) {
      const [bx, by, bw, bh] = currentBox;
      ctx.strokeStyle = "#10B981";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(bx * scaleX, by * scaleY, bw * scaleX, bh * scaleY);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
      ctx.fillRect(bx * scaleX, by * scaleY, bw * scaleX, bh * scaleY);
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
        ctx.strokeStyle = `rgba(6, 182, 212, ${1.0 - prog})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(r.x, r.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#06B6D4";
        ctx.fill();
      }
    });

    // Split Line & Slider Handle (CVAT compare slider)
    if (splitViewEnabled) {
      const splitX = rect.width * splitPosition;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, rect.height);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Handle circle
      ctx.beginPath();
      ctx.arc(splitX, rect.height / 2, 12, 0, Math.PI * 2);
      ctx.fillStyle = "#18181B";
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Arrows
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("↔", splitX, rect.height / 2);
    }

    ctx.restore();
  }, [
    annotations,
    currentFrame,
    tracks,
    maskOpacity,
    showAnnotations,
    showBoundingBoxes,
    splitViewEnabled,
    splitPosition,
    currentBox,
    ripples,
    selectedTrackId,
    video,
  ]);

  if (!video) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 select-none">
        <Box className="w-12 h-12 mb-3 stroke-[1.5] text-zinc-700 animate-pulse" />
        <p className="text-sm font-medium text-zinc-300">No medical video loaded</p>
        <p className="text-xs text-zinc-500 mt-1">
          Upload an MP4 video or click "Try Surgical Demo" in the sidebar
        </p>
      </div>
    );
  }

  // Active frame annotations for 3D viewer
  const activeFrameAnns = annotations.filter((a) => a.frame_idx === currentFrame);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col bg-zinc-950 overflow-hidden select-none relative">
      {/* 1. Center Video + Canvas Overlays Viewport */}
      <div className="flex-1 relative flex items-center justify-center p-3 overflow-hidden bg-zinc-950">
        {/* CVAT Left Docked Vertical Tool Strip */}
        <div className="absolute left-3 top-3 z-30 flex flex-col gap-1 bg-zinc-900/90 border border-zinc-800 rounded-lg p-1 backdrop-blur-md shadow-lg">
          {/* Select Tool */}
          <button
            onClick={() => setActiveTool("select")}
            title="Select & Edit Object (V)"
            className={`p-2 rounded transition ${
              activeTool === "select"
                ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <MousePointer className="w-4 h-4" />
          </button>

          {/* SAM 2 Point Prompt */}
          <button
            onClick={() => setActiveTool("point")}
            title="Interactive SAM 2 Point Prompt (W)"
            className={`p-2 rounded transition ${
              activeTool === "point"
                ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Crosshair className="w-4 h-4 text-cyan-400" />
          </button>

          {/* SAM 2 Box Prompt */}
          <button
            onClick={() => setActiveTool("box")}
            title="Interactive SAM 2 Box Prompt (B)"
            className={`p-2 rounded transition ${
              activeTool === "box"
                ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Scan className="w-4 h-4 text-amber-400" />
          </button>

          <div className="h-[1px] w-full bg-zinc-800 my-0.5" />

          {/* Split Compare Toggle */}
          <button
            onClick={() => setSplitViewEnabled(!splitViewEnabled)}
            title="Split View Compare (C)"
            className={`p-2 rounded transition ${
              splitViewEnabled
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <SplitSquareVertical className="w-4 h-4" />
          </button>

          {/* 3D Volumetric Mesh Toggle */}
          <button
            onClick={() => setIsThreeViewerOpen(true)}
            title="3D Mesh Reconstruction (Three.js)"
            className="p-2 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition"
          >
            <Box className="w-4 h-4" />
          </button>
        </div>

        {/* Video Frame Canvas Frame */}
        <div className="relative max-w-full max-h-full aspect-video rounded-lg overflow-hidden border border-zinc-800 shadow-2xl bg-black flex items-center justify-center">
          {/* HTML5 Native Video Player */}
          <video
            ref={videoRef}
            src={getVideoFileUrl(video.id)}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            playsInline
            muted
            className="w-full h-full object-contain block"
          />

          {/* Mask & Prompt Canvas Overlay */}
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className={`absolute inset-0 w-full h-full block ${
              isDraggingSplit
                ? "cursor-ew-resize"
                : activeTool === "point"
                ? "cursor-crosshair"
                : activeTool === "box"
                ? "cursor-crosshair"
                : "cursor-default"
            }`}
          />
        </div>
      </div>

      {/* 2. CVAT Professional Video Timeline & Multi-Track Scrubber */}
      <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-2.5 space-y-2 shrink-0 z-20">
        {/* Scrubber Controls Bar */}
        <div className="flex items-center justify-between">
          {/* Playback Controls (CVAT Standard) */}
          <div className="flex items-center gap-1">
            {/* Jump to Start */}
            <button
              onClick={() => jumpToFrame(0)}
              title="First Frame (Home)"
              className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-900 transition"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            {/* Jump -10 */}
            <button
              onClick={() => stepFrame(-10)}
              title="Step -10 Frames (Shift+Left)"
              className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-900 transition"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            {/* Step -1 */}
            <button
              onClick={() => stepFrame(-1)}
              title="Previous Frame (Left Arrow)"
              className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-900 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Solid White Play/Pause Button (CVAT Pro Style) */}
            <button
              onClick={togglePlay}
              title="Play / Pause (Space)"
              className="mx-1 w-8 h-8 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 active:scale-95 flex items-center justify-center font-bold shadow-sm transition"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-zinc-950" /> : <Play className="w-3.5 h-3.5 fill-zinc-950 ml-0.5" />}
            </button>

            {/* Step +1 */}
            <button
              onClick={() => stepFrame(1)}
              title="Next Frame (Right Arrow)"
              className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-900 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {/* Jump +10 */}
            <button
              onClick={() => stepFrame(10)}
              title="Step +10 Frames (Shift+Right)"
              className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-900 transition"
            >
              <SkipForward className="w-4 h-4" />
            </button>
            {/* Jump to End */}
            <button
              onClick={() => jumpToFrame(totalFrames - 1)}
              title="Last Frame (End)"
              className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-900 transition"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

          {/* Exact Timecode and Frame Number Input (CVAT Direct Jump) */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-zinc-400">FRAME</span>
            <input
              type="number"
              min={0}
              max={totalFrames - 1}
              value={currentFrame}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) jumpToFrame(val);
              }}
              className="w-14 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-center text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-600"
            />
            <span className="text-zinc-500">/ {totalFrames}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">
              {(currentFrame / fps).toFixed(2)}s / {(totalFrames / fps).toFixed(2)}s @ {fps} FPS
            </span>
          </div>

          {/* Quick Display Switches (CVAT Toolbar) */}
          <div className="flex items-center gap-3">
            {/* Playback speed selector */}
            <div className="flex items-center gap-1 text-xs font-mono text-zinc-400">
              <span>Speed:</span>
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600"
              >
                <option value={0.5}>0.5x</option>
                <option value={1.0}>1.0x</option>
                <option value={2.0}>2.0x</option>
              </select>
            </div>

            {/* Mask Opacity Slider */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Sliders className="w-3 h-3 text-zinc-400" />
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={maskOpacity}
                onChange={(e) => setMaskOpacity(parseFloat(e.target.value))}
                className="w-16 accent-zinc-300 h-1 bg-zinc-800 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Master Timeline Scrubber Bar with Keyframe Markers */}
        <div className="relative w-full h-5 bg-zinc-900 border border-zinc-800 rounded overflow-hidden flex items-center px-1 cursor-pointer">
          {/* Progress bar */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-zinc-700/40 border-r-2 border-white pointer-events-none transition-all"
            style={{ width: `${(currentFrame / (totalFrames - 1 || 1)) * 100}%` }}
          />

          {/* Keyframe indicator diamond markers (CVAT Style) */}
          {annotations
            .filter((a) => a.is_keyframe)
            .map((kf, i) => (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-amber-400 ring-1 ring-black pointer-events-none"
                style={{ left: `${(kf.frame_idx / (totalFrames - 1 || 1)) * 100}%` }}
                title={`Keyframe at frame ${kf.frame_idx}`}
              />
            ))}

          {/* Interactive Range Input */}
          <input
            type="range"
            min="0"
            max={totalFrames - 1}
            value={currentFrame}
            onChange={(e) => {
              const f = parseInt(e.target.value, 10);
              setCurrentFrame(f);
              if (videoRef.current) videoRef.current.currentTime = f / fps;
            }}
            className="w-full absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>

        {/* Multi-Track Visual Timeline Lanes (Shows active tracks over time) */}
        <div className="space-y-1 pt-0.5 max-h-24 overflow-y-auto">
          {tracks.map((track) => {
            const trackAnns = annotations.filter((a) => a.track_id === track.track_id);
            const activeFrames = new Set(trackAnns.map((a) => a.frame_idx));

            return (
              <div
                key={track.track_id}
                onClick={() => onSelectTrack(track.track_id)}
                className={`flex items-center gap-2 px-2 py-0.5 rounded cursor-pointer transition text-[11px] ${
                  selectedTrackId === track.track_id
                    ? "bg-zinc-800 border border-zinc-700/80"
                    : "bg-zinc-900/40 hover:bg-zinc-900 border border-transparent"
                }`}
              >
                {/* Track Pill */}
                <div className="w-28 shrink-0 flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: track.color }} />
                  <span className="font-medium text-zinc-200 truncate">{track.label}</span>
                </div>

                {/* Track mini timeline lane */}
                <div className="flex-1 h-2 bg-zinc-900 rounded relative overflow-hidden border border-zinc-800/80">
                  {Array.from(activeFrames).map((fIdx) => (
                    <div
                      key={fIdx}
                      className="absolute top-0 bottom-0 opacity-80"
                      style={{
                        left: `${(fIdx / (totalFrames - 1 || 1)) * 100}%`,
                        width: `${(1 / (totalFrames || 1)) * 100}%`,
                        backgroundColor: track.color,
                      }}
                    />
                  ))}
                  {/* Current playhead line */}
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

      {/* 3. Three.js 3D Volumetric Mesh Viewer Modal */}
      <ThreeSurgicalViewer
        isOpen={isThreeViewerOpen}
        onClose={() => setIsThreeViewerOpen(false)}
        videoElement={videoRef.current}
        tracks={tracks}
        frameAnnotations={activeFrameAnns}
      />
    </div>
  );
};
