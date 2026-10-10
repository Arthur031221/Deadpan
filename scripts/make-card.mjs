#!/usr/bin/env node
// Renders assets/social-card.png (1200 x 675) from a screenshot of the real page.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../bin/deadpan.mjs";

const OUT = fileURLToPath(new URL("../assets/social-card.png", import.meta.url));
const portrait = fileURLToPath(new URL("../test/fixtures/portraits/21.jpg", import.meta.url));

const server = createApp();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch();

const shotPage = await (
  await browser.newContext({ viewport: { width: 1180, height: 900 }, colorScheme: "dark", deviceScaleFactor: 2 })
).newPage();
await shotPage.goto(`http://127.0.0.1:${server.address().port}/`);
await shotPage.setInputFiles("#file", portrait);
await shotPage.waitForSelector('#stage[data-state="adjust"]');
await shotPage.waitForTimeout(600);
const shot = (await shotPage.screenshot({ clip: { x: 60, y: 215, width: 1070, height: 580 } })).toString("base64");

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: G; src: url(data:font/woff2;base64,${(await readFile(new URL("../app/fonts/schibsted-grotesk-latin-wght-normal.woff2", import.meta.url))).toString("base64")}); font-weight: 400 900; }
@font-face { font-family: M; src: url(data:font/woff2;base64,${(await readFile(new URL("../app/fonts/ibm-plex-mono-latin-500-normal.woff2", import.meta.url))).toString("base64")}); }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 675px; background: #0e1113; color: #ecebe6; font-family: G, sans-serif; position: relative; overflow: hidden; }
.glow { position: absolute; right: -120px; top: 40px; width: 760px; height: 760px; background: radial-gradient(circle, rgba(53,192,126,.22), transparent 62%); }
.copy { position: absolute; left: 64px; top: 70px; width: 520px; }
.brand { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 700; }
.mark { width: 46px; height: 46px; border-radius: 13px; background: #ecebe6; position: relative; }
.mark i { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: #0e1113; top: 17px; }
.mark i:nth-child(1) { left: 14px; } .mark i:nth-child(2) { right: 14px; }
.mark b { position: absolute; left: 14px; right: 14px; bottom: 14px; height: 4px; border-radius: 2px; background: #35c07e; }
h1 { font-size: 84px; line-height: .98; letter-spacing: -.035em; margin-top: 54px; }
h1 span { color: #35c07e; }
p { font-size: 26px; color: #9ba0a4; margin-top: 26px; line-height: 1.35; }
.stat { position: absolute; left: 64px; bottom: 64px; font-family: M, monospace; font-size: 22px; color: #35c07e; line-height: 1.5; }
.stat small { display: block; color: #8d9296; font-size: 17px; }
.shot { position: absolute; left: 600px; top: 78px; width: 740px; border-radius: 22px; box-shadow: 0 0 0 2px #35c07e, 0 30px 80px rgba(0,0,0,.6); }
</style><body><div class="glow"></div>
<div class="copy"><div class="brand"><div class="mark"><i></i><i></i><b></b></div>Deadpan</div>
<h1>Passport photos that <span>pass.</span></h1>
<p>A live guide in your browser. Nothing is uploaded.</p></div>
<div class="stat">29 of 30 head size verdicts match<small>hand-marked chin and crown points, 30 portraits</small></div>
<img class="shot" src="data:image/png;base64,${shot}"></body>`;

const card = await (await browser.newContext({ viewport: { width: 1200, height: 675 } })).newPage();
await card.setContent(html);
await card.evaluate(() => document.fonts.ready);
await card.screenshot({ path: OUT });
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log(`wrote ${OUT}`);
