"use client";

import React, { useState } from "react";
import { X, FolderPlus, Check, Sparkles } from "lucide-react";
import { useSurgiLabelStore } from "@/stores/useSurgiLabelStore";
import { DEFAULT_SURGICAL_CLASSES, AnnotationClass } from "@/lib/surgiLabelTypes";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { addProject } = useSurgiLabelStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    DEFAULT_SURGICAL_CLASSES.map((c) => c.id)
  );

  if (!isOpen) return null;

  const toggleClass = (classId: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const chosenClasses: AnnotationClass[] = DEFAULT_SURGICAL_CLASSES.filter((c) =>
      selectedClasses.includes(c.id)
    );

    const newProj = addProject({
      name: name.trim(),
      description: description.trim() || "Surgical instrument and anatomical boundary annotation dataset.",
      status: "in_progress",
      classes: chosenClasses,
      videos: [],
      annotated_frames_count: 0,
      total_frames_count: 0,
      annotation_progress: 0,
    });

    onClose();
    if (onCreated) {
      onCreated(newProj.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center text-brand-cyan">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Create New Annotation Project</h2>
              <p className="text-xs text-slate-400">Configure dataset taxonomy and surgical protocol</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-elevated transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreate} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Project Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Laparoscopic Appendectomy Dataset"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-cyan transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Clinical Description</label>
            <textarea
              rows={3}
              placeholder="Detail surgical objectives, instruments involved, and procedural milestones..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-background border border-border rounded-lg p-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-cyan transition"
            />
          </div>

          {/* Classes Checklist */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Default Instrument & Anatomy Classes ({selectedClasses.length} selected)
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 bg-background/50 rounded-lg border border-border">
              {DEFAULT_SURGICAL_CLASSES.map((cls) => {
                const isChecked = selectedClasses.includes(cls.id);
                return (
                  <button
                    type="button"
                    key={cls.id}
                    onClick={() => toggleClass(cls.id)}
                    className={`flex items-center gap-2 p-2 rounded-md border text-left transition ${
                      isChecked
                        ? "bg-elevated border-border text-slate-100 font-medium"
                        : "bg-transparent border-transparent text-slate-500 hover:bg-elevated/40"
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                        isChecked
                          ? "bg-brand-cyan text-slate-950 border-brand-cyan"
                          : "border-slate-700 bg-background"
                      }`}
                    >
                      {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cls.color }} />
                    <span className="truncate">{cls.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 rounded-lg bg-white text-slate-950 hover:bg-slate-200 active:scale-98 font-semibold shadow-sm transition disabled:opacity-50"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
