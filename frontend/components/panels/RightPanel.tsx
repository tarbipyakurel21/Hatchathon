"use client";

import React, { useState } from "react";
import { Annotation, ModelInfo, SegmentationResult } from "@/lib/types";
import {
  Sparkles,
  Eye,
  EyeOff,
  Trash2,
  Edit2,
  Clock,
  Loader2,
  Search,
  Check,
  Zap,
  SlidersHorizontal,
} from "lucide-react";

interface RightPanelProps {
  models: ModelInfo[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  onAutoAnnotate: () => Promise<void>;
  onClearAll?: () => void;
  isAnnotating: boolean;
  lastResult: SegmentationResult | null;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onUpdateAnnotation: (ann: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
  maskOpacity: number;
  setMaskOpacity: (val: number) => void;
  showAnnotations: boolean;
  setShowAnnotations: (val: boolean) => void;
  showBoundingBoxes: boolean;
  setShowBoundingBoxes: (val: boolean) => void;
  showLabels: boolean;
  setShowLabels: (val: boolean) => void;
  sensitivity: number;
  setSensitivity: (val: number) => void;
  minArea: number;
  setMinArea: (val: number) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  onAutoAnnotate,
  onClearAll,
  isAnnotating,
  lastResult,
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  maskOpacity,
  setMaskOpacity,
  showAnnotations,
  setShowAnnotations,
  showBoundingBoxes,
  setShowBoundingBoxes,
  showLabels,
  setShowLabels,
  sensitivity,
  setSensitivity,
  minArea,
  setMinArea,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredAnnotations = annotations.filter((a) =>
    a.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalArea = annotations.reduce((acc, a) => acc + (a.area || 0), 0);
  const meanArea = annotations.length > 0 ? Math.round(totalArea / annotations.length) : 0;

  const handleStartRename = (ann: Annotation) => {
    setEditingId(ann.id);
    setEditingLabel(ann.label);
  };

  const handleSaveRename = (ann: Annotation) => {
    if (editingLabel.trim()) {
      onUpdateAnnotation({ ...ann, label: editingLabel.trim() });
    }
    setEditingId(null);
  };

  const handleToggleVisibility = (ann: Annotation, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateAnnotation({ ...ann, is_visible: !ann.is_visible });
  };

  return (
    <aside className="w-72 bg-[#0d131f] border-l border-[#1e293b] flex flex-col h-full select-none shrink-0 z-20">
      {/* 1. SAM / ComfyUI AI Segmentation Control */}
      <div className="p-3.5 border-b border-[#1e293b] bg-[#121927]/60 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            <Zap className="w-3.5 h-3.5 text-brand-cyan" />
            <span>AI Model</span>
          </div>
          <span className="text-[10px] font-mono text-cyan-400">
            {models.find((m) => m.id === selectedModelId)?.speed_rating.split(" ")[0] || "Fast"}
          </span>
        </div>

        {/* Model Selector */}
        <select
          value={selectedModelId}
          onChange={(e) => onSelectModel(e.target.value)}
          className="w-full bg-[#070b13] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-cyan transition"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name.split("(")[0]}
            </option>
          ))}
        </select>

