"use client";

import React from "react";
import { ToolType, ImageItem } from "@/lib/types";
import {
  MousePointer,
  Hand,
  PenTool,
  Scan,
  Crosshair,
  Ruler,
  RotateCcw,
  RotateCw,
  Trash2,
  Save,
  Download,
  CheckCircle2,
  Loader2,
  FileImage,
  SplitSquareVertical,
  Sliders,
  HelpCircle,
} from "lucide-react";
import { StudioSwitcher } from "./StudioSwitcher";

interface TopToolbarProps {
  currentImage: ImageItem | null;
  annotationCount: number;
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hasSelected: boolean;
  onDeleteSelected: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  onSave: () => void;
  onOpenExport: () => void;
  processingStatus: string;
  isProcessing: boolean;
  splitViewEnabled: boolean;
  onToggleSplitView: () => void;
  isAdjustmentsOpen: boolean;
  onToggleAdjustments: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  currentImage,
  annotationCount,
  activeTool,
  setActiveTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasSelected,
  onDeleteSelected,
  isSaving,
  hasUnsavedChanges,
  onSave,
  onOpenExport,
  processingStatus,
  isProcessing,
  splitViewEnabled,
  onToggleSplitView,
  isAdjustmentsOpen,
  onToggleAdjustments,
}) => {
  return (
    <header className="h-12 border-b border-zinc-800 bg-zinc-950 px-3.5 flex items-center justify-between select-none z-30 shrink-0">
      {/* Left: Studio Switcher & Image File Spec */}
      <div className="flex items-center gap-3 min-w-0">
        <StudioSwitcher currentStudio="biolabel" />

        <div className="h-4 w-[1px] bg-zinc-800 hidden sm:block" />

        <div className="flex items-center gap-2 text-zinc-300 font-medium text-xs truncate">
          <FileImage className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="truncate max-w-[150px] md:max-w-[220px]">
            {currentImage ? currentImage.filename : "No image selected"}
          </span>
          {currentImage && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 font-mono border border-zinc-800 uppercase">
              {currentImage.file_format}
            </span>
          )}
        </div>

        {currentImage && (
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-zinc-500 border-l border-zinc-800 pl-3">
            <span>
              {currentImage.width}×{currentImage.height} px
            </span>
            <span>•</span>
            <span className="text-zinc-400">
              {annotationCount} {annotationCount === 1 ? "object" : "objects"}
            </span>
          </div>
        )}
      </div>

      {/* Center: CVAT Annotation Tools Strip */}
      <div className="flex items-center gap-0.5 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800">
        {/* Select (V) */}
        <button
          onClick={() => setActiveTool("select")}
          title="Select / Edit Vertices (V)"
          className={`px-2 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium transition ${
            activeTool === "select"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent"
          }`}
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Select</span>
          <kbd className="hidden xl:inline text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-950 text-zinc-500 border border-zinc-800">V</kbd>
        </button>

        {/* SAM Point Prompt (W) */}
        <button
          onClick={() => setActiveTool("point")}
          title="Interactive SAM Point: Click to segment cell (W)"
          className={`px-2 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium transition ${
            activeTool === "point"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent"
          }`}
        >
          <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden xl:inline">SAM Point</span>
          <kbd className="hidden xl:inline text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-950 text-zinc-500 border border-zinc-800">W</kbd>
        </button>

        {/* SAM Box Prompt (B) */}
        <button
          onClick={() => setActiveTool("box")}
          title="Interactive SAM Box: Drag box around object (B)"
          className={`px-2 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium transition ${
            activeTool === "box"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent"
          }`}
        >
          <Scan className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden xl:inline">SAM Box</span>
          <kbd className="hidden xl:inline text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-950 text-zinc-500 border border-zinc-800">B</kbd>
        </button>

        {/* Manual Polygon (P) */}
        <button
          onClick={() => setActiveTool("polygon")}
          title="Manual Polygon (P)"
          className={`px-2 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium transition ${
            activeTool === "polygon"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent"
          }`}
        >
          <PenTool className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Polygon</span>
          <kbd className="hidden xl:inline text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-950 text-zinc-500 border border-zinc-800">P</kbd>
        </button>

        {/* Caliper / Ruler (R) */}
        <button
          onClick={() => setActiveTool("ruler")}
          title="Microscopy Caliper / Measurement (R)"
          className={`px-2 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium transition ${
            activeTool === "ruler"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent"
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Ruler</span>
          <kbd className="hidden xl:inline text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-950 text-zinc-500 border border-zinc-800">R</kbd>
        </button>

        {/* Pan (H / Space) */}
        <button
          onClick={() => setActiveTool("pan")}
          title="Pan Viewport (H / Space)"
          className={`px-2 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium transition ${
            activeTool === "pan"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent"
          }`}
        >
          <Hand className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Pan</span>
          <kbd className="hidden xl:inline text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-950 text-zinc-500 border border-zinc-800">H</kbd>
        </button>

        <div className="h-3.5 w-[1px] bg-zinc-800 mx-0.5" />

        {/* Split View Compare */}
        <button
          onClick={onToggleSplitView}
          title="Split View Compare (C)"
          className={`p-1.5 rounded transition ${
            splitViewEnabled
              ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent"
          }`}
        >
          <SplitSquareVertical className="w-3.5 h-3.5" />
        </button>

        {/* Adjustments & LUT HUD Toggle */}
        <button
          onClick={onToggleAdjustments}
          title="Image Adjustments & Fluorescence LUTs"
          className={`p-1.5 rounded transition ${
            isAdjustmentsOpen
              ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        <div className="h-3.5 w-[1px] bg-zinc-800 mx-0.5" />

        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (⌘Z)"
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 disabled:opacity-30 disabled:hover:bg-transparent transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (⌘⇧Z)"
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 disabled:opacity-30 disabled:hover:bg-transparent transition"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        {/* Delete */}
        <button
          onClick={onDeleteSelected}
          disabled={!hasSelected}
          title="Delete Object (Del / Backspace)"
          className="p-1.5 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: Status, Save & Export Dataset */}
      <div className="flex items-center gap-2.5">
        {/* Status indicator */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs font-mono">
          {isProcessing ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 animate-pulse text-[11px]">
              <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
              {processingStatus}
            </span>
          ) : hasUnsavedChanges ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Unsaved
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 text-[11px]">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Saved
            </span>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={onSave}
          disabled={isSaving || !currentImage}
          title="Save Annotations (⌘S)"
          className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 flex items-center gap-1.5 transition disabled:opacity-40"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5 text-zinc-400" />
          )}
          <span className="hidden sm:inline">Save</span>
        </button>

        {/* Export Dataset Button (CVAT Solid Pro CTA) */}
        <button
          onClick={onOpenExport}
          disabled={!currentImage}
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.98] shadow-sm flex items-center gap-1.5 transition disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Dataset</span>
        </button>
      </div>
    </header>
  );
};
