import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getSource } from "./mcp/registry.js";
import { getDashboardSnapshot, routeAssistant } from "./server/assistantRouter.js";
import { handleMcpRequest } from "./server/mcpRuntime.js";
import { readJsonBody, sendJson, sendText, serveStatic } from "./server/http.js";

const PORT = Number(process.env.PORT || 4173);

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      app: "Campus Intelligence Dashboard",
      now: new Date().toISOString()
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/dashboard") {
    sendJson(response, 200, await getDashboardSnapshot());
    return true;
  }

  if (request.method === "POST" && pathname === "/api/assistant") {
    const body = await readJsonBody(request);
    const message = String(body.message ?? "").trim();
    if (!message) {
      sendJson(response, 400, { error: "message is required" });
      return true;
    }
    sendJson(response, 200, await routeAssistant(message));
    return true;
  }

  return false;
}

async function handleMcp(request, response, pathname) {
  const match = pathname.match(/^\/mcp\/([a-z-]+)$/);
  if (!match) {
    return false;
  }

  const source = getSource(match[1]);
  if (!source) {
    sendJson(response, 404, { error: "Unknown MCP source" });
    return true;
  }

  if (request.method === "GET") {
    sendJson(response, 200, {
      id: source.id,
      label: source.label,
      description: source.description,
      endpoint: `/mcp/${source.id}`,
      methods: ["tools/list", "tools/call", "source/overview"]
    });
    return true;
  }

  if (request.method === "POST") {
    const body = await readJsonBody(request);
    sendJson(response, 200, await handleMcpRequest(source, body));
    return true;
  }

  sendText(response, 405, "Method not allowed");
  return true;
}

export function createCampusServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const pathname = url.pathname;

      if (await handleApi(request, response, pathname)) {
        return;
      }

      if (await handleMcp(request, response, pathname)) {
        return;
      }

      if (request.method === "GET" || request.method === "HEAD") {
        await serveStatic(request, response);
        return;
      }

      sendText(response, 404, "Not found");
    } catch (error) {
      sendJson(response, 500, {
        error: "Internal server error",
        detail: error.message
      });
    }
  });
}

const isMainModule = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const server = createCampusServer();
  server.listen(PORT, () => {
    console.log(`Campus Intelligence Dashboard running at http://localhost:${PORT}`);
  });
}
