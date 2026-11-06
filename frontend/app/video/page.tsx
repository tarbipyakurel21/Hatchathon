"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  VideoItem,
  VideoTrack,
  VideoFrameAnnotation,
  SurgicalCategory,
} from "@/lib/videoTypes";
import {
  fetchVideos,
  fetchVideoDetails,
  uploadVideoFile,
  deleteVideoFile,
  fetchVideoTracks,
  saveVideoTracks,
  deleteVideoTrack,
  runTrackPrompt,
  runAutoTrack,
  loadDemoSurgicalVideo,
} from "@/lib/videoApi";

import { StudioSwitcher } from "@/components/layout/StudioSwitcher";
import { VideoSidebar } from "@/components/video/VideoSidebar";
import { VideoWorkspace } from "@/components/video/VideoWorkspace";
import { VideoTrackPanel } from "@/components/video/VideoTrackPanel";
import { VideoExportModal } from "@/components/video/VideoExportModal";

import {
  Film,
  Download,
  Save,
  CheckCircle2,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";

export default function MedDataStudioPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);

  // Tracks & Frame annotations state
  const [tracks, setTracks] = useState<VideoTrack[]>([]);
  const [annotations, setAnnotations] = useState<VideoFrameAnnotation[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [currentFrame, setCurrentFrame] = useState<number>(0);

  // Tool state
  const [activeTool, setActiveTool] = useState<"select" | "point" | "box">("point");
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("Ready");

  const [lastTelemetry, setLastTelemetry] = useState<{
    model: string;
    inference_time_ms: number;
    fps_speed: number;
    tracked_frames_count: number;
  } | null>(null);

  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // 1. Initial Load: Fetch videos or initialize demo surgical video
  useEffect(() => {
    async function init() {
      try {
        const vids = await fetchVideos();
        if (vids && vids.length > 0) {
          setVideos(vids);
          setSelectedVideoId(vids[0].id);
        } else {
          // Initialize demo surgical video automatically
          setIsLoadingDemo(true);
          const demoRes = await loadDemoSurgicalVideo();
          setVideos([demoRes.video]);
          setSelectedVideoId(demoRes.video.id);
        }
      } catch (err) {
        console.error("Failed to load videos:", err);
      } finally {
        setIsLoadingDemo(false);
      }
    }
    init();
  }, []);

  // 2. Load selected video details and tracks
  useEffect(() => {
    if (!selectedVideoId) {
      setCurrentVideo(null);
      setTracks([]);
      setAnnotations([]);
      return;
    }

    async function loadData() {
      try {
        const [vidDetails, tracksData] = await Promise.all([
          fetchVideoDetails(selectedVideoId!),
          fetchVideoTracks(selectedVideoId!),
        ]);
        setCurrentVideo(vidDetails);
        setTracks(tracksData.tracks || []);
        setAnnotations(tracksData.annotations || []);
        setSelectedTrackId(tracksData.tracks.length > 0 ? tracksData.tracks[0].track_id : null);
        setCurrentFrame(0);
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Failed to load video details/tracks:", err);
      }
    }
    loadData();
  }, [selectedVideoId]);

  // Upload Video File
  const handleUploadVideo = async (file: File) => {
    setIsUploading(true);
    setStatusMessage("Uploading surgical video...");
    try {
      const uploaded = await uploadVideoFile(file);
      setVideos((prev) => [uploaded, ...prev]);
      setSelectedVideoId(uploaded.id);
      setStatusMessage("Video uploaded successfully");
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
      setStatusMessage("Upload error");
    } finally {
      setIsUploading(false);
    }
  };

  // Delete Video File
  const handleDeleteVideo = async (vidId: string) => {
    try {
      await deleteVideoFile(vidId);
      setVideos((prev) => prev.filter((v) => v.id !== vidId));
      if (selectedVideoId === vidId) {
        const remaining = videos.filter((v) => v.id !== vidId);
        setSelectedVideoId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Trigger Demo Surgical Video
  const handleTriggerDemo = async () => {
    setIsLoadingDemo(true);
    setStatusMessage("Synthesizing surgical demo video...");
    try {
      const demoRes = await loadDemoSurgicalVideo();
      setVideos((prev) => {
        const exists = prev.find((v) => v.id === demoRes.video.id);
        return exists ? prev : [demoRes.video, ...prev];
      });
      setSelectedVideoId(demoRes.video.id);
      setStatusMessage("Surgical demo ready with pre-tracked instruments");
    } catch (err: any) {
      alert(`Demo load failed: ${err.message}`);
    } finally {
      setIsLoadingDemo(false);
    }
  };

  // SAM 2 Prompt Tracking Execution
  const handlePrompt = async (
    keyframeIdx: number,
    promptType: "point" | "box",
    promptData: [number, number] | [number, number, number, number]
  ) => {
    if (!selectedVideoId || isTracking) return;
    setIsTracking(true);
    setStatusMessage("SAM 2 Tiny tracking object across video frames...");

    try {
      const res = await runTrackPrompt(selectedVideoId, {
        keyframe_idx: keyframeIdx,
        prompt_type: promptType,
        prompt_data: promptData,
        track_id: selectedTrackId || undefined,
        category: "instrument",
      });

      // Update tracks
      setTracks((prev) => {
        const exists = prev.find((t) => t.track_id === res.track.track_id);
        return exists
          ? prev.map((t) => (t.track_id === res.track.track_id ? res.track : t))
          : [...prev, res.track];
      });

      // Update annotations
      setAnnotations((prev) => {
        const other = prev.filter((a) => a.track_id !== res.track.track_id);
        return [...other, ...res.annotations];
      });

      setSelectedTrackId(res.track.track_id);
      setLastTelemetry({
        model: res.model,
        inference_time_ms: res.inference_time_ms,
        fps_speed: res.fps_speed,
        tracked_frames_count: res.tracked_frames_count,
      });
      setStatusMessage(`Tracked ${res.tracked_frames_count} frames at ${res.fps_speed} FPS`);
    } catch (err: any) {
      alert(`Tracking prompt error: ${err.message}`);
      setStatusMessage("Tracking error");
    } finally {
      setIsTracking(false);
    }
  };

  // Auto-Track All Objects
  const handleAutoTrack = async () => {
    if (!selectedVideoId || isTracking) return;
    setIsTracking(true);
    setStatusMessage("Running zero-shot SAM 2 Tiny auto-tracking...");

    try {
      const res = await runAutoTrack(selectedVideoId);
      const tracksData = await fetchVideoTracks(selectedVideoId);
      setTracks(tracksData.tracks || []);
      setAnnotations(tracksData.annotations || []);
      if (tracksData.tracks.length > 0) {
        setSelectedTrackId(tracksData.tracks[0].track_id);
      }
      setLastTelemetry({
        model: res.model,
        inference_time_ms: res.inference_time_ms,
        fps_speed: Math.round(res.total_masks / Math.max(0.1, res.inference_time_ms / 1000)),
        tracked_frames_count: res.total_masks,
      });
      setStatusMessage(`Auto-tracked ${res.track_count} objects (${res.total_masks} total masks)`);
    } catch (err: any) {
      alert(`Auto-track error: ${err.message}`);
      setStatusMessage("Auto-track error");
    } finally {
      setIsTracking(false);
    }
  };

  // Save Tracks & Frame Annotations
  const handleSaveTracks = async () => {
    if (!selectedVideoId) return;
    setIsSaving(true);
    try {
      await saveVideoTracks(selectedVideoId, tracks, annotations);
      setHasUnsavedChanges(false);
      setStatusMessage("Tracks saved");
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Update a single track
  const handleUpdateTrack = (updated: VideoTrack) => {
    setTracks((prev) => prev.map((t) => (t.track_id === updated.track_id ? updated : t)));
    setHasUnsavedChanges(true);
  };

  // Delete a track
  const handleDeleteTrack = async (trackId: number) => {
    if (!selectedVideoId) return;
    try {
      await deleteVideoTrack(selectedVideoId, trackId);
      setTracks((prev) => prev.filter((t) => t.track_id !== trackId));
      setAnnotations((prev) => prev.filter((a) => a.track_id !== trackId));
      if (selectedTrackId === trackId) {
        setSelectedTrackId(null);
      }
      setStatusMessage("Track deleted");
    } catch (err: any) {
      alert(`Delete track failed: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070b13] text-slate-100 font-sans antialiased">
      {/* 1. MedData Studio Top Navigation Header */}
      <header className="h-14 border-b border-[#1e293b] bg-[#0d131f]/95 backdrop-blur-md px-4 flex items-center justify-between select-none z-10">
        {/* Left: Studio Switcher & Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-sm tracking-wide text-white">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-violet to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Film className="w-4 h-4 text-white" />
            </div>
            <span className="hidden sm:inline bg-gradient-to-r from-white via-slate-200 to-purple-300 bg-clip-text text-transparent">
              MedData Studio
            </span>
          </div>

          {/* Unified Studio Switcher Pill */}
          <StudioSwitcher currentStudio="meddata" />
        </div>

        {/* Center: Active Video Telemetry */}
        {currentVideo && (
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400 bg-[#070b13] px-3 py-1 rounded-full border border-slate-800">
            <span className="text-white font-semibold truncate max-w-[200px]">
              {currentVideo.filename}
            </span>
            <span className="text-slate-600">•</span>
            <span>
              {currentVideo.width}×{currentVideo.height} @ {currentVideo.fps} FPS
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-purple-400 font-bold">{tracks.length} tracks</span>
          </div>
        )}

        {/* Right: Actions (Save & Export Dataset) */}
        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className="hidden xl:flex items-center gap-1.5 text-xs font-mono">
            {isTracking ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                {statusMessage}
              </span>
            ) : hasUnsavedChanges ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Unsaved changes
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                Saved
              </span>
            )}
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveTracks}
            disabled={isSaving || !currentVideo}
            title="Save Tracks"
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition disabled:opacity-40"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-cyan-400" />}
            <span className="hidden sm:inline">Save</span>
          </button>

          {/* Export Video Dataset Button */}
          <button
            onClick={() => setIsExportOpen(true)}
            disabled={!currentVideo}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-500 to-brand-cyan text-slate-950 hover:brightness-110 shadow-lg shadow-purple-500/20 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Export Dataset</span>
          </button>
        </div>
      </header>

      {/* 2. Main Studio Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Video Library & Upload */}
        <VideoSidebar
          videos={videos}
          selectedVideoId={selectedVideoId}
          onSelectVideo={setSelectedVideoId}
          onUploadVideo={handleUploadVideo}
          onTriggerDemo={handleTriggerDemo}
          onDeleteVideo={handleDeleteVideo}
          isUploading={isUploading}
          isLoadingDemo={isLoadingDemo}
        />

        {/* Center Panel: Video Scrubber, Overlay Canvas & 3D Three.js view */}
        <VideoWorkspace
          video={currentVideo}
          tracks={tracks}
          annotations={annotations}
          currentFrame={currentFrame}
          setCurrentFrame={setCurrentFrame}
          onPrompt={handlePrompt}
          isTracking={isTracking}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          selectedTrackId={selectedTrackId}
          onSelectTrack={setSelectedTrackId}
        />

        {/* Right Panel: SAM 2 Tiny Tracker & Taxonomy Inspector */}
        <VideoTrackPanel
          tracks={tracks}
          annotations={annotations}
          selectedTrackId={selectedTrackId}
          onSelectTrack={setSelectedTrackId}
          onUpdateTrack={handleUpdateTrack}
          onDeleteTrack={handleDeleteTrack}
          onAutoTrack={handleAutoTrack}
          isTracking={isTracking}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          lastTelemetry={lastTelemetry}
        />
      </div>

      {/* 3. Export Modal */}
      {currentVideo && (
        <VideoExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          video={currentVideo}
          trackCount={tracks.length}
          maskCount={annotations.length}
        />
      )}
    </div>
  );
}
