#!/usr/bin/env node
// Runs Deadpan's own pipeline on 30 public domain portraits and compares the
// head height it measures with points marked by hand on the same pictures.
// The hand points live in test/fixtures/annotations.json and were marked
// before this comparison was run, on rulers that did not show Deadpan's output.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../bin/deadpan.mjs";
import { fitCrop } from "../app/src/core/geometry.js";
import { findSpec } from "../app/src/core/specs.js";

const fixtures = new URL("../test/fixtures/", import.meta.url);
const notes = JSON.parse(await readFile(new URL("annotations.json", fixtures), "utf8"));
const spec = findSpec(process.argv.find((a) => a.startsWith("--spec="))?.slice(7) ?? "us");

const server = createApp();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route("**/fixtures/**", async (route) => {
  const name = new URL(route.request().url()).pathname.replace("/fixtures/", "");
  await route.fulfill({ body: await readFile(fileURLToPath(new URL(name, fixtures))), contentType: "image/jpeg" });
});
await page.goto(`${origin}/`);

const measured = await page.evaluate(
  async (files) => {
    const { loadVision, analyze } = await import("/src/vision.js");
    const vision = await loadVision();
    const out = {};
    for (const file of files) {
      const blob = await (await fetch(`/fixtures/portraits/${file}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = Object.assign(document.createElement("canvas"), { width: bitmap.width, height: bitmap.height });
      canvas.getContext("2d").drawImage(bitmap, 0, 0);
      const r = analyze(vision, canvas, canvas.width, canvas.height);
      out[file] = r.m && { chinY: r.m.chinY, crownY: r.m.crownY, centerX: r.m.centerX };
    }
    return out;
  },
  notes.map((n) => n.file),
);
await browser.close();
await new Promise((resolve) => server.close(resolve));

const rows = [];
for (const n of notes) {
  const m = measured[n.file];
  const trueHead = (n.chinY - n.crownY) * n.height;
  if (!m || m.crownY == null) {
    rows.push({ file: n.file, declined: true });
    continue;
  }
  const crop = fitCrop(m, spec, { w: n.width, h: n.height });
  const mmPerPx = spec.photo.h / crop.h;
  const modelMm = (m.chinY - m.crownY) * mmPerPx;
  const trueMm = trueHead * mmPerPx;
  rows.push({
    file: n.file,
    modelMm,
    trueMm,
    errorMm: modelMm - trueMm,
    modelPass: modelMm >= spec.head.min && modelMm <= spec.head.max,
    truePass: trueMm >= spec.head.min && trueMm <= spec.head.max,
    crownErrPct: ((m.crownY - n.crownY * n.height) / trueHead) * 100,
    chinErrPct: ((m.chinY - n.chinY * n.height) / trueHead) * 100,
  });
}

const done = rows.filter((r) => !r.declined);
const sorted = (list) => [...list].sort((a, b) => a - b);
const median = (list) => sorted(list)[Math.floor(list.length / 2)];
const abs = (list) => list.map(Math.abs);
const summary = {
  spec: spec.id,
  photos: rows.length,
  declined: rows.length - done.length,
  agree: done.filter((r) => r.modelPass === r.truePass).length,
  modelPass: done.filter((r) => r.modelPass).length,
  passByHand: done.filter((r) => r.modelPass && r.truePass).length,
  medianAbsErrorMm: median(abs(done.map((r) => r.errorMm))),
  maxAbsErrorMm: Math.max(...abs(done.map((r) => r.errorMm))),
  meanSignedErrorMm: done.reduce((s, r) => s + r.errorMm, 0) / done.length,
  medianAbsCrownErrPct: median(abs(done.map((r) => r.crownErrPct))),
  medianAbsChinErrPct: median(abs(done.map((r) => r.chinErrPct))),
};
console.log(JSON.stringify(summary, null, 2));

if (process.argv.includes("--write")) {
  const f = (v, d = 1) => v.toFixed(d);
  const mid = (spec.head.min + spec.head.max) / 2;
  const lines = [
    `# Head height accuracy, ${spec.name}`,
    "",
    `For each photo Deadpan picks the crop that would make the head ${mid} mm (the middle of ${spec.head.min} to ${spec.head.max} mm). It never pads a picture, so a photo cropped too tightly for that gets the largest crop it can hold and its head reads larger. The hand marked chin and crown points give a second head height for the same crop. The two verdicts, inside the window or not, are compared.`,
    "",
    `- The verdicts agree on ${summary.agree} of ${summary.photos} photos (${summary.declined} declined)`,
    `- ${summary.passByHand} of the ${summary.modelPass} photos Deadpan passes are inside the window by hand measurement, and ${summary.photos - summary.modelPass} photos are too tight for this photo size`,
    `- median absolute error ${f(summary.medianAbsErrorMm)} mm, worst ${f(summary.maxAbsErrorMm)} mm, mean signed error ${f(summary.meanSignedErrorMm)} mm (positive means Deadpan reads the head larger than the hand points)`,
    `- crown error ${f(summary.medianAbsCrownErrPct)} percent of head height, chin error ${f(summary.medianAbsChinErrPct)} percent (medians)`,
    "",
    "| photo | Deadpan mm | by hand mm | error mm | crown err % | chin err % | Deadpan | by hand |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((r) =>
      r.declined
        ? `| ${r.file} | declined | | | | | | |`
        : `| ${r.file} | ${f(r.modelMm)} | ${f(r.trueMm)} | ${f(r.errorMm)} | ${f(r.crownErrPct)} | ${f(r.chinErrPct)} | ${r.modelPass ? "pass" : "fail"} | ${r.truePass ? "pass" : "fail"} |`,
    ),
    "",
  ];
  await writeFile(new URL("../docs/accuracy.md", import.meta.url), lines.join("\n"));
}
