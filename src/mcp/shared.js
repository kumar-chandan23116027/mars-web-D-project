import { readFile } from "node:fs/promises";

const DATA_DIR = new URL("../data/", import.meta.url);
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function readJsonData(fileName) {
  const raw = await readFile(new URL(fileName, DATA_DIR), "utf8");
  return JSON.parse(raw);
}

export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value) {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "at",
    "available",
    "be",
    "can",
    "do",
    "for",
    "from",
    "i",
    "in",
    "is",
    "me",
    "my",
    "of",
    "on",
    "please",
    "show",
    "the",
    "to",
    "today",
    "tomorrow",
    "what",
    "where",
    "with"
  ]);

  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

export function scoreAgainstQuery(record, query, fields) {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return 1;
  }

  const haystack = normalizeText(fields.map((field) => record[field]).join(" "));
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

export function currentDayName(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return DAY_NAMES[date.getDay()];
}

export function inferDayFromQuery(query) {
  const normalized = normalizeText(query);
  if (normalized.includes("tomorrow")) {
    return currentDayName(1);
  }
  const explicit = DAY_NAMES.find((day) => normalized.includes(day.toLowerCase()));
  return explicit || currentDayName();
}

export function formatDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).format(date);
}

export function daysUntil(value) {
  if (!value) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${value}T00:00:00`);
  return Math.round((date - today) / 86400000);
}
