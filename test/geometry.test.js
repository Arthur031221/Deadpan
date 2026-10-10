import assert from "node:assert/strict";
import { test } from "node:test";
import { clampCrop, crownRow, evaluate, faceMetrics, fitCrop, headRegion } from "../app/src/core/geometry.js";
import { findSpec } from "../app/src/core/specs.js";

const US = findSpec("us");

/** A filled ellipse as a person mask, top row of the ellipse is `top` (in rows). */
function ellipseMask(size, cx, top, rx, ry) {
  const mask = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - (top + ry)) / ry;
      if (dx * dx + dy * dy <= 1) mask[y * size + x] = 1;
    }
  }
  return mask;
}

test("crownRow finds the top of a round head to within a pixel", () => {
  const size = 256;
  const mask = ellipseMask(size, 128, 40, 60, 80);
  const row = crownRow(mask, size, size, { centerX: 0.5, halfWidth: 0.1 });
  assert.ok(Math.abs(row * size - 40) < 2.5, `crown at ${row * size}`);
});

test("crownRow returns null for an empty mask and for a head cut off by the top edge", () => {
  const size = 128;
  assert.equal(crownRow(new Float32Array(size * size), size, size, { centerX: 0.5, halfWidth: 0.1 }), null);
  const cut = ellipseMask(size, 64, -20, 30, 50);
  assert.equal(crownRow(cut, size, size, { centerX: 0.5, halfWidth: 0.1 }), null);
});

test("crownRow ignores a stray speck above the head", () => {
  const size = 256;
  const mask = ellipseMask(size, 128, 60, 50, 70);
  mask[5 * size + 128] = 1;
  const row = crownRow(mask, size, size, { centerX: 0.5, halfWidth: 0.12 });
  assert.ok(row * size > 55);
});

test("fitCrop puts the head at the middle of the allowed range", () => {
  const source = { w: 2000, h: 3000 };
  const crop = fitCrop({ crownY: 400, chinY: 1200, centerX: 1000 }, US, source);
  const mm = US.photo.h / crop.h;
  assert.ok(Math.abs(800 * mm - 30) < 1e-9);
  assert.ok(Math.abs(crop.w / crop.h - 1) < 1e-9);
  assert.ok(Math.abs(crop.x + crop.w / 2 - 1000) < 1e-9);
});

test("fitCrop shrinks to the picture when it is too tight for the target head size", () => {
  const source = { w: 900, h: 1200 };
  const crop = fitCrop({ crownY: 100, chinY: 1000, centerX: 450 }, US, source);
  assert.ok(crop.h <= 1200 + 1e-9 && crop.w <= 900 + 1e-9);
  assert.ok(crop.x >= 0 && crop.y >= 0);
  const mm = US.photo.h / crop.h;
  assert.ok(900 * mm > US.head.max);
});

test("clampCrop keeps a crop inside the picture when it fits", () => {
  const out = clampCrop({ x: -50, y: 900, w: 500, h: 500 }, { w: 1000, h: 1200 });
  assert.deepEqual([out.x, out.y], [0, 700]);
});

function measured(overrides = {}) {
  return { chinY: 1200, crownY: 400, centerX: 1000, rollDeg: 0.5, yawDeg: 1, pitchDeg: 5.5, ...overrides };
}
const calm = { mouthSmileLeft: 0.02, mouthSmileRight: 0.03, jawOpen: 0.01, eyeBlinkLeft: 0.1, eyeBlinkRight: 0.12 };

test("evaluate passes a well framed head and reports it as ready", () => {
  const source = { w: 2000, h: 3000 };
  const crop = fitCrop({ crownY: 400, chinY: 1200, centerX: 1000 }, US, source);
  const result = evaluate(measured(), crop, US, source, calm);
  assert.equal(result.ready, true);
  assert.ok(Math.abs(result.headMm - 30) < 1e-9);
});

test("evaluate flags a head that is too small and one that is too large", () => {
  const source = { w: 4000, h: 4000 };
  const small = evaluate(measured(), { x: 0, y: 0, w: 3000, h: 3000 }, US, source, calm);
  assert.equal(small.rules.find((r) => r.id === "head").status, "fail");
  const large = evaluate(measured(), { x: 600, y: 300, w: 800, h: 800 }, US, source, calm);
  assert.equal(large.rules.find((r) => r.id === "head").status, "fail");
});

test("evaluate reports a smile, a tilted head and a crop outside the picture", () => {
  const source = { w: 2000, h: 3000 };
  const crop = fitCrop({ crownY: 400, chinY: 1200, centerX: 1000 }, US, source);
  const smiling = evaluate(measured(), crop, US, source, { ...calm, mouthSmileLeft: 0.8, mouthSmileRight: 0.8 });
  assert.equal(smiling.rules.find((r) => r.id === "expression").status, "fail");
  const tilted = evaluate(measured({ rollDeg: 8 }), crop, US, source, calm);
  assert.equal(tilted.rules.find((r) => r.id === "level").status, "fail");
  const turned = evaluate(measured({ yawDeg: 12 }), crop, US, source, calm);
  assert.equal(turned.rules.find((r) => r.id === "facing").status, "fail");
  const nodding = evaluate(measured({ pitchDeg: 20 }), crop, US, source, calm);
  assert.equal(nodding.rules.find((r) => r.id === "facing").status, "fail");
  const outside = evaluate(measured(), { ...crop, y: -300 }, US, source, calm);
  assert.equal(outside.rules.find((r) => r.id === "inFrame").status, "fail");
});

test("evaluate leaves a rule unknown when it cannot measure it", () => {
  const source = { w: 2000, h: 3000 };
  const crop = { x: 400, y: 100, w: 1200, h: 1200 };
  const result = evaluate(measured({ crownY: null }), crop, US, source, null);
  const byId = Object.fromEntries(result.rules.map((r) => [r.id, r.status]));
  assert.equal(byId.head, "unknown");
  assert.equal(byId.expression, "unknown");
  assert.equal(result.ready, false);
});

test("faceMetrics reads roll from the eyes and centers on the cheeks", () => {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  lm[468] = { x: 0.4, y: 0.4 };
  lm[473] = { x: 0.6, y: 0.4 + 0.2 * Math.tan((10 * Math.PI) / 180) };
  lm[234] = { x: 0.3, y: 0.5 };
  lm[454] = { x: 0.7, y: 0.5 };
  lm[152] = { x: 0.5, y: 0.8 };
  const m = faceMetrics(lm, 1000, 1000);
  assert.ok(Math.abs(m.rollDeg - 10) < 1e-6);
  assert.equal(m.centerX, 500);
});

test("headRegion is a square centered on the face", () => {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  lm[10] = { x: 0.5, y: 0.3 };
  lm[152] = { x: 0.5, y: 0.7 };
  lm[234] = { x: 0.4, y: 0.5 };
  lm[454] = { x: 0.6, y: 0.5 };
  const r = headRegion(lm, 1000, 1000);
  assert.ok(Math.abs(r.x + r.size / 2 - 500) < 1e-9 && Math.abs(r.y + r.size / 2 - 500) < 1e-9);
  assert.ok(Math.abs(r.size - 960) < 1e-9);
});
