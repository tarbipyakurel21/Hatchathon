"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  FolderKanban,
  Video,
  UploadCloud,
  Download,
  Film,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Layers,
  Trash2,
  ExternalLink,
  Users,
  Tag,
  Sparkles,
} from "lucide-react";

import { SurgiNav } from "@/components/surgilabel/SurgiNav";
import { VideoUploadModal } from "@/components/surgilabel/VideoUploadModal";
import { SurgiExportModal } from "@/components/surgilabel/SurgiExportModal";
import { useSurgiLabelStore } from "@/stores/useSurgiLabelStore";

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = (params?.id as string) || "proj_cholecystectomy";

  const { projects, setCurrentVideo, deleteVideo } = useSurgiLabelStore();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const project = projects.find((p) => p.id === projectId) || projects[0];

  if (!project) {
    return (
      <div className="min-h-screen bg-background text-slate-100 flex flex-col">
        <SurgiNav />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-slate-400 mb-4">Project not found.</p>
          <Link href="/projects" className="text-brand-cyan hover:underline text-xs font-mono">
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  const handleOpenWorkspace = (videoId: string) => {
    setCurrentVideo(videoId);
    router.push(`/annotate/${videoId}`);
  };

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col font-sans">
      <SurgiNav />

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Back Link & Header */}
        <div className="space-y-3">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition font-mono"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Projects</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  {project.name}
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-elevated border border-border text-slate-300 uppercase">
                  {project.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
                {project.description}
              </p>
            </div>

            {/* Actions: Upload Video & Export */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsExportOpen(true)}
                className="px-3 py-2 rounded-lg bg-elevated hover:bg-surface border border-border text-xs font-medium text-slate-200 flex items-center gap-2 transition"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Export Dataset</span>
              </button>

              <button
                onClick={() => setIsUploadOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-white text-slate-950 hover:bg-slate-200 active:scale-98 font-semibold text-xs flex items-center gap-2 shadow-sm transition"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Video</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dataset Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-border p-4 rounded-xl">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Total Videos
            </span>
            <div className="text-xl font-bold text-white mt-1">{project.videos.length}</div>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Clinical footage files</p>
          </div>

          <div className="bg-surface border border-border p-4 rounded-xl">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Annotated Frames
            </span>
            <div className="text-xl font-bold text-white mt-1">{project.annotated_frames_count}</div>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Across all tracks</p>
          </div>

          <div className="bg-surface border border-border p-4 rounded-xl">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Label Classes
            </span>
            <div className="text-xl font-bold text-white mt-1">{project.classes.length}</div>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Surgical taxonomy</p>
          </div>

          <div className="bg-surface border border-border p-4 rounded-xl">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Completion
            </span>
            <div className="text-xl font-bold text-brand-cyan mt-1">{project.annotation_progress}%</div>
            <div className="w-full h-1 bg-background rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-brand-cyan rounded-full"
                style={{ width: `${project.annotation_progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Main Content: Videos Table + Sidebar Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Videos Table */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Surgical Videos ({project.videos.length})</h3>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="text-xs text-brand-cyan hover:underline flex items-center gap-1 font-mono"
              >
                <Plus className="w-3 h-3" />
                Add Video
              </button>
            </div>

            {project.videos.length === 0 ? (
              <div className="bg-surface border border-dashed border-border rounded-xl p-8 text-center space-y-2">
                <Film className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-300 font-medium">No videos uploaded to this project yet.</p>
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-white text-slate-950 font-semibold text-xs"
                >
                  Upload First Video
                </button>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-xl overflow-hidden divide-y divide-border">
                {project.videos.map((vid) => (
                  <div
                    key={vid.id}
                    className="p-4 flex items-center justify-between hover:bg-elevated/40 transition gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Video Thumbnail */}
                      <div className="w-20 h-14 bg-black rounded-lg border border-border overflow-hidden shrink-0 relative flex items-center justify-center">
                        {vid.thumbnail_url ? (
                          <img
                            src={vid.thumbnail_url}
                            alt={vid.filename}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Film className="w-5 h-5 text-slate-600" />
                        )}
                        <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-black/80 text-[8px] font-mono text-slate-300 rounded">
                          {vid.duration_seconds}s
                        </span>
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-xs text-slate-100 truncate">{vid.filename}</h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {vid.width}×{vid.height} • {vid.fps} FPS • {vid.total_frames} frames
                        </p>
                        <span className="inline-block mt-1 text-[9.5px] px-1.5 py-0.2 rounded bg-elevated text-slate-300 border border-border font-mono uppercase">
                          {vid.status}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleOpenWorkspace(vid.id)}
                        className="px-3 py-1.5 rounded-md bg-white text-slate-950 hover:bg-slate-200 active:scale-98 font-semibold text-xs flex items-center gap-1.5 shadow-sm transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Annotate</span>
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Delete video '${vid.filename}' from this project?`)) {
                            deleteVideo(vid.id);
                          }
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition"
                        title="Delete Video"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Col: Label Taxonomy & Team Members */}
          <div className="space-y-6">
            {/* Taxonomy */}
            <div className="bg-surface border border-border p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-brand-cyan" />
                  <span>Configured Taxonomy</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-500">{project.classes.length} classes</span>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {project.classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between p-2 rounded-md bg-elevated/60 border border-border text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                      <span className="text-slate-200 truncate">{cls.name}</span>
                    </div>
                    <span className="text-[9.5px] uppercase font-mono text-slate-500">{cls.category}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Members */}
            <div className="bg-surface border border-border p-4 rounded-xl space-y-3">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-blue" />
                <span>Clinical Annotation Team</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-elevated border border-border flex items-center justify-center text-[10px] font-bold text-brand-cyan">
                      AR
                    </div>
                    <div>
                      <p className="font-medium text-slate-200">Dr. Alexander Ross</p>
                      <p className="text-[10px] text-slate-500">Lead Surgeon & QA Reviewer</p>
                    </div>
                  </div>
                  <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-elevated border border-border flex items-center justify-center text-[10px] font-bold text-purple-400">
                      ER
                    </div>
                    <div>
                      <p className="font-medium text-slate-200">Elena Rostova</p>
                      <p className="text-[10px] text-slate-500">Computer Vision Specialist</p>
                    </div>
                  </div>
                  <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-elevated text-slate-400 border border-border">
                    Editor
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <VideoUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        projectId={project.id}
      />

      <SurgiExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
}
