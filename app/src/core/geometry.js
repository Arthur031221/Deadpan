// Pure measurements on a face and a person mask. Coordinates are source pixels
// unless a name says otherwise, y grows downward.

export const LM = { chin: 152, cheekA: 234, cheekB: 454, irisA: 468, irisB: 473 };

// MediaPipe's canonical face sits about 5 degrees nose-up against a level head.
// The median pitch over 30 frontal official portraits is 4.9, so it is removed.
export const PITCH_OFFSET_DEG = 5;

export const LIMITS = {
  rollDeg: 4,
  poseDeg: 8,
  smile: 0.25,
  jawOpen: 0.12,
  blink: 0.5,
  centerFraction: 0.06,
  minDpi: 300,
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Landmark-only measurements of one face. `lm` holds normalized points. */
export function faceMetrics(lm, w, h) {
  const px = (i) => ({ x: lm[i].x * w, y: lm[i].y * h });
  const [left, right] = [px(LM.irisA), px(LM.irisB)].sort((a, b) => a.x - b.x);
  const cheekA = px(LM.cheekA);
  const cheekB = px(LM.cheekB);
  const chin = px(LM.chin);
  const faceWidth = dist(cheekA, cheekB);
  const centerX = (cheekA.x + cheekB.x) / 2;
  return {
    chin,
    faceWidth,
    centerX,
    eyeMid: { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 },
    rollDeg: (Math.atan2(right.y - left.y, right.x - left.x) * 180) / Math.PI,
  };
}

/**
 * Square region of the source that holds the head with room for hair, in
 * pixels. The segmenter runs on this region so the head fills most of its
 * 256 x 256 input.
 */
export function headRegion(lm, w, h) {
  const top = lm[10].y * h;
  const chin = lm[LM.chin].y * h;
  const faceHeight = chin - top;
  const cx = ((lm[LM.cheekA].x + lm[LM.cheekB].x) / 2) * w;
  const cy = (top + chin) / 2;
  const side = faceHeight * 2.4;
  return { x: cx - side / 2, y: cy - side / 2, size: side };
}

/**
 * Top of the head from a person-confidence mask: the first row whose band of
 * columns around the face holds enough person pixels. Returns the row as a
 * fraction of the mask height (0 is the top row), or null when the person
 * touches the top edge of the mask or no row qualifies.
 */
export function crownRow(mask, mw, mh, { centerX, halfWidth }, { threshold = 0.5, rowShare = 0.2 } = {}) {
  const x0 = Math.max(0, Math.floor(centerX * mw - halfWidth * mw));
  const x1 = Math.min(mw - 1, Math.ceil(centerX * mw + halfWidth * mw));
  const need = Math.max(2, Math.round((x1 - x0 + 1) * rowShare));
  for (let y = 0; y < mh; y++) {
    let count = 0;
    for (let x = x0; x <= x1; x++) if (mask[y * mw + x] > threshold) count++;
    if (count >= need) {
      if (y === 0) return null;
      const above = rowShareAt(mask, mw, y - 1, x0, x1, threshold);
      const here = count / (x1 - x0 + 1);
      // Interpolate where the 20 percent line falls between the two rows.
      const t = here > above ? (rowShare - above) / (here - above) : 1;
      return (y - 1 + Math.min(1, Math.max(0, t))) / mh;
    }
  }
  return null;
}

function rowShareAt(mask, mw, y, x0, x1, threshold) {
  let count = 0;
  for (let x = x0; x <= x1; x++) if (mask[y * mw + x] > threshold) count++;
  return count / (x1 - x0 + 1);
}

/** Crop rectangle (source px) that puts the head at the middle of the allowed range. */
export function fitCrop({ crownY, chinY, centerX }, spec, source) {
  const headPx = chinY - crownY;
  const targetMm = (spec.head.min + spec.head.max) / 2;
  // A picture too tight for this head size gets the largest crop it can hold, so the head rule reports the real size.
  const h = Math.min((headPx * spec.photo.h) / targetMm, source.h, (source.w * spec.photo.h) / spec.photo.w);
  const w = (h * spec.photo.w) / spec.photo.h;
  const top = crownY - 0.4 * (spec.photo.h - (headPx * spec.photo.h) / h) * (h / spec.photo.h);
  return clampCrop({ x: centerX - w / 2, y: top, w, h }, source);
}

/** Moves a crop inside the source when it is small enough to fit. */
export function clampCrop(crop, source) {
  const x = crop.w >= source.w ? crop.x : Math.min(Math.max(crop.x, 0), source.w - crop.w);
  const y = crop.h >= source.h ? crop.y : Math.min(Math.max(crop.y, 0), source.h - crop.h);
  return { ...crop, x, y };
}

const status = (ok) => (ok == null ? "unknown" : ok ? "pass" : "fail");

/**
 * Checks one measured head against a spec and a crop. `m` holds source-pixel
 * measurements, `expression` the blendshape scores (or null).
 * Each rule says whether its numbers come from the official spec ("spec") or
 * are Deadpan's own tolerance on a qualitative rule ("guide").
 */
export function evaluate(m, crop, spec, source, expression = null) {
  const mm = spec.photo.h / crop.h;
  const headMm = m.crownY == null ? null : (m.chinY - m.crownY) * mm;
  const offsetMm = (m.centerX - (crop.x + crop.w / 2)) * mm;
  const dpi = crop.h / (spec.photo.h / 25.4);
  const inside =
    crop.x >= -0.5 && crop.y >= -0.5 && crop.x + crop.w <= source.w + 0.5 && crop.y + crop.h <= source.h + 0.5;
  const topMarginMm = m.crownY == null ? null : (m.crownY - crop.y) * mm;
  const bottomMarginMm = (crop.y + crop.h - m.chinY) * mm;
  const pose = m.yawDeg == null ? null : Math.max(Math.abs(m.yawDeg), Math.abs(m.pitchDeg - PITCH_OFFSET_DEG));
  const smile = expression ? (expression.mouthSmileLeft + expression.mouthSmileRight) / 2 : null;
  const blink = expression ? Math.max(expression.eyeBlinkLeft, expression.eyeBlinkRight) : null;
  const jaw = expression ? expression.jawOpen : null;

  const rules = [
    {
      id: "head",
      basis: "spec",
      value: headMm,
      unit: "mm",
      need: [spec.head.min, spec.head.max],
      status: status(headMm == null ? null : headMm >= spec.head.min && headMm <= spec.head.max),
    },
    {
      id: "centered",
      basis: "guide",
      value: offsetMm,
      unit: "mm",
      need: [-spec.photo.w * LIMITS.centerFraction, spec.photo.w * LIMITS.centerFraction],
      status: status(Math.abs(offsetMm) <= spec.photo.w * LIMITS.centerFraction),
    },
    {
      id: "inFrame",
      basis: "guide",
      value: Math.min(topMarginMm ?? Infinity, bottomMarginMm),
      unit: "mm",
      need: [1, null],
      status: status(topMarginMm == null ? null : inside && topMarginMm >= 1 && bottomMarginMm >= 1),
    },
    {
      id: "level",
      basis: "guide",
      value: m.rollDeg,
      unit: "deg",
      need: [-LIMITS.rollDeg, LIMITS.rollDeg],
      status: status(Math.abs(m.rollDeg) <= LIMITS.rollDeg),
    },
    {
      id: "facing",
      basis: "guide",
      value: pose,
      unit: "deg",
      need: [null, LIMITS.poseDeg],
      status: status(pose == null ? null : pose <= LIMITS.poseDeg),
    },
    {
      id: "expression",
      basis: "guide",
      value: smile == null ? null : Math.max(smile, jaw),
      unit: "",
      need: [null, LIMITS.smile],
      status: status(smile == null ? null : smile <= LIMITS.smile && jaw <= LIMITS.jawOpen),
    },
    {
      id: "eyes",
      basis: "guide",
      value: blink,
      unit: "",
      need: [null, LIMITS.blink],
      status: status(blink == null ? null : blink <= LIMITS.blink),
    },
    {
      id: "pixels",
      basis: "guide",
      value: dpi,
      unit: "dpi",
      need: [LIMITS.minDpi, null],
      status: status(dpi >= LIMITS.minDpi),
    },
  ];
  return { rules, headMm, ready: rules.every((r) => r.status === "pass") };
}
