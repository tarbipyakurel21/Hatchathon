"use client";

import React, { useState, useEffect } from "react";
import {
  Sliders,
  ShieldAlert,
  Cpu,
  Layers,
  Save,
  RotateCcw,
  CheckCircle2,
  Plus,
  Trash2,
  Info,
} from "lucide-react";
import { DEFAULT_SURGICAL_CLASSES, AnnotationClass } from "@/lib/surgiLabelTypes";

export default function SettingsPage() {
  const [classes, setClasses] = useState<AnnotationClass[]>(DEFAULT_SURGICAL_CLASSES);
  const [weights, setWeights] = useState({
    w_detection: 0.25,
    w_temporal: 0.35,
    w_tracking: 0.25,
    w_shape: 0.15,
    threshold_high: 0.55,
    threshold_medium: 0.30,
  });

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassColor, setNewClassColor] = useState("#3B82F6");
  const [newClassCategory, setNewClassCategory] = useState<"instrument" | "tissue" | "organ" | "lesion">("instrument");

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.uncertainty_weights) {
            setWeights((prev) => ({ ...prev, ...data.uncertainty_weights }));
          }
        }
      } catch (err) {
        // Fallback to local defaults
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...weights,
          recalculate_existing: true,
        }),
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error("Save settings error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    const defaults = {
      w_detection: 0.25,
      w_temporal: 0.35,
      w_tracking: 0.25,
      w_shape: 0.15,
      threshold_high: 0.55,
      threshold_medium: 0.30,
    };
    setWeights(defaults);
    try {
      await fetch("/api/settings/reset", { method: "POST" });
    } catch (err) {}
  };

  const handleAddClass = () => {
    if (!newClassName.trim()) return;
    const newClass: AnnotationClass = {
      id: `c_${Date.now()}`,
      name: newClassName.trim(),
      color: newClassColor,
      category: newClassCategory,
    };
    setClasses([...classes, newClass]);
    setNewClassName("");
  };

  const handleDeleteClass = (id: string) => {
    setClasses(classes.filter((c) => c.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col bg-background text-foreground overflow-y-auto">
      {/* Header */}
      <div className="border-b border-border bg-sidebar px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center text-brand-cyan">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Platform & Uncertainty Configuration
            </h1>
            <p className="text-xs text-slate-400">
              Configure heuristic uncertainty weights, human review triage thresholds, and surgical label taxonomies.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-mono text-slate-300 hover:bg-slate-700 flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-lg bg-brand-cyan text-slate-950 font-semibold text-xs flex items-center gap-1.5 hover:bg-brand-cyan/90 transition shadow-sm"
          >
            {isSaved ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-950" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? "Saving..." : "Save Settings"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-6 max-w-5xl space-y-6">
        {/* Section 1: Uncertainty Weights */}
        <div className="bg-sidebar border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              Heuristic Uncertainty Scoring Weights
            </h2>
          </div>

          <p className="text-xs text-slate-400">
            SurgiLabel computes review priority using transparent normalized signals:{" "}
            <code className="text-brand-cyan font-mono">
              ReviewScore = w₁·U_det + w₂·U_temp + w₃·U_track + w₄·U_shape
            </code>
            . Adjust weights to tune model sensitivity.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-300">Detection Uncertainty Weight (w₁)</span>
                <span className="text-brand-cyan font-bold">{weights.w_detection.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={weights.w_detection}
                onChange={(e) => setWeights({ ...weights, w_detection: parseFloat(e.target.value) })}
                className="w-full accent-brand-cyan cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-1">Penalizes low detector confidence outputs.</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-300">Temporal Instability Weight (w₂)</span>
                <span className="text-brand-cyan font-bold">{weights.w_temporal.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={weights.w_temporal}
                onChange={(e) => setWeights({ ...weights, w_temporal: parseFloat(e.target.value) })}
                className="w-full accent-brand-cyan cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-1">Flags sudden mask area fluctuations (ΔArea &gt; 25%) and centroid jumps.</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-300">Tracking Inconsistency Weight (w₃)</span>
                <span className="text-brand-cyan font-bold">{weights.w_tracking.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={weights.w_tracking}
                onChange={(e) => setWeights({ ...weights, w_tracking: parseFloat(e.target.value) })}
                className="w-full accent-brand-cyan cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-1">Detects dropped track frames, sudden FOV appearance, and spatial overlaps.</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-300">Shape Anomaly Weight (w₄)</span>
                <span className="text-brand-cyan font-bold">{weights.w_shape.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={weights.w_shape}
                onChange={(e) => setWeights({ ...weights, w_shape: parseFloat(e.target.value) })}
                className="w-full accent-brand-cyan cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-1">Identifies micro-fragmentation, boundary clipping, and contour roughness.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-red-400 font-semibold">High Priority Threshold</span>
                <span className="text-red-400 font-bold">{weights.threshold_high.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="0.9"
                step="0.05"
                value={weights.threshold_high}
                onChange={(e) => setWeights({ ...weights, threshold_high: parseFloat(e.target.value) })}
                className="w-full accent-red-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-1">Scores above this value trigger high priority review triage.</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-amber-400 font-semibold">Medium Priority Threshold</span>
                <span className="text-amber-400 font-bold">{weights.threshold_medium.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.5"
                step="0.05"
                value={weights.threshold_medium}
                onChange={(e) => setWeights({ ...weights, threshold_medium: parseFloat(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-1">Scores between medium and high are routed to standard QA review.</p>
            </div>
          </div>
        </div>

        {/* Section 2: Active AI Models */}
        <div className="bg-sidebar border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Cpu className="w-4 h-4 text-brand-cyan" />
            <h2 className="text-sm font-semibold text-slate-100">
              Active Computer Vision & Inference Engines (CPU Mode)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-elevated border border-border rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-slate-400">Object Detector</span>
              <h4 className="text-xs font-semibold text-slate-200 mt-1">Surgical Instrument Saliency Detector</h4>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">Specialized laparoscopic instrument & anatomy classifier.</p>
              <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Active (CPU)
              </span>
            </div>

            <div className="bg-elevated border border-border rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-slate-400">Prompt Segmenter</span>
              <h4 className="text-xs font-semibold text-slate-200 mt-1">Meta SAM 2 Tiny (sam2_t.pt)</h4>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">Zero-shot sub-pixel mask generation with polygon vectorization.</p>
              <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Active (CPU)
              </span>
            </div>

            <div className="bg-elevated border border-border rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-slate-400">Temporal Tracker</span>
              <h4 className="text-xs font-semibold text-slate-200 mt-1">Farneback Flow + CSRT Interpolator</h4>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">Sub-pixel temporal motion tracking and multi-frame propagation.</p>
              <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Active (CPU)
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Label Taxonomy */}
        <div className="bg-sidebar border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-100">
                Surgical Label Taxonomy
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">{classes.length} classes defined</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {classes.map((cls) => (
              <div
                key={cls.id}
                className="flex items-center justify-between bg-elevated border border-border rounded-lg px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                  <div>
                    <span className="font-medium text-slate-200">{cls.name}</span>
                    <span className="block text-[10px] font-mono text-slate-500 capitalize">{cls.category}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteClass(cls.id)}
                  className="text-slate-500 hover:text-red-400 transition"
                  title="Remove class"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add New Class Form */}
          <div className="pt-3 border-t border-border flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              placeholder="New class label (e.g. Suction Cannula)"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="bg-elevated border border-border rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-cyan/50 font-mono"
            />
            <select
              value={newClassCategory}
              onChange={(e: any) => setNewClassCategory(e.target.value)}
              className="bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-cyan/50 font-mono capitalize"
            >
              <option value="instrument">Instrument</option>
              <option value="organ">Organ</option>
              <option value="tissue">Tissue</option>
              <option value="lesion">Lesion</option>
            </select>
            <input
              type="color"
              value={newClassColor}
              onChange={(e) => setNewClassColor(e.target.value)}
              className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer p-0.5"
            />
            <button
              onClick={handleAddClass}
              className="px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-700 flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5 text-brand-cyan" />
              <span>Add Class</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
