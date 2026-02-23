/**
 * Client-side semantic segmentation using MediaPipe + heuristic masks.
 * 
 * Provides region masks for:
 * - Person (selfie segmentation via MediaPipe)
 * - Face (face detection via MediaPipe)
 * - Skin (YCrCb + HSV color heuristic)
 * - Sky (color + position heuristic)
 * - Vegetation (green hue + saturation heuristic)
 *
 * All processing runs entirely in the browser — no backend needed.
 */

import {
  ImageSegmenter,
  FaceDetector,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

/* ══════════════ Types ══════════════ */

export interface RegionMasks {
  /** Person silhouette [0-1] */
  person: Float32Array;
  /** Face region [0-1] */
  face: Float32Array;
  /** Skin pixels [0-1] */
  skin: Float32Array;
  /** Sky region [0-1] */
  sky: Float32Array;
  /** Vegetation/greenery [0-1] */
  vegetation: Float32Array;
  /** Background (inverse of person) [0-1] */
  background: Float32Array;
  /** Image dimensions */
  width: number;
  height: number;
}

/* ══════════════ Singleton Loaders ══════════════ */

let segmenterPromise: Promise<ImageSegmenter> | null = null;
let faceDetectorPromise: Promise<FaceDetector> | null = null;
let wasmFileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null = null;

const MEDIAPIPE_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

async function getWasm() {
  if (!wasmFileset) {
    wasmFileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_CDN);
  }
  return wasmFileset;
}

async function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const wasm = await getWasm();
      return ImageSegmenter.createFromOptions(wasm, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
    })();
  }
  return segmenterPromise;
}

async function getFaceDetector(): Promise<FaceDetector> {
  if (!faceDetectorPromise) {
    faceDetectorPromise = (async () => {
      const wasm = await getWasm();
      return FaceDetector.createFromOptions(wasm, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
    })();
  }
  return faceDetectorPromise;
}

/* ══════════════ Heuristic Masks ══════════════ */

/**
 * Skin detection using YCrCb + HSV color space heuristics.
 * Matching the backend's `_skin_mask` from processing.py.
 */
function computeSkinMask(imageData: ImageData): Float32Array {
  const { data: px, width, height } = imageData;
  const n = width * height;
  const mask = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const off = i * 4;
    const r = px[off], g = px[off + 1], b = px[off + 2];

    // YCrCb conversion
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cr = (r - y) * 0.713 + 128;
    const cb = (b - y) * 0.564 + 128;

    // YCrCb skin range (matching OpenCV's typical skin detection)
    const ycrcbSkin = cr >= 133 && cr <= 173 && cb >= 77 && cb <= 127;

    // HSV-based check
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const sat = max === 0 ? 0 : delta / max;
    let hue = 0;
    if (delta > 0) {
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
      if (hue < 0) hue += 360;
    }
    const val = max / 255;

    // HSV skin range: warm hue, moderate saturation, not too dark
    const hsvSkin = (hue >= 0 && hue <= 50) && sat >= 0.15 && sat <= 0.75 && val >= 0.20;

    // Combined: both detectors must agree for high confidence
    mask[i] = (ycrcbSkin && hsvSkin) ? 0.9 : (ycrcbSkin || hsvSkin) ? 0.3 : 0;
  }

  // Simple 3×3 morphological smoothing
  const smoothed = new Float32Array(n);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          sum += mask[(y + dy) * width + (x + dx)];
      smoothed[y * width + x] = sum / 9;
    }
  }
  return smoothed;
}

/**
 * Sky detection using color + position heuristics.
 * Matching the backend's logic: blue hue + high position + bright.
 */
function computeSkyMask(imageData: ImageData): Float32Array {
  const { data: px, width, height } = imageData;
  const n = width * height;
  const mask = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const off = i * 4;
    const r = px[off], g = px[off + 1], b = px[off + 2];
    const y = Math.floor(i / width);

    // Position weight: sky is typically in the upper 60%
    const posWeight = Math.max(0, 1 - y / (height * 0.6));

    // Color check: blue-ish (b > r && b > g) or bright overcast
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const lum = (r + g + b) / 3;

    let hue = 0;
    if (delta > 0) {
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
      if (hue < 0) hue += 360;
    }

    // Blue sky: hue 180-260, bright, low-mid saturation
    const sat = max === 0 ? 0 : delta / max;
    const isBlueSky = hue >= 180 && hue <= 260 && lum > 100 && sat > 0.1 && sat < 0.8;

    // Overcast sky: very low saturation, bright, upper image
    const isOvercast = sat < 0.12 && lum > 160 && posWeight > 0.3;

    const colorScore = isBlueSky ? 0.9 : isOvercast ? 0.5 : 0;
    mask[i] = colorScore * posWeight;
  }

  return mask;
}

