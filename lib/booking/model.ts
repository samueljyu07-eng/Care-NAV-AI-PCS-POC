import { categoryIds } from "../catalog";
import { CONSENT_TEXT_VERSION } from "./consent";
import type { ResultsFile } from "./snapshot";

export const BOOKING_ATTEMPT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BookingStatus =
  | "clicked"
  | "booked"
  | "remind_later"
  | "dismissed"
  | "expired";

export type BookingDestination = "booking" | "website" | "phone";

export type BookingAttempt = {
  id: string;
  createdAt: string;
  practitionerId: string;
  clinicId: string;
  pathwayId: string;
  sessionId: string;
  sharedWithClinic: boolean;
  parentalConsent: boolean;
  consentTextVersion: string;
  status: BookingStatus;
  statusUpdatedAt: string;
};

export type Referral = {
  id: string;
  attemptId: string;
  clinicId: string;
  createdAt: string;
  snapshot: ResultsFile;
};

export type BookFormInput = {
  attemptId: string;
  createdAt: string;
  clinicId: string;
  pathwayId: string;
  sessionId: string;
  sharedWithClinic: boolean;
  parentalConsent: boolean;
  consentTextVersion: string;
  ageBand: "13-17" | "18+";
  destination: BookingDestination;
  snapshot: ResultsFile | null;
};

const PATIENT_STATUSES = new Set<BookingStatus>([
  "booked",
  "remind_later",
  "dismissed",
  "expired",
]);

export function clinicIdFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "clinic";
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isAttemptExpired(createdAt: string, now: number): boolean {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) {
    return true;
  }
  return now - created >= BOOKING_ATTEMPT_TTL_MS;
}

export function badgeVisible(
  status: BookingStatus,
  createdAt: string,
  now: number,
): boolean {
  if (status !== "clicked" && status !== "remind_later") {
    return false;
  }
  return !isAttemptExpired(createdAt, now);
}

export function consentCanContinue(input: {
  shared: boolean;
  under18: boolean;
  parentalConsent: boolean;
}): boolean {
  if (input.shared && input.under18 && !input.parentalConsent) {
    return false;
  }
  return true;
}

export function nextStatusAllowed(
  current: BookingStatus,
  next: BookingStatus,
  createdAt: string,
  now: number,
): boolean {
  if (current !== "clicked" && current !== "remind_later") {
    return false;
  }
  if (next === "booked" || next === "remind_later" || next === "dismissed") {
    return true;
  }
  if (next === "expired") {
    return isAttemptExpired(createdAt, now);
  }
  return false;
}

export function isPatientStatus(value: unknown): value is BookingStatus {
  return typeof value === "string" && PATIENT_STATUSES.has(value as BookingStatus);
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function flag(form: FormData, name: string): boolean | null {
  const value = field(form, name);
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

function acceptCreatedAt(value: string, now: number): string | null {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  if (Math.abs(now - parsed) > 15 * 60 * 1000) {
    return null;
  }
  return new Date(parsed).toISOString();
}

const SNAPSHOT_LIMIT = 750_000;

function readSnapshot(
  raw: string,
  shared: boolean,
): { ok: true; snapshot: ResultsFile | null } | { ok: false; error: string } {
  if (!shared) {
    return { ok: true, snapshot: null };
  }
  if (!raw) {
    return { ok: false, error: "The shared file was missing." };
  }
  if (raw.length > SNAPSHOT_LIMIT) {
    return { ok: false, error: "The shared file is too large." };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "The shared file could not be read." };
    }
    if ((parsed as { kind?: unknown }).kind !== "results-file") {
      return { ok: false, error: "The shared file could not be read." };
    }
    return { ok: true, snapshot: parsed as ResultsFile };
  } catch {
    return { ok: false, error: "The shared file could not be read." };
  }
}

export function parseBookForm(
  form: FormData,
  now: number,
): { ok: true; value: BookFormInput } | { ok: false; error: string } {
  const attemptId = field(form, "attemptId");
  const sessionId = field(form, "sessionId");
  const pathwayId = field(form, "pathwayId");
  const clinicId = field(form, "clinicId");
  const destination = field(form, "destination");
  const ageBand = field(form, "ageBand");
  const sharedWithClinic = flag(form, "sharedWithClinic");
  const parentalConsent = flag(form, "parentalConsent");
  const createdAt = acceptCreatedAt(field(form, "createdAt"), now);

  if (!isUuid(attemptId) || !isUuid(sessionId)) {
    return { ok: false, error: "The booking id was missing." };
  }
  if (!createdAt) {
    return { ok: false, error: "The booking time was missing." };
  }
  if (!clinicId || !categoryIds().includes(pathwayId)) {
    return { ok: false, error: "The clinic or care pathway was missing." };
  }
  if (destination !== "booking" && destination !== "website" && destination !== "phone") {
    return { ok: false, error: "Choose booking, the website, or a phone call." };
  }
  if (ageBand !== "13-17" && ageBand !== "18+") {
    return { ok: false, error: "The age band was missing." };
  }
  if (sharedWithClinic === null || parentalConsent === null) {
    return { ok: false, error: "The consent answers were missing." };
  }
  if (field(form, "consentTextVersion") !== CONSENT_TEXT_VERSION) {
    return { ok: false, error: "The consent text is out of date. Close the window and try again." };
  }
  if (
    !consentCanContinue({
      shared: sharedWithClinic,
      under18: ageBand === "13-17",
      parentalConsent,
    })
  ) {
    return {
      ok: false,
      error: "A parent or guardian needs to confirm before the file is sent.",
    };
  }

  const snapshot = readSnapshot(field(form, "snapshot"), sharedWithClinic);
  if (!snapshot.ok) {
    return snapshot;
  }

  return {
    ok: true,
    value: {
      attemptId,
      createdAt,
      clinicId,
      pathwayId,
      sessionId,
      sharedWithClinic,
      parentalConsent,
      consentTextVersion: CONSENT_TEXT_VERSION,
      ageBand,
      destination,
      snapshot: snapshot.snapshot,
    },
  };
}

export function safeHttpUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    if (url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
