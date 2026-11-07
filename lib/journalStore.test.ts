import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearJournal, getJournalEntry, listJournalEntries, loadDemoJournal, saveJournalEntry } from "./journalStore";

let memory: Map<string, string>;

beforeEach(() => {
  memory = new Map();
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("overwrites the same day and ignores corrupt storage", () => {
  expect(
    saveJournalEntry({ date: "2026-11-04", severities: { vestibular: 2 } }),
  ).not.toBeNull();
  saveJournalEntry({ date: "2026-11-04", severities: { vestibular: 8 } });

  expect(listJournalEntries()).toHaveLength(1);
  expect(getJournalEntry("2026-11-04")?.severities.vestibular).toBe(8);

  memory.set("care-nav-journal", "{not json");
  expect(listJournalEntries()).toEqual([]);
});

it("loads 14 sample days with vestibular rising and fatigue easing", () => {
  const entries = loadDemoJournal("2026-11-04");

  expect(entries).toHaveLength(14);
  expect(entries?.[0].severities.vestibular).toBe(2);
  expect(entries?.[13].severities.vestibular).toBe(8);
  expect(entries?.[0].severities.fatigue_activity).toBe(8);
  expect(entries?.[13].severities.fatigue_activity).toBe(2);
  expect(entries?.[0].severities.oculomotor).toBe(5);
});

it("clears saved check-ins", () => {
  saveJournalEntry({ date: "2026-11-03", severities: { vestibular: 4 } });
  clearJournal();
  expect(listJournalEntries()).toEqual([]);
});

it("does nothing when the page is not in a browser", () => {
  vi.unstubAllGlobals();

  expect(listJournalEntries()).toEqual([]);
  expect(
    saveJournalEntry({ date: "2026-11-04", severities: { vestibular: 4 } }),
  ).toBeNull();
  expect(loadDemoJournal("2026-11-04")).toBeNull();
});
