"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { Annotation } from "@/lib/types";
import { Compass, Eye, EyeOff } from "lucide-react";

interface MinimapProps {
  imageSrc: string | null;
  imageDims: { w: number; h: number };
  containerDims: { w: number; h: number };
  pan: { x: number; y: number };
  zoom: number;
  annotations: Annotation[];
  onNavigate: (newPan: { x: number; y: number }) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  imageSrc,
  imageDims,
  containerDims,
  pan,
  zoom,
  annotations,
  onNavigate,
  isOpen,
  onToggle,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const MAP_WIDTH = 150;
  const MAP_HEIGHT =
    imageDims.w > 0 ? Math.round((imageDims.h / imageDims.w) * MAP_WIDTH) : 100;
  const clampedHeight = Math.min(Math.max(MAP_HEIGHT, 80), 160);

  // Load cached image for minimap
  useEffect(() => {
    if (!imageSrc) {
      imgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      imgRef.current = img;
      renderMinimap();
    };
  }, [imageSrc]);

  // Render loop
  const renderMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageDims.w || !imageDims.h) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, MAP_WIDTH, clampedHeight);

    // Draw background
    ctx.fillStyle = "#070b13";
    ctx.fillRect(0, 0, MAP_WIDTH, clampedHeight);

    const scaleX = MAP_WIDTH / imageDims.w;
    const scaleY = clampedHeight / imageDims.h;

    // Draw thumbnail image
    if (imgRef.current) {
      ctx.drawImage(imgRef.current, 0, 0, MAP_WIDTH, clampedHeight);
    }

    // Draw annotations as small glowing dots / shapes
    annotations.forEach((ann) => {
      if (!ann.is_visible || !ann.polygon || ann.polygon.length === 0) return;
      ctx.beginPath();
      ann.polygon.forEach(([x, y], idx) => {
        const mx = x * scaleX;
        const my = y * scaleY;
        if (idx === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
      });
      ctx.closePath();
      ctx.fillStyle = ann.color || "#06B6D4";
      ctx.globalAlpha = 0.5;
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Calculate visible viewport rectangle in image coords:
    // visibleX0 = -pan.x / zoom, visibleY0 = -pan.y / zoom
    // visibleW = containerDims.w / zoom, visibleH = containerDims.h / zoom
    const vX0 = (-pan.x / zoom) * scaleX;
    const vY0 = (-pan.y / zoom) * scaleY;
    const vW = (containerDims.w / zoom) * scaleX;
    const vH = (containerDims.h / zoom) * scaleY;

    // Viewport box overlay
    ctx.strokeStyle = "#22D3EE";
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "rgba(34, 211, 238, 0.12)";
    ctx.fillRect(vX0, vY0, vW, vH);
    ctx.strokeRect(vX0, vY0, vW, vH);
  }, [imageDims, containerDims, pan, zoom, annotations, clampedHeight]);

  useEffect(() => {
    if (isOpen) {
      renderMinimap();
    }
  }, [isOpen, renderMinimap]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current && e.buttons !== 1) return;
    const canvas = canvasRef.current;
    if (!canvas || !imageDims.w || !imageDims.h) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const imgTargetX = (clickX / MAP_WIDTH) * imageDims.w;
    const imgTargetY = (clickY / clampedHeight) * imageDims.h;

    // Center the viewport on (imgTargetX, imgTargetY)
    const newPanX = containerDims.w / 2 - imgTargetX * zoom;
    const newPanY = containerDims.h / 2 - imgTargetY * zoom;

    onNavigate({ x: newPanX, y: newPanY });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handlePointerMove(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        title="Open Navigator"
        className="absolute bottom-4 right-4 z-30 p-2 rounded-lg bg-[#0d131f]/90 border border-slate-700/60 text-slate-400 hover:text-brand-cyan hover:border-brand-cyan/50 backdrop-blur-md shadow-lg transition"
      >
        <Compass className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-30 bg-[#0d131f]/95 border border-slate-700/60 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800 bg-[#121927]/60">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Compass className="w-3 h-3 text-brand-cyan" />
          Navigator
        </span>
        <button
          onClick={onToggle}
          title="Minimize Navigator"
          className="text-slate-400 hover:text-slate-200 transition"
        >
          <EyeOff className="w-3 h-3" />
        </button>
      </div>

      <div className="p-1 cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={MAP_WIDTH}
          height={clampedHeight}
          className="rounded border border-slate-800/80 block"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>
    </div>
  );
};
