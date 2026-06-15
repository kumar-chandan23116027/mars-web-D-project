import { academicsSource } from "./academics.js";
import { cafeteriaSource } from "./cafeteria.js";
import { eventsSource } from "./events.js";
import { librarySource } from "./library.js";

export const sources = [
  librarySource,
  cafeteriaSource,
  eventsSource,
  academicsSource
];

export const sourceMap = new Map(sources.map((source) => [source.id, source]));

export function getSource(sourceId) {
  return sourceMap.get(sourceId);
}