        {/* Big SAM "Auto-Annotate All" Hero Button */}
        <button
          onClick={onAutoAnnotate}
          disabled={isAnnotating}
          className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-brand-cyan via-teal-400 to-brand-violet hover:brightness-110 active:scale-98 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-cyan/20 transition disabled:opacity-50"
        >
          {isAnnotating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Segmenting...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
              <span>Auto-Annotate All</span>
            </>
          )}
        </button>

        {/* Latency & Object Telemetry Chip */}
        {lastResult && (
          <div className="flex items-center justify-between px-2.5 py-1 rounded bg-[#070b13] border border-brand-cyan/25 text-[10.5px] font-mono text-slate-300">
            <span className="flex items-center gap-1 text-cyan-400 font-semibold">
              <Clock className="w-3 h-3" />
              {lastResult.inference_time_ms} ms
            </span>
            <span className="text-white font-bold">{lastResult.detected_count} cells</span>
          </div>
        )}
      </div>

      {/* 2. Visual Sliders & Display Controls */}
      <div className="p-3 border-b border-[#1e293b] space-y-2">
        <div className="flex items-center justify-between text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-brand-violet" />
            Controls
          </span>
        </div>

        {/* Mask Opacity Slider */}
        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
            <span>Opacity</span>
            <span className="font-mono text-cyan-400">{Math.round(maskOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={maskOpacity}
            onChange={(e) => setMaskOpacity(parseFloat(e.target.value))}
            className="w-full accent-brand-cyan h-1 bg-slate-800 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Sensitivity Slider */}
        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
            <span>Sensitivity</span>
            <span className="font-mono text-cyan-400">{Math.round(sensitivity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="0.8"
            step="0.05"
            value={sensitivity}
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            className="w-full accent-brand-cyan h-1 bg-slate-800 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Toggles (ComfyUI / SAM style pill switches) */}
        <div className="grid grid-cols-3 gap-1 pt-1 text-[10px]">
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className={`py-1 px-1.5 rounded border text-center transition ${
              showAnnotations
                ? "bg-brand-cyan/15 border-brand-cyan text-cyan-300 font-semibold"
                : "bg-[#070b13] border-slate-800 text-slate-500"
            }`}
          >
            Masks
          </button>
          <button
            onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
            className={`py-1 px-1.5 rounded border text-center transition ${
              showBoundingBoxes
                ? "bg-brand-cyan/15 border-brand-cyan text-cyan-300 font-semibold"
                : "bg-[#070b13] border-slate-800 text-slate-500"
            }`}
          >
            Boxes
          </button>
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`py-1 px-1.5 rounded border text-center transition ${
              showLabels
                ? "bg-brand-cyan/15 border-brand-cyan text-cyan-300 font-semibold"
                : "bg-[#070b13] border-slate-800 text-slate-500"
            }`}
          >
            Labels
          </button>
        </div>
      </div>

      {/* 3. Detected Objects / Cut-Outs List */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-2.5 border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-300">
              Objects ({annotations.length})
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {meanArea > 0 ? `~${meanArea}px²` : ""}
            </span>
          </div>

          {annotations.length > 0 && onClearAll && (
            <button
              onClick={() => {
                if (confirm("Clear all annotations on this image?")) {
                  onClearAll();
                }
              }}
              title="Clear all objects (SAM style)"
              className="text-[10.5px] text-rose-400 hover:text-rose-300 hover:underline transition"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Search */}
        <div className="p-2 border-b border-[#1e293b]/60">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#070b13] border border-[#1e293b] rounded pl-7 pr-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-cyan"
            />
          </div>
        </div>

        {/* Scrollable Object Items */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {filteredAnnotations.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-600">
              No objects detected
            </div>
          ) : (
            filteredAnnotations.map((ann) => {
              const isSelected = ann.id === selectedAnnotationId;
              const isEditing = editingId === ann.id;

              return (
                <div
                  key={ann.id}
                  onClick={() => onSelectAnnotation(ann.id)}
                  className={`group flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition border text-xs ${
                    isSelected
                      ? "bg-[#162032] border-brand-cyan text-white shadow-sm"
                      : "bg-[#070b13]/60 border-transparent hover:bg-[#121927] hover:border-slate-800 text-slate-300"
                  }`}
                >
                  {/* Color Indicator */}
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-700 shadow-sm"
                    style={{ backgroundColor: ann.color || "#06B6D4" }}
                  />

                  {/* Label */}
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRename(ann);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                          className="w-full bg-slate-900 border border-brand-cyan rounded px-1 py-0.5 text-xs text-white focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveRename(ann)}
                          className="p-0.5 text-brand-cyan hover:text-white"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate text-[11.5px]">{ann.label}</span>
                        <span className="font-mono text-[10px] text-slate-500 shrink-0 ml-1">
                          {Math.round(ann.area)} px²
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!isEditing && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(ann);
                        }}
                        title="Rename"
                        className="p-1 text-slate-500 hover:text-slate-300 rounded"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      <button
                        onClick={(e) => handleToggleVisibility(ann, e)}
                        title={ann.is_visible ? "Hide" : "Show"}
                        className={`p-1 rounded ${
                          ann.is_visible ? "text-slate-500 hover:text-slate-300" : "text-amber-400"
                        }`}
                      >
                        {ann.is_visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAnnotation(ann.id);
                        }}
                        title="Delete"
                        className="p-1 text-slate-500 hover:text-rose-400 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
};
