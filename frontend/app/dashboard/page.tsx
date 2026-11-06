"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Video,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  TrendingUp,
  Layers,
  Activity,
  FileCheck,
  ChevronRight,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

import { SurgiNav } from "@/components/surgilabel/SurgiNav";
import { NewProjectModal } from "@/components/surgilabel/NewProjectModal";
import { useSurgiLabelStore } from "@/stores/useSurgiLabelStore";
import { DEMO_ACTIVITIES } from "@/lib/surgiLabelDemoData";

const ACTIVITY_DATA = [
  { day: "Mon", manual: 45, ai: 120, reviewed: 140 },
  { day: "Tue", manual: 55, ai: 180, reviewed: 210 },
  { day: "Wed", manual: 60, ai: 240, reviewed: 270 },
  { day: "Thu", manual: 85, ai: 310, reviewed: 350 },
  { day: "Fri", manual: 70, ai: 290, reviewed: 320 },
  { day: "Sat", manual: 40, ai: 160, reviewed: 190 },
  { day: "Sun", manual: 95, ai: 380, reviewed: 440 },
];

export default function DashboardPage() {
  const { projects, annotations, reviewQueue } = useSurgiLabelStore();
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);

  // Compute live KPI metrics
  const totalProjects = projects.length;
  const totalVideos = projects.reduce((acc, p) => acc + p.videos.length, 0);
  const totalAnnotatedFrames = annotations.length > 0 ? new Set(annotations.map((a) => a.frame_idx)).size : 120;
  const pendingReviews = annotations.filter((a) => a.review_status === "unreviewed").length;

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col font-sans">
      <SurgiNav />

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              BioLabel AI — Biomedical Data Studio
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Annotate Less. Review Smarter. • CVAT Video Architecture + SAM 2 Tracking & Smart Review
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsNewProjectOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-white text-slate-950 hover:bg-slate-200 active:scale-98 font-semibold text-xs flex items-center gap-2 shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Projects */}
          <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Total Projects</span>
              <FolderKanban className="w-4 h-4 text-brand-cyan" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{totalProjects}</div>
              <div className="text-[11px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>3 active surgical protocols</span>
              </div>
            </div>
          </div>

          {/* 2. Videos Uploaded */}
          <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Videos Uploaded</span>
              <Video className="w-4 h-4 text-brand-blue" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{totalVideos}</div>
              <div className="text-[11px] text-slate-400 font-mono mt-1">
                695 total clinical frames
              </div>
            </div>
          </div>

          {/* 3. Annotated Frames */}
          <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Annotated Frames</span>
              <CheckCircle2 className="w-4 h-4 text-brand-green" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{totalAnnotatedFrames}</div>
              <div className="text-[11px] text-emerald-400 font-mono mt-1">
                480 instance masks tracked
              </div>
            </div>
          </div>

          {/* 4. Pending Reviews */}
          <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Pending Reviews</span>
              <Clock className="w-4 h-4 text-brand-amber" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{pendingReviews}</div>
              <div className="text-[11px] text-amber-400/90 font-mono mt-1">
                Awaiting surgical QA sign-off
              </div>
            </div>
          </div>
        </div>

        {/* Flagship Callout: Uncertainty-Aware Review Queue */}
        <div className="bg-gradient-to-r from-amber-500/10 via-elevated to-elevated border border-amber-500/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-100">Smart Review — Uncertainty Queue</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                  {reviewQueue.filter((i) => i.priority_tier === "high").length} High Priority
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Heuristic scoring has flagged candidate frames with sudden area fluctuations or tracking discontinuities for human inspection.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/review"
              className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition shadow-sm"
            >
              <span>Open Smart Review ({reviewQueue.filter((i) => i.review_status === "unreviewed" || i.review_status === "pending_review").length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Middle Section: Annotation Activity Chart + Recent Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Chart */}
          <div className="lg:col-span-2 bg-surface border border-border p-5 rounded-xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Annotation Velocity & QA</h3>
                <p className="text-xs text-slate-400">Weekly frames annotated vs. reviewed by surgeons</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-brand-cyan">
                  <span className="w-2 h-2 rounded-full bg-brand-cyan" />
                  AI Tracking
                </span>
                <span className="flex items-center gap-1.5 text-brand-green">
                  <span className="w-2 h-2 rounded-full bg-brand-green" />
                  Reviewed
                </span>
              </div>
            </div>

            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ACTIVITY_DATA}>
                  <defs>
                    <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22D3EE" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      borderColor: "#1E293B",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area type="monotone" dataKey="ai" stroke="#22D3EE" fill="url(#aiGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="reviewed" stroke="#10B981" fill="url(#revGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Clinical Activity Feed */}
          <div className="bg-surface border border-border p-5 rounded-xl shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-white">Recent Procedural Activity</h3>
            <div className="space-y-3">
              {DEMO_ACTIVITIES.map((act) => (
                <div key={act.id} className="flex items-start gap-2.5 text-xs">
                  <div className="w-6 h-6 rounded-full bg-elevated border border-border flex items-center justify-center text-[10px] font-bold text-brand-cyan shrink-0 mt-0.5">
                    {act.user_name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-200">
                      <span className="font-medium text-white">{act.user_name}</span>{" "}
                      <span className="text-slate-400">{act.action}</span>{" "}
                      <span className="text-brand-cyan font-mono text-[11px]">{act.target}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{act.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Section: Recent Projects Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Active Projects</h3>
            <Link
              href="/projects"
              className="text-xs text-brand-cyan hover:underline flex items-center gap-1 font-mono"
            >
              View all ({projects.length})
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {projects.map((proj) => {
              const mainVideo = proj.videos[0];

              return (
                <Link
                  key={proj.id}
                  href={`/projects/${proj.id}`}
                  className="group bg-surface border border-border hover:border-slate-700 p-4 rounded-xl shadow-sm transition flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-elevated border border-border text-slate-300 uppercase">
                        {proj.status.replace("_", " ")}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {proj.videos.length} {proj.videos.length === 1 ? "video" : "videos"}
                      </span>
                    </div>

                    <h4 className="font-semibold text-sm text-slate-100 group-hover:text-brand-cyan transition">
                      {proj.name}
                    </h4>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {proj.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/60 space-y-2">
                    <div className="flex justify-between text-[11px] font-mono text-slate-400">
                      <span>Progress</span>
                      <span className="text-slate-200 font-bold">{proj.annotation_progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-cyan rounded-full transition-all"
                        style={{ width: `${proj.annotation_progress}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>

      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
      />
    </div>
  );
}