/**
 * Vegetation detection using green hue + saturation heuristics.
 */
function computeVegetationMask(imageData: ImageData): Float32Array {
  const { data: px, width, height } = imageData;
  const n = width * height;
  const mask = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const off = i * 4;
    const r = px[off], g = px[off + 1], b = px[off + 2];

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const sat = max === 0 ? 0 : delta / max;

    let hue = 0;
    if (delta > 0) {
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
      if (hue < 0) hue += 360;
    }

    // Green vegetation: hue 60-170, moderate saturation, g > r
    const isGreen = hue >= 60 && hue <= 170 && sat >= 0.15 && g > r;
    mask[i] = isGreen ? Math.min(1, sat * 1.5) : 0;
  }

  return mask;
}

/* ══════════════ Face Mask from Detections ══════════════ */

function createFaceMask(
  faces: { originX: number; originY: number; width: number; height: number }[],
  imgWidth: number,
  imgHeight: number,
): Float32Array {
  const n = imgWidth * imgHeight;
  const mask = new Float32Array(n);

  for (const f of faces) {
    // Expand face bbox by 20% for forehead/chin
    const cx = f.originX + f.width / 2;
    const cy = f.originY + f.height / 2;
    const rw = f.width * 0.6;
    const rh = f.height * 0.6;

    const x0 = Math.max(0, Math.floor((cx - rw) * imgWidth));
    const x1 = Math.min(imgWidth - 1, Math.ceil((cx + rw) * imgWidth));
    const y0 = Math.max(0, Math.floor((cy - rh) * imgHeight));
    const y1 = Math.min(imgHeight - 1, Math.ceil((cy + rh) * imgHeight));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // Elliptical soft mask
        const dx = (x / imgWidth - cx) / rw;
        const dy = (y / imgHeight - cy) / rh;
        const dist = dx * dx + dy * dy;
        if (dist <= 1) {
          const val = 1 - Math.sqrt(dist);
          mask[y * imgWidth + x] = Math.max(mask[y * imgWidth + x], val);
        }
      }
    }
  }

  return mask;
}

/* ══════════════ Public API ══════════════ */

/**
 * Compute all semantic region masks for an image.
 * Uses MediaPipe for person/face segmentation + heuristics for skin/sky/vegetation.
 *
 * @param imageData - Source image pixels
 * @returns Promise<RegionMasks> — all mask arrays sized width*height
 */
export async function computeRegionMasks(imageData: ImageData): Promise<RegionMasks> {
  const { width, height } = imageData;
  const n = width * height;

  // Draw ImageData to a canvas for MediaPipe input
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);

  // Run all detections in parallel
  const [personMask, faces, skinMask, skyMask, vegMask] = await Promise.all([
    // Person segmentation
    (async () => {
      try {
        const segmenter = await getSegmenter();
        const result = segmenter.segment(canvas);
        // confidenceMasks[0] is the person confidence (background class or person class depending on model)
        if (result.confidenceMasks && result.confidenceMasks.length > 0) {
          const raw = result.confidenceMasks[0].getAsFloat32Array();
          const mask = new Float32Array(n);
          for (let i = 0; i < n; i++) mask[i] = raw[i];
          result.close();
          return mask;
        }
        result.close();
        return new Float32Array(n);
      } catch {
        // Fallback: no person mask
        return new Float32Array(n);
      }
    })(),

    // Face detection
    (async () => {
      try {
        const detector = await getFaceDetector();
        const result = detector.detect(canvas);
        return result.detections.map((d) => {
          const bb = d.boundingBox!;
          return {
            originX: bb.originX / width,
            originY: bb.originY / height,
            width: bb.width / width,
            height: bb.height / height,
          };
        });
      } catch {
        return [];
      }
    })(),

    // Heuristic masks (sync but wrapped in Promise.resolve for parallel execution)
    Promise.resolve(computeSkinMask(imageData)),
    Promise.resolve(computeSkyMask(imageData)),
    Promise.resolve(computeVegetationMask(imageData)),
  ]);

  // Build face mask from detections
  const faceMask = createFaceMask(faces, width, height);

  // Background = inverse of person
  const bgMask = new Float32Array(n);
  for (let i = 0; i < n; i++) bgMask[i] = 1 - personMask[i];

  return {
    person: personMask,
    face: faceMask,
    skin: skinMask,
    sky: skyMask,
    vegetation: vegMask,
    background: bgMask,
    width,
    height,
  };
}

/**
 * Check if MediaPipe models are available (preload).
 * Call this early (e.g., on editor mount) to warm up the models.
 */
export async function preloadSegmentationModels(): Promise<boolean> {
  try {
    await Promise.all([getSegmenter(), getFaceDetector()]);
    return true;
  } catch {
    return false;
  }
}
