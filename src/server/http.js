import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const PUBLIC_DIR = join(ROOT_DIR, "public");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

export function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

export function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8"
  });
  response.end(text);
}

export async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    return {};
  }
  return JSON.parse(raw);
}

export async function serveStatic(request, response) {
  const url = new URL(request.url, "http://localhost");
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const absolutePath = resolve(join(PUBLIC_DIR, safePath));

  if (!absolutePath.startsWith(PUBLIC_DIR)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const info = await stat(absolutePath);
    if (!info.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }

    const extension = extname(absolutePath);
    response.writeHead(200, {
      "content-type": MIME_TYPES[extension] ?? "application/octet-stream",
      "cache-control": "no-cache"
    });
    createReadStream(absolutePath).pipe(response);
  } catch {
    const fallback = await readFile(join(PUBLIC_DIR, "index.html"));
    response.writeHead(200, {
      "content-type": MIME_TYPES[".html"],
      "cache-control": "no-cache"
    });
    response.end(fallback);
  }
}
