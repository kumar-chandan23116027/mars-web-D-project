import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const PORT = 4397;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(path, options) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const payload = await response.json();
  assert.equal(response.ok, true, `${path} returned ${response.status}`);
  return payload;
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 6000) {
    try {
      const health = await fetchJson("/api/health");
      if (health.ok) {
        return;
      }
    } catch {
      await wait(150);
    }
  }
  throw new Error("Server did not start in time");
}

const child = spawn(process.execPath, ["src/server.js"], {
  cwd: new URL("../", import.meta.url),
  env: {
    ...process.env,
    PORT: String(PORT)
  },
  stdio: ["ignore", "pipe", "pipe"]
});

const output = [];
child.stdout.on("data", (chunk) => output.push(chunk.toString()));
child.stderr.on("data", (chunk) => output.push(chunk.toString()));

try {
  await waitForServer();

  const dashboard = await fetchJson("/api/dashboard");
  assert.equal(dashboard.stats.liveSources, 4);
  assert.equal(dashboard.stats.totalTools, 4);
  assert.equal(dashboard.sources.length, 4);

  const assistant = await fetchJson("/api/assistant", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: "Is an AI book available and what workshop is today?"
    })
  });
  assert.match(assistant.answer, /Library/);
  assert.equal(assistant.toolTrace.length >= 2, true);

  const tools = await fetchJson("/mcp/library", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list"
    })
  });
  assert.equal(tools.result.tools[0].name, "search_library");

  const libraryCall = await fetchJson("/mcp/library", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "search_library",
        arguments: {
          query: "AI book available"
        }
      }
    })
  });
  assert.equal(libraryCall.result.content[0].json.items.length > 0, true);

  console.log("Smoke test passed");
} catch (error) {
  console.error(output.join(""));
  console.error(error);
  process.exitCode = 1;
} finally {
  child.kill();
}
