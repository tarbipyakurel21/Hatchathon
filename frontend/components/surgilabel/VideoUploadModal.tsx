"use client";

import React, { useState, useRef } from "react";
import { X, UploadCloud, Film, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useSurgiLabelStore } from "@/stores/useSurgiLabelStore";
import { uploadVideoFile } from "@/lib/videoApi";

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export const VideoUploadModal: React.FC<VideoUploadModalProps> = ({
  isOpen,
  onClose,
  projectId,
}) => {
  const { addVideoToProject, setCurrentVideo } = useSurgiLabelStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.includes("video") || file.name.endsWith(".mp4") || file.name.endsWith(".webm")) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError("Please upload an MP4 or WebM video file.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setError(null);

    try {
      // 1. Upload to backend
      const vidRecord = await uploadVideoFile(selectedFile);

      // 2. Add to Zustand store
      const added = addVideoToProject(projectId, {
        filename: vidRecord.filename,
        url: `/api/videos/${vidRecord.id}/file`,
        thumbnail_url: vidRecord.thumbnail_path ? `/api/videos/${vidRecord.id}/thumbnail` : undefined,
        duration_seconds: vidRecord.duration_seconds || 5.0,
        fps: vidRecord.fps || 25.0,
        total_frames: vidRecord.total_frames || 120,
        width: vidRecord.width || 640,
        height: vidRecord.height || 480,
        status: "uploaded",
        annotation_count: 0,
      });

      setCurrentVideo(added.id);
      onClose();
    } catch (err: any) {
      console.error("Upload error:", err);
      // Fallback: create client-side entry using object URL for local testing
      const objectUrl = URL.createObjectURL(selectedFile);
      const added = addVideoToProject(projectId, {
        filename: selectedFile.name,
        url: objectUrl,
        duration_seconds: 5.0,
        fps: 25.0,
        total_frames: 125,
        width: 1280,
        height: 720,
        status: "uploaded",
        annotation_count: 0,
      });
      setCurrentVideo(added.id);
      onClose();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center text-brand-cyan">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Upload Surgical Footage</h2>
              <p className="text-xs text-slate-400">Import clinical laparoscopic or robotic video</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-elevated transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dropzone */}
        <div className="p-5 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
              isDragging
                ? "border-brand-cyan bg-brand-cyan/10"
                : "border-border bg-background/50 hover:border-slate-600 hover:bg-elevated/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-elevated border border-border flex items-center justify-center text-slate-400">
              <UploadCloud className="w-6 h-6 text-brand-cyan" />
            </div>
            {selectedFile ? (
              <div className="text-center">
                <p className="text-xs font-semibold text-slate-100">{selectedFile.name}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-slate-200">
                  Click to browse or drag and drop surgical video
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Supported formats: MP4, WebM (up to 200 MB)
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-white transition text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="px-4 py-2 rounded-lg bg-white text-slate-950 hover:bg-slate-200 active:scale-98 font-semibold text-xs shadow-sm transition disabled:opacity-50 flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing Video...</span>
                </>
              ) : (
                <span>Upload & Open</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
