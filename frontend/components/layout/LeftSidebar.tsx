"use client";

import React, { useState, useRef } from "react";
import { Dataset, ImageItem } from "@/lib/types";
import { getThumbnailUrl } from "@/lib/api";
import {
  Microscope,
  FolderOpen,
  UploadCloud,
  Play,
  Layers,
  Sparkles,
  ChevronDown,
  Plus,
  Trash2,
  FileImage,
  Check,
  AlertCircle,
  BarChart2,
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
      e.target.value = ""; // Reset
    }
  };

  return (
    <aside className="w-72 bg-[#0d131f] border-r border-[#1e293b] flex flex-col h-full select-none shrink-0 z-20">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#1e293b] bg-[#070b13]/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-cyan to-brand-violet flex items-center justify-center shadow-lg shadow-brand-cyan/20">
            <Microscope className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
              BioLabel
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30">
                MVP
              </span>
            </h1>
            <p className="text-[10.5px] text-slate-400 font-sans tracking-tight">
              Microscopy to AI Datasets
            </p>
          </div>
        </div>

        {/* Try Demo Prominent CTA Button */}
        <button
          onClick={onTriggerDemo}
          className="mt-3.5 w-full py-2 px-3 rounded-lg bg-gradient-to-r from-brand-cyan/20 via-brand-violet/20 to-brand-cyan/20 border border-brand-cyan/40 hover:border-brand-cyan hover:bg-brand-cyan/30 text-xs font-semibold text-cyan-200 hover:text-white flex items-center justify-center gap-2 transition duration-200 group shadow-lg shadow-cyan-950/40"
        >
          <Sparkles className="w-3.5 h-3.5 text-brand-cyan group-hover:rotate-12 transition-transform" />
          <span>Try Microscopy Demo</span>
          <Play className="w-3 h-3 fill-current ml-auto text-brand-cyan" />
        </button>
      </div>

      {/* Dataset Selector Dropdown */}
      <div className="p-3 border-b border-[#1e293b] bg-[#121927]/60">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span className="font-medium text-[11px] uppercase tracking-wider text-slate-500">
            Dataset
          </span>
          <button
            onClick={onOpenBenchmark}
            title="Benchmark FastSAM vs Watershed"
            className="text-[11px] text-brand-cyan hover:underline flex items-center gap-1"
          >
            <BarChart2 className="w-3 h-3" />
            Benchmark
          </button>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsDatasetOpen(!isDatasetOpen)}
            className="w-full px-2.5 py-1.5 rounded-md bg-[#070b13] border border-[#1e293b] hover:border-slate-700 text-xs text-left text-slate-200 flex items-center justify-between transition"
          >
            <div className="truncate flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-brand-violet shrink-0" />
              <span className="truncate">
                {selectedDataset ? selectedDataset.name : "Select Dataset"}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
                  className={`w-full px-3 py-1.5 text-xs text-left flex items-center justify-between hover:bg-slate-800 transition ${
                    selectedDataset?.id === d.id
                      ? "text-brand-cyan font-medium bg-brand-cyan/5"
                      : "text-slate-300"
                  }`}
                >
                  <span className="truncate">{d.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {d.image_count} imgs
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Dropzone */}
      <div className="p-3 border-b border-[#1e293b]">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition ${
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
          <UploadCloud className="w-5 h-5 mx-auto text-slate-500 mb-1" />
          <p className="text-xs font-medium text-slate-300">
            {isUploading ? "Uploading..." : "Upload Microscopy Image"}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
            PNG, JPG, TIFF (up to 50MB)
          </p>
        </div>
      </div>

      {/* Images Thumbnail Gallery */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1 px-1">
          <span className="font-medium text-[11px] uppercase tracking-wider">
            Images ({images.length})
          </span>
        </div>

        {images.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            <FileImage className="w-8 h-8 mx-auto text-slate-700 mb-2" />
            <p>No images in this dataset</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Upload files or click Try Demo above
            </p>
          </div>
        ) : (
          images.map((img) => {
            const isSelected = img.id === selectedImageId;
            return (
              <div
                key={img.id}
                onClick={() => onSelectImage(img.id)}
                className={`group relative flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition border ${
                  isSelected
                    ? "bg-[#162032] border-brand-cyan shadow-md shadow-cyan-950/30"
                    : "bg-[#070b13]/80 border-[#1e293b]/60 hover:bg-[#121927] hover:border-slate-700"
                }`}
              >
                {/* Thumbnail */}
                <div className="w-12 h-12 rounded bg-slate-900 overflow-hidden shrink-0 border border-slate-800 flex items-center justify-center">
                  <img
                    src={getThumbnailUrl(img.id)}
                    alt={img.filename}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback icon on error
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs font-medium truncate ${
                      isSelected ? "text-cyan-300 font-semibold" : "text-slate-300"
                    }`}
                  >
                    {img.filename}
                  </p>
                  <div className="flex items-center gap-2 text-[10.5px] font-mono text-slate-500 mt-0.5">
                    <span>
                      {img.width}×{img.height}
                    </span>
                    <span>•</span>
                    <span className="uppercase">{img.file_format}</span>
                  </div>
                  <div className="mt-1">
                    <span className="inline-block px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-brand-cyan/10 text-cyan-400 border border-brand-cyan/20">
                      {img.annotation_count} cells
                    </span>
                  </div>
                </div>

                {/* Delete button (hover) */}
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
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Status footer */}
      <div className="p-3 border-t border-[#1e293b] bg-[#070b13]/60 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="font-mono">CPU Inference Mode</span>
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Ready
        </span>
      </div>
    </aside>
  );
};
