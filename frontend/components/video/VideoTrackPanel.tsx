"use client";

import React, { useState } from "react";
import { VideoTrack, VideoFrameAnnotation, SurgicalCategory } from "@/lib/videoTypes";
import {
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
  Eye,
  EyeOff,
  Tag,
  Sliders,
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

const CATEGORY_COLORS: Record<SurgicalCategory, string> = {
  instrument: "text-cyan-400 bg-cyan-950/60 border-cyan-800/60",
  tissue: "text-purple-400 bg-purple-950/60 border-purple-800/60",
  organ: "text-emerald-400 bg-emerald-950/60 border-emerald-800/60",
  lesion: "text-amber-400 bg-amber-950/60 border-amber-800/60",
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
  const [activeTab, setActiveTab] = useState<"objects" | "labels">("objects");
  const [editingTrackId, setEditingTrackId] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

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

  const filteredTracks = tracks.filter((t) =>
    t.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-80 bg-zinc-950 border-l border-zinc-800 flex flex-col h-full select-none shrink-0 z-20">
      {/* 1. CVAT Navigation Tabs: Objects vs Labels */}
      <div className="flex border-b border-zinc-800 bg-zinc-950 text-xs font-medium">
        <button
          onClick={() => setActiveTab("objects")}
          className={`flex-1 py-2.5 text-center transition border-b-2 ${
            activeTab === "objects"
              ? "border-zinc-100 text-zinc-100 font-semibold bg-zinc-900/50"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Objects ({tracks.length})
        </button>
        <button
          onClick={() => setActiveTab("labels")}
          className={`flex-1 py-2.5 text-center transition border-b-2 ${
            activeTab === "labels"
              ? "border-zinc-100 text-zinc-100 font-semibold bg-zinc-900/50"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Taxonomy Labels
        </button>
      </div>

      {/* 2. SAM 2 Tiny Model Action Strip */}
      <div className="p-3 border-b border-zinc-800 bg-zinc-900/30 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            AI Video Tracking
          </span>
          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
            SAM 2 Tiny
          </span>
        </div>

        {/* Clean, High-Contrast Solid CTA (CVAT Pro Style) */}
        <button
          onClick={onAutoTrack}
          disabled={isTracking}
          className="w-full py-2 px-3 rounded-md bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.99] font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
        >
          {isTracking ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" />
              <span>Propagating Video Masks...</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              <span>Auto-Track with SAM 2 Tiny</span>
            </>
          )}
        </button>

        {/* Telemetry readout */}
        {lastTelemetry && (
          <div className="flex items-center justify-between px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10.5px] font-mono text-zinc-400">
            <span className="flex items-center gap-1 text-zinc-300">
              <Clock className="w-3 h-3 text-zinc-500" />
              {lastTelemetry.inference_time_ms} ms
            </span>
            <span className="text-zinc-300 font-semibold">
              {lastTelemetry.tracked_frames_count} masks ({lastTelemetry.fps_speed} FPS)
            </span>
          </div>
        )}
      </div>

      {activeTab === "objects" ? (
        <>
          {/* Search bar */}
          <div className="p-2.5 border-b border-zinc-800 bg-zinc-950">
            <input
              type="text"
              placeholder="Filter tracks by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
            />
          </div>

          {/* 3. Track List (CVAT Objects List) */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredTracks.map((track) => {
              const isSelected = selectedTrackId === track.track_id;
              const trackFrameCount = annotations.filter((a) => a.track_id === track.track_id).length;

              return (
                <div
                  key={track.track_id}
                  onClick={() => onSelectTrack(track.track_id)}
                  className={`rounded-md p-2 transition cursor-pointer border text-xs ${
                    isSelected
                      ? "bg-zinc-900 border-zinc-700 shadow-sm"
                      : "bg-zinc-950 border-zinc-800/80 hover:bg-zinc-900/60 hover:border-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Left: Swatch & Label */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-zinc-700"
                        style={{ backgroundColor: track.color }}
                      />

                      {editingTrackId === track.track_id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="text"
                            value={editingLabel}
                            onChange={(e) => setEditingLabel(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSaveRename(track)}
                            autoFocus
                            className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-white w-full"
                          />
                          <button
                            onClick={() => handleSaveRename(track)}
                            className="p-1 text-zinc-300 hover:text-white"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-zinc-200 truncate">
                              #{track.track_id} {track.label}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: Category badge & Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[9.5px] uppercase font-mono px-1.5 py-0.2 rounded border ${
                          CATEGORY_COLORS[track.category] || "text-zinc-400 bg-zinc-900 border-zinc-800"
                        }`}
                      >
                        {track.category}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(track);
                        }}
                        title="Rename Track"
                        className="p-1 text-zinc-500 hover:text-zinc-300 rounded transition"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete track #${track.track_id} (${track.label}) across all frames?`)) {
                            onDeleteTrack(track.track_id);
                          }
                        }}
                        title="Delete Track"
                        className="p-1 text-zinc-500 hover:text-rose-400 rounded transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Track Subtitle: Frames presence */}
                  <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>
                      Tracked across <b>{trackFrameCount}</b> frames
                    </span>
                    <span className="text-zinc-400">Track mode</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4. CVAT Selected Track Inspector */}
          {selectedTrack && (
            <div className="p-3 border-t border-zinc-800 bg-zinc-900/40 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <span>Track Inspector</span>
                <span className="text-zinc-500 font-mono">#{selectedTrack.track_id}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400">
                <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                  <div className="text-[10px] text-zinc-500">CATEGORY</div>
                  <div className="text-zinc-200 capitalize mt-0.5">{selectedTrack.category}</div>
                </div>
                <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                  <div className="text-[10px] text-zinc-500">MASKS</div>
                  <div className="text-zinc-200 mt-0.5">{selectedTrackAnns.length} frames</div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Taxonomy Labels Tab */
        <div className="flex-1 p-3 space-y-3 overflow-y-auto text-xs text-zinc-400">
          <p className="text-[11px] text-zinc-500">
            Configured medical taxonomy labels for automatic surgical tool and tissue segmentation:
          </p>

          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#06B6D4]" />
                <span className="text-zinc-200">Laparoscopic Grasper</span>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase">Instrument</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                <span className="text-zinc-200">Electrocautery Hook</span>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase">Instrument</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                <span className="text-zinc-200">Gallbladder Fundus</span>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase">Organ</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
                <span className="text-zinc-200">Liver Parenchyma</span>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase">Tissue</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
