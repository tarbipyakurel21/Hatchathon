import {
  Project,
  SurgiVideo,
  SurgiAnnotation,
  SurgicalPhaseInterval,
} from "./surgiLabelTypes";

export function exportToSurgiLabelJSON(
  project: Project,
  video: SurgiVideo,
  annotations: SurgiAnnotation[],
  phases: SurgicalPhaseInterval[],
  onlyReviewed = false
) {
  const filteredAnns = onlyReviewed
    ? annotations.filter((a) => a.review_status === "approved")
    : annotations;

  return {
    format: "SurgiLabel-v1.0",
    exported_at: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      classes: project.classes,
    },
    video: {
      id: video.id,
      filename: video.filename,
      fps: video.fps,
      duration_seconds: video.duration_seconds,
      total_frames: video.total_frames,
      width: video.width,
      height: video.height,
    },
    surgical_phases: phases.filter((ph) => ph.video_id === video.id),
    annotations: filteredAnns.map((a) => ({
      id: a.id,
      track_id: a.track_id,
      frame_idx: a.frame_idx,
      timestamp_seconds: +(a.frame_idx / video.fps).toFixed(3),
      label: a.label,
      class_id: a.class_id,
      color: a.color,
      type: a.type,
      bbox: a.bbox,
      polygon: a.polygon,
      confidence: a.confidence,
      source: a.source,
      review_status: a.review_status,
      review_notes: a.review_notes,
    })),
  };
}

export function exportToCOCOJSON(
  project: Project,
  video: SurgiVideo,
  annotations: SurgiAnnotation[],
  onlyReviewed = false
) {
  const filteredAnns = onlyReviewed
    ? annotations.filter((a) => a.review_status === "approved")
    : annotations;

  const categories = project.classes.map((c, idx) => ({
    id: idx + 1,
    name: c.name,
    supercategory: c.category,
  }));
  const classMap = new Map(project.classes.map((c, idx) => [c.id, idx + 1]));

  // Images representing each frame
  const frameSet = new Set(filteredAnns.map((a) => a.frame_idx));
  const images = Array.from(frameSet).sort((a, b) => a - b).map((f) => ({
    id: f,
    file_name: `frame_${String(f).padStart(6, "0")}.jpg`,
    width: video.width,
    height: video.height,
    frame_number: f,
    timestamp: +(f / video.fps).toFixed(3),
  }));

  const cocoAnnotations = filteredAnns.map((a, idx) => {
    const catId = classMap.get(a.class_id) || 1;
    const [bx, by, bw, bh] = a.bbox;
    const flatPoly = a.polygon ? a.polygon.flat() : [];

    return {
      id: idx + 1,
      image_id: a.frame_idx,
      category_id: catId,
      segmentation: flatPoly.length >= 6 ? [flatPoly] : [],
      area: bw * bh,
      bbox: [bx, by, bw, bh],
      iscrowd: 0,
      confidence: a.confidence,
      attributes: {
        track_id: a.track_id,
        is_keyframe: a.is_keyframe,
        source: a.source,
        review_status: a.review_status,
      },
    };
  });

  return {
    info: {
      description: `SurgiLabel COCO Export: ${project.name}`,
      url: "https://surgilabel.ai",
      version: "1.0",
      year: new Date().getFullYear(),
      contributor: "SurgiLabel Clinical AI",
      date_created: new Date().toISOString(),
    },
    licenses: [{ id: 1, name: "Research & Development Only", url: "" }],
    images,
    annotations: cocoAnnotations,
    categories,
  };
}

export function exportToYOLOFormat(
  video: SurgiVideo,
  annotations: SurgiAnnotation[],
  classMap: Map<string, number>,
  onlyReviewed = false
) {
  const filteredAnns = onlyReviewed
    ? annotations.filter((a) => a.review_status === "approved")
    : annotations;

  const vw = video.width || 640;
  const vh = video.height || 480;

  // Group by frame
  const frameMap: Record<number, string[]> = {};

  filteredAnns.forEach((a) => {
    const classIdx = classMap.get(a.class_id) ?? 0;
    const [bx, by, bw, bh] = a.bbox;

    // Normalize coordinates for YOLO (center_x, center_y, width, height in [0, 1])
    const xCenter = (bx + bw / 2) / vw;
    const yCenter = (by + bh / 2) / vh;
    const normW = bw / vw;
    const normH = bh / vh;

    const line = `${classIdx} ${xCenter.toFixed(6)} ${yCenter.toFixed(6)} ${normW.toFixed(6)} ${normH.toFixed(6)}`;

    if (!frameMap[a.frame_idx]) {
      frameMap[a.frame_idx] = [];
    }
    frameMap[a.frame_idx].push(line);
  });

  return {
    format: "YOLOv8-Darknet",
    video: video.filename,
    total_frames_annotated: Object.keys(frameMap).length,
    labels: frameMap,
  };
}

export function downloadJsonFile(filename: string, data: any) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
