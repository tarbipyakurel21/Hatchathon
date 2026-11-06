import {
  VideoItem,
  VideoTrack,
  VideoFrameAnnotation,
  VideoTracksResponse,
  TrackPromptResult,
  SurgicalCategory,
} from "./videoTypes";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const getVideoFileUrl = (videoId: string): string =>
  `${API_BASE}/api/videos/${videoId}/file`;

export const getVideoThumbnailUrl = (videoId: string): string =>
  `${API_BASE}/api/videos/${videoId}/thumbnail`;

export const getVideoExportDownloadUrl = (filename: string): string =>
  `${API_BASE}/api/videos/export/download/${filename}`;

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

export async function fetchVideos(): Promise<VideoItem[]> {
  const res = await fetch(`${API_BASE}/api/videos`);
  return handleResponse<VideoItem[]>(res);
}

export async function fetchVideoDetails(videoId: string): Promise<VideoItem> {
  const res = await fetch(`${API_BASE}/api/videos/${videoId}`);
  return handleResponse<VideoItem>(res);
}

export async function uploadVideoFile(file: File): Promise<VideoItem> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/videos/upload`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<VideoItem>(res);
}

export async function deleteVideoFile(
  videoId: string
): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/videos/${videoId}`, {
    method: "DELETE",
  });
  return handleResponse<{ status: string; message: string }>(res);
}

export async function fetchVideoTracks(
  videoId: string
): Promise<VideoTracksResponse> {
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/tracks`);
  return handleResponse<VideoTracksResponse>(res);
}

export async function saveVideoTracks(
  videoId: string,
  tracks: VideoTrack[],
  annotations: VideoFrameAnnotation[]
): Promise<VideoTracksResponse> {
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/tracks`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tracks, annotations }),
  });
  return handleResponse<VideoTracksResponse>(res);
}

export async function deleteVideoTrack(
  videoId: string,
  trackId: number
): Promise<{ status: string; deleted: boolean }> {
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/tracks/${trackId}`, {
    method: "DELETE",
  });
  return handleResponse<{ status: string; deleted: boolean }>(res);
}

export async function runTrackPrompt(
  videoId: string,
  params: {
    keyframe_idx: number;
    prompt_type: "point" | "box";
    prompt_data: [number, number] | [number, number, number, number];
    track_id?: number;
    label?: string;
    category?: SurgicalCategory;
    color?: string;
  }
): Promise<TrackPromptResult> {
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/track-prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse<TrackPromptResult>(res);
}

export async function runAutoTrack(videoId: string): Promise<{
  status: string;
  model: string;
  track_count: number;
  total_masks: number;
  inference_time_ms: number;
  tracks: VideoTrack[];
}> {
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/auto-track`, {
    method: "POST",
  });
  return handleResponse<any>(res);
}

export async function exportVideoDataset(videoId: string): Promise<{
  status: string;
  filename: string;
  download_url: string;
  track_count: number;
  mask_count: number;
}> {
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/export`, {
    method: "POST",
  });
  return handleResponse<any>(res);
}

export async function loadDemoSurgicalVideo(): Promise<{
  status: string;
  video: VideoItem;
  track_count: number;
  annotation_count: number;
}> {
  const res = await fetch(`${API_BASE}/api/videos/demo/load`, {
    method: "POST",
  });
  return handleResponse<any>(res);
}
