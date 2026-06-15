import { inferDayFromQuery, readJsonData, scoreAgainstQuery } from "./shared.js";

async function loadCafeteria() {
  return readJsonData("cafeteria.json");
}

function mealMatchesQuery(meal, query) {
  const score = scoreAgainstQuery(
    {
      ...meal,
      labelsText: meal.labels.join(" ")
    },
    query,
    ["slot", "name", "labelsText"]
  );
  return score > 0 || query.trim().length < 3;
}

export const cafeteriaSource = {
  id: "cafeteria",
  label: "Cafeteria",
  accent: "#c2410c",
  description: "Daily menu, prices, dietary labels, and wait estimates.",
  async overview() {
    const data = await loadCafeteria();
    const day = inferDayFromQuery("today");
    const today = data.menu.find((entry) => entry.day === day) ?? data.menu[0];
    const veganOptions = today.meals.filter((meal) => meal.labels.some((label) => label.includes("vegan")));
    return {
      sourceName: data.sourceName,
      lastSynced: data.lastSynced,
      metric: String(today.meals.length),
      metricLabel: `${today.day} meals`,
      secondary: `${veganOptions.length} vegan-friendly`,
      hours: data.hours,
      items: today.meals.map((meal) => ({
        title: meal.name,
        detail: `${meal.slot} - INR ${meal.price}`,
        status: `${meal.waitMinutes} min wait`
      }))
    };
  },
  tools: [
    {
      name: "get_menu",
      description: "Find cafeteria meals by day, slot, dietary preference, or item name.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Student's natural-language cafeteria request" },
          day: { type: "string", description: "Optional day name" }
        }
      },
      async handler(args = {}) {
        const data = await loadCafeteria();
        const query = args.query ?? "";
        const day = args.day || inferDayFromQuery(query);
        const dayMenu = data.menu.find((entry) => entry.day.toLowerCase() === day.toLowerCase()) ?? data.menu[0];
        const wantsVegan = /vegan|plant|dairy free/.test(query.toLowerCase());
        const slotMatch = ["breakfast", "lunch", "snacks", "dinner"].find((slot) => query.toLowerCase().includes(slot));
        const meals = dayMenu.meals
          .filter((meal) => (slotMatch ? meal.slot === slotMatch : true))
          .filter((meal) => (wantsVegan ? meal.labels.some((label) => label.includes("vegan")) : true))
          .filter((meal) => mealMatchesQuery(meal, query) || wantsVegan || Boolean(slotMatch));

        return {
          summary: `${dayMenu.day} cafeteria menu has ${meals.length} matching option${meals.length === 1 ? "" : "s"}.`,
          highlights: meals.map((meal) => `${meal.slot}: ${meal.name} for INR ${meal.price} (${meal.waitMinutes} min wait)`),
          items: meals.map((meal) => ({
            id: `${dayMenu.day}-${meal.slot}`,
            title: meal.name,
            detail: `${dayMenu.day} ${meal.slot} - ${meal.labels.join(", ")}`,
            meta: `INR ${meal.price} - ${meal.waitMinutes} min wait`,
            status: "Serving"
          }))
        };
      }
    }
  ]
};
