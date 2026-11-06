"use client";

import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import type { AgeBand } from "../../lib/catalog";
import {
  getOrCreateSessionId,
  newBookingId,
  saveCurrentAttempt,
} from "../../lib/booking/browser";
import { clinicIdFromName, consentCanContinue, type BookingDestination } from "../../lib/booking/model";
import {
  BOOK_BUTTON,
  CALL_BUTTON,
  CANCEL_LABEL,
  CONSENT_TEXT_VERSION,
  CONSENT_UNCHECKED,
  CONTINUE_LABEL,
  PARENT_LABEL,
  WEBSITE_BUTTON,
  consentIntro,
  shareLabel,
} from "../../lib/booking/consent";
import { SHARED_BOOKING_URL } from "../../lib/booking/link";
import type { Practitioner } from "../../lib/booking/practitioners";
import type { ResultsFile } from "../../lib/booking/snapshot";
import { libraryStepById, visibleLibraryStepSources } from "../../lib/careSteps";
import { SHOW_DRAFT_STEPS } from "../../lib/copy";
import { cliniciansForStep } from "../../lib/matchPractitioners";

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
  pathwayId,
  stepNodeId,
  buildSnapshot,
  onClose,
}: {
  title: string;
  stepId: string | null;
  practitionerType: string;
  patientCity: string;
  ageBand: AgeBand | null;
  pathwayId: string;
  stepNodeId: string;
  buildSnapshot: () => ResultsFile;
  onClose: () => void;
}) {
  const [isPhone, setIsPhone] = useState(false);
  const [consent, setConsent] = useState<ConsentTarget | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const resetKey = `${title}:${isPhone}`;
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setOffset({ x: 0, y: 0 });
    setConsent(null);
  }
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
    if ((event.target as HTMLElement).closest("button, a, input, label")) {
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
          {consent ? (
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setConsent(null)}
                className="cursor-pointer text-sm font-medium text-black underline decoration-black underline-offset-4"
              >
                Back
              </button>
              <h2 id="step-window-title" className="text-xl font-bold tracking-tight text-black">
                {consent.person.name}
              </h2>
              <p className="text-sm leading-6 text-[#545454]">{consent.person.clinic}</p>
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
        {consent ? (
          <ConsentStep
            key={`${consent.person.id}-${consent.destination}`}
            person={consent.person}
            destination={consent.destination}
            ageBand={ageBand}
            pathwayId={pathwayId}
            stepNodeId={stepNodeId}
            roomy={isPhone}
            buildSnapshot={buildSnapshot}
            onCancel={() => setConsent(null)}
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
                onStart={(person, destination) => setConsent({ person, destination })}
              />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

type ConsentTarget = {
  person: Practitioner;
  destination: BookingDestination;
};

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

function contactActions(person: Practitioner): { destination: BookingDestination; label: string }[] {
  if (person.bookingUrl) {
    return [{ destination: "booking", label: BOOK_BUTTON }];
  }
  const actions: { destination: BookingDestination; label: string }[] = [];
  if (person.phone) {
    actions.push({ destination: "phone", label: CALL_BUTTON });
  }
  if (person.website) {
    actions.push({ destination: "website", label: WEBSITE_BUTTON });
  }
  return actions;
}

function WhoOffers({
  practitionerType,
  patientCity,
  ageBand,
  roomy = false,
  onStart,
}: {
  practitionerType: string;
  patientCity: string;
  ageBand: AgeBand | null;
  roomy?: boolean;
  onStart: (person: Practitioner, destination: BookingDestination) => void;
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
          {matches.map((person) => {
            const actions = contactActions(person);
            return (
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
                {actions.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    {actions.map((action) => (
                      <button
                        key={action.destination}
                        type="button"
                        onClick={() => onStart(person, action.destination)}
                        className={`inline-flex cursor-pointer items-center justify-center rounded-full border border-[#E2E2E2] bg-white font-medium text-black hover:bg-[#F6F6F6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${roomy ? "min-h-12 w-full px-5 text-base" : "min-h-10 px-4 text-sm"}`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[#545454]">
                    No booking link, phone, or website is listed for this demo clinician.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function openBookingPage(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function writeField(form: HTMLFormElement, name: string, value: string) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement) {
    field.value = value;
  }
}

function ConsentStep({
  person,
  destination,
  ageBand,
  pathwayId,
  stepNodeId,
  roomy = false,
  buildSnapshot,
  onCancel,
}: {
  person: Practitioner;
  destination: BookingDestination;
  ageBand: AgeBand | null;
  pathwayId: string;
  stepNodeId: string;
  roomy?: boolean;
  buildSnapshot: () => ResultsFile;
  onCancel: () => void;
}) {
  const [share, setShare] = useState(false);
  const [parental, setParental] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const sending = useRef(false);
  const under18 = ageBand === "13-17";
  const canContinue = consentCanContinue({
    shared: share,
    under18,
    parentalConsent: parental,
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!canContinue || sending.current) {
      event.preventDefault();
      return;
    }
    const attemptId = newBookingId();
    const sessionId = getOrCreateSessionId();
    if (!attemptId || !sessionId || !pathwayId) {
      event.preventDefault();
      setProblem("This browser could not start a booking. Try again.");
      return;
    }
    const createdAt = new Date().toISOString();
    const clinicId = clinicIdFromName(person.clinic);
    const snapshot = share ? JSON.stringify(buildSnapshot()) : "";
    const form = event.currentTarget;
    writeField(form, "attemptId", attemptId);
    writeField(form, "createdAt", createdAt);
    writeField(form, "clinicId", clinicId);
    writeField(form, "pathwayId", pathwayId);
    writeField(form, "sessionId", sessionId);
    writeField(form, "sharedWithClinic", share ? "true" : "false");
    writeField(form, "parentalConsent", parental ? "true" : "false");
    writeField(form, "consentTextVersion", CONSENT_TEXT_VERSION);
    writeField(form, "ageBand", ageBand ?? "");
    writeField(form, "destination", destination);
    writeField(form, "snapshot", snapshot);
    const saved = saveCurrentAttempt({
      id: attemptId,
      createdAt,
      status: "clicked",
      practitionerId: person.id,
      clinicId,
      clinicName: person.clinic,
      pathwayId,
      sessionId,
      stepNodeId,
      destination,
      phone: person.phone,
      promptOpen: true,
      returned: false,
    });
    if (!saved) {
      event.preventDefault();
      setProblem("This browser could not save the booking on this device.");
      return;
    }
    sending.current = true;
    if (destination === "booking") {
      event.preventDefault();
      openBookingPage(SHARED_BOOKING_URL);
      void fetch(`/api/book/${person.id}`, {
        method: "POST",
        body: new FormData(form),
        keepalive: true,
      });
    }
  }

  return (
    <form
      method="POST"
      action={`/api/book/${person.id}`}
      target="_blank"
      onSubmit={onSubmit}
      className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 ${roomy ? "step-sheet-scroll" : ""}`}
      style={roomy ? sheetScrollStyle : undefined}
    >
      <Hidden name="attemptId" />
      <Hidden name="createdAt" />
      <Hidden name="clinicId" />
      <Hidden name="pathwayId" />
      <Hidden name="sessionId" />
      <Hidden name="sharedWithClinic" />
      <Hidden name="parentalConsent" />
      <Hidden name="consentTextVersion" />
      <Hidden name="ageBand" />
      <Hidden name="destination" />
      <Hidden name="snapshot" />
      <p className="text-base leading-7 text-black">{consentIntro(person.clinic)}</p>
      <p className="text-base leading-7 text-[#545454]">{CONSENT_UNCHECKED}</p>
      <label className="flex items-start gap-3 text-base leading-7 text-black">
        <input
          type="checkbox"
          checked={share}
          onChange={(event) => setShare(event.target.checked)}
          className="mt-1 size-5 shrink-0 accent-black"
        />
        <span>{shareLabel(person.clinic)}</span>
      </label>
      {under18 ? (
        <label className="flex items-start gap-3 text-base leading-7 text-black">
          <input
            type="checkbox"
            checked={parental}
            onChange={(event) => setParental(event.target.checked)}
            className="mt-1 size-5 shrink-0 accent-black"
          />
          <span>{PARENT_LABEL}</span>
        </label>
      ) : null}
      {problem ? <p className="text-base leading-7 text-red-950">{problem}</p> : null}
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={!canContinue}
          className={
            canContinue
              ? "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-black px-5 text-base font-medium text-white"
              : "inline-flex min-h-12 cursor-not-allowed items-center justify-center rounded-full bg-[#E2E2E2] px-5 text-base font-medium text-[#545454]"
          }
        >
          {CONTINUE_LABEL}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border border-[#E2E2E2] bg-white px-5 text-base font-medium text-black hover:bg-[#F6F6F6]"
        >
          {CANCEL_LABEL}
        </button>
      </div>
    </form>
  );
}

function Hidden({ name }: { name: string }) {
  return <input type="hidden" name={name} defaultValue="" />;
}
