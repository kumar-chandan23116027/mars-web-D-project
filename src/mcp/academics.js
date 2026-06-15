import { daysUntil, formatDate, readJsonData, scoreAgainstQuery } from "./shared.js";

async function loadAcademics() {
  return readJsonData("academics.json");
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (!a.date && !b.date) {
      return a.title.localeCompare(b.title);
    }
    if (!a.date) {
      return 1;
    }
    if (!b.date) {
      return -1;
    }
    return a.date.localeCompare(b.date);
  });
}

export const academicsSource = {
  id: "academics",
  label: "Academics",
  accent: "#7c3aed",
  description: "Academic handbook snippets, deadlines, policies, and notices.",
  async overview() {
    const data = await loadAcademics();
    const dated = sortEntries(data.entries.filter((entry) => entry.date)).slice(0, 4);
    const policies = data.entries.filter((entry) => entry.type === "policy").length;
    return {
      sourceName: data.sourceName,
      lastSynced: data.lastSynced,
      metric: String(dated.length),
      metricLabel: "dated notices",
      secondary: `${policies} active policies`,
      items: dated.map((entry) => ({
        title: entry.title,
        detail: `${formatDate(entry.date)} - ${entry.summary}`,
        status: entry.type
      }))
    };
  },
  tools: [
    {
      name: "search_academics",
      description: "Search handbook entries, notices, policies, and academic deadlines.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Student's natural-language academic request" }
        }
      },
      async handler(args = {}) {
        const data = await loadAcademics();
        const query = args.query ?? "";
        const ranked = data.entries
          .map((entry) => ({
            ...entry,
            tagsText: entry.tags.join(" "),
            score: scoreAgainstQuery(
              {
                ...entry,
                tagsText: entry.tags.join(" ")
              },
              query,
              ["type", "title", "summary", "tagsText"]
            )
          }))
          .filter((entry) => entry.score > 0 || query.trim().length < 3 || /deadline|policy|academic|exam/.test(query.toLowerCase()))
          .sort((a, b) => b.score - a.score || (a.date ?? "9999").localeCompare(b.date ?? "9999"))
          .slice(0, 5);

        return {
          summary: ranked.length
            ? `Found ${ranked.length} academic reference${ranked.length === 1 ? "" : "s"}.`
            : "No matching academic references were found.",
          highlights: ranked.map((entry) => {
            const until = daysUntil(entry.date);
            const timing = entry.date
              ? `${formatDate(entry.date)}${until !== null && until >= 0 ? ` (${until} days left)` : ""}`
              : "handbook policy";
            return `${entry.title}: ${entry.summary} [${timing}]`;
          }),
          items: ranked.map((entry) => ({
            id: entry.id,
            title: entry.title,
            detail: entry.summary,
            meta: entry.date ? formatDate(entry.date) : "Handbook",
            status: entry.type
          }))
        };
      }
    }
  ]
};
