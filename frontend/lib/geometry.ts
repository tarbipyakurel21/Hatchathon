import { Point } from "./types";

export function pointInPolygon(point: Point, vs: Point[]): boolean {
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function computeBoundingBox(
  pts: Point[]
): [number, number, number, number] {
  if (!pts || pts.length === 0) return [0, 0, 0, 0];
  let minX = pts[0][0];
  let maxX = pts[0][0];
  let minY = pts[0][1];
  let maxY = pts[0][1];

  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return [minX, minY, maxX - minX, maxY - minY];
}

export function computePolygonArea(pts: Point[]): number {
  if (!pts || pts.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i][0] * pts[j][1];
    area -= pts[j][0] * pts[i][1];
  }
  return Math.abs(area) / 2.0;
}

export function distanceBetween(p1: Point, p2: Point): number {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function distanceToSegment(p: Point, v: Point, w: Point): { dist: number; proj: Point } {
  const l2 = (v[0] - w[0]) ** 2 + (v[1] - w[1]) ** 2;
  if (l2 === 0) return { dist: distanceBetween(p, v), proj: v };
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj: Point = [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
  return { dist: distanceBetween(p, proj), proj };
}

export const SCIENTIFIC_PALETTE = [
  "#06B6D4", // Cyan
  "#8B5CF6", // Violet
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#3B82F6", // Blue
  "#14B8A6", // Teal
  "#A855F7", // Purple
  "#E11D48", // Rose
  "#6366F1", // Indigo
  "#84CC16", // Lime
  "#F97316", // Orange
];

export function getPaletteColor(index: number): string {
  return SCIENTIFIC_PALETTE[index % SCIENTIFIC_PALETTE.length];
}
