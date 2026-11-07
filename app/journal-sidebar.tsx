"use client";

import { useEffect, useId, useState } from "react";
import { JOURNAL_ADJUSTMENT, entriesInWindow } from "../lib/journalAdjustment";
import {
  addIsoDays,
  emptySeverities,
  formatJournalDate,
  journalCategories,
  severitiesFrom,
  todayIso,
  type JournalEntry,
} from "../lib/journal";
import {
  clearJournal,
  getJournalEntry,
  journalSampleLoaded,
  listJournalEntries,
  loadDemoJournal,
  saveJournalEntry,
} from "../lib/journalStore";

function Sparkline({ points }: { points: (number | null)[] }) {
  const width = 128;
  const height = 40;
  if (points.every((point) => point === null)) {
    return <span className="text-sm text-[#545454]">No days yet</span>;
  }
  const span = Math.max(points.length - 1, 1);
  const xAt = (index: number) => (index / span) * width;
  const yAt = (value: number) => 4 + (1 - value / 10) * (height - 8);
  const segments: { key: number; d: string }[] = [];
  let commands: string[] = [];
  let segmentStart = 0;
  points.forEach((value, index) => {
    if (value === null) {
      if (commands.length > 0) {
        segments.push({ key: segmentStart, d: commands.join(" ") });
        commands = [];
      }
      return;
    }
    if (commands.length === 0) {
      segmentStart = index;
    }
    const command = commands.length === 0 ? "M" : "L";
    commands.push(`${command}${xAt(index).toFixed(1)},${yAt(value).toFixed(1)}`);
  });
  if (commands.length > 0) {
    segments.push({ key: segmentStart, d: commands.join(" ") });
  }
  const dots = points.flatMap((value, index) =>
    value === null ? [] : [{ index, cx: xAt(index), cy: yAt(value) }],
  );

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0"
    >
      {segments.map((segment) => (
        <path
          key={segment.key}
          d={segment.d}
          fill="none"
          stroke="#000"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {dots.map((dot) => (
        <circle key={dot.index} cx={dot.cx} cy={dot.cy} r="2.5" fill="#000" />
      ))}
    </svg>
  );
}

function windowPoints(
  entries: JournalEntry[],
  categoryId: string,
  today: string,
): (number | null)[] {
  return Array.from({ length: JOURNAL_ADJUSTMENT.windowDays }, (_, index) => {
    const iso = addIsoDays(today, index - (JOURNAL_ADJUSTMENT.windowDays - 1));
    const entry = entries.find((item) => item.date === iso);
    const value = entry?.severities[categoryId];
    return typeof value === "number" ? value : null;
  });
}

export function JournalSidebar() {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [severities, setSeverities] = useState<Record<string, number>>(emptySeverities);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [sample, setSample] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [status, setStatus] = useState("");

  function refresh(date: string) {
    const saved = listJournalEntries();
    setToday(todayIso());
    setEntries(saved);
    setSample(journalSampleLoaded());
    setSelectedDate(date);
    setSeverities(severitiesFrom(getJournalEntry(date)));
  }

  function openJournal() {
    refresh(todayIso());
    setConfirmClear(false);
    setConfirmDemo(false);
    setStatus("");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function chooseDate(date: string) {
    setSelectedDate(date);
    setSeverities(severitiesFrom(getJournalEntry(date)));
    setStatus("");
    setConfirmClear(false);
    setConfirmDemo(false);
  }

  function saveDay() {
    const saved = saveJournalEntry({ date: selectedDate, severities });
    if (!saved) {
      setStatus("Could not save on this browser.");
      return;
    }
    refresh(selectedDate);
    setStatus(`Saved for ${formatJournalDate(selectedDate)}.`);
    setConfirmClear(false);
    setConfirmDemo(false);
  }

  function loadSample() {
    const loaded = loadDemoJournal(today || todayIso());
    if (!loaded) {
      setStatus("Could not save sample data on this browser.");
      return;
    }
    const currentDay = todayIso();
    refresh(currentDay);
    setConfirmDemo(false);
    setStatus("Sample data loaded. These check-ins are made up.");
  }

  function clearAll() {
    clearJournal();
    const currentDay = todayIso();
    setEntries([]);
    setSample(false);
    setSelectedDate(currentDay);
    setSeverities(emptySeverities());
    setConfirmClear(false);
    setStatus("Journal cleared from this browser.");
  }

  const categories = journalCategories();
  const recentCount = today ? entriesInWindow(entries, today).length : 0;
  const savedCount = entries.length;
  const editingToday = selectedDate !== "" && selectedDate === today;

  return (
    <>
      <div className="mt-6">
        <button
          type="button"
          aria-expanded={open}
          onClick={openJournal}
          className="inline-flex min-h-12 cursor-pointer items-center rounded-full bg-[#F6F6F6] px-5 text-base font-medium text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          Symptom journal
        </button>
        <p className="mt-2 text-sm leading-6 text-[#545454]">
          Daily check-in. Saved in this browser.
        </p>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close symptom journal"
            className="absolute inset-0 cursor-pointer bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="journal-panel relative flex h-full w-full flex-col bg-white sm:w-[28rem]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#E2E2E2] px-4 py-4">
              <h2 id={titleId} className="text-2xl font-bold tracking-tight text-black">
                Symptom journal
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-12 cursor-pointer items-center rounded-full px-4 text-base font-medium text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <p className="text-base leading-7 text-[#545454]">
                Rate each area from 0 to 10 for one day. Check-ins stay in this
                browser. After a few days they can nudge the care pathway scores.
              </p>
              {sample ? (
                <p className="mt-4 rounded-xl border border-[#E2E2E2] bg-[#F6F6F6] px-4 py-4 text-base leading-7 text-black">
                  Sample data is loaded. These check-ins are made up so you can
                  see a trend.
                </p>
              ) : null}
              {savedCount > 0 && recentCount < JOURNAL_ADJUSTMENT.minEntries ? (
                <p className="mt-4 text-base leading-7 text-black">
                  Log a few more days. After {JOURNAL_ADJUSTMENT.minEntries}{" "}
                  check-ins in the last {JOURNAL_ADJUSTMENT.windowDays} days,
                  recent trends can update the match on your results.
                </p>
              ) : null}
              <section className="mt-8" aria-label="Daily check-in">
                <h3 className="text-base font-semibold text-black">
                  {editingToday ? "Today" : formatJournalDate(selectedDate)}
                </h3>
                <ul className="mt-4 flex flex-col gap-6">
                  {categories.map((category) => {
                    const value = severities[category.id] ?? 0;
                    const sliderId = `journal-${category.id}`;
                    return (
                      <li key={category.id}>
                        <div className="flex items-baseline justify-between gap-3">
                          <label htmlFor={sliderId} className="text-base font-medium text-black">
                            {category.label}
                          </label>
                          <span className="text-base font-medium text-black">{value}</span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[#545454]">
                          {category.example}
                        </p>
                        <input
                          id={sliderId}
                          type="range"
                          min={0}
                          max={10}
                          step={1}
                          value={value}
                          aria-valuetext={`${value} out of 10`}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            setSeverities((current) => ({
                              ...current,
                              [category.id]: next,
                            }));
                          }}
                          className="journal-slider mt-2 w-full cursor-pointer"
                        />
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={saveDay}
                  disabled={!selectedDate}
                  className="mt-6 inline-flex min-h-14 w-full cursor-pointer items-center justify-center rounded-full bg-black px-5 text-base font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {editingToday ? "Save today" : `Save ${formatJournalDate(selectedDate)}`}
                </button>
                {!editingToday && today ? (
                  <button
                    type="button"
                    onClick={() => chooseDate(today)}
                    className="mt-3 inline-flex min-h-12 w-full cursor-pointer items-center justify-center text-base font-medium text-black underline decoration-black underline-offset-4"
                  >
                    Back to today
                  </button>
                ) : null}
                {status ? (
                  <p className="mt-3 text-base leading-7 text-[#545454]" role="status">
                    {status}
                  </p>
                ) : null}
              </section>

              <section className="mt-10" aria-label="Last 14 days">
                <h3 className="text-base font-semibold text-black">Last 14 days</h3>
                <ul className="mt-4 flex flex-col gap-4">
                  {categories.map((category) => (
                    <li key={category.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 text-sm leading-6 text-black">
                        {category.label}
                      </span>
                      <Sparkline points={today ? windowPoints(entries, category.id, today) : []} />
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-10" aria-label="Past check-ins">
                <h3 className="text-base font-semibold text-black">Past check-ins</h3>
                {entries.length === 0 ? (
                  <p className="mt-3 text-base leading-7 text-[#545454]">
                    No check-ins saved yet.
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2">
                    {[...entries].reverse().map((entry) => {
                      const selected = entry.date === selectedDate;
                      return (
                        <li key={entry.date}>
                          <button
                            type="button"
                            onClick={() => chooseDate(entry.date)}
                            aria-pressed={selected}
                            className={
                              selected
                                ? "flex min-h-12 w-full cursor-pointer items-center rounded-xl bg-black px-4 text-left text-base text-white"
                                : "flex min-h-12 w-full cursor-pointer items-center rounded-xl bg-[#F6F6F6] px-4 text-left text-base text-black"
                            }
                          >
                            {entry.date === today ? "Today" : formatJournalDate(entry.date)}
                            <span className={selected ? "ml-2 text-sm text-white/80" : "ml-2 text-sm text-[#545454]"}>
                              Edit
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="mt-10 border-t border-[#E2E2E2] pt-6">
                <h3 className="text-base font-semibold text-black">Sample data</h3>
                <p className="mt-1 text-sm leading-6 text-[#545454]">
                  Loads 14 made-up days. Balance symptoms rise and fatigue eases.
                  This replaces check-ins saved in this browser.
                </p>
                {confirmDemo ? (
                  <div className="mt-4 flex flex-col gap-2">
                    <p className="text-base leading-7 text-black">
                      Replace the check-ins saved in this browser with sample data?
                    </p>
                    <button
                      type="button"
                      onClick={loadSample}
                      className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-black px-5 text-base font-medium text-white"
                    >
                      Load sample data
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDemo(false)}
                      className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-[#F6F6F6] px-5 text-base font-medium text-black"
                    >
                      Keep my check-ins
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (entries.length > 0) {
                        setConfirmDemo(true);
                        setConfirmClear(false);
                        return;
                      }
                      loadSample();
                    }}
                    className="mt-4 inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full bg-[#F6F6F6] px-5 text-base font-medium text-black"
                  >
                    Load sample data
                  </button>
                )}

                <div className="mt-8">
                  {confirmClear ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-base leading-7 text-black">
                        This removes every saved day from this browser.
                      </p>
                      <button
                        type="button"
                        onClick={clearAll}
                        className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-black px-5 text-base font-medium text-white"
                      >
                        Yes, clear my journal
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClear(false)}
                        className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-[#F6F6F6] px-5 text-base font-medium text-black"
                      >
                        Keep my journal
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmClear(true);
                        setConfirmDemo(false);
                      }}
                      className="inline-flex min-h-12 cursor-pointer items-center text-base font-medium text-black underline decoration-black underline-offset-4"
                    >
                      Clear my journal
                    </button>
                  )}
                </div>
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
