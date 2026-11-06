import { categoryIds } from "./catalog";
import {
  addIsoDays,
  isIsoDate,
  parseJournalEntries,
  todayIso,
  type JournalEntry,
} from "./journal";

const STORAGE_KEY = "care-nav-journal";

type JournalStore = {
  sample: boolean;
  entries: JournalEntry[];
};

const RISING = [2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8];
const FALLING = [8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2];

function emptyStore(): JournalStore {
  return { sample: false, entries: [] };
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStore(): JournalStore {
  const storage = browserStorage();
  if (!storage) {
    return emptyStore();
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyStore();
    }
    return normalizeStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

function normalizeStore(value: unknown): JournalStore {
  if (Array.isArray(value)) {
    return { sample: false, entries: parseJournalEntries(value) };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return emptyStore();
  }
  const record = value as { sample?: unknown; entries?: unknown };
  return {
    sample: record.sample === true,
    entries: parseJournalEntries(record.entries),
  };
}

function writeStore(store: JournalStore): boolean {
  const storage = browserStorage();
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function listJournalEntries(): JournalEntry[] {
  return readStore().entries;
}

export function getJournalEntry(date: string): JournalEntry | null {
  if (!isIsoDate(date)) {
    return null;
  }
  return listJournalEntries().find((entry) => entry.date === date) ?? null;
}

export function journalSampleLoaded(): boolean {
  return readStore().sample;
}

export function saveJournalEntry(input: {
  date: string;
  severities: Record<string, number>;
}): JournalEntry | null {
  if (!isIsoDate(input.date)) {
    return null;
  }
  const entry: JournalEntry = {
    date: input.date,
    severities: input.severities,
    updatedAt: new Date().toISOString(),
  };
  const current = readStore();
  const entries = parseJournalEntries([
    ...current.entries.filter((item) => item.date !== entry.date),
    entry,
  ]);
  if (!writeStore({ sample: false, entries })) {
    return null;
  }
  return getJournalEntry(entry.date);
}

export function clearJournal(): void {
  const storage = browserStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

export function loadDemoJournal(today = todayIso()): JournalEntry[] | null {
  if (!isIsoDate(today)) {
    return null;
  }
  const entries: JournalEntry[] = RISING.map((_, index) => {
    const severities: Record<string, number> = {};
    for (const id of categoryIds()) {
      if (id === "vestibular") {
        severities[id] = RISING[index];
      } else if (id === "fatigue_activity") {
        severities[id] = FALLING[index];
      } else {
        severities[id] = 5;
      }
    }
    return {
      date: addIsoDays(today, index - (RISING.length - 1)),
      severities,
      updatedAt: new Date().toISOString(),
    };
  });
  if (!writeStore({ sample: true, entries })) {
    return null;
  }
  return listJournalEntries();
}
