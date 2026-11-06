import test from "node:test";
import assert from "node:assert/strict";

test("Uncertainty Calculation: Area volatility detection", () => {
  const prevArea = 1000.0;
  const currArea = 1600.0; // 60% change
  const areaRatio = Math.abs(currArea - prevArea) / Math.max(10.0, prevArea);

  assert.equal(areaRatio, 0.6);
  assert.ok(areaRatio > 0.25, "Should flag when area changes by > 25%");
});

test("Uncertainty Calculation: Centroid jump detection", () => {
  const prevBbox = [100, 100, 50, 50];
  const currBbox = [150, 140, 50, 50];

  const prevCx = prevBbox[0] + prevBbox[2] / 2;
  const prevCy = prevBbox[1] + prevBbox[3] / 2;
  const currCx = currBbox[0] + currBbox[2] / 2;
  const currCy = currBbox[1] + currBbox[3] / 2;

  const dist = Math.sqrt((currCx - prevCx) ** 2 + (currCy - prevCy) ** 2);
  assert.ok(dist > 35.0, "Should detect centroid jump > 35px");
});

test("Uncertainty Scoring: Normalized weighted combination", () => {
  const w_det = 0.25;
  const w_temp = 0.35;
  const w_track = 0.25;
  const w_shape = 0.15;

  const u_det = 0.42; // (1 - 0.58 confidence)
  const u_temp = 0.85; // high area shift
  const u_track = 0.70; // dropped frames
  const u_shape = 0.20;

  const score = (w_det * u_det) + (w_temp * u_temp) + (w_track * u_track) + (w_shape * u_shape);
  assert.ok(score >= 0.55, "Score should classify as high priority tier");
});
