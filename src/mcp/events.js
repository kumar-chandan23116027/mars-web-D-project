import { daysUntil, formatDate, normalizeText, readJsonData, scoreAgainstQuery } from "./shared.js";

async function loadEvents() {
  return readJsonData("events.json");
}

function upcoming(events) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return events
    .filter((event) => new Date(`${event.date}T00:00:00`) >= today)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

export const eventsSource = {
  id: "events",
  label: "Events",
  accent: "#047857",
  description: "Club events, workshops, tech-fest sessions, venues, and seats.",
  async overview() {
    const data = await loadEvents();
    const nextEvents = upcoming(data.events).slice(0, 4);
    const seats = nextEvents.reduce((total, event) => total + event.seatsLeft, 0);
    return {
      sourceName: data.sourceName,
      lastSynced: data.lastSynced,
      metric: String(nextEvents.length),
      metricLabel: "upcoming events",
      secondary: `${seats} seats visible`,
      items: nextEvents.map((event) => ({
        title: event.title,
        detail: `${formatDate(event.date)} at ${event.time} - ${event.venue}`,
        status: `${event.seatsLeft} seats`
      }))
    };
  },
  tools: [
    {
      name: "find_events",
      description: "Find upcoming events by date, club, topic, venue, or seat availability.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Student's natural-language events request" }
        }
      },
      async handler(args = {}) {
        const data = await loadEvents();
        const query = args.query ?? "";
        const normalized = normalizeText(query);
        const todayIso = new Date().toISOString().slice(0, 10);
        const wantsToday = normalized.includes("today");
        const wantsTomorrow = normalized.includes("tomorrow");
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowIso = tomorrow.toISOString().slice(0, 10);

        const ranked = upcoming(data.events)
          .map((event) => ({
            ...event,
            tagsText: event.tags.join(" "),
            score: scoreAgainstQuery(
              {
                ...event,
                tagsText: event.tags.join(" ")
              },
              query,
              ["title", "club", "venue", "tagsText"]
            )
          }))
          .filter((event) => (wantsToday ? event.date === todayIso : true))
          .filter((event) => (wantsTomorrow ? event.date === tomorrowIso : true))
          .filter((event) => event.score > 0 || query.trim().length < 3 || wantsToday || wantsTomorrow || normalized.includes("event"))
          .sort((a, b) => b.score - a.score || `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
          .slice(0, 5);

        return {
          summary: ranked.length
            ? `Found ${ranked.length} relevant event${ranked.length === 1 ? "" : "s"}.`
            : "No matching upcoming events were found.",
          highlights: ranked.map((event) => {
            const due = daysUntil(event.date);
            const when = due === 0 ? "today" : due === 1 ? "tomorrow" : formatDate(event.date);
            return `${event.title} is ${when} at ${event.time} in ${event.venue}; ${event.seatsLeft} seats left`;
          }),
          items: ranked.map((event) => ({
            id: event.id,
            title: event.title,
            detail: `${event.club} - ${formatDate(event.date)} ${event.time}`,
            meta: `${event.venue} - ${event.seatsLeft} seats left`,
            status: "Open"
          }))
        };
      }
    }
  ]
};
