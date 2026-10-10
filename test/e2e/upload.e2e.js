import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { jpegSize, launch, portrait, ruleStatuses, serve, solidPng } from "./helpers.js";

let site;
let session;

before(async () => {
  site = await serve();
  session = await launch();
});
after(async () => {
  await session.browser.close();
  await site.close();
});

async function load(name, spec = "us") {
  const { page } = session;
  await page.goto(site.url);
  await page.selectOption("#spec", spec);
  await page.setInputFiles("#file", portrait(name));
  await page.waitForSelector('#stage[data-state="adjust"]', { timeout: 60000 });
}

test("a smiling official portrait fails only the expression rule and auto fit lands the head in range", async () => {
  await load("17.jpg");
  const statuses = await ruleStatuses(session.page);
  assert.equal(statuses.head, "pass");
  assert.equal(statuses.expression, "fail");
  assert.equal(statuses.level, "pass");
});

test("switching the photo type refits the crop to the new rules", async () => {
  await load("23.jpg");
  await session.page.selectOption("#spec", "tw");
  await session.page.waitForFunction(() =>
    document.querySelector(".spec-card strong").textContent.startsWith("35 x 45"),
  );
  assert.equal((await ruleStatuses(session.page)).head, "pass");
  const head = parseFloat(await session.page.textContent(".rule .val"));
  assert.ok(head >= 32 && head <= 36, `head ${head}`);
});

test("US visa export is a square JPEG under 240 KB", async () => {
  await load("23.jpg", "us-visa");
  await session.page.click("text=Make the print sheet");
  const [file] = await Promise.all([session.page.waitForEvent("download"), session.page.click("#dlDigital")]);
  const bytes = new Uint8Array(await readFile(await file.path()));
  const { w, h } = jpegSize(bytes);
  assert.equal(w, h);
  assert.ok(w >= 600 && w <= 1200);
  assert.ok(bytes.length <= 240000, `${bytes.length} bytes`);
});

test("the page switches to Traditional Chinese and keeps the rules readable", async () => {
  await load("23.jpg");
  await session.page.selectOption("#lang", "zh-TW");
  assert.match(await session.page.textContent(".rule .label"), /頭部高度/);
  assert.equal(await session.page.evaluate(() => document.documentElement.lang), "zh-TW");
});

test("a custom size uses the numbers typed in", async () => {
  await load("23.jpg", "custom");
  await session.page.fill('#custom input[name="min"]', "20");
  await session.page.fill('#custom input[name="max"]', "24");
  const need = await session.page.textContent(".rule .need");
  assert.match(need, /20\.0 to 24\.0/);
});

test("a picture without a face says so instead of guessing", async () => {
  const { page } = session;
  await page.goto(site.url);
  await page.setInputFiles("#file", { name: "wall.png", mimeType: "image/png", buffer: solidPng(400) });
  await page.waitForSelector('#stage[data-state="adjust"]', { timeout: 60000 });
  assert.equal((await ruleStatuses(page)).head, "unknown");
  assert.match(await page.textContent("#hud"), /No face/);
});

test("scrolling on the photo zooms the crop and the head readout follows", async () => {
  await load("21.jpg");
  const { page } = session;
  const before = parseFloat(await page.textContent(".rule .val"));
  const box = await page.locator("#stage").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 400);
  await page.waitForFunction((was) => parseFloat(document.querySelector(".rule .val").textContent) < was - 2, before);
  await page.click("text=Fit the head size");
  await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector(".rule .val").textContent) - 30) < 0.05);
});
