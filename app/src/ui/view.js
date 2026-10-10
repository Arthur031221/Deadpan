// Drawing on the stage canvas: the photo crop and the live guide on top of it.

export function sizeCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { width, height } = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(width * dpr));
  const h = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { w, h, dpr };
}

/** Largest rectangle of the photo's aspect, centered in the source. */
export function centerCrop(srcW, srcH, aspect) {
  if (srcW / srcH >= aspect) {
    const w = srcH * aspect;
    return { x: (srcW - w) / 2, y: 0, w, h: srcH };
  }
  const h = srcW / aspect;
  return { x: 0, y: (srcH - h) / 2, w: srcW, h };
}

export function drawFrame(canvas, source, crop, mirrored) {
  const ctx = canvas.getContext("2d");
  // A crop can reach past the picture, so clear what an earlier frame left behind.
  ctx.fillStyle = "#0b0d0f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (mirrored) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

const COLORS = { pass: "#35c07e", fail: "#f0645b", idle: "rgba(255,255,255,0.7)" };

/**
 * Head guide: the dashed oval is where a head of the middle allowed size sits.
 * The band above the measured chin is where the crown has to land.
 */
export function drawGuide(canvas, { crop, spec, m, headStatus, mirrored, dpr }) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const mmPx = H / spec.photo.h;
  const sx = (x) => (mirrored ? W - ((x - crop.x) * W) / crop.w : ((x - crop.x) * W) / crop.w);
  const sy = (y) => ((y - crop.y) * H) / crop.h;

  const target = (spec.head.min + spec.head.max) / 2;
  const top = 0.4 * (spec.photo.h - target) * mmPx;
  ctx.save();
  ctx.setLineDash([8 * dpr, 8 * dpr]);
  ctx.lineWidth = 2 * dpr;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(W / 2, top + (target * mmPx) / 2, target * mmPx * 0.38, (target * mmPx) / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  if (!m) return;

  const color = COLORS[headStatus] ?? COLORS.idle;
  const cx = sx(m.centerX);
  const chin = sy(m.chinY);
  const bandTop = chin - spec.head.max * mmPx;
  const bandBottom = chin - spec.head.min * mmPx;
  ctx.fillStyle = headStatus === "pass" ? "rgba(53,192,126,0.22)" : "rgba(240,100,91,0.18)";
  ctx.fillRect(0, bandTop, W, bandBottom - bandTop);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 * dpr;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(0, bandTop);
  ctx.lineTo(W, bandTop);
  ctx.moveTo(0, bandBottom);
  ctx.lineTo(W, bandBottom);
  ctx.stroke();

  const tick = (y) => {
    ctx.beginPath();
    ctx.lineWidth = 3 * dpr;
    ctx.moveTo(cx - 0.12 * W, y);
    ctx.lineTo(cx + 0.12 * W, y);
    ctx.stroke();
  };
  tick(chin);
  if (m.crownY != null) tick(sy(m.crownY));
}
