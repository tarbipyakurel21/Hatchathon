"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Filter,
  SlidersHorizontal,
  Clock,
  Sparkles,
  Zap,
  RotateCcw,
  Layers,
  ChevronDown,
  Info,
  Maximize2,
} from "lucide-react";
import { useSurgiLabelStore } from "@/stores/useSurgiLabelStore";
import { ReviewQueueItem, PriorityTier, ReviewStatus } from "@/lib/surgiLabelTypes";

export default function ReviewQueuePage() {
  const router = useRouter();
  const {
    reviewQueue,
    loadReviewQueue,
    submitReviewAction,
    batchApproveReviewQueue,
    setActiveReviewItem,
    currentVideoId,
    projects,
  } = useSurgiLabelStore();

  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<ReviewQueueItem | null>(null);

  useEffect(() => {
    loadReviewQueue();
  }, [loadReviewQueue]);

  const filteredItems = reviewQueue.filter((item) => {
    if (priorityFilter !== "all" && item.priority_tier !== priorityFilter) return false;
    if (statusFilter !== "all" && item.review_status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesLabel = item.label.toLowerCase().includes(q);
      const matchesReason = item.reasons.some((r) => r.toLowerCase().includes(q));
      if (!matchesLabel && !matchesReason) return false;
    }
    return true;
  });

  const highPriorityCount = reviewQueue.filter((i) => i.priority_tier === "high").length;
  const mediumPriorityCount = reviewQueue.filter((i) => i.priority_tier === "medium").length;
  const approvedCount = reviewQueue.filter((i) => i.review_status === "approved" || i.review_status === "corrected").length;
  const unreviewedCount = reviewQueue.filter((i) => i.review_status === "unreviewed" || i.review_status === "pending_review").length;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (!selectedItem && filteredItems.length > 0) {
        setSelectedItem(filteredItems[0]);
        return;
      }

      if (!selectedItem) return;

      const currentIndex = filteredItems.findIndex((i) => i.id === selectedItem.id);

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = filteredItems[Math.min(filteredItems.length - 1, currentIndex + 1)];
        if (next) setSelectedItem(next);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = filteredItems[Math.max(0, currentIndex - 1)];
        if (prev) setSelectedItem(prev);
      } else if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        submitReviewAction(selectedItem.annotation_id, "approved");
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        submitReviewAction(selectedItem.annotation_id, "rejected");
      } else if (e.key.toLowerCase() === "c" || e.key === "Enter") {
        e.preventDefault();
        handleInspectInWorkspace(selectedItem);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItem, filteredItems, submitReviewAction]);

  const handleInspectInWorkspace = (item: ReviewQueueItem) => {
    setActiveReviewItem(item);
    router.push(`/annotate/${item.video_id}?frame=${item.frame_idx}&track=${item.track_id}`);
  };

  const handleBatchApprove = () => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : filteredItems.map((i) => i.annotation_id);
    batchApproveReviewQueue(ids);
    setSelectedIds(new Set());
  };

  const toggleSelect = (annId: string) => {
    const next = new Set(selectedIds);
    if (next.has(annId)) next.delete(annId);
    else next.add(annId);
    setSelectedIds(next);
  };

  return (
    <div className="flex-1 flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Banner */}
      <div className="border-b border-border bg-sidebar px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Smart Review — Intelligent QA Queue
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30">
                  Annotate Less. Review Smarter.
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Prioritizing candidate frames exhibiting temporal turbulence, centroid shifts, and model ambiguity over sequential review.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Batch Actions */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleBatchApprove}
            className="px-3 py-1.5 rounded-lg bg-brand-cyan text-slate-950 font-semibold text-xs flex items-center gap-1.5 hover:bg-brand-cyan/90 transition shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approve {selectedIds.size > 0 ? `Selected (${selectedIds.size})` : "All Filtered"}</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-6 pb-2 shrink-0">
        <div className="bg-elevated border border-border rounded-xl p-3">
          <p className="text-[10px] font-mono uppercase text-slate-400">Flagged For Review</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-slate-100 font-mono">{unreviewedCount}</span>
            <span className="text-[10px] text-slate-400">candidates</span>
          </div>
        </div>

        <div className="bg-elevated border border-red-500/30 rounded-xl p-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-bl-full pointer-events-none" />
          <p className="text-[10px] font-mono uppercase text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-red-400" /> High Anomaly
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-red-400 font-mono">{highPriorityCount}</span>
            <span className="text-[10px] text-red-300/70 font-mono">Urgent triage</span>
          </div>
        </div>

        <div className="bg-elevated border border-amber-500/30 rounded-xl p-3">
          <p className="text-[10px] font-mono uppercase text-amber-400">Medium Anomaly</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-amber-400 font-mono">{mediumPriorityCount}</span>
            <span className="text-[10px] text-amber-300/70 font-mono">Optical variance</span>
          </div>
        </div>

        <div className="bg-elevated border border-emerald-500/30 rounded-xl p-3">
          <p className="text-[10px] font-mono uppercase text-emerald-400">Verified / Approved</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-emerald-400 font-mono">{approvedCount}</span>
            <span className="text-[10px] text-emerald-300/70 font-mono">Dataset ready</span>
          </div>
        </div>

        <div className="bg-elevated border border-border rounded-xl p-3">
          <p className="text-[10px] font-mono uppercase text-brand-cyan flex items-center gap-1">
            <Zap className="w-3 h-3" /> Effort Saved
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-slate-100 font-mono">78%</span>
            <span className="text-[10px] text-slate-400">human review reduction</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority Pill Filters */}
          <div className="flex items-center bg-elevated border border-border rounded-lg p-0.5 text-xs font-mono">
            {["all", "high", "medium", "low"].map((tier) => (
              <button
                key={tier}
                onClick={() => setPriorityFilter(tier)}
                className={`px-2.5 py-1 rounded-md capitalize transition ${
                  priorityFilter === tier
                    ? "bg-slate-700 text-white font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tier} {tier === "high" && `(${highPriorityCount})`}
              </button>
            ))}
          </div>

          <div className="h-4 w-[1px] bg-border mx-1" />

          {/* Status Filters */}
          <div className="flex items-center bg-elevated border border-border rounded-lg p-0.5 text-xs font-mono">
            {["all", "unreviewed", "approved", "rejected"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md capitalize transition ${
                  statusFilter === st
                    ? "bg-slate-700 text-white font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Search input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter by label or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-elevated border border-border rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-cyan/50 w-56 font-mono"
          />
        </div>
      </div>

      {/* Main Review Items List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="h-64 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center p-6 bg-sidebar/30">
            <ShieldCheck className="w-10 h-10 text-emerald-400 mb-2 opacity-80" />
            <h3 className="text-sm font-semibold text-slate-200">No Flagged Items Match Filters</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              All surgical frames within current criteria have been verified or do not exceed uncertainty anomaly thresholds.
            </p>
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const isSelected = selectedItem?.id === item.id;
            const isHigh = item.priority_tier === "high";
            const isApproved = item.review_status === "approved" || item.review_status === "corrected";

            return (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`border rounded-xl transition p-4 bg-sidebar cursor-pointer ${
                  isSelected
                    ? "border-brand-cyan shadow-md ring-1 ring-brand-cyan/20"
                    : isHigh
                    ? "border-red-500/40 hover:border-red-500/80 bg-red-950/5"
                    : "border-border hover:border-slate-600 bg-sidebar"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Thumbnail & Frame Telemetry */}
                  <div className="flex items-start gap-3.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.annotation_id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelect(item.annotation_id);
                      }}
                      className="mt-1.5 rounded border-border text-brand-cyan focus:ring-0 cursor-pointer"
                    />

                    {/* Frame Visual Badge */}
                    <div className="w-24 h-16 rounded-lg bg-black border border-border flex flex-col items-center justify-center relative overflow-hidden shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-200">Frame {item.frame_idx}</span>
                      <span className="text-[10px] font-mono text-slate-400 mt-0.5">{item.timestamp_seconds}s</span>
                      <div
                        className="absolute bottom-0 left-0 right-0 h-1"
                        style={{ backgroundColor: item.color }}
                      />
                    </div>

                    {/* Metadata & Instrument Title */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <h4 className="text-sm font-semibold text-slate-100">{item.label}</h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-elevated text-slate-400 border border-border">
                          Track #{item.track_id}
                        </span>

                        {/* Priority Badge */}
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            isHigh
                              ? "bg-red-500/15 text-red-300 border-red-500/30"
                              : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          }`}
                        >
                          {item.priority_tier.toUpperCase()} PRIORITY ({Math.round(item.overall_review_priority * 100)}%)
                        </span>

                        {isApproved && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        )}
                      </div>

                      {/* Explainable Anomaly Reasons */}
                      <div className="mt-2 space-y-1">
                        {item.reasons.map((reason, rIdx) => (
                          <div key={rIdx} className="flex items-center gap-1.5 text-xs text-slate-300">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: Uncertainty Multi-Signal Breakdown & Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:pl-4 lg:border-l lg:border-border">
                    {/* Anomaly Mini-Bars */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400 min-w-[200px]">
                      <div>
                        <div className="flex justify-between">
                          <span>Temporal:</span>
                          <span className="text-slate-200">
                            {Math.round((item.temporal_instability ?? 0.45) * 100)}%
                          </span>
                        </div>
                        <div className="w-full h-1 bg-elevated rounded-full overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${Math.round((item.temporal_instability ?? 0.45) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <span>Continuity:</span>
                          <span className="text-slate-200">
                            {Math.round((item.tracking_inconsistency ?? 0.3) * 100)}%
                          </span>
                        </div>
                        <div className="w-full h-1 bg-elevated rounded-full overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-red-400 rounded-full"
                            style={{ width: `${Math.round((item.tracking_inconsistency ?? 0.3) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInspectInWorkspace(item);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-slate-700 border border-border text-xs font-medium text-slate-200 flex items-center gap-1.5 transition"
                        title="Open annotation workspace at this exact frame (Enter / C)"
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-brand-cyan" />
                        <span>Inspect</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          submitReviewAction(item.annotation_id, "approved");
                        }}
                        className={`p-1.5 rounded-lg border text-xs transition ${
                          item.review_status === "approved"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                            : "bg-elevated hover:bg-emerald-950/40 border-border text-slate-300 hover:text-emerald-300 hover:border-emerald-500/30"
                        }`}
                        title="Approve annotation (Press A)"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          submitReviewAction(item.annotation_id, "rejected");
                        }}
                        className={`p-1.5 rounded-lg border text-xs transition ${
                          item.review_status === "rejected"
                            ? "bg-red-500/20 text-red-300 border-red-500/50"
                            : "bg-elevated hover:bg-red-950/40 border-border text-slate-300 hover:text-red-300 hover:border-red-500/30"
                        }`}
                        title="Reject annotation (Press R)"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Sticky Keyboard Shortcuts Bar */}
      <div className="border-t border-border bg-sidebar px-6 py-2.5 flex items-center justify-between text-xs font-mono text-slate-400 shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-elevated border border-border text-slate-300 font-bold">A</kbd>{" "}
            Approve
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-elevated border border-border text-slate-300 font-bold">R</kbd>{" "}
            Reject
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-elevated border border-border text-slate-300 font-bold">C / Enter</kbd>{" "}
            Inspect & Correct
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-elevated border border-border text-slate-300 font-bold">J / K</kbd>{" "}
            Navigate Queue
          </span>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span>Multi-signal review priority derived from detector confidence, temporal ΔArea, and centroid motion.</span>
        </div>
      </div>
    </div>
  );
}
