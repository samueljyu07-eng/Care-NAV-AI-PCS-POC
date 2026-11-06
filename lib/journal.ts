import { categoryById, listCategories } from "./catalog";

export type JournalEntry = {
  date: string;
  severities: Record<string, number>;
  updatedAt: string;
};

export type JournalCategory = {
  id: string;
  label: string;
  example: string;
};

const EXAMPLE_SYMPTOMS: Record<string, string> = {
  fatigue_activity: "Physical or cognitive fatigue, or brain fog after activity",
  exertional_symptoms:
    "Headache, lightheadedness, or foggy thinking during or after physical activity",
  neuroendocrine: "Fatigue, feeling cold, weight shifts, or mood changes",
  vestibular: "Dizziness in crowds, or motion sickness",
  oculomotor: "Eyes tire or blur when reading or on screens",
  sensory_peripheral: "Neck stiffness, or sensitivity to light or noise",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function journalCategories(): JournalCategory[] {
  return listCategories().map((category) => ({
    id: category.id,
    label: category.patient_label,
    example:
      EXAMPLE_SYMPTOMS[category.id] ||
      category.typical_features ||
      category.patient_label,
  }));
}

export function todayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatJournalDate(iso: string): string {
  if (!isIsoDate(iso)) {
    return iso;
  }
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function emptySeverities(): Record<string, number> {
  return Object.fromEntries(journalCategories().map((category) => [category.id, 0]));
}

export function severitiesFrom(entry: JournalEntry | null): Record<string, number> {
  const next = emptySeverities();
  if (!entry) {
    return next;
  }
  for (const category of journalCategories()) {
    const value = entry.severities[category.id];
    if (typeof value === "number" && Number.isFinite(value)) {
      next[category.id] = clampSeverity(value);
    }
  }
  return next;
}

export function clampSeverity(value: number): number {
  return Math.min(10, Math.max(0, Math.round(value)));
}

function cleanSeverities(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }
  const allowed = new Set(journalCategories().map((category) => category.id));
  const severities: Record<string, number> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!allowed.has(id) || typeof raw !== "number" || !Number.isFinite(raw)) {
      continue;
    }
    severities[id] = clampSeverity(raw);
  }
  return severities;
}

function parseJournalEntry(value: unknown): JournalEntry | null {
  if (!isRecord(value) || typeof value.date !== "string" || !isIsoDate(value.date)) {
    return null;
  }
  const severities = cleanSeverities(value.severities);
  if (Object.keys(severities).length === 0) {
    return null;
  }
  const updatedAt =
    typeof value.updatedAt === "string" && value.updatedAt.trim() !== ""
      ? value.updatedAt
      : "";
  return { date: value.date, severities, updatedAt };
}

export function parseJournalEntries(value: unknown): JournalEntry[] {
  const list = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.entries)
      ? value.entries
      : [];
  const byDate = new Map<string, JournalEntry>();
  for (const item of list) {
    const entry = parseJournalEntry(item);
    if (!entry) {
      continue;
    }
    const current = byDate.get(entry.date);
    if (!current || entry.updatedAt >= current.updatedAt) {
      byDate.set(entry.date, entry);
    }
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

export function categoryLabel(categoryId: string): string {
  return categoryById(categoryId)?.patient_label ?? categoryId;
}
