"use client";

import React, { useState } from "react";
import { VideoItem } from "@/lib/videoTypes";
import { exportVideoDataset, getVideoExportDownloadUrl } from "@/lib/videoApi";
import {
  Download,
  X,
  FileArchive,
  FolderTree,
  Loader2,
  Film,
  Layers,
  Sparkles,
} from "lucide-react";

interface VideoExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoItem | null;
  trackCount: number;
  maskCount: number;
}

export const VideoExportModal: React.FC<VideoExportModalProps> = ({
  isOpen,
  onClose,
  video,
  trackCount,
  maskCount,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !video) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const res = await exportVideoDataset(video.id);
      setDownloadUrl(res.download_url);

      // Trigger automatic browser download
      const link = document.createElement("a");
      link.href = getVideoExportDownloadUrl(res.filename);
      link.setAttribute("download", res.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setError(err.message || "Failed to package video dataset");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-zinc-800 border border-zinc-700/60 flex items-center justify-center">
              <FileArchive className="w-4 h-4 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-zinc-100 uppercase tracking-wide">Export Video Dataset</h2>
              <p className="text-[11px] text-zinc-400">
                Standardized Video-COCO, MOTS & Tracking Format (CVAT Compatible)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5 text-xs text-zinc-300">
          {/* Summary card */}
          <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 flex items-center justify-between">
            <div>
              <p className="font-medium text-zinc-100">{video.filename}</p>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                {video.total_frames} frames @ {video.fps} FPS • {trackCount} tracked objects • {maskCount} masks
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60 font-mono">
              Ready
            </span>
          </div>

          {/* Directory Tree Structure Preview */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
              <FolderTree className="w-3.5 h-3.5 text-zinc-400" />
              <span>Package Directory Layout</span>
            </div>
            <div className="bg-zinc-900/80 rounded-lg p-3 font-mono text-[11px] text-zinc-400 border border-zinc-800 space-y-1">
              <div className="text-zinc-200 font-semibold">meddata-surgical-dataset/</div>
              <div className="pl-4 text-zinc-400">├── videos/ <span className="text-zinc-600">({video.filename})</span></div>
              <div className="pl-4 text-zinc-400">├── frames/ <span className="text-zinc-600">(frame_00000.jpg ... frame_XXXXX.jpg)</span></div>
              <div className="pl-4 text-zinc-400">├── masks/ <span className="text-zinc-600">(frame_00000_track_Y.png)</span></div>
              <div className="pl-4 text-zinc-400">├── annotations/</div>
              <div className="pl-8 text-emerald-400">└── video_coco.json <span className="text-zinc-500">(Video-COCO & MOTS format)</span></div>
              <div className="pl-4 text-zinc-400">└── metadata.json <span className="text-zinc-500">(FPS, duration, SAM 2 Tiny metadata)</span></div>
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 font-mono">ZIP Archive</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.98] shadow-sm flex items-center gap-2 transition disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Packaging Video Dataset...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ZIP Package</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
