"use client";

import React, { useState } from "react";
import { Dataset } from "@/lib/types";
import { exportDataset, getExportDownloadUrl } from "@/lib/api";
import {
  Download,
  X,
  FileArchive,
  CheckCircle2,
  FileCode,
  Image,
  FolderTree,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: Dataset | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  dataset,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !dataset) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const res = await exportDataset(dataset.id);
      setDownloadUrl(res.download_url);
      setFilename(res.filename);
      // Trigger download
      const link = document.createElement("a");
      link.href = getExportDownloadUrl(res.filename);
      link.setAttribute("download", res.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setError(err.message || "Failed to generate dataset package");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#0d131f] border border-[#1e293b] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-[#1e293b] flex items-center justify-between bg-[#121927]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center">
              <FileArchive className="w-4 h-4 text-brand-cyan" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Export Annotated Dataset</h2>
              <p className="text-[11px] text-slate-400">
                AI-Ready Package for PyTorch, TensorFlow, Cellpose & YOLO
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
          {/* Dataset Info */}
          <div className="bg-[#070b13] p-3 rounded-lg border border-[#1e293b] flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-200">{dataset.name}</p>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                {dataset.image_count} images • {dataset.annotation_count} cell annotations
              </p>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Ready
            </span>
          </div>

          {/* Directory Tree Structure Preview */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              <FolderTree className="w-3.5 h-3.5 text-brand-violet" />
              <span>Package File Structure</span>
            </div>
            <div className="bg-[#070b13] p-3 rounded-lg font-mono text-[11px] text-slate-400 border border-[#1e293b] space-y-1">
              <div className="text-brand-cyan font-bold">biolabel-dataset/</div>
              <div className="pl-4 text-slate-300">├── images/ (Original microscopy images)</div>
              <div className="pl-4 text-slate-300">├── masks/ (16-bit integer instance masks)</div>
              <div className="pl-4 text-slate-300">
                ├── annotations/
                <div className="pl-4 text-emerald-400">└── annotations.json (COCO format)</div>
              </div>
              <div className="pl-4 text-slate-400">└── metadata.json (Dataset provenance & stats)</div>
            </div>
          </div>

          {/* Highlights */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded bg-[#121927] border border-[#1e293b]">
              <span className="text-white font-medium block">COCO 1.0 JSON</span>
              <span className="text-slate-500 text-[10px]">Polygons, bboxes, categories & areas</span>
            </div>
            <div className="p-2.5 rounded bg-[#121927] border border-[#1e293b]">
              <span className="text-white font-medium block">Instance PNG Masks</span>
              <span className="text-slate-500 text-[10px]">16-bit stable integer pixel IDs</span>
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]">
              {error}
            </div>
          )}

          {filename && downloadUrl && (
            <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center justify-between">
              <span>Downloaded {filename}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1e293b] bg-[#121927] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition"
          >
            Close
          </button>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-violet hover:brightness-110 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-brand-cyan/25 transition disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating ZIP Archive...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Download Dataset ZIP</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
