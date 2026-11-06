"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Annotation,
  Point,
  ToolType,
  ImageAdjustments,
  SplitViewConfig,
  Measurement,
} from "@/lib/types";
import {
  pointInPolygon,
  computeBoundingBox,
  computePolygonArea,
  distanceBetween,
  distanceToSegment,
} from "@/lib/geometry";
import { applyAdjustmentsToImageData } from "@/lib/lut";
import { Minimap } from "./Minimap";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Hand,
  MousePointer,
  PenTool,
  Scan,
  Crosshair,
  Ruler,
  SplitSquareVertical,
  Activity,
  Layers,
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
  adjustments: ImageAdjustments;
  splitView: SplitViewConfig;
  onSplitViewChange: (cfg: SplitViewConfig) => void;
  onSelectAnnotation: (id: string | null) => void;
  onUpdateAnnotation: (ann: Annotation) => void;
  onAddAnnotation: (ann: Partial<Annotation>) => void;
  onDeleteSelected: () => void;
  onSegmentBox?: (bbox: [number, number, number, number]) => void;
  isAnnotating?: boolean;
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
  adjustments,
  splitView,
  onSplitViewChange,
  onSelectAnnotation,
  onUpdateAnnotation,
  onAddAnnotation,
  onDeleteSelected,
  onSegmentBox,
  isAnnotating = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Viewport transformation state
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageDims, setImageDims] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });
  const [containerDims, setContainerDims] = useState<{ w: number; h: number }>({
    w: 800,
    h: 600,
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

  // Drawing state for manual polygon & SAM prompts
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [currentMousePos, setCurrentMousePos] = useState<Point | null>(null);
  const [boxStart, setBoxStart] = useState<Point | null>(null);
  const [currentBox, setCurrentBox] = useState<[number, number, number, number] | null>(null);

  // Measurement (Ruler) state
  const [rulerStart, setRulerStart] = useState<Point | null>(null);
  const [currentMeasurement, setCurrentMeasurement] = useState<Measurement | null>(null);

  // Point prompt ripple animation feedback
  const [pointRipples, setPointRipples] = useState<{ x: number; y: number; time: number }[]>([]);

  // Split-view dragging state
  const [isDraggingSplitDivider, setIsDraggingSplitDivider] = useState<boolean>(false);

  // Minimap visibility
  const [isMinimapOpen, setIsMinimapOpen] = useState<boolean>(true);

  // Live cursor readout
  const [cursorInfo, setCursorInfo] = useState<{
    x: number;
    y: number;
    intensity: number | null;
  } | null>(null);

  // Keep track of container dimensions
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerDims({
          w: containerRef.current.clientWidth,
          h: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // 1. Load source image
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

  // 2. Offscreen Cache with Adjustments & Scientific LUT
  useEffect(() => {
    if (!imageObjRef.current || !imageDims.w || !imageDims.h) return;

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement("canvas");
    }
    const off = offscreenCanvasRef.current;
    off.width = imageDims.w;
    off.height = imageDims.h;
    const ctx = off.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Apply brightness and contrast filter
    const b = 100 + adjustments.brightness;
    const c = 100 + adjustments.contrast;
    ctx.filter = `brightness(${b}%) contrast(${c}%)`;
    ctx.drawImage(imageObjRef.current, 0, 0);
    ctx.filter = "none";

    // If LUT, gamma or invert is active, transform image data
    if (
      adjustments.lut !== "original" ||
      adjustments.exposure !== 1.0 ||
      adjustments.invert
    ) {
      const imgData = ctx.getImageData(0, 0, imageDims.w, imageDims.h);
      applyAdjustmentsToImageData(imgData, {
        lut: adjustments.lut,
        exposure: adjustments.exposure,
        invert: adjustments.invert,
      });
      ctx.putImageData(imgData, 0, 0);
    }
  }, [imageLoaded, imageDims, adjustments]);

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

  // Keyboard navigation & tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        setSpacePressed(true);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
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
        } else if (currentMeasurement) {
          setCurrentMeasurement(null);
          setRulerStart(null);
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
  }, [
    selectedId,
    drawingPoints,
    currentMeasurement,
    onDeleteSelected,
    onSelectAnnotation,
    finishPolygon,
  ]);

  // Mouse wheel zoom (anchored at mouse cursor)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.1), 25.0);

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

    // Split-view divider dragging check
    if (splitView.enabled) {
      const dividerX = rect.width * splitView.position;
      if (Math.abs(mouseX - dividerX) <= 8) {
        setIsDraggingSplitDivider(true);
        return;
      }
    }

    // Pan mode: Space held, middle mouse, or Pan tool active
    if (spacePressed || activeTool === "pan" || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: mouseX - pan.x, y: mouseY - pan.y });
      return;
    }

    // Ruler tool: start measuring
    if (activeTool === "ruler") {
      setRulerStart([imgX, imgY]);
      setCurrentMeasurement({
        start: [imgX, imgY],
        end: [imgX, imgY],
        distancePx: 0,
        distanceUm: 0,
        angleDeg: 0,
      });
      return;
    }

    // SAM Point Prompt (Quick Select): click on cell
    if (activeTool === "point" && onSegmentBox) {
      // Localized bounding box around point
      const boxSize = 70;
      const x0 = Math.max(0, imgX - boxSize / 2);
      const y0 = Math.max(0, imgY - boxSize / 2);
      const w = Math.min(imageDims.w - x0, boxSize);
      const h = Math.min(imageDims.h - y0, boxSize);

      // Trigger ripple visual effect
      setPointRipples((prev) => [
        ...prev.slice(-3),
        { x: imgX, y: imgY, time: Date.now() },
      ]);

      onSegmentBox([x0, y0, w, h]);
      return;
    }

    // SAM Box Prompt Tool
    if (activeTool === "box") {
      setBoxStart([imgX, imgY]);
      setCurrentBox([imgX, imgY, 0, 0]);
      return;
    }

    // Polygon Manual Drawing Tool
    if (activeTool === "polygon") {
      if (drawingPoints.length > 0) {
        const [firstX, firstY] = drawingPoints[0];
        const screenFirst = imageToScreen(firstX, firstY);
        const distToFirst = Math.hypot(
          mouseX - screenFirst[0],
          mouseY - screenFirst[1]
        );

        if (distToFirst < 14 && drawingPoints.length >= 3) {
          finishPolygon();
          return;
        }
      }

      setDrawingPoints((prev) => [...prev, [imgX, imgY]]);
      return;
    }

    // Select Tool: check vertex drag on selected annotation
    if (activeTool === "select") {
      if (selectedId) {
        const selectedAnn = annotations.find((a) => a.id === selectedId);
        if (selectedAnn && selectedAnn.polygon) {
          for (let i = 0; i < selectedAnn.polygon.length; i++) {
            const [vx, vy] = selectedAnn.polygon[i];
            const [svx, svy] = imageToScreen(vx, vy);
            if (Math.hypot(mouseX - svx, mouseY - svy) < 8) {
              setDraggingVertexIdx(i);
              return;
            }
          }
        }
      }

      // Check if clicking inside any visible annotation polygon
      let clickedAnnId: string | null = null;
      for (let i = annotations.length - 1; i >= 0; i--) {
        const ann = annotations[i];
        if (!ann.is_visible) continue;
        if (ann.polygon && pointInPolygon([imgX, imgY], ann.polygon)) {
          clickedAnnId = ann.id;
          break;
        }
      }

      onSelectAnnotation(clickedAnnId);
    }
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

    // Live pixel coordinate & intensity inspection readout
    if (imgX >= 0 && imgX < imageDims.w && imgY >= 0 && imgY < imageDims.h) {
      let pixelIntensity: number | null = null;
      if (offscreenCanvasRef.current) {
        const offCtx = offscreenCanvasRef.current.getContext("2d", {
          willReadFrequently: true,
        });
        if (offCtx) {
          try {
            const p = offCtx.getImageData(Math.floor(imgX), Math.floor(imgY), 1, 1).data;
            pixelIntensity = Math.round(0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]);
          } catch {}
        }
      }
      setCursorInfo({
        x: Math.round(imgX),
        y: Math.round(imgY),
        intensity: pixelIntensity,
      });
    } else {
      setCursorInfo(null);
    }

    // Split-view divider drag
    if (isDraggingSplitDivider && splitView.enabled) {
      const pos = Math.max(0.05, Math.min(0.95, mouseX / rect.width));
      onSplitViewChange({ ...splitView, position: pos });
      return;
    }

    // Panning
    if (isPanning) {
      setPan({ x: mouseX - panStart.x, y: mouseY - panStart.y });
      return;
    }

    // Ruler measurement drag
    if (activeTool === "ruler" && rulerStart) {
      const dx = imgX - rulerStart[0];
      const dy = imgY - rulerStart[1];
      const distPx = Math.hypot(dx, dy);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      setCurrentMeasurement({
        start: rulerStart,
        end: [imgX, imgY],
        distancePx: Math.round(distPx * 10) / 10,
        distanceUm: Math.round(distPx * 0.5 * 10) / 10,
        angleDeg: Math.round(angle),
      });
      return;
    }

    // Dragging polygon vertex
    if (draggingVertexIdx !== null && selectedId) {
      const selectedAnn = annotations.find((a) => a.id === selectedId);
      if (selectedAnn && selectedAnn.polygon) {
        const updatedPts: Point[] = selectedAnn.polygon.map((p, idx) =>
          idx === draggingVertexIdx ? [imgX, imgY] : p
        );
        const bbox = computeBoundingBox(updatedPts);
        const area = computePolygonArea(updatedPts);
        onUpdateAnnotation({
          ...selectedAnn,
          polygon: updatedPts,
          bbox,
          area: Math.round(area * 10) / 10,
        });
      }
      return;
    }

    // Dragging SAM Box Prompt
    if (boxStart && activeTool === "box") {
      const x = Math.min(boxStart[0], imgX);
      const y = Math.min(boxStart[1], imgY);
      const w = Math.abs(imgX - boxStart[0]);
      const h = Math.abs(imgY - boxStart[1]);
      setCurrentBox([x, y, w, h]);
      return;
    }

    // Hover state detection for selection tool
    if (activeTool === "select") {
      let foundHoverId: string | null = null;
      let foundVertexIdx: number | null = null;

      if (selectedId) {
        const selectedAnn = annotations.find((a) => a.id === selectedId);
        if (selectedAnn && selectedAnn.polygon) {
          for (let i = 0; i < selectedAnn.polygon.length; i++) {
            const [vx, vy] = selectedAnn.polygon[i];
            const [svx, svy] = imageToScreen(vx, vy);
            if (Math.hypot(mouseX - svx, mouseY - svy) < 8) {
              foundVertexIdx = i;
              break;
            }
          }
        }
      }

      setHoveredVertexIdx(foundVertexIdx);

      if (foundVertexIdx === null) {
        for (let i = annotations.length - 1; i >= 0; i--) {
          const ann = annotations[i];
          if (!ann.is_visible) continue;
          if (ann.polygon && pointInPolygon([imgX, imgY], ann.polygon)) {
            foundHoverId = ann.id;
            break;
          }
        }
      }
      setHoveredId(foundHoverId);
    }
  };

  // Canvas Mouse Up
  const handleMouseUp = () => {
    setIsDraggingSplitDivider(false);
    setIsPanning(false);
    setDraggingVertexIdx(null);

    // Finish Ruler
    if (activeTool === "ruler") {
      setRulerStart(null);
    }

    // Finish SAM Box Prompt
    if (boxStart && currentBox && activeTool === "box") {
      const [, , w, h] = currentBox;
      if (w > 10 && h > 10 && onSegmentBox) {
        onSegmentBox(currentBox);
      }
      setBoxStart(null);
      setCurrentBox(null);
    }
  };

  // 3. Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

    // Dark backdrop
    ctx.fillStyle = "#070b13";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Apply viewport transform
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Render adjusted microscopy image from offscreen cache
    const sourceImage = offscreenCanvasRef.current || imageObjRef.current;
    if (sourceImage && imageLoaded) {
      ctx.imageSmoothingEnabled = zoom < 2.5;
      ctx.drawImage(sourceImage, 0, 0);

      // Fine border around microscopy field
      ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
      ctx.lineWidth = 1 / zoom;
      ctx.strokeRect(0, 0, imageDims.w, imageDims.h);
    }

    // Annotations Rendering with Split-View Clipping
    const renderAnnotations = () => {
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
          ? Math.min(maskOpacity + 0.3, 0.95)
          : isHovered
          ? Math.min(maskOpacity + 0.18, 0.85)
          : maskOpacity;
        ctx.fill();

        // Outline stroke
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = isSelected
          ? "#FFFFFF"
          : isHovered
          ? "#22D3EE"
          : ann.color || "#06B6D4";
        ctx.lineWidth = (isSelected ? 2.8 : isHovered ? 2.2 : 1.6) / zoom;
        ctx.stroke();

        // Bounding Box
        if (showBoundingBoxes && ann.bbox) {
          const [bx, by, bw, bh] = ann.bbox;
          ctx.strokeStyle = isSelected ? "#FFFFFF" : "rgba(148, 163, 184, 0.6)";
          ctx.lineWidth = 1 / zoom;
          ctx.setLineDash([4 / zoom, 4 / zoom]);
          ctx.strokeRect(bx, by, bw, bh);
          ctx.setLineDash([]);
        }

        // Label Tag
        if (showLabels && ann.polygon.length > 0) {
          const [lx, ly] = ann.polygon[0];
          ctx.save();
          ctx.font = `${Math.max(10, 12 / zoom)}px monospace`;
          const text = `${ann.label} (${Math.round(ann.area)} px²)`;
          const metrics = ctx.measureText(text);
          const textPad = 4 / zoom;
          const bgHeight = 16 / zoom;
          const bgWidth = metrics.width + textPad * 2;

          ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
          ctx.fillRect(lx, ly - bgHeight - 2 / zoom, bgWidth, bgHeight);
          ctx.fillStyle = isSelected ? "#22D3EE" : "#F1F5F9";
          ctx.fillText(text, lx + textPad, ly - 5 / zoom);
          ctx.restore();
        }
      });

      // Selected Annotation Vertex Handles
      if (selectedId) {
        const selectedAnn = annotations.find((a) => a.id === selectedId);
        if (selectedAnn && selectedAnn.polygon) {
          selectedAnn.polygon.forEach(([vx, vy], idx) => {
            const isVertexHovered = idx === hoveredVertexIdx;
            const isVertexDragging = idx === draggingVertexIdx;
            const handleRadius =
              (isVertexHovered || isVertexDragging ? 6 : 4.5) / zoom;

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
    };

    if (showAnnotations) {
      if (splitView.enabled) {
        // Split-view mode: masks render ONLY on the right side of the split divider
        ctx.save();
        const splitScreenX = rect.width * splitView.position;
        const [splitImgX] = screenToImage(splitScreenX, 0);

        ctx.beginPath();
        ctx.rect(splitImgX, -10000, 20000, 20000);
        ctx.clip();
        renderAnnotations();
        ctx.restore();
      } else {
        renderAnnotations();
      }
    }

    // In-progress Polygon
    if (drawingPoints.length > 0) {
      ctx.beginPath();
      drawingPoints.forEach(([px, py], idx) => {
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      if (currentMousePos) {
        ctx.lineTo(currentMousePos[0], currentMousePos[1]);
      }
      ctx.strokeStyle = "#22D3EE";
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.stroke();
      ctx.setLineDash([]);

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

    // SAM Box Prompt Preview
    if (currentBox) {
      const [bx, by, bw, bh] = currentBox;
      ctx.strokeStyle = "#10B981";
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
      ctx.fillRect(bx, by, bw, bh);
    }

    // SAM Point Prompt Ripple Feedback
    const now = Date.now();
    pointRipples.forEach((ripple) => {
      const elapsed = now - ripple.time;
      if (elapsed < 1200) {
        const progress = elapsed / 1200;
        const radius = (15 + progress * 35) / zoom;
        const alpha = (1 - progress) * 0.8;

        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
        ctx.lineWidth = 2.5 / zoom;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, 4 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`;
        ctx.fill();
      }
    });

    // Caliper / Ruler Tool Render
    if (currentMeasurement) {
      const { start, end, distancePx, distanceUm, angleDeg } = currentMeasurement;
      const [sx, sy] = start;
      const [ex, ey] = end;

      // Measurement line
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();

      // End-point tick marks
      const tickLen = 6 / zoom;
      const perpAngle = Math.atan2(ey - sy, ex - sx) + Math.PI / 2;
      const dxPerp = Math.cos(perpAngle) * tickLen;
      const dyPerp = Math.sin(perpAngle) * tickLen;

      // Start tick
      ctx.beginPath();
      ctx.moveTo(sx - dxPerp, sy - dyPerp);
      ctx.lineTo(sx + dxPerp, sy + dyPerp);
      ctx.stroke();

      // End tick
      ctx.beginPath();
      ctx.moveTo(ex - dxPerp, ey - dyPerp);
      ctx.lineTo(ex + dxPerp, ey + dyPerp);
      ctx.stroke();

      // Center callout label
      const midX = (sx + ex) / 2;
      const midY = (sy + ey) / 2;
      const calloutText = `${distancePx} px (${distanceUm} µm) • ${angleDeg}°`;
      ctx.save();
      ctx.font = `bold ${Math.max(11, 13 / zoom)}px monospace`;
      const textMetrics = ctx.measureText(calloutText);
      const pad = 6 / zoom;
      const bH = 20 / zoom;
      const bW = textMetrics.width + pad * 2;

      ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 1 / zoom;
      ctx.fillRect(midX - bW / 2, midY - bH - 4 / zoom, bW, bH);
      ctx.strokeRect(midX - bW / 2, midY - bH - 4 / zoom, bW, bH);

      ctx.fillStyle = "#FDE68A";
      ctx.fillText(calloutText, midX - bW / 2 + pad, midY - 9 / zoom);
      ctx.restore();
    }

    ctx.restore(); // Restore pan/zoom viewport transform

    // Split-View Draggable Divider Line (in Screen Space)
    if (splitView.enabled) {
      const dividerScreenX = rect.width * splitView.position;

      // Vertical line
      ctx.strokeStyle = "#22D3EE";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(dividerScreenX, 0);
      ctx.lineTo(dividerScreenX, rect.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draggable center grip
      const midScreenY = rect.height / 2;
      ctx.fillStyle = "#0D131F";
      ctx.strokeStyle = "#22D3EE";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(dividerScreenX, midScreenY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Grip arrows
      ctx.fillStyle = "#22D3EE";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("◂ ▸", dividerScreenX, midScreenY);

      // Side badges
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
      ctx.fillRect(dividerScreenX - 82, 16, 74, 20);
      ctx.fillRect(dividerScreenX + 8, 16, 78, 20);

      ctx.fillStyle = "#94A3B8";
      ctx.fillText("RAW SIGNAL", dividerScreenX - 45, 30);
      ctx.fillStyle = "#22D3EE";
      ctx.fillText("AI SEGMENTED", dividerScreenX + 47, 30);
    }

    ctx.restore(); // Restore retina scale
  }, [
    imageLoaded,
    imageDims,
    pan,
    zoom,
    annotations,
    selectedId,
    hoveredId,
    hoveredVertexIdx,
    draggingVertexIdx,
    drawingPoints,
    currentMousePos,
    currentBox,
    maskOpacity,
    showAnnotations,
    showBoundingBoxes,
    showLabels,
    splitView,
    currentMeasurement,
    pointRipples,
    screenToImage,
    adjustments,
  ]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full w-full bg-[#070b13] overflow-hidden select-none"
    >
      {/* Main Interactive Canvas */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`w-full h-full block ${
          isDraggingSplitDivider
            ? "cursor-ew-resize"
            : isPanning
            ? "cursor-grabbing"
            : spacePressed || activeTool === "pan"
            ? "cursor-grab"
            : activeTool === "point"
            ? "cursor-cell"
            : activeTool === "ruler"
            ? "cursor-crosshair"
            : activeTool === "polygon" || activeTool === "box"
            ? "cursor-crosshair"
            : "cursor-default"
        }`}
      />

      {/* Floating HUD: Live Cursor Pixel Coordinate & Intensity Readout */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d131f]/90 border border-slate-800 text-[11px] font-mono text-slate-400 backdrop-blur-md shadow-lg pointer-events-none">
        <Activity className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
        {cursorInfo ? (
          <div className="flex items-center gap-3">
            <span>
              X: <b className="text-white">{cursorInfo.x}</b> Y:{" "}
              <b className="text-white">{cursorInfo.y}</b>
            </span>
            {cursorInfo.intensity !== null && (
              <span className="text-slate-500 border-l border-slate-800 pl-3">
                Intensity: <b className="text-cyan-400">{cursorInfo.intensity}</b>
              </span>
            )}
            <span className="text-slate-500 border-l border-slate-800 pl-3">
              {Math.round(zoom * 100)}%
            </span>
          </div>
        ) : (
          <span>{imageDims.w ? `${imageDims.w} × ${imageDims.h} px • ${Math.round(zoom * 100)}%` : "Ready"}</span>
        )}
      </div>

      {/* Floating Canvas Quick Controls (Zoom In/Out, Fit, Reset) */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-1 p-1 rounded-lg bg-[#0d131f]/90 border border-slate-800 backdrop-blur-md shadow-lg">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.25, 25.0))}
          title="Zoom In"
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z * 0.8, 0.1))}
          title="Zoom Out"
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="h-4 w-[1px] bg-slate-800 mx-0.5" />
        <button
          onClick={fitToScreen}
          title="Fit to Screen"
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={resetZoom}
          title="Reset Zoom (100%)"
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition text-[11px] font-mono px-2"
        >
          1:1
        </button>
      </div>

      {/* Interactive Minimap / Navigator */}
      <Minimap
        imageSrc={imageUrl}
        imageDims={imageDims}
        containerDims={containerDims}
        pan={pan}
        zoom={zoom}
        annotations={annotations}
        onNavigate={(newPan) => setPan(newPan)}
        isOpen={isMinimapOpen}
        onToggle={() => setIsMinimapOpen(!isMinimapOpen)}
      />
    </div>
  );
};
