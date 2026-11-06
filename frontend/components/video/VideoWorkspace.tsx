"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  VideoItem,
  VideoTrack,
  VideoFrameAnnotation,
  SurgicalCategory,
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
  Layers,
  Sparkles,
  Maximize2,
  Volume2,
  VolumeX,
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

  const fps = video?.fps || 30.0;
  const totalFrames = video?.total_frames || 90;

  // Sync Video time when currentFrame changes externally
  useEffect(() => {
    if (!videoRef.current || isPlaying) return;
    const targetTime = currentFrame / fps;
    if (Math.abs(videoRef.current.currentTime - targetTime) > 0.03) {
      videoRef.current.currentTime = targetTime;
    }
  }, [currentFrame, fps, isPlaying]);

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
    const nextFrame = Math.max(0, Math.min(totalFrames - 1, currentFrame + delta));
    setCurrentFrame(nextFrame);
    videoRef.current.currentTime = nextFrame / fps;
  };

  // Keyboard shortcuts (Space = Play/Pause, Left/Right = Step, W = Point, B = Box)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepFrame(e.shiftKey ? -10 : -1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepFrame(e.shiftKey ? 10 : 1);
      } else if (e.key.toLowerCase() === "w") {
        setActiveTool("point");
      } else if (e.key.toLowerCase() === "b") {
        setActiveTool("box");
      } else if (e.key.toLowerCase() === "v") {
        setActiveTool("select");
      } else if (e.key.toLowerCase() === "c") {
        setSplitViewEnabled((s) => !s);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentFrame, isPlaying, totalFrames]);

  // Canvas Mouse Coordinates mapping to native video resolution
  const getCanvasVideoCoords = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas || !video) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const vx = (clickX / rect.width) * (video.width || 640);
    const vy = (clickY / rect.height) * (video.height || 360);
    return [vx, vy];
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !video) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Split divider drag check
    if (splitViewEnabled) {
      const divX = rect.width * splitPosition;
      if (Math.abs(mouseX - divX) <= 10) {
        setIsDraggingSplit(true);
        return;
      }
    }

    const [vx, vy] = getCanvasVideoCoords(e);

    // SAM 2 Point Prompt
    if (activeTool === "point") {
      setRipples((prev) => [...prev.slice(-3), { x: vx, y: vy, time: Date.now() }]);
      onPrompt(currentFrame, "point", [Math.round(vx), Math.round(vy)]);
      return;
    }

    // SAM 2 Box Prompt
    if (activeTool === "box") {
      setBoxStart([vx, vy]);
      setCurrentBox([vx, vy, 0, 0]);
      return;
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
    const vh = video.height || 360;

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

        // Semi-transparent mask fill
        ctx.fillStyle = color;
        ctx.globalAlpha = isSelected ? Math.min(maskOpacity + 0.35, 0.95) : maskOpacity;
        ctx.fill();

        // Contour stroke
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = isSelected ? "#FFFFFF" : color;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.stroke();

        // Bounding box
        if (showBoundingBoxes && ann.bbox) {
          const [bx, by, bw, bh] = ann.bbox;
          ctx.strokeStyle = isSelected ? "#FFFFFF" : "rgba(255, 255, 255, 0.4)";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(bx * scaleX, by * scaleY, bw * scaleX, bh * scaleY);
          ctx.setLineDash([]);

          // Label badge
          if (track) {
            ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
            const text = `${track.label} #${track.track_id}`;
            ctx.font = "bold 10px monospace";
            const textMetrics = ctx.measureText(text);
            ctx.fillRect(bx * scaleX, by * scaleY - 16, textMetrics.width + 8, 16);
            ctx.fillStyle = isSelected ? "#22D3EE" : "#F1F5F9";
            ctx.fillText(text, bx * scaleX + 4, by * scaleY - 4);
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
      ctx.lineWidth = 2;
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
        ctx.arc(r.x * scaleX, r.y * scaleY, rad, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34, 211, 238, ${1 - prog})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Split Divider Line
    if (splitViewEnabled) {
      const dividerX = rect.width * splitPosition;
      ctx.strokeStyle = "#22D3EE";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(dividerX, 0);
      ctx.lineTo(dividerX, rect.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Center Grip
      const midY = rect.height / 2;
      ctx.fillStyle = "#0D131F";
      ctx.strokeStyle = "#22D3EE";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(dividerX, midY, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#22D3EE";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("◂ ▸", dividerX, midY);
    }

    ctx.restore();
  }, [
    video,
    currentFrame,
    annotations,
    tracks,
    maskOpacity,
    showAnnotations,
    showBoundingBoxes,
    splitViewEnabled,
    splitPosition,
    currentBox,
    ripples,
    selectedTrackId,
  ]);

  if (!video) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#070b13] text-slate-500 select-none">
        <Box className="w-12 h-12 mb-3 stroke-[1.5] text-slate-700 animate-pulse" />
        <p className="text-sm font-medium text-slate-400">No medical video loaded</p>
        <p className="text-xs text-slate-600 mt-1">
          Upload a surgical MP4 video or click "Try Surgical Demo" in the left sidebar
        </p>
      </div>
    );
  }

  // Active frame annotations for 3D viewer
  const activeFrameAnns = annotations.filter((a) => a.frame_idx === currentFrame);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col bg-[#070b13] overflow-hidden select-none relative">
      {/* 1. Center Video + Canvas Overlays Viewport */}
      <div className="flex-1 relative flex items-center justify-center p-3 overflow-hidden bg-[#070b13]">
        <div className="relative max-w-full max-h-full aspect-video rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-black flex items-center justify-center">
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

          {/* Quick 3D Mesh Viewer Button Floating in Viewport */}
          <button
            onClick={() => setIsThreeViewerOpen(true)}
            title="Open 3D Mesh Reconstruction (Three.js)"
            className="absolute top-3 right-3 z-30 px-3 py-1.5 rounded-lg bg-[#0d131f]/90 border border-cyan-500/40 text-cyan-300 hover:text-white hover:border-cyan-400 hover:bg-cyan-500/20 backdrop-blur-md shadow-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D Mesh View</span>
          </button>
        </div>
      </div>

      {/* 2. Professional NLE Scrubbing Timeline & Multi-Track Lanes */}
      <div className="border-t border-[#1e293b] bg-[#0d131f] p-3 space-y-2.5 shrink-0 z-20">
        {/* Scrubber Controls Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => stepFrame(-10)}
              title="Jump 10 Frames Back (Shift+Left)"
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={() => stepFrame(-1)}
              title="Step 1 Frame Back (Left Arrow)"
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Big Play / Pause Button */}
            <button
              onClick={togglePlay}
              title="Play / Pause (Space)"
              className="mx-1 w-9 h-9 rounded-full bg-gradient-to-r from-brand-cyan to-brand-violet hover:brightness-110 active:scale-95 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-cyan-500/20 transition"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-slate-950 ml-0.5" />}
            </button>

            <button
              onClick={() => stepFrame(1)}
              title="Step 1 Frame Forward (Right Arrow)"
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => stepFrame(10)}
              title="Jump 10 Frames Forward (Shift+Right)"
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Exact Timecode and Frame Counter Readout */}
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-cyan-400 font-bold">
              FRAME {String(currentFrame).padStart(4, "0")} / {String(totalFrames).padStart(4, "0")}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300">
              {(currentFrame / fps).toFixed(2)}s / {(totalFrames / fps).toFixed(2)}s @ {fps} FPS
            </span>
          </div>

          {/* Quick Display Switches (Split, Opacity, Boxes) */}
          <div className="flex items-center gap-3">
            {/* Split View Compare */}
            <button
              onClick={() => setSplitViewEnabled(!splitViewEnabled)}
              title="Split View Compare: Compare raw video with tracked masks (C)"
              className={`px-2.5 py-1 rounded text-xs border font-medium flex items-center gap-1.5 transition ${
                splitViewEnabled
                  ? "bg-brand-violet text-white border-brand-violet font-semibold"
                  : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>

            {/* Mask Opacity Slider */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Sliders className="w-3 h-3 text-cyan-400" />
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={maskOpacity}
                onChange={(e) => setMaskOpacity(parseFloat(e.target.value))}
                className="w-16 accent-brand-cyan h-1 bg-slate-800 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Master Timeline Scrubber Bar with Keyframe Markers */}
        <div className="relative w-full h-6 bg-[#070b13] border border-slate-800 rounded-lg overflow-hidden flex items-center px-1 cursor-pointer">
          {/* Progress bar */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-brand-cyan/20 border-r-2 border-brand-cyan pointer-events-none transition-all"
            style={{ width: `${(currentFrame / (totalFrames - 1 || 1)) * 100}%` }}
          />

          {/* Keyframe indicator dots */}
          {annotations
            .filter((a) => a.is_keyframe)
            .map((kf, i) => (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-900 pointer-events-none"
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
        <div className="space-y-1 pt-1 max-h-24 overflow-y-auto">
          {tracks.map((track) => {
            const trackAnns = annotations.filter((a) => a.track_id === track.track_id);
            const activeFrames = new Set(trackAnns.map((a) => a.frame_idx));

            return (
              <div
                key={track.track_id}
                onClick={() => onSelectTrack(track.track_id)}
                className={`flex items-center gap-2 px-2 py-0.5 rounded cursor-pointer transition text-[11px] ${
                  selectedTrackId === track.track_id
                    ? "bg-[#162032] border border-cyan-500/40"
                    : "bg-[#070b13]/60 hover:bg-[#121927]"
                }`}
              >
                {/* Track Pill */}
                <div className="w-24 shrink-0 flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: track.color }} />
                  <span className="font-semibold text-slate-200 truncate">{track.label}</span>
                </div>

                {/* Track mini timeline lane */}
                <div className="flex-1 h-2 bg-slate-900 rounded relative overflow-hidden">
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
