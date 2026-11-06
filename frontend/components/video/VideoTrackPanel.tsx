"use client";

import React, { useState } from "react";
import { VideoTrack, VideoFrameAnnotation, SurgicalCategory } from "@/lib/videoTypes";
import { SCIENTIFIC_PALETTE } from "@/lib/geometry";
import {
  Sparkles,
  Zap,
  Trash2,
  Edit2,
  Check,
  Clock,
  Loader2,
  Crosshair,
  Scan,
  MousePointer,
  Layers,
  Activity,
  Plus,
} from "lucide-react";

interface VideoTrackPanelProps {
  tracks: VideoTrack[];
  annotations: VideoFrameAnnotation[];
  selectedTrackId: number | null;
  onSelectTrack: (trackId: number | null) => void;
  onUpdateTrack: (updated: VideoTrack) => void;
  onDeleteTrack: (trackId: number) => void;
  onAutoTrack: () => Promise<void>;
  isTracking: boolean;
  activeTool: "select" | "point" | "box";
  setActiveTool: (tool: "select" | "point" | "box") => void;
  lastTelemetry: {
    model: string;
    inference_time_ms: number;
    fps_speed: number;
    tracked_frames_count: number;
  } | null;
}

const CATEGORY_ICONS: Record<SurgicalCategory, string> = {
  instrument: "🛠️",
  tissue: "🫀",
  organ: "🫁",
  lesion: "🎯",
};

