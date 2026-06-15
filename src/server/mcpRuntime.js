export function listTools(source) {
  return source.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }));
}

export async function callTool(source, name, args = {}) {
  const tool = source.tools.find((entry) => entry.name === name);
  if (!tool) {
    const error = new Error(`Tool "${name}" not found on source "${source.id}"`);
    error.code = -32601;
    throw error;
  }

  return tool.handler(args);
}

export async function handleMcpRequest(source, payload) {
  const request = Array.isArray(payload) ? payload[0] : payload;
  const id = request?.id ?? null;

  try {
    if (!request || request.jsonrpc !== "2.0") {
      throw Object.assign(new Error("Invalid JSON-RPC request"), { code: -32600 });
    }

    if (request.method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          source: {
            id: source.id,
            label: source.label,
            description: source.description
          },
          tools: listTools(source)
        }
      };
    }

    if (request.method === "tools/call") {
      const { name, arguments: args = {} } = request.params ?? {};
      const result = await callTool(source, name, args);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "json",
              json: result
            }
          ]
        }
      };
    }

    if (request.method === "source/overview") {
      return {
        jsonrpc: "2.0",
        id,
        result: await source.overview()
      };
    }

    throw Object.assign(new Error(`Unsupported method "${request.method}"`), { code: -32601 });
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: error.code ?? -32000,
        message: error.message
      }
    };
  }
}
