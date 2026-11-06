import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("SurgiLabel Video Coordinate & Conversion Utilities", () => {
  it("converts normalized YOLO bounding boxes to pixel coordinates accurately", () => {
    const videoW = 640;
    const videoH = 480;

    const bbox = [160, 180, 120, 100]; // [x, y, w, h]
    const xCenter = (bbox[0] + bbox[2] / 2) / videoW;
    const yCenter = (bbox[1] + bbox[3] / 2) / videoH;
    const normW = bbox[2] / videoW;
    const normH = bbox[3] / videoH;

    assert.equal(xCenter, 220 / 640);
    assert.equal(yCenter, 230 / 480);
    assert.equal(normW, 120 / 640);
    assert.equal(normH, 100 / 480);

    // Reconstruct pixel coordinates
    const recX = Math.round((xCenter - normW / 2) * videoW);
    const recY = Math.round((yCenter - normH / 2) * videoH);
    const recW = Math.round(normW * videoW);
    const recH = Math.round(normH * videoH);

    assert.deepEqual([recX, recY, recW, recH], bbox);
  });

  it("calculates accurate timecode and frame intervals", () => {
    const fps = 25.0;
    const frameIdx = 60;
    const timestamp = +(frameIdx / fps).toFixed(2);
    assert.equal(timestamp, 2.4);

    const frameFromTs = Math.round(timestamp * fps);
    assert.equal(frameFromTs, 60);
  });

  it("validates non-overlapping and ordered surgical phase intervals", () => {
    const phases = [
      { name: "Preparation", start: 0, end: 24 },
      { name: "Dissection", start: 25, end: 79 },
      { name: "Clipping", start: 80, end: 104 },
      { name: "Extraction", start: 105, end: 119 },
    ];

    for (let i = 0; i < phases.length - 1; i++) {
      assert.ok(phases[i].end < phases[i + 1].start, `Interval ${phases[i].name} should end before ${phases[i + 1].name} starts`);
    }

    assert.equal(phases[phases.length - 1].end, 119);
  });
});
