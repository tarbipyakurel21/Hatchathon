"use client";

import React from "react";
import { ToolType, ImageItem } from "@/lib/types";
import {
  MousePointer,
  Hand,
  PenTool,
  RotateCcw,
  RotateCw,
  Trash2,
  Save,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileImage,
} from "lucide-react";

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
}) => {
  return (
    <header className="h-14 border-b border-[#1e293b] bg-[#0d131f]/95 backdrop-blur-md px-4 flex items-center justify-between select-none z-10">
      {/* Left: Image Info & Dimensions */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 text-slate-200 font-medium text-sm truncate">
          <FileImage className="w-4 h-4 text-brand-cyan shrink-0" />
          <span className="truncate max-w-[200px] md:max-w-[320px]">
            {currentImage ? currentImage.filename : "No image selected"}
          </span>
          {currentImage && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700/60 uppercase">
              {currentImage.file_format}
            </span>
          )}
        </div>

        {currentImage && (
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 border-l border-[#1e293b] pl-3">
            <span>
              {currentImage.width} × {currentImage.height} px
            </span>
            <span className="text-slate-600">•</span>
            <span className="px-1.5 py-0.5 rounded-full bg-brand-cyan/10 text-cyan-400 border border-brand-cyan/20">
              {annotationCount} {annotationCount === 1 ? "cell" : "cells"}
            </span>
          </div>
        )}
      </div>

      {/* Center: Tool Selection & History */}
      <div className="flex items-center gap-1 bg-[#121927] p-1 rounded-lg border border-[#1e293b]">
        <button
          onClick={() => setActiveTool("select")}
          title="Select Annotation (V)"
          className={`px-2.5 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium transition ${
            activeTool === "select"
              ? "bg-brand-cyan text-slate-950 font-semibold shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Select</span>
        </button>

        <button
          onClick={() => setActiveTool("pan")}
          title="Pan Canvas (H / Space+Drag)"
          className={`px-2.5 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium transition ${
            activeTool === "pan"
              ? "bg-brand-cyan text-slate-950 font-semibold shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <Hand className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Pan</span>
        </button>

        <button
          onClick={() => setActiveTool("polygon")}
          title="Draw Manual Polygon (P)"
          className={`px-2.5 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium transition ${
            activeTool === "polygon"
              ? "bg-brand-cyan text-slate-950 font-semibold shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <PenTool className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Polygon</span>
        </button>

        <div className="h-4 w-[1px] bg-[#1e293b] mx-1" />

        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 disabled:opacity-30 disabled:hover:bg-transparent transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 disabled:opacity-30 disabled:hover:bg-transparent transition"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        {/* Delete */}
        <button
          onClick={onDeleteSelected}
          disabled={!hasSelected}
          title="Delete Selected (Backspace/Del)"
          className="p-1.5 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: Status, Save & Export */}
      <div className="flex items-center gap-3">
        {/* Real-time Status Badge */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs">
          {isProcessing ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-cyan/15 text-cyan-300 border border-brand-cyan/30 animate-pulse font-mono">
              <Loader2 className="w-3 h-3 animate-spin" />
              {processingStatus}
            </span>
          ) : hasUnsavedChanges ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              Unsaved changes
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              <CheckCircle2 className="w-3 h-3" />
              Saved
            </span>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={onSave}
          disabled={isSaving || !currentImage}
          title="Save annotations to database"
          className="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition disabled:opacity-40"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5 text-brand-cyan" />
          )}
          <span className="hidden sm:inline">Save</span>
        </button>

        {/* Export Dataset button */}
        <button
          onClick={onOpenExport}
          disabled={!currentImage}
          className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-gradient-to-r from-brand-cyan to-brand-violet text-slate-950 hover:brightness-110 shadow-lg shadow-brand-cyan/20 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
