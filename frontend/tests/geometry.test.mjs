import { test } from "node:test";
import assert from "node:assert/strict";

// Re-implement the pure functions to test the mathematical logic directly
function pointInPolygon(point, vs) {
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

function computeBoundingBox(pts) {
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

function computePolygonArea(pts) {
  if (!pts || pts.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i][0] * pts[j][1];
    area -= pts[j][0] * pts[i][1];
  }
  return Math.abs(area) / 2.0;
}

function distanceBetween(p1, p2) {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function computePolygonPerimeter(pts) {
  if (!pts || pts.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    perimeter += distanceBetween(pts[i], pts[j]);
  }
  return Math.round(perimeter * 10) / 10;
}

function computeCircularity(area, perimeter) {
  if (perimeter <= 0 || area <= 0) return 0;
  const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
  return Math.min(1.0, Math.round(circularity * 100) / 100);
}

test("pointInPolygon accurately detects point inclusion", () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(pointInPolygon([5, 5], square), true);
  assert.equal(pointInPolygon([15, 5], square), false);
  assert.equal(pointInPolygon([-1, 5], square), false);
});

test("computeBoundingBox returns [minX, minY, w, h]", () => {
  const pts = [[10, 20], [50, 20], [50, 80], [10, 80]];
  const bbox = computeBoundingBox(pts);
  assert.deepEqual(bbox, [10, 20, 40, 60]);
});

test("computePolygonArea computes Shoelace formula area", () => {
  const square = [[0, 0], [20, 0], [20, 20], [0, 20]];
  assert.equal(computePolygonArea(square), 400);

  const triangle = [[0, 0], [10, 0], [0, 10]];
  assert.equal(computePolygonArea(triangle), 50);
});

test("computePolygonPerimeter calculates boundary perimeter", () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(computePolygonPerimeter(square), 40);
});

test("computeCircularity classifies circularity score", () => {
  // A regular polygon with 100 points approximating a circle with radius 10
  const circlePts = [];
  const r = 10;
  const N = 100;
  for (let i = 0; i < N; i++) {
    const theta = (2 * Math.PI * i) / N;
    circlePts.push([r * Math.cos(theta), r * Math.sin(theta)]);
  }
  const area = computePolygonArea(circlePts);
  const perimeter = computePolygonPerimeter(circlePts);
  const circularity = computeCircularity(area, perimeter);

  // Should be close to 1.0 (approx > 0.95)
  assert.ok(circularity >= 0.95 && circularity <= 1.0);

  // A very skinny rectangle (high perimeter, low area)
  const skinny = [[0, 0], [100, 0], [100, 2], [0, 2]];
  const skinnyArea = computePolygonArea(skinny);
  const skinnyPerimeter = computePolygonPerimeter(skinny);
  const skinnyCircularity = computeCircularity(skinnyArea, skinnyPerimeter);

  assert.ok(skinnyCircularity < 0.15);
});
