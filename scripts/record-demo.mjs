#!/usr/bin/env node
// Records the real page against the fake camera clip and turns it into assets/demo.gif.
// Needs ffmpeg on the PATH.
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../bin/deadpan.mjs";

const CLIP = fileURLToPath(new URL("../test/fixtures/camera.mjpeg", import.meta.url));
const OUT = fileURLToPath(new URL("../assets/demo.gif", import.meta.url));
const SIZE = { width: 1180, height: 900 };

const server = createApp();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const dir = await mkdtemp(join(tmpdir(), "deadpan-demo-"));
const browser = await chromium.launch({
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    `--use-file-for-fake-video-capture=${CLIP}`,
  ],
});
const context = await browser.newContext({
  viewport: SIZE,
  colorScheme: "dark",
  permissions: ["camera"],
  recordVideo: { dir, size: SIZE },
});
const page = await context.newPage();
const t0 = Date.now();
const mark = () => (Date.now() - t0) / 1000;

await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.evaluate(() => document.fonts.ready);
await page.click("text=Start camera");
await page.waitForSelector('#stage[data-state="live"]');
await page.waitForFunction(() => document.querySelector(".rule")?.dataset.status !== "unknown");
const live = mark();
await page.waitForSelector('#stage[data-state="adjust"]', { timeout: 60000 });
await page.waitForTimeout(2600);
await page.click("text=Make the print sheet");
await page.waitForTimeout(6500);
const end = mark();
await context.close();
await browser.close();
await new Promise((resolve) => server.close(resolve));

const [video] = await readdir(dir);
const start = Math.max(0, live - 0.1);
const filters =
  "fps=12,scale=880:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=112:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5";
execFileSync("ffmpeg", [
  "-loglevel",
  "error",
  "-y",
  "-ss",
  String(start),
  "-t",
  String(end - start),
  "-i",
  join(dir, video),
  "-vf",
  filters,
  "-loop",
  "0",
  OUT,
]);
await rm(dir, { recursive: true });
console.log(`wrote ${OUT}, ${(end - start).toFixed(1)} s`);
