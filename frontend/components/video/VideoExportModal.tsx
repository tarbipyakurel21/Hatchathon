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
      <div className="w-full max-w-lg bg-[#0d131f] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#1e293b] flex items-center justify-between bg-[#121927]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-cyan/15 border border-brand-cyan/30 flex items-center justify-center">
              <FileArchive className="w-4 h-4 text-brand-cyan" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Export Video Tracking Dataset</h2>
              <p className="text-[11px] text-slate-400">
                AI-Ready Package for SAM 2, Track-RCNN, YOLOv8-Track & MOTS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs text-slate-300">
          {/* Summary card */}
          <div className="bg-[#070b13] p-3 rounded-xl border border-[#1e293b] flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">{video.filename}</p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {video.total_frames} frames @ {video.fps} FPS • {trackCount} tracked objects • {maskCount} masks
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
              Ready
            </span>
          </div>

          {/* Directory Tree Structure Preview */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              <FolderTree className="w-3.5 h-3.5 text-brand-violet" />
              <span>Dataset Package File Structure</span>
            </div>
            <div className="bg-[#070b13] rounded-lg p-3 font-mono text-[11px] text-slate-400 border border-[#1e293b] space-y-1">
              <div className="text-cyan-400 font-semibold">meddata-surgical-dataset/</div>
              <div className="pl-4 text-slate-400">├── videos/ <span className="text-slate-600">({video.filename})</span></div>
              <div className="pl-4 text-slate-400">├── frames/ <span className="text-slate-600">(frame_00000.jpg ... frame_XXXXX.jpg)</span></div>
              <div className="pl-4 text-slate-400">├── masks/ <span className="text-slate-600">(frame_00000_track_Y.png)</span></div>
              <div className="pl-4 text-slate-400">├── annotations/</div>
              <div className="pl-8 text-emerald-400">└── video_coco.json <span className="text-slate-600">(Video-COCO & MOTS format)</span></div>
              <div className="pl-4 text-purple-400">└── metadata.json <span className="text-slate-600">(FPS, duration, SAM 2 Tiny metadata)</span></div>
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1e293b] bg-[#121927] flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">Standardized ZIP</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand-cyan to-brand-violet text-slate-950 hover:brightness-110 shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Packaging Video Dataset...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 stroke-[2.5]" />
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
