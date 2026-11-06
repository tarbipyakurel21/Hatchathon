"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Microscope, Film, Sparkles } from "lucide-react";

interface StudioSwitcherProps {
  currentStudio?: "biolabel" | "meddata";
  onStudioChange?: (studio: "biolabel" | "meddata") => void;
}

export const StudioSwitcher: React.FC<StudioSwitcherProps> = ({
  currentStudio,
  onStudioChange,
}) => {
  const router = useRouter();
  const pathname = usePathname();

  const isMedData = currentStudio ? currentStudio === "meddata" : pathname.startsWith("/video");

  const handleSelect = (mode: "biolabel" | "meddata") => {
    if (onStudioChange) {
      onStudioChange(mode);
    } else {
      if (mode === "meddata") {
        router.push("/video");
      } else {
        router.push("/");
      }
    }
  };

  return (
    <div className="flex items-center bg-[#070b13] p-1 rounded-xl border border-slate-800 shadow-inner">
      {/* BioLabel: Microscopy Images */}
      <button
        onClick={() => handleSelect("biolabel")}
        className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all duration-150 ${
          !isMedData
            ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
        }`}
      >
        <Microscope className="w-3.5 h-3.5 text-brand-cyan" />
        <span className="hidden sm:inline">BioLabel</span>
        <span className="text-[10px] text-slate-500 font-mono hidden md:inline">Microscopy</span>
      </button>

      {/* MedData Studio: Surgical Videos & SAM 2 */}
      <button
        onClick={() => handleSelect("meddata")}
        className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all duration-150 ${
          isMedData
            ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
        }`}
      >
        <Film className="w-3.5 h-3.5 text-purple-400" />
        <span className="hidden sm:inline">MedData Studio</span>
        <span className="text-[10px] text-slate-500 font-mono hidden md:inline">Video & SAM 2</span>
      </button>
    </div>
  );
};
