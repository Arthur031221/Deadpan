import { crc32, deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../bin/deadpan.mjs";

export const CLIP = fileURLToPath(new URL("../fixtures/camera.mjpeg", import.meta.url));
export const portrait = (name) => fileURLToPath(new URL(`../fixtures/portraits/${name}`, import.meta.url));

export async function serve() {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/`,
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export async function launch({ camera = false, viewport = { width: 1100, height: 900 }, colorScheme = "light" } = {}) {
  const args = camera
    ? [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        `--use-file-for-fake-video-capture=${CLIP}`,
      ]
    : [];
  const browser = await chromium.launch({ args });
  const context = await browser.newContext({
    viewport,
    colorScheme,
    acceptDownloads: true,
    permissions: camera ? ["camera"] : [],
  });
  await context.addInitScript(() => localStorage.clear());
  const page = await context.newPage();
  const requests = [];
  page.on("request", (req) => requests.push(req.url()));
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on(
    "console",
    (msg) => msg.type() === "error" && /Content Security Policy|Refused/.test(msg.text()) && errors.push(msg.text()),
  );
  return { browser, page, requests, errors };
}

export const ruleStatuses = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll(".rule")]
        .slice(0, 8)
        .map((row, i) => [
          ["head", "centered", "inFrame", "level", "facing", "expression", "eyes", "pixels"][i],
          row.dataset.status,
        ]),
    ),
  );

export function jpegSize(bytes) {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error("bad marker");
    const marker = bytes[i + 1];
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker >= 0xc0 && marker <= 0xc3)
      return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
    i += 2 + len;
  }
  throw new Error("no frame header");
}

/** A plain grey PNG with no face in it. */
export function solidPng(size) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 150)]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
