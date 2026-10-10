import assert from "node:assert/strict";
import { test } from "node:test";
import { PAPERS, packSheet, photoPixels, readJpegDpi, withJpegDpi } from "../app/src/core/sheet.js";
import { CHECKED, SPECS, findSpec } from "../app/src/core/specs.js";

test("six US photos tile a 4 x 6 print exactly", () => {
  const pack = packSheet(PAPERS["4x6"], findSpec("us").photo);
  assert.equal(pack.count, 6);
  assert.equal(pack.rotated, false);
  assert.ok(Math.abs(pack.grid.w - 101.6) < 1e-6 && pack.grid.x < 1e-6);
});

test("35 x 45 photos turn sideways to get eight on a 4 x 6", () => {
  const pack = packSheet(PAPERS["4x6"], findSpec("tw").photo);
  assert.equal(pack.count, 8);
  assert.equal(pack.rotated, true);
});

test("cells never overlap or leave the paper", () => {
  for (const spec of SPECS) {
    for (const paper of Object.values(PAPERS)) {
      const { cells } = packSheet(paper, spec.photo);
      for (const c of cells) {
        assert.ok(c.x >= -1e-6 && c.y >= -1e-6 && c.x + c.w <= paper.w + 1e-6 && c.y + c.h <= paper.h + 1e-6);
      }
      for (let i = 0; i < cells.length; i++)
        for (let j = i + 1; j < cells.length; j++) {
          const a = cells[i];
          const b = cells[j];
          const apart =
            a.x + a.w <= b.x + 1e-6 || b.x + b.w <= a.x + 1e-6 || a.y + a.h <= b.y + 1e-6 || b.y + b.h <= a.y + 1e-6;
          assert.ok(apart);
        }
    }
  }
});

test("photo pixel sizes follow the print resolution", () => {
  assert.deepEqual(photoPixels({ w: 50.8, h: 50.8 }), { w: 600, h: 600 });
  assert.deepEqual(photoPixels({ w: 35, h: 45 }, 600), { w: 827, h: 1063 });
});

test("withJpegDpi rewrites the density of an existing JFIF header", () => {
  const jfif = Uint8Array.from([
    0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xdb, 1, 2, 3,
  ]);
  const out = withJpegDpi(jfif, 300);
  assert.deepEqual(readJpegDpi(out), { x: 300, y: 300 });
  assert.equal(out.length, jfif.length);
  assert.deepEqual([...out.subarray(20)], [...jfif.subarray(20)]);
});

test("withJpegDpi adds a JFIF header when the file has none", () => {
  const bare = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0, 3, 7, 0xff, 0xd9]);
  const out = withJpegDpi(bare, 600);
  assert.deepEqual(readJpegDpi(out), { x: 600, y: 600 });
  assert.equal(out.length, bare.length + 18);
  assert.deepEqual([...out.subarray(20)], [...bare.subarray(2)]);
  assert.throws(() => withJpegDpi(Uint8Array.of(1, 2, 3), 300));
});

test("every preset names its source and a sane head range", () => {
  for (const s of SPECS) {
    assert.ok(s.source.url.startsWith("https://"), s.id);
    assert.ok(s.head.min > 0 && s.head.max > s.head.min && s.head.max < s.photo.h, s.id);
  }
  assert.match(CHECKED, /^\d{4}-\d{2}-\d{2}$/);
});
