"use client";

import React from "react";
import { ImageAdjustments, ScientificLUT } from "@/lib/types";
import {
  Sliders,
  Sun,
  Contrast,
  Sparkles,
  RotateCcw,
  X,
  Palette,
  Eye,
} from "lucide-react";

interface AdjustmentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  adjustments: ImageAdjustments;
  onChange: (adj: ImageAdjustments) => void;
  onReset: () => void;
}

const LUT_OPTIONS: { id: ScientificLUT; name: string; color: string; desc: string }[] = [
  { id: "original", name: "Natural", color: "#94A3B8", desc: "Original microscopy signal" },
  { id: "dapi", name: "DAPI", color: "#06B6D4", desc: "Cyan nucleic stain" },
  { id: "gfp", name: "GFP", color: "#10B981", desc: "Emerald green fluorescence" },
  { id: "rfp", name: "RFP / Cy5", color: "#F43F5E", desc: "Ruby red fluorescent protein" },
  { id: "fire", name: "Fire", color: "#F59E0B", desc: "Thermal glow intensity map" },
  { id: "viridis", name: "Viridis", color: "#8B5CF6", desc: "Perceptually uniform colormap" },
];

export const AdjustmentsPanel: React.FC<AdjustmentsPanelProps> = ({
  isOpen,
  onClose,
  adjustments,
  onChange,
  onReset,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-4 z-40 w-80 bg-[#0d131f]/95 backdrop-blur-xl border border-slate-700/60 rounded-xl shadow-2xl p-4 select-none animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 uppercase tracking-wider">
          <Sliders className="w-3.5 h-3.5 text-brand-cyan" />
          <span>Microscopy Display & LUT</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onReset}
            title="Reset All to Defaults"
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            title="Close Panel"
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4 pt-3 text-xs">
        {/* Scientific Colormap (LUT) */}
        <div>
          <div className="flex items-center justify-between text-slate-300 font-medium mb-1.5">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Palette className="w-3 h-3 text-brand-violet" />
              Fluorescence LUT
            </span>
            <span className="text-[10px] uppercase font-mono text-cyan-400">
              {adjustments.lut}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {LUT_OPTIONS.map((opt) => {
              const isActive = adjustments.lut === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => onChange({ ...adjustments, lut: opt.id })}
                  title={opt.desc}
                  className={`p-1.5 rounded-lg border text-left transition flex flex-col gap-1 ${
                    isActive
                      ? "bg-cyan-500/15 border-cyan-400 text-white shadow-sm shadow-cyan-500/20"
                      : "bg-[#070b13] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                    <span className="font-semibold text-[11px] truncate">
                      {opt.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Brightness Slider */}
        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span className="flex items-center gap-1 text-[11px]">
              <Sun className="w-3 h-3 text-amber-400" />
              Brightness
            </span>
            <span className="font-mono text-cyan-400 text-[11px]">
              {adjustments.brightness > 0 ? `+${adjustments.brightness}` : adjustments.brightness}%
            </span>
          </div>
          <input
            type="range"
            min="-80"
            max="80"
            step="2"
            value={adjustments.brightness}
            onChange={(e) =>
              onChange({ ...adjustments, brightness: parseInt(e.target.value, 10) })
            }
            className="w-full accent-brand-cyan h-1 bg-slate-800 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Contrast Slider */}
        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span className="flex items-center gap-1 text-[11px]">
              <Contrast className="w-3 h-3 text-sky-400" />
              Contrast
            </span>
            <span className="font-mono text-cyan-400 text-[11px]">
              {adjustments.contrast > 0 ? `+${adjustments.contrast}` : adjustments.contrast}%
            </span>
          </div>
          <input
            type="range"
            min="-80"
            max="80"
            step="2"
            value={adjustments.contrast}
            onChange={(e) =>
              onChange({ ...adjustments, contrast: parseInt(e.target.value, 10) })
            }
            className="w-full accent-brand-cyan h-1 bg-slate-800 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Exposure / Gamma */}
        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span className="flex items-center gap-1 text-[11px]">
              <Sparkles className="w-3 h-3 text-purple-400" />
              Gamma (Exposure)
            </span>
            <span className="font-mono text-cyan-400 text-[11px]">
              {adjustments.exposure.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={adjustments.exposure}
            onChange={(e) =>
              onChange({ ...adjustments, exposure: parseFloat(e.target.value) })
            }
            className="w-full accent-brand-cyan h-1 bg-slate-800 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Invert Signal (Darkfield vs Brightfield) */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-300 flex items-center gap-1.5">
            <Eye className="w-3 h-3 text-slate-400" />
            Invert Field (Darkfield/Brightfield)
          </span>
          <button
            onClick={() => onChange({ ...adjustments, invert: !adjustments.invert })}
            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
              adjustments.invert ? "bg-brand-cyan" : "bg-slate-800"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-slate-950 transition-transform ${
                adjustments.invert ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
