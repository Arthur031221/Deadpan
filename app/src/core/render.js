// Canvas output: one photo, the print sheet, and JPEG encoding.
import { PRINT_DPI, packSheet, photoPixels, withJpegDpi } from "./sheet.js";

const canvasOf = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });

/** Cuts `crop` out of `source` into a canvas of the photo's pixel size. */
export function renderPhoto(source, crop, spec, dpi = PRINT_DPI) {
  const { w, h } = photoPixels(spec.photo, dpi);
  const canvas = canvasOf(w, h);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h);
  return canvas;
}

/** Tiles a photo canvas on the paper at 300 dpi, with thin cut lines. */
export function renderSheet(photoCanvas, paper, spec) {
  const pack = packSheet(paper, spec.photo);
  const mm = PRINT_DPI / 25.4;
  const sheet = canvasOf(Math.round(paper.w * mm), Math.round(paper.h * mm));
  const ctx = sheet.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.imageSmoothingQuality = "high";
  for (const cell of pack.cells) {
    const x = Math.round(cell.x * mm);
    const y = Math.round(cell.y * mm);
    const w = Math.round(cell.w * mm);
    const h = Math.round(cell.h * mm);
    if (pack.rotated) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(photoCanvas, 0, 0, h, w);
      ctx.restore();
    } else {
      ctx.drawImage(photoCanvas, x, y, w, h);
    }
  }
  ctx.strokeStyle = "rgba(120,120,120,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const cell of pack.cells)
    ctx.rect(
      Math.round(cell.x * mm) + 0.5,
      Math.round(cell.y * mm) + 0.5,
      Math.round(cell.w * mm) - 1,
      Math.round(cell.h * mm) - 1,
    );
  ctx.stroke();
  return { canvas: sheet, pack };
}

export async function toJpeg(canvas, quality = 0.92, dpi = PRINT_DPI) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return withJpegDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
}

/** Highest JPEG quality that stays under a byte limit, or null if none does. */
export async function toJpegUnder(canvas, maxBytes, dpi = PRINT_DPI) {
  let lo = 0.4;
  let hi = 0.95;
  let best = null;
  for (let i = 0; i < 7; i++) {
    const q = (lo + hi) / 2;
    const bytes = await toJpeg(canvas, q, dpi);
    if (bytes.length <= maxBytes) {
      best = bytes;
      lo = q;
    } else hi = q;
  }
  return best;
}

export function download(name, bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
