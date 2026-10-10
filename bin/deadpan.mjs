#!/usr/bin/env node
// Serves the built-in page on localhost. Browsers only allow camera access on
// localhost or https, so opening index.html from disk would not work.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../app", import.meta.url)));
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
  ".tflite": "application/octet-stream",
  ".webmanifest": "application/manifest+json",
};

export function createApp() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let path = normalize(decodeURIComponent(url.pathname));
      if (path.endsWith(sep) || path.endsWith("/")) path += "index.html";
      const file = join(ROOT, path);
      if (file !== ROOT && !file.startsWith(ROOT + sep)) throw Object.assign(new Error("outside"), { code: "ENOENT" });
      if (!(await stat(file)).isFile()) throw Object.assign(new Error("not a file"), { code: "ENOENT" });
      res.writeHead(200, {
        "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(await readFile(file));
    } catch (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500).end(err.code === "ENOENT" ? "Not found" : "Server error");
    }
  });
}

function main(argv) {
  const portArg = argv.find((a) => /^\d+$/.test(a));
  const port = Number(portArg ?? process.env.PORT ?? 4173);
  const server = createApp();
  server.on("error", (err) => {
    console.error(err.code === "EADDRINUSE" ? `Port ${port} is busy. Try: npx deadpan 4180` : err.message);
    process.exit(1);
  });
  server.listen(port, "127.0.0.1", () => {
    const url = `http://localhost:${port}/`;
    console.log(`Deadpan is running at ${url}\nPress Ctrl+C to stop. Your photos never leave this computer.`);
    if (!argv.includes("--no-open")) {
      const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      spawn(opener, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" })
        .on("error", () => {})
        .unref();
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
