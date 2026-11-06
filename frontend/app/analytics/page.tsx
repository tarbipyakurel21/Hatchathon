"use client";

import React from "react";
import Link from "next/link";
import {
  BarChart3,
  PieChart as PieIcon,
  Activity,
  Layers,
  CheckCircle2,
  Clock,
  Video,
  Download,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { SurgiNav } from "@/components/surgilabel/SurgiNav";
import { useSurgiLabelStore } from "@/stores/useSurgiLabelStore";

export default function AnalyticsPage() {
  const { projects, annotations } = useSurgiLabelStore();

  // 1. Calculate Class Distribution from stored annotations
  const classCountMap: Record<string, { name: string; count: number; color: string }> = {};
  annotations.forEach((a) => {
    if (!classCountMap[a.label]) {
      classCountMap[a.label] = { name: a.label, count: 0, color: a.color || "#22D3EE" };
    }
    classCountMap[a.label].count += 1;
  });
  const classDistribution = Object.values(classCountMap);

  // 2. Manual vs AI-Assisted ratio
  const manualCount = annotations.filter((a) => a.source === "manual").length;
  const aiCount = annotations.filter((a) => a.source === "ai").length;
  const sourceData = [
    { name: "Manual Ground Truth", value: manualCount, color: "#3B82F6" },
    { name: "AI Inferred (SAM 2)", value: aiCount, color: "#22D3EE" },
  ];

  // 3. Review Status Breakdown
  const approvedCount = annotations.filter((a) => a.review_status === "approved").length;
  const unreviewedCount = annotations.filter((a) => a.review_status === "unreviewed").length;
  const rejectedCount = annotations.filter((a) => a.review_status === "rejected").length;
  const reviewData = [
    { status: "Approved", count: approvedCount, color: "#10B981" },
    { status: "Pending QA", count: unreviewedCount, color: "#F59E0B" },
    { status: "Rejected", count: rejectedCount, color: "#EF4444" },
  ];

  // Total unique frames
  const uniqueFrames = new Set(annotations.map((a) => a.frame_idx)).size;

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col font-sans">
      <SurgiNav />

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Dataset Analytics & Metrics
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Derived metrics from {annotations.length} stored surgical annotations
            </p>
          </div>

          <Link
            href="/annotate/demo_laparoscopy_cholecystectomy"
            className="px-3.5 py-2 rounded-lg bg-white text-slate-950 hover:bg-slate-200 active:scale-98 font-semibold text-xs flex items-center gap-2 shadow-sm transition"
          >
            <span>Open Workspace</span>
          </Link>
        </div>

        {/* Top 4 KPI Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface border border-border p-4 rounded-xl">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Total Annotations
            </span>
            <div className="text-2xl font-bold text-white mt-1">{annotations.length}</div>
            <p className="text-[10px] text-brand-cyan font-mono mt-0.5">Instances tracked</p>
          </div>

          <div className="bg-surface border border-border p-4 rounded-xl">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Annotated Frames
            </span>
            <div className="text-2xl font-bold text-white mt-1">{uniqueFrames}</div>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Across clinical clips</p>
          </div>

          <div className="bg-surface border border-border p-4 rounded-xl">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Approval Rate
            </span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {annotations.length > 0 ? Math.round((approvedCount / annotations.length) * 100) : 0}%
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{approvedCount} approved by surgeon</p>
          </div>

          <div className="bg-surface border border-border p-4 rounded-xl">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              AI Acceleration
            </span>
            <div className="text-2xl font-bold text-brand-cyan mt-1">
              {annotations.length > 0 ? Math.round((aiCount / annotations.length) * 100) : 0}%
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Propagated via SAM 2</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Class Distribution */}
          <div className="bg-surface border border-border p-5 rounded-xl shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-white">Annotation Distribution by Surgical Class</h3>
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classDistribution} layout="vertical">
                  <XAxis type="number" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#64748B" fontSize={11} tickLine={false} width={110} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      borderColor: "#1E293B",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {classDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Source & Quality Breakdown */}
          <div className="bg-surface border border-border p-5 rounded-xl shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-white">Manual vs. AI-Assisted Annotations</h3>
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      borderColor: "#1E293B",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Review QA Status Progress */}
        <div className="bg-surface border border-border p-5 rounded-xl shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-white">Clinical Review & Verification Funnel</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reviewData.map((item) => (
              <div key={item.status} className="bg-elevated/60 border border-border p-3.5 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">{item.status}</span>
                  <span className="text-lg font-bold font-mono" style={{ color: item.color }}>
                    {item.count}
                  </span>
                </div>
                <div className="w-full h-1 bg-background rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: item.color,
                      width: `${(item.count / (annotations.length || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
