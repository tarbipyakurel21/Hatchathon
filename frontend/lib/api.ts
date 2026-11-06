import {
  Dataset,
  ImageItem,
  Annotation,
  ModelInfo,
  SegmentationResult,
  BenchmarkResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const getImageUrl = (imageId: string): string =>
  `${API_BASE}/api/images/${imageId}/file`;

export const getThumbnailUrl = (imageId: string): string =>
  `${API_BASE}/api/images/${imageId}/thumbnail`;

export const getExportDownloadUrl = (filename: string): string =>
  `${API_BASE}/api/datasets/export/download/${filename}`;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorText = await res.text();
    let detail = `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(errorText);
      detail = parsed.detail || detail;
    } catch {
      detail = errorText || detail;
    }
    throw new Error(detail);
  }
  return res.json();
}

// Health check
export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  return handleResponse<any>(res);
}

// Models
export async function fetchModels(): Promise<ModelInfo[]> {
  const res = await fetch(`${API_BASE}/api/models`);
  return handleResponse<ModelInfo[]>(res);
}

// Datasets
export async function fetchDatasets(): Promise<Dataset[]> {
  const res = await fetch(`${API_BASE}/api/datasets`);
  return handleResponse<Dataset[]>(res);
}

export async function createDataset(
  name: string,
  description?: string
): Promise<Dataset> {
  const res = await fetch(`${API_BASE}/api/datasets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  return handleResponse<Dataset>(res);
}

export async function fetchDatasetImages(
  datasetId: string
): Promise<ImageItem[]> {
  const res = await fetch(`${API_BASE}/api/datasets/${datasetId}/images`);
  return handleResponse<ImageItem[]>(res);
}

export async function exportDataset(
  datasetId: string
): Promise<{ status: string; message: string; filename: string; download_url: string }> {
  const res = await fetch(`${API_BASE}/api/datasets/${datasetId}/export`, {
    method: "POST",
  });
  return handleResponse<{ status: string; message: string; filename: string; download_url: string }>(res);
}

// Images
export async function uploadImages(
  datasetId: string,
  files: File[]
): Promise<ImageItem[]> {
  const formData = new FormData();
  formData.append("dataset_id", datasetId);
  files.forEach((file) => formData.append("files", file));

  const res = await fetch(`${API_BASE}/api/images/upload`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<ImageItem[]>(res);
}

export async function fetchImageDetails(imageId: string): Promise<ImageItem> {
  const res = await fetch(`${API_BASE}/api/images/${imageId}`);
  return handleResponse<ImageItem>(res);
}

export async function deleteImage(
  imageId: string
): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/images/${imageId}`, {
    method: "DELETE",
  });
  return handleResponse<{ status: string; message: string }>(res);
}

// Segmentation
export async function segmentImage(
  imageId: string,
  params: {
    model_id?: string;
    min_area?: number;
    max_area?: number;
    threshold?: number;
  }
): Promise<SegmentationResult> {
  const res = await fetch(`${API_BASE}/api/images/${imageId}/segment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse<SegmentationResult>(res);
}

// Annotations
export async function fetchAnnotations(
  imageId: string
): Promise<Annotation[]> {
  const res = await fetch(`${API_BASE}/api/images/${imageId}/annotations`);
  return handleResponse<Annotation[]>(res);
}

export async function updateAnnotations(
  imageId: string,
  annotations: Annotation[]
): Promise<Annotation[]> {
  const res = await fetch(`${API_BASE}/api/images/${imageId}/annotations`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ annotations }),
  });
  return handleResponse<Annotation[]>(res);
}

// Demo
export async function loadDemoDataset(): Promise<{
  status: string;
  dataset: Dataset;
  images: ImageItem[];
  first_image_id: string | null;
}> {
  const res = await fetch(`${API_BASE}/api/demo/load`, {
    method: "POST",
  });
  return handleResponse<{
    status: string;
    dataset: Dataset;
    images: ImageItem[];
    first_image_id: string | null;
  }>(res);
}

// Benchmark
export async function runBenchmark(
  imageId: string,
  params?: { min_area?: number; max_area?: number; threshold?: number }
): Promise<BenchmarkResponse> {
  const res = await fetch(`${API_BASE}/api/benchmark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_id: imageId, ...params }),
  });
  return handleResponse<BenchmarkResponse>(res);
}
