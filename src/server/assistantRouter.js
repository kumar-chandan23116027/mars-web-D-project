import { sources } from "../mcp/registry.js";
import { callTool, listTools } from "./mcpRuntime.js";

const SOURCE_KEYWORDS = {
  library: [
    "book",
    "borrow",
    "copy",
    "copies",
    "library",
    "manual",
    "read",
    "shelf",
    "title"
  ],
  cafeteria: [
    "breakfast",
    "cafe",
    "cafeteria",
    "dinner",
    "eat",
    "food",
    "lunch",
    "menu",
    "snack",
    "vegan"
  ],
  events: [
    "club",
    "event",
    "fest",
    "hackathon",
    "session",
    "tech fest",
    "today",
    "tomorrow",
    "volunteer",
    "workshop"
  ],
  academics: [
    "academic",
    "attendance",
    "deadline",
    "exam",
    "handbook",
    "policy",
    "registration",
    "scholarship",
    "submission",
    "timetable"
  ]
};

const TOOL_BY_SOURCE = {
  library: "search_library",
  cafeteria: "get_menu",
  events: "find_events",
  academics: "search_academics"
};

function normalize(value) {
  return String(value ?? "").toLowerCase();
}

function selectSources(message) {
  const normalized = normalize(message);
  const matched = sources.filter((source) => {
    const keywords = SOURCE_KEYWORDS[source.id] ?? [];
    return keywords.some((keyword) => normalized.includes(keyword));
  });

  if (matched.length > 0) {
    return matched;
  }

  return sources;
}

function createIntro(selected) {
  const names = selected.map((source) => source.label).join(", ");
  return `I checked ${names} in real time.`;
}

function createAnswer(selected, results) {
  const intro = createIntro(selected);
  const lines = [];

  for (const entry of results) {
    if (entry.error) {
      lines.push(`${entry.source.label}: ${entry.error}`);
      continue;
    }

    const highlights = entry.result.highlights?.slice(0, 3) ?? [];
    if (highlights.length === 0) {
      lines.push(`${entry.source.label}: ${entry.result.summary}`);
      continue;
    }

    for (const highlight of highlights) {
      lines.push(`${entry.source.label}: ${highlight}`);
    }
  }

  if (lines.length === 0) {
    return `${intro}\n\nI could not find a strong match, but the live source servers are reachable. Try a more specific book title, meal type, event topic, or academic deadline.`;
  }

  const nextStep = selected.length > 1
    ? "I combined results across sources so you can plan the next step without opening separate portals."
    : "This came from the matching campus source server, not a prebuilt central database.";

  return `${intro}\n\n${lines.map((line) => `- ${line}`).join("\n")}\n\n${nextStep}`;
}

export async function getDashboardSnapshot() {
  const overviews = await Promise.all(
    sources.map(async (source) => {
      const overview = await source.overview();
      return {
        id: source.id,
        label: source.label,
        accent: source.accent,
        description: source.description,
        tools: listTools(source),
        ...overview
      };
    })
  );

  const stats = {
    liveSources: sources.length,
    totalTools: sources.reduce((total, source) => total + source.tools.length, 0),
    updatedAt: new Date().toISOString(),
    campusName: process.env.CAMPUS_NAME || "Northstar Institute of Technology"
  };

  return { stats, sources: overviews };
}

export async function routeAssistant(message) {
  const selected = selectSources(message);
  const toolTrace = [];
  const results = [];

  for (const source of selected) {
    const toolName = TOOL_BY_SOURCE[source.id];
    const startedAt = Date.now();
    try {
      const result = await callTool(source, toolName, {
        query: message
      });
      const latencyMs = Date.now() - startedAt;
      toolTrace.push({
        source: source.id,
        label: source.label,
        tool: toolName,
        latencyMs,
        status: "ok"
      });
      results.push({ source, result });
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      toolTrace.push({
        source: source.id,
        label: source.label,
        tool: toolName,
        latencyMs,
        status: "error"
      });
      results.push({ source, error: error.message });
    }
  }

  return {
    message,
    answer: createAnswer(selected, results),
    sources: selected.map((source) => ({
      id: source.id,
      label: source.label,
      accent: source.accent
    })),
    toolTrace,
    results: results.map((entry) => ({
      source: entry.source.id,
      label: entry.source.label,
      result: entry.result ?? null,
      error: entry.error ?? null
    })),
    createdAt: new Date().toISOString()
  };
}
