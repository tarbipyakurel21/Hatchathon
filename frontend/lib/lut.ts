import { ScientificLUT } from "./types";

// Standard 256-sample Viridis RGB Colormap samples (interpolated key points)
const VIRIDIS_STOPS: [number, number, number, number][] = [
  [0, 68, 1, 84],       // Deep purple
  [0.25, 59, 82, 139],  // Blue
  [0.5, 33, 145, 140],  // Teal
  [0.75, 94, 201, 98],  // Light green
  [1.0, 253, 231, 37],  // Bright yellow
];

// Fire / Thermal Colormap
const FIRE_STOPS: [number, number, number, number][] = [
  [0.0, 0, 0, 0],       // Black
  [0.2, 80, 0, 120],    // Dark Violet
  [0.45, 200, 30, 30],  // Red-Orange
  [0.75, 255, 180, 0],  // Warm Gold
  [1.0, 255, 255, 255], // White Hot
];

function interpolateStops(
  t: number,
  stops: [number, number, number, number][]
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, r0, g0, b0] = stops[i];
    const [p1, r1, g1, b1] = stops[i + 1];
    if (clamped >= p0 && clamped <= p1) {
      const frac = (clamped - p0) / (p1 - p0);
      return [
        Math.round(r0 + (r1 - r0) * frac),
        Math.round(g0 + (g1 - g0) * frac),
        Math.round(b0 + (b1 - b0) * frac),
      ];
    }
  }
  return [255, 255, 255];
}

// Pre-build 256-entry lookup tables for ultra-fast per-pixel transformation
export const LUT_TABLES: Record<ScientificLUT, Uint8Array> = {
  original: new Uint8Array(256 * 3),
  dapi: new Uint8Array(256 * 3),
  gfp: new Uint8Array(256 * 3),
  rfp: new Uint8Array(256 * 3),
  fire: new Uint8Array(256 * 3),
  viridis: new Uint8Array(256 * 3),
};

// Initialize tables
for (let i = 0; i < 256; i++) {
  const norm = i / 255;

  // 1. Original (identity)
  LUT_TABLES.original[i * 3] = i;
  LUT_TABLES.original[i * 3 + 1] = i;
  LUT_TABLES.original[i * 3 + 2] = i;

  // 2. DAPI (Nucleic Cyan / Blue-Violet: [i * 0.1, i * 0.75, i * 1.0])
  LUT_TABLES.dapi[i * 3] = Math.round(i * 0.15);
  LUT_TABLES.dapi[i * 3 + 1] = Math.round(i * 0.75);
  LUT_TABLES.dapi[i * 3 + 2] = Math.min(255, Math.round(i * 1.15));

  // 3. GFP (Emerald Fluorescent Green: [i * 0.1, i * 1.0, i * 0.25])
  LUT_TABLES.gfp[i * 3] = Math.round(i * 0.12);
  LUT_TABLES.gfp[i * 3 + 1] = Math.min(255, Math.round(i * 1.05));
  LUT_TABLES.gfp[i * 3 + 2] = Math.round(i * 0.35);

  // 4. RFP / Cy5 (Ruby Red: [i * 1.0, i * 0.1, i * 0.25])
  LUT_TABLES.rfp[i * 3] = Math.min(255, Math.round(i * 1.1));
  LUT_TABLES.rfp[i * 3 + 1] = Math.round(i * 0.12);
  LUT_TABLES.rfp[i * 3 + 2] = Math.round(i * 0.3);

  // 5. Fire
  const fireColor = interpolateStops(norm, FIRE_STOPS);
  LUT_TABLES.fire[i * 3] = fireColor[0];
  LUT_TABLES.fire[i * 3 + 1] = fireColor[1];
  LUT_TABLES.fire[i * 3 + 2] = fireColor[2];

  // 6. Viridis
  const viridisColor = interpolateStops(norm, VIRIDIS_STOPS);
  LUT_TABLES.viridis[i * 3] = viridisColor[0];
  LUT_TABLES.viridis[i * 3 + 1] = viridisColor[1];
  LUT_TABLES.viridis[i * 3 + 2] = viridisColor[2];
}

/**
 * Apply scientific LUT, exposure (gamma), brightness, contrast, and inversion to an ImageData buffer.
 */
export function applyAdjustmentsToImageData(
  imgData: ImageData,
  options: {
    lut: ScientificLUT;
    exposure: number; // Gamma: 0.5 to 2.5
    invert: boolean;
  }
): void {
  const { lut, exposure, invert } = options;
  if (lut === "original" && exposure === 1.0 && !invert) {
    return;
  }

  const data = imgData.data;
  const lutTable = LUT_TABLES[lut] || LUT_TABLES.original;
  const gammaInv = 1.0 / (exposure || 1.0);

  // Precompute gamma map for [0..255]
  const gammaMap = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const val = Math.pow(i / 255.0, gammaInv) * 255.0;
    gammaMap[i] = Math.max(0, Math.min(255, Math.round(val)));
  }

  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Invert if active
    if (invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }

    // Apply exposure / gamma
    if (exposure !== 1.0) {
      r = gammaMap[r];
      g = gammaMap[g];
      b = gammaMap[b];
    }

    // Apply LUT colormap based on luminance / intensity
    if (lut !== "original") {
      // Perceptual grayscale luminance
      const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      const idx = luma * 3;
      data[i] = lutTable[idx];
      data[i + 1] = lutTable[idx + 1];
      data[i + 2] = lutTable[idx + 2];
    } else {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
}
