import { readJsonData, scoreAgainstQuery } from "./shared.js";

async function loadLibrary() {
  return readJsonData("library.json");
}

function toHighlight(book) {
  const status = book.availability === "available"
    ? `${book.copies} copies available`
    : `checked out until ${book.dueDate}`;
  return `${book.title} by ${book.author} - ${status} at ${book.location}`;
}

export const librarySource = {
  id: "library",
  label: "Library",
  accent: "#2563eb",
  description: "Book availability, shelf locations, issue status, and library policy hints.",
  async overview() {
    const data = await loadLibrary();
    const available = data.books.filter((book) => book.availability === "available");
    const checkedOut = data.books.length - available.length;
    return {
      sourceName: data.sourceName,
      lastSynced: data.lastSynced,
      metric: `${available.length}/${data.books.length}`,
      metricLabel: "titles available",
      secondary: `${checkedOut} checked out`,
      items: available.slice(0, 4).map((book) => ({
        title: book.title,
        detail: `${book.copies} copies - ${book.location}`,
        status: "Available"
      }))
    };
  },
  tools: [
    {
      name: "search_library",
      description: "Find books by title, author, subject, tag, or availability.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Student's natural-language library request" },
          availableOnly: { type: "boolean", description: "Only return available books" }
        }
      },
      async handler(args = {}) {
        const data = await loadLibrary();
        const query = args.query ?? "";
        const availableOnly = Boolean(args.availableOnly) || /available|borrow|issue|get/.test(query.toLowerCase());
        const ranked = data.books
          .map((book) => ({
            ...book,
            score: scoreAgainstQuery(
              {
                ...book,
                tagsText: book.tags.join(" ")
              },
              query,
              ["title", "author", "subject", "availability", "location", "tagsText"]
            )
          }))
          .filter((book) => (availableOnly ? book.availability === "available" : true))
          .filter((book) => book.score > 0 || query.trim().length < 3)
          .sort((a, b) => b.score - a.score || b.copies - a.copies)
          .slice(0, 5);

        const items = ranked.map((book) => ({
          id: book.id,
          title: book.title,
          detail: `${book.subject} - ${book.author}`,
          meta: book.availability === "available"
            ? `${book.copies} copies available`
            : `Due back ${book.dueDate}`,
          location: book.location,
          status: book.availability
        }));

        return {
          summary: items.length
            ? `Found ${items.length} matching library result${items.length === 1 ? "" : "s"}.`
            : "No matching library titles were found.",
          highlights: ranked.map(toHighlight),
          items
        };
      }
    }
  ]
};
