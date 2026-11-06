"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dataset,
  ImageItem,
  Annotation,
  ModelInfo,
  SegmentationResult,
  ToolType,
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

  // Global Keyboard Shortcuts (Ctrl/Cmd+Z for Undo, Ctrl/Cmd+Shift+Z or Ctrl+Y for Redo)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) {
        if (e.key.toLowerCase() === "s" || e.key.toLowerCase() === "v") {
          setActiveTool("select");
        } else if (e.key.toLowerCase() === "b") {
          setActiveTool("box");
        } else if (e.key.toLowerCase() === "p") {
          setActiveTool("polygon");
        } else if (e.key.toLowerCase() === "h") {
          setActiveTool("pan");
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
          // If no datasets exist yet, initialize demo automatically
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
      // Update image item count in state
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

  // AI Auto-Annotate Trigger
  const handleAutoAnnotate = async () => {
    if (!selectedImageId) return;
    setIsAnnotating(true);
    setProcessingStatus(`Segmenting with ${selectedModelId}...`);
    try {
      const res = await segmentImage(selectedImageId, {
        model_id: selectedModelId,
        threshold: sensitivity,
        min_area: minArea,
      });

      setLastResult(res);
      pushHistory(res.annotations);
      setHasUnsavedChanges(false); // Already saved on backend during segment

      // Update image count in list
      setImages((prev) =>
        prev.map((img) =>
          img.id === selectedImageId
            ? { ...img, annotation_count: res.detected_count }
            : img
        )
      );
      setProcessingStatus(`Detected ${res.detected_count} objects in ${res.inference_time_ms}ms`);
    } catch (err: any) {
      alert(`Segmentation error: ${err.message}`);
      setProcessingStatus("Error");
    } finally {
      setIsAnnotating(false);
    }
  };

  // SAM-style Box Prompt Segment
  const handleSegmentBox = async (bbox: [number, number, number, number]) => {
    if (!selectedImageId) return;
    setIsAnnotating(true);
    setProcessingStatus("Segmenting prompt box...");
    try {
      const res = await segmentBox(selectedImageId, {
        bbox,
        model_id: selectedModelId,
        threshold: sensitivity,
        min_area: minArea,
      });
      pushHistory(res);
      setHasUnsavedChanges(false);
      setImages((prev) =>
        prev.map((img) =>
          img.id === selectedImageId ? { ...img, annotation_count: res.length } : img
        )
      );
      setProcessingStatus(`Added objects from box prompt`);
    } catch (err: any) {
      alert(`Box segmentation error: ${err.message}`);
    } finally {
      setIsAnnotating(false);
    }
  };

  // SAM-style Clear All
  const handleClearAll = async () => {
    if (!selectedImageId) return;
    try {
      await clearAllAnnotations(selectedImageId);
      pushHistory([]);
      setSelectedAnnotationId(null);
      setImages((prev) =>
        prev.map((img) =>
          img.id === selectedImageId ? { ...img, annotation_count: 0 } : img
        )
      );
      setProcessingStatus("Cleared");
    } catch (err: any) {
      alert(`Clear failed: ${err.message}`);
    }
  };

  // Annotation Mutations
  const handleAddAnnotation = (annData: Partial<Annotation>) => {
    const nextIndex = annotations.length + 1;
    const newAnn: Annotation = {
      id: crypto.randomUUID ? crypto.randomUUID() : `ann_${Date.now()}`,
      label: `Cell ${String(nextIndex).padStart(3, "0")}`,
      category: "cell",
      color: getPaletteColor(nextIndex - 1),
      polygon: annData.polygon || [],
      bbox: annData.bbox || [0, 0, 0, 0],
      area: annData.area || 0,
      is_visible: true,
      model_name: "manual",
    };
    pushHistory([...annotations, newAnn]);
    setSelectedAnnotationId(newAnn.id);
  };

  const handleUpdateAnnotation = (updated: Annotation) => {
    const newAnns = annotations.map((a) => (a.id === updated.id ? updated : a));
    pushHistory(newAnns);
  };

  const handleDeleteAnnotation = (id: string) => {
    const newAnns = annotations.filter((a) => a.id !== id);
    pushHistory(newAnns);
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedAnnotationId) {
      handleDeleteAnnotation(selectedAnnotationId);
    }
  };

  // Demo Trigger CTA
  const handleTriggerDemo = async () => {
    try {
      setProcessingStatus("Loading demo dataset...");
      const demoRes = await loadDemoDataset();
      const updatedDatasets = await fetchDatasets();
      setDatasets(updatedDatasets);
      setSelectedDataset(demoRes.dataset);
      setImages(demoRes.images);
      if (demoRes.first_image_id) {
        setSelectedImageId(demoRes.first_image_id);
      }
      setProcessingStatus("Demo loaded");
    } catch (err: any) {
      alert(`Demo load failed: ${err.message}`);
    }
  };

  // Upload handler
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

  // Delete image handler
  const handleDeleteImage = async (imageId: string) => {
    try {
      await deleteImage(imageId);
      const remaining = images.filter((img) => img.id !== imageId);
      setImages(remaining);
      if (selectedImageId === imageId) {
        setSelectedImageId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const imageUrl = selectedImageId ? getImageUrl(selectedImageId) : null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070b13]">
      {/* Top Navigation Toolbar */}
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
        isProcessing={isAnnotating}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar */}
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

        {/* Center Interactive Canvas */}
        <main className="flex-1 relative overflow-hidden bg-[#070b13]">
          <AnnotationCanvas
            imageUrl={imageUrl}
            annotations={annotations}
            selectedId={selectedAnnotationId}
            activeTool={activeTool}
            maskOpacity={maskOpacity}
            showBoundingBoxes={showBoundingBoxes}
            showLabels={showLabels}
            showAnnotations={showAnnotations}
            onSelectAnnotation={setSelectedAnnotationId}
            onUpdateAnnotation={handleUpdateAnnotation}
            onAddAnnotation={handleAddAnnotation}
            onDeleteSelected={handleDeleteSelected}
            onSegmentBox={handleSegmentBox}
          />
        </main>

        {/* Right Properties & AI Panel */}
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
        />
      </div>

      {/* Export Dataset Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        dataset={selectedDataset}
      />

      {/* Benchmark Model Comparison Modal */}
      <BenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
        currentImage={currentImage}
      />
    </div>
  );
}