export const VideoTrackPanel: React.FC<VideoTrackPanelProps> = ({
  tracks,
  annotations,
  selectedTrackId,
  onSelectTrack,
  onUpdateTrack,
  onDeleteTrack,
  onAutoTrack,
  isTracking,
  activeTool,
  setActiveTool,
  lastTelemetry,
}) => {
  const [editingTrackId, setEditingTrackId] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState<string>("");

  const selectedTrack = tracks.find((t) => t.track_id === selectedTrackId);
  const selectedTrackAnns = selectedTrackId
    ? annotations.filter((a) => a.track_id === selectedTrackId)
    : [];

  const handleStartRename = (track: VideoTrack) => {
    setEditingTrackId(track.track_id);
    setEditingLabel(track.label);
  };

  const handleSaveRename = (track: VideoTrack) => {
    if (editingLabel.trim()) {
      onUpdateTrack({ ...track, label: editingLabel.trim() });
    }
    setEditingTrackId(null);
  };

  return (
    <aside className="w-80 bg-[#0d131f] border-l border-[#1e293b] flex flex-col h-full select-none shrink-0 z-20">
      {/* 1. SAM 2 Tiny Hero Tracking Controls */}
      <div className="p-3.5 border-b border-[#1e293b] bg-[#121927]/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            <Zap className="w-3.5 h-3.5 text-brand-cyan" />
            <span>AI Tracking Model</span>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 bg-brand-cyan/10 px-1.5 py-0.5 rounded border border-brand-cyan/20">
            SAM 2 Tiny (CPU Ready)
          </span>
        </div>

        {/* Big Auto-Track Button */}
        <button
          onClick={onAutoTrack}
          disabled={isTracking}
          className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-brand-cyan via-teal-400 to-brand-violet hover:brightness-110 active:scale-98 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
        >
          {isTracking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Tracking Video Objects...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
              <span>Auto-Track with SAM 2 Tiny</span>
            </>
          )}
        </button>

        {/* Telemetry readout */}
        {lastTelemetry && (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#070b13] border border-cyan-500/25 text-[11px] font-mono text-slate-300">
            <span className="flex items-center gap-1 text-cyan-400 font-semibold">
              <Clock className="w-3 h-3" />
              {lastTelemetry.inference_time_ms} ms
            </span>
            <span className="text-emerald-400 font-bold">
              {lastTelemetry.fps_speed} FPS
            </span>
            <span className="text-white">
              {lastTelemetry.tracked_frames_count} frames
            </span>
          </div>
        )}
      </div>

      {/* 2. Interactive Prompt Tool Switcher (Point Prompt vs Box Prompt) */}
      <div className="p-3 border-b border-[#1e293b] space-y-2">
        <div className="text-[10.5px] uppercase font-semibold text-slate-400 tracking-wider">
          SAM 2 Prompt Mode
        </div>

        <div className="grid grid-cols-3 gap-1 text-xs">
          <button
            onClick={() => setActiveTool("point")}
            className={`py-1.5 px-2 rounded-lg border text-center transition flex items-center justify-center gap-1.5 font-medium ${
              activeTool === "point"
                ? "bg-brand-cyan text-slate-950 border-brand-cyan font-bold shadow-sm"
                : "bg-[#070b13] border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Point</span>
          </button>

          <button
            onClick={() => setActiveTool("box")}
            className={`py-1.5 px-2 rounded-lg border text-center transition flex items-center justify-center gap-1.5 font-medium ${
              activeTool === "box"
                ? "bg-brand-cyan text-slate-950 border-brand-cyan font-bold shadow-sm"
                : "bg-[#070b13] border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            <span>Box</span>
          </button>

          <button
            onClick={() => setActiveTool("select")}
            className={`py-1.5 px-2 rounded-lg border text-center transition flex items-center justify-center gap-1.5 font-medium ${
              activeTool === "select"
                ? "bg-brand-cyan text-slate-950 border-brand-cyan font-bold shadow-sm"
                : "bg-[#070b13] border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Select</span>
          </button>
        </div>
      </div>

      {/* 3. Selected Track Detail & Taxonomy Inspector */}
      {selectedTrack && (
        <div className="p-3 border-b border-[#1e293b] bg-[#162032]/70 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] uppercase font-bold text-cyan-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              Track #{selectedTrack.track_id} Inspector
            </span>
            <button
              onClick={() => onSelectTrack(null)}
              className="text-[10px] text-slate-400 hover:text-white"
            >
              Deselect
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="bg-[#070b13] p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 block text-[9.5px]">FRAMES</span>
              <span className="text-white font-bold">{selectedTrackAnns.length} active</span>
            </div>
            <div className="bg-[#070b13] p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 block text-[9.5px]">CATEGORY</span>
              <span className="text-cyan-300 font-bold capitalize">
                {selectedTrack.category}
              </span>
            </div>
          </div>

          {/* Color Palette Swatches */}
          <div className="pt-1 flex items-center justify-between">
            <span className="text-[10.5px] text-slate-400">Track Color</span>
            <div className="flex items-center gap-1">
              {SCIENTIFIC_PALETTE.slice(0, 6).map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdateTrack({ ...selectedTrack, color: c })}
                  className={`w-3.5 h-3.5 rounded-full transition-transform ${
                    selectedTrack.color === c ? "scale-125 ring-2 ring-white" : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Active Tracks List */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-2.5 border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-brand-cyan" />
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-300">
              Tracks ({tracks.length})
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {annotations.length} total masks
          </span>
        </div>

        {/* Tracks Scrollable List */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {tracks.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No tracks created yet. Click on the video with Point Prompt or click Auto-Track above.
            </div>
          ) : (
            tracks.map((track) => {
              const isSelected = track.track_id === selectedTrackId;
              const isEditing = editingTrackId === track.track_id;
              const trackMaskCount = annotations.filter((a) => a.track_id === track.track_id).length;

              return (
                <div
                  key={track.track_id}
                  onClick={() => onSelectTrack(track.track_id)}
                  className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition border text-xs ${
                    isSelected
                      ? "bg-[#162032] border-brand-cyan text-white shadow-sm"
                      : "bg-[#070b13]/60 border-transparent hover:bg-[#121927] hover:border-slate-800 text-slate-300"
                  }`}
                >
                  {/* Category icon & Color indicator */}
                  <span className="text-sm shrink-0">{CATEGORY_ICONS[track.category] || "🛠️"}</span>
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: track.color }}
                  />

                  {/* Track Label */}
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRename(track);
                            if (e.key === "Escape") setEditingTrackId(null);
                          }}
                          autoFocus
                          className="w-full bg-slate-900 border border-brand-cyan rounded px-1 py-0.5 text-xs text-white focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveRename(track)}
                          className="p-0.5 text-brand-cyan hover:text-white"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold truncate text-[11.5px]">{track.label}</span>
                        <span className="font-mono text-[10px] text-slate-500 shrink-0 ml-1">
                          {trackMaskCount}f
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
                          handleStartRename(track);
                        }}
                        title="Rename Track"
                        className="p-1 text-slate-500 hover:text-slate-300 rounded"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete track '${track.label}'?`)) {
                            onDeleteTrack(track.track_id);
                          }
                        }}
                        title="Delete Track"
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
