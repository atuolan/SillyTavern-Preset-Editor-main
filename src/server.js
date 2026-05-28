#!/usr/bin/env node
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = normalize(join(__dirname, ".."));

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function safeDecodePath(urlPath) {
  try {
    return decodeURIComponent(urlPath);
  } catch {
    return null;
  }
}

function resolveFilePath(urlPath) {
  const decoded = safeDecodePath(urlPath);
  if (decoded == null) return null;
  const clean = decoded.split("?")[0].split("#")[0];
  const mapped = clean === "/" ? "web/index.html" : clean.replace(/^\/+/, "");
  const relative = normalize(mapped).replace(/^(\.\.(\/|\\|$))+/, "");
  const topDir = relative.split(sep)[0];
  if (!(topDir === "web" || topDir === "src")) return null;
  const fullPath = normalize(join(projectRoot, relative));
  if (!fullPath.startsWith(projectRoot)) return null;
  return fullPath;
}

const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  if (method !== "GET" && method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Method Not Allowed");
    return;
  }

  const filePath = resolveFilePath(req.url || "/");
  if (!filePath) {
    res.statusCode = 400;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Bad Request");
    return;
  }

  try {
    const st = await stat(filePath);
    if (!st.isFile()) {
      res.statusCode = 404;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("Not Found");
      return;
    }
  } catch {
    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Not Found");
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const ct = contentTypes[ext] || "application/octet-stream";

  res.statusCode = 200;
  res.setHeader("content-type", ct);
  res.setHeader("cache-control", "no-store");

  if (method === "HEAD") {
    res.end();
    return;
  }

  const buf = await readFile(filePath);
  res.end(buf);
});

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`UI server: http://${host}:${port}/`);
  // eslint-disable-next-line no-console
  console.log(`Open: http://${host}:${port}/ (loads /web/index.html)`);
});
