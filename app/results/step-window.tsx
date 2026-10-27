"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import type { AgeBand } from "../../lib/catalog";
import { libraryStepById, visibleLibraryStepSources } from "../../lib/careSteps";
import { SHOW_DRAFT_STEPS } from "../../lib/copy";
import { cliniciansForStep, type Practitioner } from "../../lib/matchPractitioners";

const PHONE_QUERY = "(max-width: 639px)";
const sheetScrollStyle = {
  WebkitOverflowScrolling: "touch",
  overscrollBehavior: "contain",
  touchAction: "pan-y",
} as const;

export default function StepWindow({
  title,
  stepId,
  practitionerType,
  patientCity,
  ageBand,
  onClose,
  onBooked,
}: {
  title: string;
  stepId: string | null;
  practitionerType: string;
  patientCity: string;
  ageBand: AgeBand | null;
  onClose: () => void;
  onBooked: () => void;
}) {
  const [isPhone, setIsPhone] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const update = () => setIsPhone(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
  }, [title, isPhone]);

  useEffect(() => {
    setBooking(null);
  }, [title]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  function onDragStart(event: ReactPointerEvent<HTMLElement>) {
    if (isPhone || event.button !== 0) {
      return;
    }
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The pointer can already be gone. Drag still follows the move events.
    }
  }

  function onDragMove(event: ReactPointerEvent<HTMLElement>) {
    if (!drag.current || !dialogRef.current) {
      return;
    }
    const nextX = drag.current.ox + event.clientX - drag.current.x;
    const nextY = drag.current.oy + event.clientY - drag.current.y;
    const width = dialogRef.current.offsetWidth;
    const height = dialogRef.current.offsetHeight;
    const left = (window.innerWidth - width) / 2 + nextX;
    const top = (window.innerHeight - height) / 2 + nextY;
    const clampedLeft = Math.min(Math.max(left, 80 - width), window.innerWidth - 80);
    const clampedTop = Math.min(Math.max(top, 8), window.innerHeight - 64);
    setOffset({
      x: clampedLeft - (window.innerWidth - width) / 2,
      y: clampedTop - (window.innerHeight - height) / 2,
    });
  }

  function onDragEnd() {
    drag.current = null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-window-title"
        onClick={(event) => event.stopPropagation()}
        className={
          isPhone
            ? "step-sheet absolute inset-x-0 bottom-0 flex h-[85dvh] flex-col rounded-t-2xl bg-white shadow-xl"
            : "absolute top-1/2 left-1/2 flex h-[80vh] w-[min(1040px,85vw)] flex-col rounded-2xl bg-white shadow-xl"
        }
        style={
          isPhone
            ? undefined
            : {
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }
        }
      >
        <header
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          className={`flex shrink-0 items-start justify-between gap-4 border-b border-[#E2E2E2] px-5 py-4 ${isPhone ? "" : "cursor-grab touch-none select-none active:cursor-grabbing"}`}
        >
          {booking ? (
            <div className="min-w-0 flex-1">
              {booking.kind === "slots" ? (
                <button
                  type="button"
                  onClick={() => setBooking(null)}
                  className="cursor-pointer text-sm font-medium text-black underline decoration-black underline-offset-4"
                >
                  Back
                </button>
              ) : null}
              <h2 id="step-window-title" className="text-xl font-bold tracking-tight text-black">
                {booking.person.name}
              </h2>
              <p className="text-sm leading-6 text-[#545454]">{booking.person.clinic}</p>
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <h2 id="step-window-title" className="text-xl font-bold tracking-tight text-black">
                {title}
              </h2>
              <DraftBadge stepId={stepId} />
            </div>
          )}
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-black hover:bg-[#F6F6F6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
              <path
                d="M5 5 15 15M15 5 5 15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        {booking ? (
          <BookingScreen
            roomy={isPhone}
            booking={booking}
            onSelect={(slotId) =>
              setBooking((current) =>
                current?.kind === "slots" ? { ...current, slotId } : current,
              )
            }
            onConfirm={() =>
              setBooking((current) => {
                if (current?.kind !== "slots" || !current.slotId) {
                  return current;
                }
                const slot = current.slots.find((item) => item.id === current.slotId);
                if (!slot) {
                  return current;
                }
                return {
                  kind: "confirmed",
                  person: current.person,
                  slotLabel: slot.label,
                };
              })
            }
            onDone={onBooked}
          />
        ) : (
          <div
            className={
              isPhone
                ? "step-sheet-scroll flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5"
                : "flex min-h-0 flex-1"
            }
            style={isPhone ? sheetScrollStyle : undefined}
          >
            <div
              className={
                isPhone
                  ? undefined
                  : "min-h-0 flex-1 overflow-y-auto border-r border-[#E2E2E2] px-5 py-5"
              }
            >
              <StepBody stepId={stepId} ageBand={ageBand} />
            </div>
            <div className={isPhone ? undefined : "min-h-0 flex-1 overflow-y-auto px-5 py-5"}>
              <WhoOffers
                practitionerType={practitionerType}
                patientCity={patientCity}
                ageBand={ageBand}
                roomy={isPhone}
                onChoose={(person) =>
                  setBooking({
                    kind: "slots",
                    person,
                    slotId: null,
                    slots: bookingSlots(person.details.availability, new Date()),
                  })
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function DraftBadge({ stepId }: { stepId: string | null }) {
  const step = libraryStepById(stepId);
  if (!SHOW_DRAFT_STEPS || step?.clinician_status !== "draft") {
    return null;
  }
  return (
    <span className="rounded-full bg-[#F6F6F6] px-3 py-1 text-sm font-medium text-black">
      Draft
    </span>
  );
}

function StepBody({
  stepId,
  ageBand,
}: {
  stepId: string | null;
  ageBand: AgeBand | null;
}) {
  const step = libraryStepById(stepId);
  if (!step) {
    return null;
  }
  const safetyNote = step.safety_note.trim();
  const teenNote = ageBand === "13-17" ? step.teen_note.trim() : "";
  const sources = visibleLibraryStepSources(step);

  return (
    <div className="flex flex-col gap-6">
      {step.what_it_involves.trim() ? (
        <section>
          <h3 className="text-base font-semibold text-black">What happens in this session</h3>
          <p className="mt-2 text-base leading-7 text-black">{step.what_it_involves}</p>
        </section>
      ) : null}
      {step.why_it_may_help.trim() ? (
        <section>
          <h3 className="text-base font-semibold text-black">Why it may help</h3>
          <p className="mt-2 text-base leading-7 text-black">{step.why_it_may_help}</p>
        </section>
      ) : null}
      {safetyNote || teenNote ? (
        <aside className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4" role="note">
          <h3 className="text-base font-semibold text-amber-950">Good to know</h3>
          {safetyNote ? (
            <p className="mt-2 text-base leading-7 text-amber-950">{step.safety_note}</p>
          ) : null}
          {teenNote ? (
            <p className="mt-2 text-base leading-7 text-amber-950">{step.teen_note}</p>
          ) : null}
        </aside>
      ) : null}
      {sources.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-base font-semibold text-black">
            Sources and limits
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {sources.map((source) => (
              <li key={`${source.title}-${source.url}`}>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-base font-medium text-black underline decoration-black underline-offset-4"
                  >
                    {source.title || source.url}
                  </a>
                ) : (
                  <p className="text-base font-medium text-black">{source.title}</p>
                )}
                {source.limits ? (
                  <p className="mt-1 text-sm leading-6 text-[#545454]">{source.limits}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function firstSentence(about: string) {
  const trimmed = about.trim();
  const end = trimmed.indexOf(". ");
  if (end === -1) {
    return trimmed;
  }
  return trimmed.slice(0, end + 1);
}

function WhoOffers({
  practitionerType,
  patientCity,
  ageBand,
  roomy = false,
  onChoose,
}: {
  practitionerType: string;
  patientCity: string;
  ageBand: AgeBand | null;
  roomy?: boolean;
  onChoose: (person: Practitioner) => void;
}) {
  const matches = cliniciansForStep(practitionerType, patientCity, ageBand ?? undefined);

  return (
    <section aria-label="Who offers this">
      <h3 className="text-base font-semibold text-black">Who offers this</h3>
      {matches.length === 0 ? (
        <p className="mt-2 text-base leading-7 text-[#545454]">
          No matching clinicians are in the demo data.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {matches.map((person) => (
            <li key={person.id} className="rounded-xl border border-[#E2E2E2] bg-white px-4 py-3">
              <p className="text-base font-semibold text-black">{person.name}</p>
              <p className="text-sm leading-6 text-[#545454]">{person.clinic}</p>
              <p className="mt-2 text-base leading-7 text-black">{firstSentence(person.about)}</p>
              <p className="mt-2 text-sm leading-6 text-[#545454]">
                {person.details.availability}
              </p>
              <p className="text-sm leading-6 text-[#545454]">
                {person.details.languages.join(", ")}
              </p>
              <p className="mt-2 text-sm font-medium text-black">
                {person.details.accepting_new_patients
                  ? "Accepting new patients"
                  : "Not accepting new patients"}
              </p>
              <p className="mt-1 text-sm leading-6 text-[#545454]">Fictional clinic.</p>
              <button
                type="button"
                onClick={() => onChoose(person)}
                className={`mt-3 inline-flex cursor-pointer items-center justify-center rounded-full border border-[#E2E2E2] bg-white font-medium text-black hover:bg-[#F6F6F6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${roomy ? "min-h-12 w-full px-5 text-base" : "min-h-10 px-4 text-sm"}`}
              >
                Choose
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type BookingSlot = { id: string; label: string };

type Booking =
  | { kind: "slots"; person: Practitioner; slotId: string | null; slots: BookingSlot[] }
  | { kind: "confirmed"; person: Practitioner; slotLabel: string };

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const MORNING_TIMES = ["9:00 a.m.", "10:30 a.m."];
const AFTERNOON_TIMES = ["1:00 p.m.", "2:30 p.m."];

function bookingSlots(availability: string, today: Date): BookingSlot[] {
  const rules = availabilityRules(availability);
  const slots: BookingSlot[] = [];
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  cursor.setDate(cursor.getDate() + 1);
  for (let guard = 0; guard < 80 && slots.length < 6; guard += 1) {
    const matches = rules.filter((rule) => rule.day === cursor.getDay());
    for (const match of matches) {
      const times = match.period === "afternoon" ? AFTERNOON_TIMES : MORNING_TIMES;
      for (const time of times) {
        if (slots.length >= 6) {
          break;
        }
        const label = `${dayLabel(cursor)} · ${time}`;
        slots.push({ id: label, label });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return slots;
}

function availabilityRules(availability: string): { day: number; period: "morning" | "afternoon" }[] {
  const normalized = availability.toLowerCase().replace(/,/g, "");
  if (/\bweekdays?\b/.test(normalized)) {
    const period = normalized.includes("afternoon") ? "afternoon" : "morning";
    return [1, 2, 3, 4, 5].map((day) => ({ day, period }));
  }
  const rules: { day: number; period: "morning" | "afternoon" }[] = [];
  let pending: number[] = [];
  for (const token of normalized.split(/\s+/)) {
    const day = DAY_NAMES.indexOf(token as (typeof DAY_NAMES)[number]);
    if (day >= 0) {
      pending.push(day);
      continue;
    }
    if (token.startsWith("morning") || token.startsWith("afternoon")) {
      const period = token.startsWith("afternoon") ? "afternoon" : "morning";
      for (const pendingDay of pending) {
        rules.push({ day: pendingDay, period });
      }
      pending = [];
    }
  }
  if (rules.length > 0) {
    return rules;
  }
  return [1, 2, 3, 4, 5].map((day) => ({ day, period: "morning" as const }));
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function BookingScreen({
  booking,
  roomy = false,
  onSelect,
  onConfirm,
  onDone,
}: {
  booking: Booking;
  roomy?: boolean;
  onSelect: (slotId: string) => void;
  onConfirm: () => void;
  onDone: () => void;
}) {
  const ready = booking.kind === "slots" && Boolean(booking.slotId);
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 ${roomy ? "step-sheet-scroll" : ""}`}
      style={roomy ? sheetScrollStyle : undefined}
    >
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        Demo only. No real booking is made.
      </p>
      {booking.kind === "slots" ? (
        <>
          <ul className="flex flex-col gap-2">
            {booking.slots.map((slot) => {
              const selected = booking.slotId === slot.id;
              return (
                <li key={slot.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(slot.id)}
                    className={
                      selected
                        ? `w-full cursor-pointer rounded-xl border-2 border-black bg-[#F6F6F6] px-4 text-left text-base text-black ${roomy ? "min-h-12" : "py-3"}`
                        : `w-full cursor-pointer rounded-xl border border-[#E2E2E2] bg-white px-4 text-left text-base text-black hover:bg-[#F6F6F6] ${roomy ? "min-h-12" : "py-3"}`
                    }
                  >
                    {slot.label}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            disabled={!ready}
            onClick={onConfirm}
            className={
              ready
                ? "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-black px-5 text-base font-medium text-white"
                : "inline-flex min-h-12 cursor-not-allowed items-center justify-center rounded-full bg-[#E2E2E2] px-5 text-base font-medium text-[#545454]"
            }
          >
            Confirm
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xl font-bold tracking-tight text-black">{booking.person.name}</p>
          <p className="text-base leading-7 text-[#545454]">{booking.person.clinic}</p>
          <p className="text-base leading-7 text-black">{booking.slotLabel}</p>
          <button
            type="button"
            onClick={onDone}
            className="mt-2 inline-flex min-h-12 w-fit cursor-pointer items-center justify-center rounded-full bg-black px-5 text-base font-medium text-white"
          >
            Back to pathway
          </button>
        </div>
      )}
    </div>
  );
}
