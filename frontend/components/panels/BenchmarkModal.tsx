"use client";

import React, { useState } from "react";
import { BenchmarkResponse, ImageItem } from "@/lib/types";
import { runBenchmark } from "@/lib/api";
import {
  BarChart3,
  X,
  Zap,
  Clock,
  Layers,
  Award,
  Loader2,
  CheckCircle2,
  Activity,
} from "lucide-react";

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentImage: ImageItem | null;
}

export const BenchmarkModal: React.FC<BenchmarkModalProps> = ({
  isOpen,
  onClose,
  currentImage,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !currentImage) return null;

  const handleRunBenchmark = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const data = await runBenchmark(currentImage.id);
      setBenchmarkData(data);
    } catch (err: any) {
      setError(err.message || "Benchmark execution failed");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#0d131f] border border-[#1e293b] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-[#1e293b] flex items-center justify-between bg-[#121927]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-violet/10 border border-brand-violet/20 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-brand-violet" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Microscopy Segmentation Benchmark
              </h2>
              <p className="text-[11px] text-slate-400">
                FastSAM-s (Zero-Shot CNN) vs Classical Cell Watershed Baseline
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

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-300">
          <div className="bg-[#070b13] p-3 rounded-lg border border-[#1e293b] flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-200">Test Image: {currentImage.filename}</p>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                {currentImage.width} × {currentImage.height} px • CPU-Only M3 Execution
              </p>
            </div>
            <button
              onClick={handleRunBenchmark}
              disabled={isRunning}
              className="px-3 py-1.5 rounded-lg bg-brand-cyan hover:bg-brand-cyan-light text-slate-950 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Benchmarking...</span>
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5" />
                  <span>Execute Benchmark</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {error}
            </div>
          )}

          {benchmarkData && (
            <div className="space-y-4">
              {/* Recommendation Banner */}
              <div className="p-3 rounded-lg bg-brand-cyan/10 border border-brand-cyan/30 text-cyan-200 flex items-start gap-2.5">
                <Award className="w-5 h-5 text-brand-cyan shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block mb-0.5">Evaluation & Finding:</span>
                  <p className="leading-relaxed text-[11.5px]">{benchmarkData.recommendation}</p>
                </div>
              </div>

              {/* Side by side comparison cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {benchmarkData.results.map((res, idx) => {
                  const isFastest =
                    idx === 0 ||
                    res.inference_time_ms < benchmarkData.results[0].inference_time_ms;
                  return (
                    <div
                      key={res.model_id}
                      className="p-3.5 rounded-lg bg-[#121927] border border-[#1e293b] space-y-2.5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-100 text-xs truncate">
                            {res.model_name.split("(")[0]}
                          </span>
                          {res.model_id === "microscopy-watershed" && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Baseline Winner
                            </span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-slate-400 mt-1">{res.notes}</p>
                      </div>

                      <div className="grid grid-cols-3 gap-1 pt-2 border-t border-[#1e293b] text-center font-mono">
                        <div className="bg-[#070b13] p-1.5 rounded">
                          <span className="text-[10px] text-slate-500 block">Speed</span>
                          <span className="text-cyan-400 font-bold text-[11px]">
                            {res.inference_time_ms} ms
                          </span>
                        </div>
                        <div className="bg-[#070b13] p-1.5 rounded">
                          <span className="text-[10px] text-slate-500 block">Detected</span>
                          <span className="text-white font-bold text-[11px]">
                            {res.detected_count} cells
                          </span>
                        </div>
                        <div className="bg-[#070b13] p-1.5 rounded">
                          <span className="text-[10px] text-slate-500 block">Avg Area</span>
                          <span className="text-slate-300 font-bold text-[11px]">
                            {res.mean_object_area} px²
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!benchmarkData && !isRunning && (
            <div className="text-center py-6 text-slate-500 text-xs">
              Click <strong className="text-slate-300">Execute Benchmark</strong> to compare CPU
              inference latency, cell count accuracy, and boundary delineation between FastSAM-s and
              Microscopy Watershed.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1e293b] bg-[#121927] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
