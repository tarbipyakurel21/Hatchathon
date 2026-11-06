"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  FolderKanban,
  Film,
  BarChart3,
  Video,
  Search,
  Sparkles,
  Layers,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useSurgiLabelStore } from "@/stores/useSurgiLabelStore";

export const SurgiNav: React.FC = () => {
  const pathname = usePathname();
  const { currentVideoId, projects } = useSurgiLabelStore();

  const activeVideoId = currentVideoId || "demo_laparoscopy_cholecystectomy";

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Activity },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: `/annotate/${activeVideoId}`, label: "Workspace", icon: Video },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <header className="h-14 bg-sidebar border-b border-border px-4 flex items-center justify-between select-none z-40 shrink-0">
      {/* Brand & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center text-brand-cyan group-hover:border-brand-cyan/50 transition">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-slate-100 tracking-tight">SurgiLabel</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30">
                Clinical AI
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono -mt-0.5">Surgical Video Platform</p>
          </div>
        </Link>

        <div className="h-4 w-[1px] bg-border mx-1 hidden sm:block" />

        {/* Primary Nav Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.label === "Workspace" && pathname.startsWith("/annotate"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                  isActive
                    ? "bg-elevated text-white border border-border shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-elevated/50"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-brand-cyan" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Quick Search */}
        <div className="hidden lg:flex items-center gap-2 bg-background/60 border border-border rounded-lg px-2.5 py-1 text-xs text-slate-400 font-mono">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <span>Quick search...</span>
          <kbd className="text-[10px] bg-elevated px-1 py-0.2 rounded border border-border text-slate-400">⌘K</kbd>
        </div>

        {/* User / Surgeon Profile */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-border">
          <div className="w-7 h-7 rounded-full bg-elevated border border-border flex items-center justify-center text-xs font-semibold text-brand-cyan">
            AR
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-medium text-slate-200 leading-none">Dr. A. Ross, FACS</p>
            <p className="text-[10px] text-slate-400 font-mono leading-none mt-1">Attending Surgeon</p>
          </div>
        </div>
      </div>
    </header>
  );
};
