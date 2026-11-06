"use client";

import React, { useState } from "react";
import { X, Download, FileArchive, Check, Layers, Code, ShieldCheck } from "lucide-react";
import { useSurgiLabelStore } from "@/stores/useSurgiLabelStore";
import {
  exportToCOCOJSON,
  exportToYOLOFormat,
  exportToSurgiLabelJSON,
  downloadJsonFile,
} from "@/lib/surgiLabelExport";

interface SurgiExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SurgiExportModal: React.FC<SurgiExportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    projects,
    currentProjectId,
    currentVideoId,
    annotations,
    phaseIntervals,
  } = useSurgiLabelStore();

  const [format, setFormat] = useState<"coco" | "yolo" | "surgilabel">("surgilabel");
  const [onlyReviewed, setOnlyReviewed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const project = projects.find((p) => p.id === currentProjectId) || projects[0];
  const video = project?.videos.find((v) => v.id === currentVideoId) || project?.videos[0];

  const handleExport = () => {
    if (!project || !video) return;
    setIsExporting(true);

    try {
      if (format === "coco") {
        const cocoData = exportToCOCOJSON(project, video, annotations, onlyReviewed);
        downloadJsonFile(`${video.filename.replace(/\.[^/.]+$/, "")}_coco.json`, cocoData);
      } else if (format === "yolo") {
        const classMap = new Map(project.classes.map((c, idx) => [c.id, idx]));
        const yoloData = exportToYOLOFormat(video, annotations, classMap, onlyReviewed);
        downloadJsonFile(`${video.filename.replace(/\.[^/.]+$/, "")}_yolo.json`, yoloData);
      } else {
        const surgiData = exportToSurgiLabelJSON(project, video, annotations, phaseIntervals, onlyReviewed);
        downloadJsonFile(`${video.filename.replace(/\.[^/.]+$/, "")}_surgilabel.json`, surgiData);
      }
      onClose();
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed: " + err);
    } finally {
      setIsExporting(false);
    }
  };

  const approvedCount = annotations.filter((a) => a.review_status === "approved").length;
  const targetCount = onlyReviewed ? approvedCount : annotations.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center text-brand-cyan">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Export Annotation Dataset</h2>
              <p className="text-xs text-slate-400">Download formatted training annotations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-elevated transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Format Selection Cards */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Target ML Format</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat("surgilabel")}
                className={`p-3 rounded-lg border text-left transition ${
                  format === "surgilabel"
                    ? "bg-elevated border-brand-cyan text-white shadow-sm"
                    : "bg-background border-border text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="font-semibold text-slate-200">SurgiLabel JSON</div>
                <p className="text-[10px] text-slate-400 mt-1">Tracks + Phases + Review Status</p>
              </button>

              <button
                type="button"
                onClick={() => setFormat("coco")}
                className={`p-3 rounded-lg border text-left transition ${
                  format === "coco"
                    ? "bg-elevated border-brand-cyan text-white shadow-sm"
                    : "bg-background border-border text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="font-semibold text-slate-200">Video-COCO</div>
                <p className="text-[10px] text-slate-400 mt-1">PyTorch / Detectron2 Instances</p>
              </button>

              <button
                type="button"
                onClick={() => setFormat("yolo")}
                className={`p-3 rounded-lg border text-left transition ${
                  format === "yolo"
                    ? "bg-elevated border-brand-cyan text-white shadow-sm"
                    : "bg-background border-border text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="font-semibold text-slate-200">YOLOv8 Format</div>
                <p className="text-[10px] text-slate-400 mt-1">Normalized BBoxes for Ultralytics</p>
              </button>
            </div>
          </div>

          {/* Filtering Options */}
          <div className="bg-background/60 p-3.5 rounded-lg border border-border space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyReviewed}
                onChange={(e) => setOnlyReviewed(e.target.checked)}
                className="rounded border-border text-brand-cyan focus:ring-0 w-4 h-4 bg-elevated"
              />
              <span className="text-slate-200 font-medium">Export approved annotations only</span>
            </label>
            <p className="text-[11px] text-slate-400 pl-6">
              Filters out draft/unreviewed predictions. ({approvedCount} approved out of {annotations.length} total)
            </p>
          </div>

          {/* Export Manifest Preview */}
          <div className="bg-elevated p-3 rounded-lg border border-border font-mono text-[11px] text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Target Video:</span>
              <span className="text-slate-100 truncate max-w-[240px]">{video?.filename}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Frames:</span>
              <span className="text-slate-100">{video?.total_frames} frames @ {video?.fps} FPS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Included Objects:</span>
              <span className="text-brand-cyan font-bold">{targetCount} annotations</span>
            </div>
            {format === "surgilabel" && (
              <div className="flex justify-between">
                <span className="text-slate-400">Surgical Phases:</span>
                <span className="text-brand-green font-bold">{phaseIntervals.length} phase intervals</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || targetCount === 0}
              className="px-4 py-2 rounded-lg bg-white text-slate-950 hover:bg-slate-200 active:scale-98 font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Dataset</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
