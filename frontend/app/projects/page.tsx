"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Plus,
  Search,
  LayoutGrid,
  List,
  Filter,
  Film,
  Video,
  Clock,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Layers,
} from "lucide-react";

import { SurgiNav } from "@/components/surgilabel/SurgiNav";
import { NewProjectModal } from "@/components/surgilabel/NewProjectModal";
import { useSurgiLabelStore } from "@/stores/useSurgiLabelStore";

export default function ProjectsPage() {
  const { projects } = useSurgiLabelStore();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col font-sans">
      <SurgiNav />

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Header & New Project CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Projects & Datasets
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Organize surgical procedures, label classes, and video cohorts
            </p>
          </div>

          <button
            onClick={() => setIsNewProjectOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-white text-slate-950 hover:bg-slate-200 active:scale-98 font-semibold text-xs flex items-center gap-2 shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>

        {/* Toolbar: Search, Filter, View Mode */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface border border-border p-3 rounded-xl">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search datasets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-cyan transition"
            />
          </div>

          {/* Filter & View Switcher */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-cyan transition font-mono"
            >
              <option value="all">All Statuses</option>
              <option value="in_progress">In Progress</option>
              <option value="review">In Review</option>
              <option value="completed">Completed</option>
            </select>

            <div className="flex items-center bg-background rounded-lg border border-border p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded transition ${
                  viewMode === "grid" ? "bg-elevated text-brand-cyan" : "text-slate-500 hover:text-slate-300"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded transition ${
                  viewMode === "list" ? "bg-elevated text-brand-cyan" : "text-slate-500 hover:text-slate-300"
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Project Cards (Grid View) */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((proj) => {
              const mainVideo = proj.videos[0];

              return (
                <Link
                  key={proj.id}
                  href={`/projects/${proj.id}`}
                  className="group bg-surface border border-border hover:border-slate-700 rounded-xl overflow-hidden shadow-sm transition flex flex-col justify-between"
                >
                  <div>
                    {/* Top Thumbnail Preview */}
                    <div className="h-36 bg-background relative flex items-center justify-center border-b border-border overflow-hidden">
                      {mainVideo?.thumbnail_url ? (
                        <img
                          src={mainVideo.thumbnail_url}
                          alt={proj.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-600">
                          <Film className="w-8 h-8 stroke-[1.5]" />
                          <span className="text-[10px] font-mono">Clinical Footage</span>
                        </div>
                      )}

                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-slate-300 border border-slate-800 uppercase">
                        {proj.status.replace("_", " ")}
                      </span>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 space-y-2">
                      <h3 className="font-semibold text-sm text-slate-100 group-hover:text-brand-cyan transition line-clamp-1">
                        {proj.name}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {proj.description}
                      </p>

                      {/* Class Badges */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {proj.classes.slice(0, 4).map((c) => (
                          <span
                            key={c.id}
                            className="text-[9.5px] px-1.5 py-0.2 rounded bg-elevated text-slate-300 border border-border font-mono flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.name}
                          </span>
                        ))}
                        {proj.classes.length > 4 && (
                          <span className="text-[9.5px] px-1 py-0.2 rounded text-slate-500 font-mono">
                            +{proj.classes.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Progress */}
                  <div className="p-4 pt-0">
                    <div className="pt-3 border-t border-border/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>{proj.videos.length} videos • {proj.annotated_frames_count} frames</span>
                      <span className="text-slate-200 font-bold">{proj.annotation_progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-background rounded-full overflow-hidden mt-1.5">
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
        ) : (
          /* List View */
          <div className="bg-surface border border-border rounded-xl overflow-hidden divide-y divide-border">
            {filteredProjects.map((proj) => (
              <Link
                key={proj.id}
                href={`/projects/${proj.id}`}
                className="p-4 flex items-center justify-between hover:bg-elevated/40 transition gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-slate-100 hover:text-brand-cyan transition truncate">
                      {proj.name}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-elevated border border-border text-slate-400 uppercase">
                      {proj.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{proj.description}</p>
                </div>

                <div className="flex items-center gap-6 shrink-0 font-mono text-xs text-slate-400">
                  <span>{proj.videos.length} videos</span>
                  <span>{proj.annotated_frames_count} frames</span>
                  <div className="w-24">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span>Progress</span>
                      <span className="text-slate-200">{proj.annotation_progress}%</span>
                    </div>
                    <div className="w-full h-1 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-cyan rounded-full"
                        style={{ width: `${proj.annotation_progress}%` }}
                      />
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
      />
    </div>
  );
}
