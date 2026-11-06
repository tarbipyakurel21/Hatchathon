"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Annotation,
  Point,
  ToolType,
} from "@/lib/types";
import {
  pointInPolygon,
  computeBoundingBox,
  computePolygonArea,
  distanceBetween,
  distanceToSegment,
} from "@/lib/geometry";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Hand,
  MousePointer,
  PenTool,
  Scan,
} from "lucide-react";

interface AnnotationCanvasProps {
  imageUrl: string | null;
  annotations: Annotation[];
  selectedId: string | null;
  activeTool: ToolType;
  maskOpacity: number;
  showBoundingBoxes: boolean;
  showLabels: boolean;
  showAnnotations: boolean;
  onSelectAnnotation: (id: string | null) => void;
  onUpdateAnnotation: (ann: Annotation) => void;
  onAddAnnotation: (ann: Partial<Annotation>) => void;
  onDeleteSelected: () => void;
  onSegmentBox?: (bbox: [number, number, number, number]) => void;
}

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  imageUrl,
  annotations,
  selectedId,
  activeTool,
  maskOpacity,
  showBoundingBoxes,
  showLabels,
  showAnnotations,
  onSelectAnnotation,
  onUpdateAnnotation,
  onAddAnnotation,
  onDeleteSelected,
  onSegmentBox,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);

  // Viewport transformation state
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageDims, setImageDims] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });

  // Interaction state
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [spacePressed, setSpacePressed] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredVertexIdx, setHoveredVertexIdx] = useState<number | null>(null);
  const [draggingVertexIdx, setDraggingVertexIdx] = useState<number | null>(null);

  // Drawing state for manual polygon & SAM box prompt
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [currentMousePos, setCurrentMousePos] = useState<Point | null>(null);
  const [boxStart, setBoxStart] = useState<Point | null>(null);
  const [currentBox, setCurrentBox] = useState<[number, number, number, number] | null>(null);

  // Load image
  useEffect(() => {
    if (!imageUrl) {
      setImageLoaded(false);
      imageObjRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = () => {
      imageObjRef.current = img;
      setImageDims({ w: img.naturalWidth, h: img.naturalHeight });
      setImageLoaded(true);

      // Fit to container on initial load
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const scaleX = (clientWidth - 64) / img.naturalWidth;
        const scaleY = (clientHeight - 64) / img.naturalHeight;
        const initScale = Math.min(scaleX, scaleY, 1.0);
        const initX = (clientWidth - img.naturalWidth * initScale) / 2;
        const initY = (clientHeight - img.naturalHeight * initScale) / 2;

        setZoom(initScale);
        setPan({ x: initX, y: initY });
      }
    };
  }, [imageUrl]);

  // Coordinate transforms
  const screenToImage = useCallback(
    (screenX: number, screenY: number): Point => {
      return [(screenX - pan.x) / zoom, (screenY - pan.y) / zoom];
    },
    [pan, zoom]
  );

  const imageToScreen = useCallback(
    (imgX: number, imgY: number): Point => {
      return [imgX * zoom + pan.x, imgY * zoom + pan.y];
    },
    [pan, zoom]
  );

  // Fit to screen helper
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !imageDims.w || !imageDims.h) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const scaleX = (clientWidth - 64) / imageDims.w;
    const scaleY = (clientHeight - 64) / imageDims.h;
    const fitScale = Math.min(scaleX, scaleY, 1.0);
    const fitX = (clientWidth - imageDims.w * fitScale) / 2;
    const fitY = (clientHeight - imageDims.h * fitScale) / 2;

    setZoom(fitScale);
    setPan({ x: fitX, y: fitY });
  }, [imageDims]);

  // Reset to 100% zoom
  const resetZoom = useCallback(() => {
    if (!containerRef.current || !imageDims.w || !imageDims.h) return;
    const { clientWidth, clientHeight } = containerRef.current;
    setZoom(1.0);
    setPan({
      x: (clientWidth - imageDims.w) / 2,
      y: (clientHeight - imageDims.h) / 2,
    });
  }, [imageDims]);

  // Keyboard navigation & tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        setSpacePressed(true);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        // If not in input or textarea
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          if (selectedId) {
            onDeleteSelected();
          }
        }
      }
      if (e.key === "Escape") {
        if (drawingPoints.length > 0) {
          setDrawingPoints([]);
        } else {
          onSelectAnnotation(null);
        }
      }
      if (e.key === "Enter" && drawingPoints.length >= 3) {
        finishPolygon();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedId, drawingPoints, onDeleteSelected, onSelectAnnotation]);

  // Complete drawing polygon
  const finishPolygon = useCallback(() => {
    if (drawingPoints.length < 3) return;
    const bbox = computeBoundingBox(drawingPoints);
    const area = computePolygonArea(drawingPoints);
    onAddAnnotation({
      polygon: drawingPoints,
      bbox,
      area: Math.round(area * 10) / 10,
    });
    setDrawingPoints([]);
  }, [drawingPoints, onAddAnnotation]);

  // Mouse wheel zoom (anchored at mouse cursor)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.1), 15.0);

    // Keep point under mouse fixed:
    // (mouseX - pan.x) / zoom == (mouseX - newPanX) / newZoom
    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Canvas Mouse Down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const [imgX, imgY] = screenToImage(mouseX, mouseY);

    // Pan mode: Space held, middle mouse, or Pan tool active
    if (spacePressed || activeTool === "pan" || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: mouseX - pan.x, y: mouseY - pan.y });
      return;
    }

    if (e.button !== 0) return; // Only left click for editing

    // SAM-style Box prompt mode
    if (activeTool === "box") {
      setBoxStart([imgX, imgY]);
      setCurrentBox([imgX, imgY, 0, 0]);
      return;
    }

    // If drawing polygon
    if (activeTool === "polygon") {
      // Check if clicking near first vertex to close
      if (drawingPoints.length >= 3) {
        const [firstX, firstY] = drawingPoints[0];
        const [firstScreenX, firstScreenY] = imageToScreen(firstX, firstY);
        const dist = Math.hypot(mouseX - firstScreenX, mouseY - firstScreenY);
        if (dist < 14) {
          finishPolygon();
          return;
        }
      }

      // Add vertex
      setDrawingPoints((prev) => [...prev, [Math.round(imgX), Math.round(imgY)]]);
      return;
    }

    // Select mode: check if clicking on selected annotation's vertex
    if (selectedId) {
      const selectedAnn = annotations.find((a) => a.id === selectedId);
      if (selectedAnn && selectedAnn.polygon) {
        // Vertex handle hit testing (12px screen radius)
        for (let i = 0; i < selectedAnn.polygon.length; i++) {
          const [vx, vy] = selectedAnn.polygon[i];
          const [sx, sy] = imageToScreen(vx, vy);
          if (Math.hypot(mouseX - sx, mouseY - sy) <= 12) {
            setDraggingVertexIdx(i);
            return;
          }
        }

        // Edge hit testing: click on edge to insert new vertex
        for (let i = 0; i < selectedAnn.polygon.length; i++) {
          const j = (i + 1) % selectedAnn.polygon.length;
          const v1 = selectedAnn.polygon[i];
          const v2 = selectedAnn.polygon[j];
          const { dist, proj } = distanceToSegment([imgX, imgY], v1, v2);
          const [psx, psy] = imageToScreen(proj[0], proj[1]);
          if (Math.hypot(mouseX - psx, mouseY - psy) <= 8) {
            const newPoly = [...selectedAnn.polygon];
            newPoly.splice(i + 1, 0, [Math.round(proj[0]), Math.round(proj[1])]);
            const newBbox = computeBoundingBox(newPoly);
            const newArea = computePolygonArea(newPoly);
            onUpdateAnnotation({
              ...selectedAnn,
              polygon: newPoly,
              bbox: newBbox,
              area: Math.round(newArea * 10) / 10,
            });
            setDraggingVertexIdx(i + 1);
            return;
          }
        }
      }
    }

    // Hit test annotations (select top-most under cursor)
    let foundId: string | null = null;
    for (let i = annotations.length - 1; i >= 0; i--) {
      const ann = annotations[i];
      if (!ann.is_visible) continue;
      if (pointInPolygon([imgX, imgY], ann.polygon)) {
        foundId = ann.id;
        break;
      }
    }

    onSelectAnnotation(foundId);
  };

  // Canvas Mouse Move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const [imgX, imgY] = screenToImage(mouseX, mouseY);
    setCurrentMousePos([imgX, imgY]);

    // Handle panning
    if (isPanning) {
      setPan({ x: mouseX - panStart.x, y: mouseY - panStart.y });
      return;
    }

    // Handle SAM-style box prompt dragging
    if (activeTool === "box" && boxStart) {
      const minX = Math.min(boxStart[0], imgX);
      const minY = Math.min(boxStart[1], imgY);
      const bw = Math.abs(imgX - boxStart[0]);
      const bh = Math.abs(imgY - boxStart[1]);
      setCurrentBox([minX, minY, bw, bh]);
      return;
    }

    // Handle dragging vertex
    if (draggingVertexIdx !== null && selectedId) {
      const selectedAnn = annotations.find((a) => a.id === selectedId);
      if (selectedAnn) {
        const newPoly = selectedAnn.polygon.map((p, idx) =>
          idx === draggingVertexIdx ? ([Math.round(imgX), Math.round(imgY)] as Point) : p
        );
        const newBbox = computeBoundingBox(newPoly);
        const newArea = computePolygonArea(newPoly);
        onUpdateAnnotation({
          ...selectedAnn,
          polygon: newPoly,
          bbox: newBbox,
          area: Math.round(newArea * 10) / 10,
        });
      }
      return;
    }

    // Vertex hover check
    if (selectedId) {
      const selectedAnn = annotations.find((a) => a.id === selectedId);
      if (selectedAnn && selectedAnn.polygon) {
        let vHit: number | null = null;
        for (let i = 0; i < selectedAnn.polygon.length; i++) {
          const [vx, vy] = selectedAnn.polygon[i];
          const [sx, sy] = imageToScreen(vx, vy);
          if (Math.hypot(mouseX - sx, mouseY - sy) <= 12) {
            vHit = i;
            break;
          }
        }
        setHoveredVertexIdx(vHit);
        if (vHit !== null) return;
      }
    } else {
      setHoveredVertexIdx(null);
    }

    // Polygon hover check
    let foundHover: string | null = null;
    if (activeTool === "select") {
      for (let i = annotations.length - 1; i >= 0; i--) {
        const ann = annotations[i];
        if (!ann.is_visible) continue;
        if (pointInPolygon([imgX, imgY], ann.polygon)) {
          foundHover = ann.id;
          break;
        }
      }
    }
    setHoveredId(foundHover);
  };

  // Canvas Mouse Up
  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingVertexIdx(null);

    // If box prompt finished
    if (activeTool === "box" && currentBox) {
      if (currentBox[2] >= 10 && currentBox[3] >= 10 && onSegmentBox) {
        onSegmentBox(currentBox);
      }
      setBoxStart(null);
      setCurrentBox(null);
    }
  };

  // Double click on vertex to delete it
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedId || hoveredVertexIdx === null) return;
    const selectedAnn = annotations.find((a) => a.id === selectedId);
    if (!selectedAnn || selectedAnn.polygon.length <= 3) return; // Keep at least triangle

    const newPoly = selectedAnn.polygon.filter((_, idx) => idx !== hoveredVertexIdx);
    const newBbox = computeBoundingBox(newPoly);
    const newArea = computePolygonArea(newPoly);
    onUpdateAnnotation({
      ...selectedAnn,
      polygon: newPoly,
      bbox: newBbox,
      area: Math.round(newArea * 10) / 10,
    });
    setHoveredVertexIdx(null);
  };

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high-DPI retina display
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw background checkerboard pattern for subtle contrast
    ctx.fillStyle = "#070b13";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Apply viewport transform
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw microscopy image
    if (imageObjRef.current && imageLoaded) {
      ctx.imageSmoothingEnabled = zoom < 2.5; // Nearest neighbor when zooming into pixels
      ctx.drawImage(imageObjRef.current, 0, 0);

      // Subtle image border
      ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
      ctx.lineWidth = 1 / zoom;
      ctx.strokeRect(0, 0, imageDims.w, imageDims.h);
    }

    // Draw Annotations
    if (showAnnotations) {
      annotations.forEach((ann) => {
        if (!ann.is_visible || !ann.polygon || ann.polygon.length < 3) return;

        const isSelected = ann.id === selectedId;
        const isHovered = ann.id === hoveredId;

        ctx.beginPath();
        ann.polygon.forEach(([x, y], idx) => {
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();

        // Fill with semi-transparent color
        ctx.fillStyle = ann.color || "#06B6D4";
        ctx.globalAlpha = isSelected
          ? Math.min(maskOpacity + 0.25, 0.9)
          : isHovered
          ? Math.min(maskOpacity + 0.15, 0.8)
          : maskOpacity;
        ctx.fill();

        // Stroke outline
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = isSelected ? "#FFFFFF" : isHovered ? "#22D3EE" : ann.color || "#06B6D4";
        ctx.lineWidth = (isSelected ? 3 : isHovered ? 2.5 : 1.8) / zoom;
        ctx.stroke();

        // Draw Bounding Box if toggled
        if (showBoundingBoxes && ann.bbox) {
          const [bx, by, bw, bh] = ann.bbox;
          ctx.strokeStyle = isSelected ? "#FFFFFF" : "rgba(148, 163, 184, 0.6)";
          ctx.lineWidth = 1 / zoom;
          ctx.setLineDash([4 / zoom, 4 / zoom]);
          ctx.strokeRect(bx, by, bw, bh);
          ctx.setLineDash([]);
        }

        // Draw Label pill if toggled
        if (showLabels && ann.polygon.length > 0) {
          const [lx, ly] = ann.polygon[0];
          ctx.save();
          ctx.font = `${Math.max(10, 12 / zoom)}px monospace`;
          const text = `${ann.label} (${Math.round(ann.area)} px²)`;
          const metrics = ctx.measureText(text);
          const textPad = 4 / zoom;
          const bgHeight = 16 / zoom;
          const bgWidth = metrics.width + textPad * 2;

          ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
          ctx.fillRect(lx, ly - bgHeight - 2 / zoom, bgWidth, bgHeight);
          ctx.fillStyle = isSelected ? "#22D3EE" : "#F1F5F9";
          ctx.fillText(text, lx + textPad, ly - 5 / zoom);
          ctx.restore();
        }
      });

      // Draw Selected Annotation's Vertex Handles
      if (selectedId) {
        const selectedAnn = annotations.find((a) => a.id === selectedId);
        if (selectedAnn && selectedAnn.polygon) {
          selectedAnn.polygon.forEach(([vx, vy], idx) => {
            const isVertexHovered = idx === hoveredVertexIdx;
            const isVertexDragging = idx === draggingVertexIdx;
            const handleRadius = (isVertexHovered || isVertexDragging ? 6 : 4.5) / zoom;

            ctx.beginPath();
            ctx.arc(vx, vy, handleRadius, 0, Math.PI * 2);
            ctx.fillStyle = isVertexHovered ? "#22D3EE" : "#FFFFFF";
            ctx.fill();
            ctx.strokeStyle = "#0F172A";
            ctx.lineWidth = 1.5 / zoom;
            ctx.stroke();
          });
        }
      }
    }

    // Draw Live Polygon currently being drawn
    if (drawingPoints.length > 0) {
      ctx.beginPath();
      drawingPoints.forEach(([px, py], idx) => {
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });

      // Connect to mouse position
      if (currentMousePos) {
        ctx.lineTo(currentMousePos[0], currentMousePos[1]);
      }

      ctx.strokeStyle = "#22D3EE";
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw vertices of the in-progress polygon
      drawingPoints.forEach(([px, py], idx) => {
        const isFirst = idx === 0;
        ctx.beginPath();
        ctx.arc(px, py, (isFirst ? 6 : 4) / zoom, 0, Math.PI * 2);
        ctx.fillStyle = isFirst ? "#10B981" : "#06B6D4";
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
      });
    }

    // Draw Live SAM Box Prompt
    if (currentBox) {
      const [bx, by, bw, bh] = currentBox;
      ctx.fillStyle = "rgba(6, 182, 212, 0.15)";
      ctx.fillRect(bx, by, bw, bh);

      ctx.strokeStyle = "#22D3EE";
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);
    }

    ctx.restore();
    ctx.restore();
  }, [
    imageLoaded,
    imageDims,
    zoom,
    pan,
    annotations,
    selectedId,
    hoveredId,
    hoveredVertexIdx,
    draggingVertexIdx,
    maskOpacity,
    showBoundingBoxes,
    showLabels,
    showAnnotations,
    drawingPoints,
    currentMousePos,
    currentBox,
  ]);

  // Determine cursor style
  let cursorClass = "cursor-default";
  if (isPanning) {
    cursorClass = "cursor-grabbing";
  } else if (spacePressed || activeTool === "pan") {
    cursorClass = "cursor-grab";
  } else if (activeTool === "polygon" || activeTool === "box") {
    cursorClass = "cursor-crosshair";
  } else if (hoveredVertexIdx !== null) {
    cursorClass = "cursor-move";
  } else if (hoveredId !== null) {
    cursorClass = "cursor-pointer";
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none bg-[#070b13] flex items-center justify-center"
    >
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        className={`w-full h-full block ${cursorClass}`}
      />

      {/* Floating Canvas Controls (Bottom Center) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-[#0d131f]/90 backdrop-blur-md border border-[#1e293b] rounded-full shadow-2xl text-xs text-slate-300">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.25, 15.0))}
          title="Zoom In (+)"
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="px-2 font-mono text-[11px] min-w-[50px] text-center text-slate-400">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.max(z / 1.25, 0.1))}
          title="Zoom Out (-)"
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="h-4 w-[1px] bg-[#1e293b] mx-1" />
        <button
          onClick={fitToScreen}
          title="Fit to Screen (0)"
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition flex items-center gap-1"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px]">Fit</span>
        </button>
        <button
          onClick={resetZoom}
          title="100% Zoom (1)"
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition flex items-center gap-1"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px]">100%</span>
        </button>
      </div>

      {/* SAM Box Prompt helper banner */}
      {activeTool === "box" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-brand-cyan/20 border border-brand-cyan/40 rounded-full backdrop-blur-md text-xs text-cyan-200 shadow-xl flex items-center gap-2">
          <Scan className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>Click & drag a box around cells to auto-segment</span>
        </div>
      )}

      {/* Manual Polygon Drawing helper banner */}
      {activeTool === "polygon" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-brand-cyan/20 border border-brand-cyan/40 rounded-full backdrop-blur-md text-xs text-cyan-200 shadow-xl flex items-center gap-2">
          <PenTool className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>
            Click points • Enter or click first point to close • Esc to cancel
          </span>
        </div>
      )}
    </div>
  );
};
