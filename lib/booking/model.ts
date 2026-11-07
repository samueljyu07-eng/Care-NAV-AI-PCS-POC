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

export const REFERRAL_STATUSES = ["new", "viewed", "contacted", "booked", "closed"] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const CLINIC_REFERRAL_STATUSES = ["contacted", "booked", "closed"] as const;
export type ClinicReferralStatus = (typeof CLINIC_REFERRAL_STATUSES)[number];

export const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  new: "New",
  viewed: "Viewed",
  contacted: "Contacted",
  booked: "Booked",
  closed: "Closed / Not a fit",
};

export type PatientSays = "booked" | "not_yet" | "no_response";

export const PATIENT_SAYS_LABEL: Record<PatientSays, string> = {
  booked: "Booked",
  not_yet: "Not yet",
  no_response: "No response",
};

export type PatientContact = {
  name: string;
  phone: string;
  email: string;
};

export type Referral = {
  id: string;
  attemptId: string;
  clinicId: string;
  createdAt: string;
  snapshot: ResultsFile;
  status: ReferralStatus;
  statusUpdatedAt: string;
  firstViewedAt: string | null;
  patient: PatientContact;
};

export const ACCESS_ACTIONS = [
  "viewed_list",
  "opened_referral",
  "status_changed",
  "printed",
] as const;
export type AccessAction = (typeof ACCESS_ACTIONS)[number];

export type AccessLog = {
  id: string;
  timestamp: string;
  referralId: string | null;
  clinicId: string;
  actor: "shared-portal";
  action: AccessAction;
  details: string;
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
  patient: PatientContact | null;
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

export function isReferralStatus(value: unknown): value is ReferralStatus {
  return typeof value === "string" && (REFERRAL_STATUSES as readonly string[]).includes(value);
}

export function isClinicReferralStatus(value: unknown): value is ClinicReferralStatus {
  return (
    typeof value === "string" && (CLINIC_REFERRAL_STATUSES as readonly string[]).includes(value)
  );
}

export function patientSays(status: BookingStatus | null | undefined): PatientSays {
  if (status === "booked") {
    return "booked";
  }
  if (status === "remind_later") {
    return "not_yet";
  }
  return "no_response";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+().\-\s]{7,30}$/;

export function parsePatientContact(
  form: FormData,
  shared: boolean,
): { ok: true; patient: PatientContact | null } | { ok: false; error: string } {
  if (!shared) {
    return { ok: true, patient: null };
  }
  const name = field(form, "patientName");
  const phone = field(form, "patientPhone");
  const email = field(form, "patientEmail");
  if (!name || name.length > 80) {
    return { ok: false, error: "Add your name so the clinic can reach you." };
  }
  if (!PHONE_PATTERN.test(phone)) {
    return { ok: false, error: "Add a phone number the clinic can call." };
  }
  if (email.length > 120 || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Add an email the clinic can use." };
  }
  return { ok: true, patient: { name, phone, email } };
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
  const patient = parsePatientContact(form, sharedWithClinic);
  if (!patient.ok) {
    return patient;
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
      patient: patient.patient,
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
