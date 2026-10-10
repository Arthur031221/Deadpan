import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { readJpegDpi } from "../../app/src/core/sheet.js";
import { jpegSize, launch, ruleStatuses, serve } from "./helpers.js";

let site;
let session;

before(async () => {
  site = await serve();
  session = await launch({ camera: true });
});
after(async () => {
  await session.browser.close();
  await site.close();
});

test("the guide turns green on the camera feed, takes the picture and builds a 4 x 6 sheet", async () => {
  const { page, requests, errors } = session;
  await page.goto(site.url);
  await page.click("text=Start camera");
  await page.waitForSelector('#stage[data-state="live"]');
  await page.waitForSelector('#stage[data-state="adjust"]', { timeout: 90000 });

  assert.deepEqual(Object.values(await ruleStatuses(page)), Array(8).fill("pass"));
  const head = await page.textContent(".rule .val");
  assert.match(head, /^(2[5-9]|3[0-5])\.\d mm$/);

  await page.click("text=Make the print sheet");
  const [sheet] = await Promise.all([page.waitForEvent("download"), page.click("#dlSheet")]);
  const bytes = new Uint8Array(await readFile(await sheet.path()));
  assert.deepEqual(jpegSize(bytes), { w: 1200, h: 1800 });
  assert.deepEqual(readJpegDpi(bytes), { x: 300, y: 300 });
  assert.match(await page.textContent("#sheetNote"), /^6 photos on 4 x 6 in/);

  assert.deepEqual(errors, []);
  const blocked = await page.evaluate(() =>
    fetch("https://example.com/").then(
      () => "reached",
      () => "blocked",
    ),
  );
  assert.equal(blocked, "blocked");
  assert.ok(
    requests.every((url) => url.startsWith(site.origin) || url.startsWith("blob:") || url.startsWith("data:")),
    requests.filter((u) => !u.startsWith(site.origin)).join("\n"),
  );
});
