// Print sheet layout and file helpers. Lengths are millimetres.

export const PAPERS = {
  "4x6": { name: "4 x 6 in", w: 101.6, h: 152.4 },
  a6: { name: "A6", w: 105, h: 148 },
};

export const PRINT_DPI = 300;

/** Fits as many photos as possible on the paper, upright or turned a quarter. */
export function packSheet(paper, photo) {
  const fits = (pw, ph) => ({
    cols: Math.floor((paper.w + 1e-6) / pw),
    rows: Math.floor((paper.h + 1e-6) / ph),
    pw,
    ph,
  });
  const upright = fits(photo.w, photo.h);
  const turned = fits(photo.h, photo.w);
  const best =
    turned.cols * turned.rows > upright.cols * upright.rows
      ? { ...turned, rotated: true }
      : { ...upright, rotated: false };
  const gridW = best.cols * best.pw;
  const gridH = best.rows * best.ph;
  const ox = (paper.w - gridW) / 2;
  const oy = (paper.h - gridH) / 2;
  const cells = [];
  for (let r = 0; r < best.rows; r++) {
    for (let c = 0; c < best.cols; c++)
      cells.push({ x: ox + c * best.pw, y: oy + r * best.ph, w: best.pw, h: best.ph });
  }
  return { ...best, cells, count: cells.length, grid: { x: ox, y: oy, w: gridW, h: gridH } };
}

const mmToPx = (mm, dpi = PRINT_DPI) => Math.round((mm / 25.4) * dpi);

/** Pixel size of one photo at a print resolution. */
export function photoPixels(photo, dpi = PRINT_DPI) {
  return { w: mmToPx(photo.w, dpi), h: mmToPx(photo.h, dpi) };
}

/**
 * Sets the pixel density in a JPEG's JFIF header so print shops read the
 * intended size. Adds a JFIF segment when the file has none.
 */
export function withJpegDpi(bytes, dpi) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Not a JPEG file");
  const jfif = bytes[2] === 0xff && bytes[3] === 0xe0 && bytes[6] === 0x4a && bytes[7] === 0x46;
  const out = jfif ? Uint8Array.from(bytes) : new Uint8Array(bytes.length + 18);
  if (!jfif) {
    out.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0, 0, 0, 0, 0, 0], 0);
    out.set(bytes.subarray(2), 20);
  }
  out[13] = 1;
  out[14] = dpi >> 8;
  out[15] = dpi & 0xff;
  out[16] = dpi >> 8;
  out[17] = dpi & 0xff;
  return out;
}

/** Reads the density back, for tests and the self check. */
export function readJpegDpi(bytes) {
  if (bytes[2] !== 0xff || bytes[3] !== 0xe0 || bytes[13] !== 1) return null;
  return { x: (bytes[14] << 8) | bytes[15], y: (bytes[16] << 8) | bytes[17] };
}
