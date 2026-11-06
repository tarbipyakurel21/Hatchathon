"use client";

import React, { useRef, useState } from "react";
import { VideoItem } from "@/lib/videoTypes";
import { getVideoThumbnailUrl } from "@/lib/videoApi";
import {
  Film,
  UploadCloud,
  Trash2,
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
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col h-full select-none shrink-0 z-20">
      {/* 1. Header & Demo Action */}
      <div className="p-3.5 border-b border-zinc-800 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Film className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-zinc-100 tracking-wide uppercase">Video Library</h2>
            <p className="text-[10px] text-zinc-500 font-mono">CVAT Medical Clips</p>
          </div>
        </div>

        {/* Try Surgical Demo Button */}
        <button
          onClick={onTriggerDemo}
          disabled={isLoadingDemo}
          className="w-full py-1.5 px-3 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium text-xs flex items-center justify-center gap-2 transition active:scale-98 shadow-sm disabled:opacity-50"
        >
          {isLoadingDemo ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current text-zinc-400" />
          )}
          <span>Load Surgical Demo</span>
        </button>
      </div>

      {/* 2. Upload Dropzone */}
      <div className="p-3 border-b border-zinc-800">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-lg p-3 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5 ${
            isDragging
              ? "border-zinc-500 bg-zinc-900"
              : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900"
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
            <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
          ) : (
            <UploadCloud className="w-4 h-4 text-zinc-500" />
          )}
          <span className="text-[11px] font-medium text-zinc-300">
            {isUploading ? "Uploading..." : "Upload Medical Video"}
          </span>
          <span className="text-[9.5px] text-zinc-500 font-mono">
            MP4, WebM (up to 50MB)
          </span>
        </div>
      </div>

      {/* 3. Video List (CVAT Clips Bin) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="text-[10px] uppercase font-semibold text-zinc-500 px-2 py-1">
          Loaded Clips ({videos.length})
        </div>

        {videos.map((vid) => {
          const isSelected = vid.id === selectedVideoId;

          return (
            <div
              key={vid.id}
              onClick={() => onSelectVideo(vid.id)}
              className={`group rounded-md p-2 cursor-pointer transition border relative overflow-hidden ${
                isSelected
                  ? "bg-zinc-900 border-zinc-700 shadow-sm"
                  : "bg-zinc-950 border-zinc-800/80 hover:bg-zinc-900/60 hover:border-zinc-800"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {/* Thumbnail Preview */}
                <div className="w-14 h-10 rounded bg-black border border-zinc-800 overflow-hidden shrink-0 relative flex items-center justify-center">
                  {vid.thumbnail_path ? (
                    <img
                      src={getVideoThumbnailUrl(vid.id)}
                      alt={vid.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Play className="w-4 h-4 text-zinc-700 fill-zinc-700" />
                  )}
                  <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-black/80 text-[8px] font-mono text-zinc-300 rounded">
                    {vid.duration_seconds}s
                  </span>
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-200 truncate">{vid.filename}</p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
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
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 rounded transition"
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
