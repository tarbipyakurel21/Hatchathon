"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dataset,
  ImageItem,
  Annotation,
  ModelInfo,
  SegmentationResult,
  ToolType,
  ImageAdjustments,
  SplitViewConfig,
} from "@/lib/types";
import {
  fetchDatasets,
  fetchModels,
  fetchDatasetImages,
  fetchImageDetails,
  fetchAnnotations,
  updateAnnotations,
  uploadImages,
  deleteImage,
  segmentImage,
  segmentBox,
  clearAllAnnotations,
  loadDemoDataset,
  getImageUrl,
} from "@/lib/api";
import { getPaletteColor } from "@/lib/geometry";

import { TopToolbar } from "@/components/layout/TopToolbar";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightPanel } from "@/components/panels/RightPanel";
import { AnnotationCanvas } from "@/components/canvas/AnnotationCanvas";
import { AdjustmentsPanel } from "@/components/panels/AdjustmentsPanel";
import { ExportModal } from "@/components/panels/ExportModal";
import { BenchmarkModal } from "@/components/panels/BenchmarkModal";

export default function WorkspacePage() {
  // Global Data State
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<ImageItem | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("microscopy-watershed");

  // Annotation & Canvas State
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [maskOpacity, setMaskOpacity] = useState<number>(0.35);
  const [showAnnotations, setShowAnnotations] = useState<boolean>(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(false);
  const [showLabels, setShowLabels] = useState<boolean>(false);

  // Adobe / Scientific Visualization State
  const [adjustments, setAdjustments] = useState<ImageAdjustments>({
    brightness: 0,
    contrast: 0,
    exposure: 1.0,
    invert: false,
    lut: "original",
  });
  const [isAdjustmentsOpen, setIsAdjustmentsOpen] = useState<boolean>(false);
  const [splitView, setSplitView] = useState<SplitViewConfig>({
    enabled: false,
    position: 0.5,
  });

  // Model Parameter State
  const [sensitivity, setSensitivity] = useState<number>(0.4);
  const [minArea, setMinArea] = useState<number>(25);

  // History State for Undo / Redo
  const [past, setPast] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Status & Modal State
  const [isAnnotating, setIsAnnotating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>("Ready");
  const [lastResult, setLastResult] = useState<SegmentationResult | null>(null);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);

  // Push history helper
  const pushHistory = useCallback(
    (newAnnotations: Annotation[]) => {
      setPast((prev) => [...prev, annotations]);
      setFuture([]);
      setAnnotations(newAnnotations);
      setHasUnsavedChanges(true);
    },
    [annotations]
  );

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, prev.length - 1));
    setFuture((prev) => [annotations, ...prev]);
    setAnnotations(previous);
    setHasUnsavedChanges(true);
  }, [past, annotations]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, annotations]);
    setAnnotations(next);
    setHasUnsavedChanges(true);
  }, [future, annotations]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) {
        const key = e.key.toLowerCase();
        if (key === "s" || key === "v") {
          setActiveTool("select");
        } else if (key === "w" || key === "a") {
          setActiveTool("point");
        } else if (key === "b") {
          setActiveTool("box");
        } else if (key === "p") {
          setActiveTool("polygon");
        } else if (key === "r" || key === "m") {
          setActiveTool("ruler");
        } else if (key === "h") {
          setActiveTool("pan");
        } else if (key === "c") {
          setSplitView((s) => ({ ...s, enabled: !s.enabled }));
        }
      }

      if (modifier && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (
        (modifier && e.shiftKey && e.key.toLowerCase() === "z") ||
        (modifier && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleUndo, handleRedo]);

  // Initial Data Load
  useEffect(() => {
    async function init() {
      try {
        const [modelsData, datasetsData] = await Promise.all([
          fetchModels().catch(() => []),
          fetchDatasets().catch(() => []),
        ]);

        if (modelsData && modelsData.length > 0) {
          setModels(modelsData);
          setSelectedModelId(modelsData[0].id);
        }

        if (datasetsData && datasetsData.length > 0) {
          setDatasets(datasetsData);
          setSelectedDataset(datasetsData[0]);
        } else {
          const demoRes = await loadDemoDataset();
          setDatasets([demoRes.dataset]);
          setSelectedDataset(demoRes.dataset);
          setImages(demoRes.images);
          if (demoRes.first_image_id) {
            setSelectedImageId(demoRes.first_image_id);
          }
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }
    init();
  }, []);

  // When selected dataset changes, load its images
  useEffect(() => {
    if (!selectedDataset) return;
    async function loadImages() {
      try {
        const imgList = await fetchDatasetImages(selectedDataset!.id);
        setImages(imgList);
        if (imgList.length > 0) {
          setSelectedImageId(imgList[0].id);
        } else {
          setSelectedImageId(null);
          setCurrentImage(null);
          setAnnotations([]);
        }
      } catch (err) {
        console.error("Failed to load dataset images:", err);
      }
    }
    loadImages();
  }, [selectedDataset]);

  // When selected image changes, load details and annotations
  useEffect(() => {
    if (!selectedImageId) {
      setCurrentImage(null);
      setAnnotations([]);
      setPast([]);
      setFuture([]);
      return;
    }

    async function loadImageData() {
      try {
        const [imgDetails, anns] = await Promise.all([
          fetchImageDetails(selectedImageId!),
          fetchAnnotations(selectedImageId!),
        ]);
        setCurrentImage(imgDetails);
        setAnnotations(anns || []);
        setSelectedAnnotationId(null);
        setPast([]);
        setFuture([]);
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Failed to load image details:", err);
      }
    }
    loadImageData();
  }, [selectedImageId]);

  // Save annotations to backend
  const handleSaveAnnotations = async () => {
    if (!selectedImageId) return;
    setIsSaving(true);
    try {
      const saved = await updateAnnotations(selectedImageId, annotations);
      setAnnotations(saved);
      setHasUnsavedChanges(false);
      setImages((prev) =>
        prev.map((img) =>
          img.id === selectedImageId
            ? { ...img, annotation_count: saved.length }
            : img
        )
      );
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Run AI Auto-Annotation
  const handleAutoAnnotate = async () => {
    if (!selectedImageId || isAnnotating) return;
    setIsAnnotating(true);
    setProcessingStatus("Inference running...");

    try {
      const result = await segmentImage(selectedImageId, {
        model_id: selectedModelId,
        threshold: sensitivity,
        min_area: minArea,
      });

      setLastResult(result);
      pushHistory(result.annotations || []);
      setProcessingStatus(`Detected ${result.detected_count} cells`);
      setImages((prev) =>
        prev.map((img) =>
          img.id === selectedImageId
            ? { ...img, annotation_count: result.detected_count }
            : img
        )
      );
    } catch (err: any) {
      alert(`Segmentation failed: ${err.message}`);
      setProcessingStatus("Error");
    } finally {
      setIsAnnotating(false);
    }
  };

  // SAM Box Prompt / Point Prompt Segmentation
  const handleSegmentBox = async (bbox: [number, number, number, number]) => {
    if (!selectedImageId) return;
    setProcessingStatus("Prompt segmenting...");
    try {
      const newAnns = await segmentBox(selectedImageId, {
        bbox,
        model_id: selectedModelId,
        threshold: sensitivity,
        min_area: minArea,
      });

      if (newAnns && newAnns.length > 0) {
        const coloredAnns = newAnns.map((a, i) => ({
          ...a,
          color: getPaletteColor(annotations.length + i),
        }));
        pushHistory([...annotations, ...coloredAnns]);
        setSelectedAnnotationId(coloredAnns[0].id);
        setProcessingStatus(`Added ${newAnns.length} object`);
      } else {
        setProcessingStatus("No object detected in area");
      }
    } catch (err: any) {
      alert(`Prompt segmentation error: ${err.message}`);
      setProcessingStatus("Error");
    }
  };

  // Clear all annotations on current image
  const handleClearAll = async () => {
    if (!selectedImageId) return;
    try {
      await clearAllAnnotations(selectedImageId);
      pushHistory([]);
      setImages((prev) =>
        prev.map((img) =>
          img.id === selectedImageId ? { ...img, annotation_count: 0 } : img
        )
      );
      setProcessingStatus("Cleared");
    } catch (err: any) {
      alert(`Failed to clear: ${err.message}`);
    }
  };

  // Upload Images
  const handleUploadFiles = async (files: File[]) => {
    if (!selectedDataset) return;
    setIsUploading(true);
    try {
      const uploaded = await uploadImages(selectedDataset.id, files);
      setImages((prev) => [...uploaded, ...prev]);
      if (uploaded.length > 0) {
        setSelectedImageId(uploaded[0].id);
      }
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Delete Image
  const handleDeleteImage = async (imgId: string) => {
    if (!confirm("Are you sure you want to delete this image?")) return;
    try {
      await deleteImage(imgId);
      setImages((prev) => prev.filter((img) => img.id !== imgId));
      if (selectedImageId === imgId) {
        const remaining = images.filter((img) => img.id !== imgId);
        setSelectedImageId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Load Demo Workflow
  const handleTriggerDemo = async () => {
    setProcessingStatus("Loading demo images...");
    try {
      const demoRes = await loadDemoDataset();
      setDatasets((prev) => {
        const exists = prev.find((d) => d.id === demoRes.dataset.id);
        return exists ? prev : [demoRes.dataset, ...prev];
      });
      setSelectedDataset(demoRes.dataset);
      setImages(demoRes.images);
      if (demoRes.first_image_id) {
        setSelectedImageId(demoRes.first_image_id);
      }
      setProcessingStatus("Demo ready");
    } catch (err: any) {
      alert(`Demo load failed: ${err.message}`);
    }
  };

  // Annotation Manipulation
  const handleUpdateAnnotation = (updated: Annotation) => {
    const updatedList = annotations.map((a) =>
      a.id === updated.id ? updated : a
    );
    pushHistory(updatedList);
  };

  const handleAddAnnotation = (annData: Partial<Annotation>) => {
    const newId = `ann_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newIndex = annotations.length + 1;
    const newAnn: Annotation = {
      id: newId,
      image_id: selectedImageId || undefined,
      label: `Cell ${String(newIndex).padStart(3, "0")}`,
      category: "cell",
      color: getPaletteColor(annotations.length),
      polygon: annData.polygon || [],
      bbox: annData.bbox || [0, 0, 0, 0],
      area: annData.area || 0,
      is_visible: true,
      model_name: "manual",
    };
    pushHistory([...annotations, newAnn]);
    setSelectedAnnotationId(newId);
  };

  const handleDeleteAnnotation = (id: string) => {
    const filtered = annotations.filter((a) => a.id !== id);
    pushHistory(filtered);
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedAnnotationId) {
      handleDeleteAnnotation(selectedAnnotationId);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070b13] text-slate-100 font-sans antialiased">
      {/* 1. Adobe / SAM Top Toolbar */}
      <TopToolbar
        currentImage={currentImage}
        annotationCount={annotations.length}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        hasSelected={selectedAnnotationId !== null}
        onDeleteSelected={handleDeleteSelected}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={handleSaveAnnotations}
        onOpenExport={() => setIsExportOpen(true)}
        processingStatus={processingStatus}
        isProcessing={isAnnotating || isUploading}
        splitViewEnabled={splitView.enabled}
        onToggleSplitView={() =>
          setSplitView((s) => ({ ...s, enabled: !s.enabled }))
        }
        isAdjustmentsOpen={isAdjustmentsOpen}
        onToggleAdjustments={() => setIsAdjustmentsOpen(!isAdjustmentsOpen)}
      />

      {/* 2. Workspace Center Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Datasets & Images */}
        <LeftSidebar
          datasets={datasets}
          selectedDataset={selectedDataset}
          images={images}
          selectedImageId={selectedImageId}
          onSelectDataset={setSelectedDataset}
          onSelectImage={setSelectedImageId}
          onUploadFiles={handleUploadFiles}
          onTriggerDemo={handleTriggerDemo}
          onOpenBenchmark={() => setIsBenchmarkOpen(true)}
          onDeleteImage={handleDeleteImage}
          isUploading={isUploading}
        />

        {/* Center Panel: Interactive High-Precision Canvas */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          <AnnotationCanvas
            imageUrl={selectedImageId ? getImageUrl(selectedImageId) : null}
            annotations={annotations}
            selectedId={selectedAnnotationId}
            activeTool={activeTool}
            maskOpacity={maskOpacity}
            showBoundingBoxes={showBoundingBoxes}
            showLabels={showLabels}
            showAnnotations={showAnnotations}
            adjustments={adjustments}
            splitView={splitView}
            onSplitViewChange={setSplitView}
            onSelectAnnotation={setSelectedAnnotationId}
            onUpdateAnnotation={handleUpdateAnnotation}
            onAddAnnotation={handleAddAnnotation}
            onDeleteSelected={handleDeleteSelected}
            onSegmentBox={handleSegmentBox}
            isAnnotating={isAnnotating}
          />

          {/* Floating Lightroom / Adobe Camera Raw Adjustments HUD */}
          <AdjustmentsPanel
            isOpen={isAdjustmentsOpen}
            onClose={() => setIsAdjustmentsOpen(false)}
            adjustments={adjustments}
            onChange={setAdjustments}
            onReset={() =>
              setAdjustments({
                brightness: 0,
                contrast: 0,
                exposure: 1.0,
                invert: false,
                lut: "original",
              })
            }
          />
        </main>

        {/* Right Panel: AI Models, Controls, Layer Stack & Morphometry */}
        <RightPanel
          models={models}
          selectedModelId={selectedModelId}
          onSelectModel={setSelectedModelId}
          onAutoAnnotate={handleAutoAnnotate}
          onClearAll={handleClearAll}
          isAnnotating={isAnnotating}
          lastResult={lastResult}
          annotations={annotations}
          selectedAnnotationId={selectedAnnotationId}
          onSelectAnnotation={setSelectedAnnotationId}
          onUpdateAnnotation={handleUpdateAnnotation}
          onDeleteAnnotation={handleDeleteAnnotation}
          maskOpacity={maskOpacity}
          setMaskOpacity={setMaskOpacity}
          showAnnotations={showAnnotations}
          setShowAnnotations={setShowAnnotations}
          showBoundingBoxes={showBoundingBoxes}
          setShowBoundingBoxes={setShowBoundingBoxes}
          showLabels={showLabels}
          setShowLabels={setShowLabels}
          sensitivity={sensitivity}
          setSensitivity={setSensitivity}
          minArea={minArea}
          setMinArea={setMinArea}
          onOpenAdjustments={() => setIsAdjustmentsOpen(true)}
        />
      </div>

      {/* 3. Export Modal */}
      {selectedDataset && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          dataset={selectedDataset}
        />
      )}

      {/* 4. Model Benchmark Modal */}
      {currentImage && (
        <BenchmarkModal
          isOpen={isBenchmarkOpen}
          onClose={() => setIsBenchmarkOpen(false)}
          currentImage={currentImage}
        />
      )}
    </div>
  );
}
