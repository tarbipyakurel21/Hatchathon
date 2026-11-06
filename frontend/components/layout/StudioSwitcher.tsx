"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Microscope, Film } from "lucide-react";

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
    <div className="inline-flex items-center bg-zinc-900/90 p-0.5 rounded-md border border-zinc-800 text-xs font-medium select-none">
      {/* BioLabel: Images Mode */}
      <button
        onClick={() => handleSelect("biolabel")}
        className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-all duration-150 ${
          !isMedData
            ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60 font-semibold"
            : "text-zinc-400 hover:text-zinc-200 border border-transparent"
        }`}
      >
        <Microscope className="w-3.5 h-3.5 text-zinc-300" />
        <span>Images (BioLabel)</span>
      </button>

      {/* MedData Studio: Video / SAM 2 Mode */}
      <button
        onClick={() => handleSelect("meddata")}
        className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-all duration-150 ${
          isMedData
            ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60 font-semibold"
            : "text-zinc-400 hover:text-zinc-200 border border-transparent"
        }`}
      >
        <Film className="w-3.5 h-3.5 text-zinc-300" />
        <span>Video & SAM 2 (CVAT)</span>
      </button>
    </div>
  );
};
