"use client";

import React, { useState, useRef } from "react";
import { Dataset, ImageItem } from "@/lib/types";
import { getThumbnailUrl } from "@/lib/api";
import {
  Microscope,
  FolderOpen,
  UploadCloud,
  Play,
  Sparkles,
  ChevronDown,
  Trash2,
  FileImage,
  BarChart2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface LeftSidebarProps {
  datasets: Dataset[];
  selectedDataset: Dataset | null;
  images: ImageItem[];
  selectedImageId: string | null;
  onSelectDataset: (dataset: Dataset) => void;
  onSelectImage: (imageId: string) => void;
  onUploadFiles: (files: File[]) => Promise<void>;
  onTriggerDemo: () => void;
  onOpenBenchmark: () => void;
  onDeleteImage: (imageId: string) => void;
  isUploading: boolean;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  datasets,
  selectedDataset,
  images,
  selectedImageId,
  onSelectDataset,
  onSelectImage,
  onUploadFiles,
  onTriggerDemo,
  onOpenBenchmark,
  onDeleteImage,
  isUploading,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDatasetOpen, setIsDatasetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = Array.from(e.dataTransfer.files).filter((file) => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        return ["png", "jpg", "jpeg", "tif", "tiff"].includes(ext || "");
      });
      if (validFiles.length > 0) {
        await onUploadFiles(validFiles);
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = Array.from(e.target.files);
      await onUploadFiles(validFiles);
      e.target.value = "";
    }
  };

  // Collapsed Minimal Sidebar (ComfyUI / Studio style)
  if (isCollapsed) {
    return (
      <aside className="w-14 bg-[#0d131f] border-r border-[#1e293b] flex flex-col items-center py-3 select-none shrink-0 z-20 space-y-4">
        <button
          onClick={() => setIsCollapsed(false)}
          title="Expand Sidebar"
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <PanelLeftOpen className="w-5 h-5 text-brand-cyan" />
        </button>

        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-cyan to-brand-violet flex items-center justify-center shadow-lg shadow-brand-cyan/20">
          <Microscope className="w-4 h-4 text-slate-950 stroke-[2.5]" />
        </div>

        <button
          onClick={onTriggerDemo}
          title="Try Microscopy Demo"
          className="p-2 text-brand-cyan hover:bg-brand-cyan/15 rounded-lg transition"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          title="Upload Image"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          <UploadCloud className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenBenchmark}
          title="Open Benchmark"
          className="p-2 text-slate-400 hover:text-brand-violet hover:bg-slate-800 rounded-lg transition"
        >
          <BarChart2 className="w-4 h-4" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.tif,.tiff"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </aside>
    );
  }

  // Expanded Sidebar
  return (
    <aside className="w-64 bg-[#0d131f] border-r border-[#1e293b] flex flex-col h-full select-none shrink-0 z-20">
      {/* Brand Header */}
      <div className="p-3.5 border-b border-[#1e293b] bg-[#070b13]/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-cyan to-brand-violet flex items-center justify-center shadow-md shadow-brand-cyan/20">
              <Microscope className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="font-bold text-xs tracking-tight text-white flex items-center gap-1">
                BioLabel
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30">
                  AI
                </span>
              </h1>
            </div>
          </div>
          <button
            onClick={() => setIsCollapsed(true)}
            title="Collapse Sidebar"
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Try Demo CTA Button */}
        <button
          onClick={onTriggerDemo}
          className="mt-3 w-full py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-brand-cyan/20 via-brand-violet/20 to-brand-cyan/20 border border-brand-cyan/40 hover:border-brand-cyan hover:bg-brand-cyan/30 text-xs font-semibold text-cyan-200 hover:text-white flex items-center justify-between transition group shadow-md"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-cyan group-hover:rotate-12 transition-transform" />
            Try Demo
          </span>
          <Play className="w-3 h-3 fill-current text-brand-cyan" />
        </button>
      </div>

      {/* Dataset Selector */}
      <div className="p-2.5 border-b border-[#1e293b] bg-[#121927]/60">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold text-[10px] uppercase tracking-wider text-slate-400">
            Dataset
          </span>
          <button
            onClick={onOpenBenchmark}
            title="Benchmark FastSAM vs Watershed"
            className="text-[10px] text-brand-cyan hover:underline flex items-center gap-1"
          >
            <BarChart2 className="w-3 h-3" />
            Benchmark
          </button>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsDatasetOpen(!isDatasetOpen)}
            className="w-full px-2 py-1.5 rounded bg-[#070b13] border border-[#1e293b] hover:border-slate-700 text-xs text-left text-slate-200 flex items-center justify-between transition"
          >
            <div className="truncate flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-brand-violet shrink-0" />
              <span className="truncate text-[11.5px]">
                {selectedDataset ? selectedDataset.name : "Select Dataset"}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {isDatasetOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#121927] border border-[#1e293b] rounded-lg shadow-2xl py-1 z-30 max-h-48 overflow-y-auto">
              {datasets.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    onSelectDataset(d);
                    setIsDatasetOpen(false);
                  }}
                  className={`w-full px-2.5 py-1 text-xs text-left flex items-center justify-between hover:bg-slate-800 transition ${
                    selectedDataset?.id === d.id
                      ? "text-brand-cyan font-medium bg-brand-cyan/5"
                      : "text-slate-300"
                  }`}
                >
                  <span className="truncate">{d.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {d.image_count} imgs
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Dropzone */}
      <div className="p-2.5 border-b border-[#1e293b]">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-lg p-2.5 text-center cursor-pointer transition ${
            isDragging
              ? "border-brand-cyan bg-brand-cyan/10"
              : "border-slate-800 hover:border-slate-700 bg-[#070b13]/50 hover:bg-[#070b13]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.tif,.tiff"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <UploadCloud className="w-4 h-4 mx-auto text-slate-400 mb-0.5" />
          <p className="text-[11px] font-medium text-slate-300">
            {isUploading ? "Uploading..." : "Upload Images"}
          </p>
          <p className="text-[9.5px] text-slate-400 font-mono">PNG, JPG, TIFF</p>
        </div>
      </div>

      {/* Images List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-1 mb-1">
          Images ({images.length})
        </div>

        {images.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            <FileImage className="w-6 h-6 mx-auto text-slate-500 mb-1" />
            <p className="text-[11px]">No images</p>
          </div>
        ) : (
          images.map((img) => {
            const isSelected = img.id === selectedImageId;
            return (
              <div
                key={img.id}
                onClick={() => onSelectImage(img.id)}
                className={`group flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition border ${
                  isSelected
                    ? "bg-[#162032] border-brand-cyan shadow-sm"
                    : "bg-[#070b13]/80 border-[#1e293b]/60 hover:bg-[#121927] hover:border-slate-800"
                }`}
              >
                <div className="w-10 h-10 rounded bg-slate-900 overflow-hidden shrink-0 border border-slate-800 flex items-center justify-center">
                  <img
                    src={getThumbnailUrl(img.id)}
                    alt={img.filename}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[11.5px] font-medium truncate ${
                      isSelected ? "text-cyan-300 font-semibold" : "text-slate-300"
                    }`}
                  >
                    {img.filename}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                    <span>
                      {img.width}×{img.height}
                    </span>
                    <span>•</span>
                    <span className="text-cyan-400 font-semibold">
                      {img.annotation_count} cells
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete image '${img.filename}'?`)) {
                      onDeleteImage(img.id);
                    }
                  }}
                  title="Delete image"
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
