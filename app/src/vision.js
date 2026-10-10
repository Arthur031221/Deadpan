// In-browser face and person models (MediaPipe Tasks). Nothing here makes a
// network request except for loading the bundled model files.
import { FilesetResolver, FaceLandmarker, ImageSegmenter } from "../vendor/mediapipe/vision_bundle.mjs";
import { faceMetrics, headRegion, crownRow } from "./core/geometry.js";

const WORK = 256;
const here = (path) => new URL(path, import.meta.url).href;

// The runtime ships gzipped because the raw file is over 10 MB. The browser unpacks it into a blob URL.
async function unpackedRuntime() {
  const files = await FilesetResolver.forVisionTasks(here("../vendor/mediapipe/wasm"));
  const response = await fetch(`${files.wasmBinaryPath}.gz`);
  if (!response.ok) throw new Error(`Could not load the face model runtime (${response.status})`);
  const wasm = await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  return { ...files, wasmBinaryPath: URL.createObjectURL(new Blob([wasm], { type: "application/wasm" })) };
}

export async function loadVision() {
  const files = await unpackedRuntime();
  const make = async (delegate) => {
    const landmarkOptions = {
      baseOptions: { modelAssetPath: here("../models/face_landmarker.task"), delegate },
      numFaces: 2,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    };
    const [still, video, segmenter] = await Promise.all([
      FaceLandmarker.createFromOptions(files, { ...landmarkOptions, runningMode: "IMAGE" }),
      FaceLandmarker.createFromOptions(files, { ...landmarkOptions, runningMode: "VIDEO" }),
      ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: here("../models/selfie_segmenter.tflite"), delegate },
        runningMode: "IMAGE",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      }),
    ]);
    return { still, video, segmenter, delegate };
  };
  try {
    return { ...(await make("GPU")), work: workCanvas() };
  } catch {
    return { ...(await make("CPU")), work: workCanvas() };
  }
}

function workCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = WORK;
  return canvas;
}

/** Yaw and pitch in degrees from the 4 x 4 face transform (column major). */
function headPose(data) {
  if (!data) return { yawDeg: null, pitchDeg: null };
  const r = (row, col) => data[col * 4 + row];
  const deg = (rad) => (rad * 180) / Math.PI;
  return {
    yawDeg: deg(Math.atan2(-r(2, 0), Math.hypot(r(2, 1), r(2, 2)))),
    pitchDeg: deg(Math.atan2(r(2, 1), r(2, 2))),
  };
}

const scoresOf = (face) => Object.fromEntries((face ?? []).map((c) => [c.categoryName, c.score]));

/**
 * Measures the one face in `source`. `width` and `height` are the source's own
 * pixel size. Returns { faces, m, expression, background } where `m` is null
 * unless exactly one face is visible. A null crownY means the top of the head
 * could not be measured (it touches the edge of the picture or the region).
 */
export function analyze(vision, source, width, height, timestamp = null) {
  const detected = timestamp == null ? vision.still.detect(source) : vision.video.detectForVideo(source, timestamp);
  const faces = detected.faceLandmarks.length;
  if (faces !== 1) return { faces, m: null, expression: null, background: null };

  const lm = detected.faceLandmarks[0];
  const m = { ...faceMetrics(lm, width, height), ...headPose(detected.facialTransformationMatrixes[0]?.data) };
  const region = headRegion(lm, width, height);
  const { crownY, background } = measureCrown(vision, source, region, m, height);
  return {
    faces,
    m: { ...m, chinY: m.chin.y, crownY },
    expression: scoresOf(detected.faceBlendshapes[0]?.categories),
    background,
  };
}

function measureCrown(vision, source, region, m, height) {
  const ctx = vision.work.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, WORK, WORK);
  if (region.y < 0) {
    // Above the picture, continue the top row so the gap does not look like a person.
    ctx.drawImage(source, region.x, 0, region.size, 1, 0, 0, WORK, (-region.y * WORK) / region.size);
  }
  ctx.drawImage(source, region.x, region.y, region.size, region.size, 0, 0, WORK, WORK);
  const result = vision.segmenter.segment(vision.work);
  const mask = result.confidenceMasks[0].getAsFloat32Array();
  const row = crownRow(mask, WORK, WORK, { centerX: 0.5, halfWidth: (0.25 * m.faceWidth) / region.size });
  const background = backgroundStats(ctx.getImageData(0, 0, WORK, WORK).data, mask);
  result.confidenceMasks.forEach((c) => c.close());
  if (row == null) return { crownY: null, background };
  const crownY = region.y + row * region.size;
  return { crownY: crownY > 1 && crownY < height ? crownY : null, background };
}

/** Brightness and spread of the pixels the person mask is sure are not the person. */
function backgroundStats(rgba, mask) {
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 0.05) continue;
    const luma = 0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2];
    // The grey fill used outside the picture is not background.
    if (rgba[i * 4] === 128 && rgba[i * 4 + 1] === 128 && rgba[i * 4 + 2] === 128) continue;
    n++;
    sum += luma;
    sumSq += luma * luma;
  }
  if (n < 400) return null;
  const mean = sum / n;
  return { mean, spread: Math.sqrt(Math.max(0, sumSq / n - mean * mean)), pixels: n };
}
