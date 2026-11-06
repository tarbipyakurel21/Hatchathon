"use client";

import React, { useRef, useState } from "react";
import { VideoItem } from "@/lib/videoTypes";
import { getVideoThumbnailUrl } from "@/lib/videoApi";
import {
  Film,
  UploadCloud,
  Sparkles,
  Trash2,
  Clock,
  CheckCircle2,
  Play,
  Loader2,
} from "lucide-react";

interface VideoSidebarProps {
  videos: VideoItem[];
  selectedVideoId: string | null;
  onSelectVideo: (videoId: string) => void;
  onUploadVideo: (file: File) => Promise<void>;
  onTriggerDemo: () => Promise<void>;
  onDeleteVideo: (videoId: string) => Promise<void>;
  isUploading: boolean;
  isLoadingDemo: boolean;
}

export const VideoSidebar: React.FC<VideoSidebarProps> = ({
  videos,
  selectedVideoId,
  onSelectVideo,
  onUploadVideo,
  onTriggerDemo,
  onDeleteVideo,
  isUploading,
  isLoadingDemo,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await onUploadVideo(file);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await onUploadVideo(file);
      e.target.value = "";
    }
  };

  return (
    <aside className="w-64 bg-[#0d131f] border-r border-[#1e293b] flex flex-col h-full select-none shrink-0 z-20">
      {/* 1. Header & Demo Action */}
      <div className="p-3.5 border-b border-[#1e293b] space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-cyan/15 border border-brand-cyan/30 flex items-center justify-center">
            <Film className="w-3.5 h-3.5 text-brand-cyan" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white tracking-wide">SURGICAL VIDEOS</h2>
            <p className="text-[10px] text-slate-400">MedData Studio Library</p>
          </div>
        </div>

        {/* Try Surgical Demo Button */}
        <button
          onClick={onTriggerDemo}
          disabled={isLoadingDemo}
          className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-brand-cyan/20 to-brand-violet/20 hover:from-brand-cyan/30 hover:to-brand-violet/30 border border-cyan-500/30 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-2 transition active:scale-98 shadow-sm"
        >
          {isLoadingDemo ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-brand-cyan" />
          )}
          <span>Try Surgical Demo</span>
        </button>
      </div>

      {/* 2. Upload Dropzone */}
      <div className="p-3 border-b border-[#1e293b]">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-xl p-3 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5 ${
            isDragging
              ? "border-brand-cyan bg-brand-cyan/10"
              : "border-slate-800 bg-[#070b13]/60 hover:border-slate-700 hover:bg-[#121927]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
            onChange={handleFileInput}
            className="hidden"
          />
          {isUploading ? (
            <Loader2 className="w-5 h-5 text-brand-cyan animate-spin" />
          ) : (
            <UploadCloud className="w-5 h-5 text-slate-500" />
          )}
          <span className="text-[11px] font-medium text-slate-300">
            {isUploading ? "Uploading..." : "Upload Surgical Video"}
          </span>
          <span className="text-[9.5px] text-slate-500 font-mono">
            MP4, WebM, MOV (up to 50MB)
          </span>
        </div>
      </div>

      {/* 3. Video List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        <div className="text-[10px] uppercase font-semibold text-slate-400 px-2 py-1">
          Loaded Clips ({videos.length})
        </div>

        {videos.map((vid) => {
          const isSelected = vid.id === selectedVideoId;

          return (
            <div
              key={vid.id}
              onClick={() => onSelectVideo(vid.id)}
              className={`group rounded-xl p-2 cursor-pointer transition border relative overflow-hidden ${
                isSelected
                  ? "bg-[#162032] border-brand-cyan shadow-md shadow-cyan-500/10"
                  : "bg-[#070b13]/60 border-slate-800/80 hover:bg-[#121927] hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {/* Thumbnail Preview */}
                <div className="w-14 h-10 rounded-lg bg-black border border-slate-800 overflow-hidden shrink-0 relative flex items-center justify-center">
                  {vid.thumbnail_path ? (
                    <img
                      src={getVideoThumbnailUrl(vid.id)}
                      alt={vid.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Play className="w-4 h-4 text-slate-600 fill-slate-600" />
                  )}
                  <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-black/80 text-[8px] font-mono text-cyan-400 rounded">
                    {vid.duration_seconds}s
                  </span>
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">{vid.filename}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {vid.total_frames} frames • {vid.fps} FPS
                  </p>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete video '${vid.filename}'?`)) {
                      onDeleteVideo(vid.id);
                    }
                  }}
                  title="Delete Video"
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
