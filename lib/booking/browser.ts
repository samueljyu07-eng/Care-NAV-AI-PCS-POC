import { isUuid, type BookingDestination, type BookingStatus } from "./model";

const ATTEMPT_KEY = "care-nav-booking-attempt";
const SESSION_KEY = "care-nav-session-id";
const BOOKED_STEPS_KEY = "care-nav-booked-steps";

export const STEP_BOOKED_EVENT = "carenav-step-booked";

export type StoredBooking = {
  id: string;
  createdAt: string;
  status: BookingStatus;
  practitionerId: string;
  clinicId: string;
  clinicName: string;
  pathwayId: string;
  sessionId: string;
  stepNodeId: string;
  destination: BookingDestination;
  phone?: string;
  promptOpen: boolean;
  returned: boolean;
};

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedAttempt: StoredBooking | null = null;
let clockNow = 0;
let bookedRaw: string | null | undefined;
let bookedSteps: string[] = [];
const serverBookedSteps: string[] = [];

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isStatus(value: unknown): value is BookingStatus {
  return (
    value === "clicked" ||
    value === "booked" ||
    value === "remind_later" ||
    value === "dismissed" ||
    value === "expired"
  );
}

function isDestination(value: unknown): value is BookingDestination {
  return value === "booking" || value === "website" || value === "phone";
}

function readStored(raw: string | null): StoredBooking | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredBooking>;
    if (!parsed || typeof parsed.id !== "string" || !isUuid(parsed.id)) {
      return null;
    }
    if (!isStatus(parsed.status) || !isDestination(parsed.destination)) {
      return null;
    }
    if (typeof parsed.createdAt !== "string" || typeof parsed.stepNodeId !== "string") {
      return null;
    }
    return {
      id: parsed.id,
      createdAt: parsed.createdAt,
      status: parsed.status,
      practitionerId: typeof parsed.practitionerId === "string" ? parsed.practitionerId : "",
      clinicId: typeof parsed.clinicId === "string" ? parsed.clinicId : "",
      clinicName: typeof parsed.clinicName === "string" ? parsed.clinicName : "",
      pathwayId: typeof parsed.pathwayId === "string" ? parsed.pathwayId : "",
      sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : "",
      stepNodeId: parsed.stepNodeId,
      destination: parsed.destination,
      phone: typeof parsed.phone === "string" ? parsed.phone : undefined,
      promptOpen: parsed.promptOpen === true,
      returned: parsed.returned === true,
    };
  } catch {
    return null;
  }
}

export function subscribeBooking(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeBookingClock(listener: () => void) {
  const tick = () => {
    clockNow = Date.now();
    listener();
  };
  clockNow = Date.now();
  const interval = window.setInterval(tick, 60 * 60 * 1000);
  const frame = window.requestAnimationFrame(tick);
  return () => {
    window.clearInterval(interval);
    window.cancelAnimationFrame(frame);
  };
}

export function getBookingClock(): number {
  return clockNow;
}

export function getBookingClockServer(): number {
  return 0;
}

function rememberBookedRaw(raw: string | null) {
  if (raw === bookedRaw) {
    return;
  }
  bookedRaw = raw;
  bookedSteps = readBookedStepIdsFrom(raw);
}

function readBookedStepIdsFrom(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function subscribeBookedSteps(listener: () => void) {
  window.addEventListener(STEP_BOOKED_EVENT, listener);
  return () => window.removeEventListener(STEP_BOOKED_EVENT, listener);
}

export function getBookedStepSnapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(BOOKED_STEPS_KEY);
  } catch {
    raw = null;
  }
  rememberBookedRaw(raw);
  return bookedSteps;
}

export function getBookedStepServerSnapshot(): string[] {
  return serverBookedSteps;
}

export function getBookingSnapshot(): StoredBooking | null {
  const raw = storage()?.getItem(ATTEMPT_KEY) ?? null;
  if (raw === cachedRaw) {
    return cachedAttempt;
  }
  cachedRaw = raw;
  cachedAttempt = readStored(raw);
  return cachedAttempt;
}

export function getBookingServerSnapshot(): StoredBooking | null {
  return null;
}

function writeAttempt(attempt: StoredBooking): boolean {
  const box = storage();
  if (!box) {
    return false;
  }
  try {
    const raw = JSON.stringify(attempt);
    box.setItem(ATTEMPT_KEY, raw);
    cachedRaw = raw;
    cachedAttempt = attempt;
    emit();
    return true;
  } catch {
    return false;
  }
}

export function newBookingId(): string | null {
  try {
    const id = crypto.randomUUID();
    return isUuid(id) ? id : null;
  } catch {
    return null;
  }
}

export function getOrCreateSessionId(): string | null {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && isUuid(existing)) {
      return existing;
    }
    const created = newBookingId();
    if (!created) {
      return null;
    }
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return null;
  }
}

export function saveCurrentAttempt(attempt: StoredBooking): boolean {
  return writeAttempt(attempt);
}

export function markBookingReturned() {
  const current = getBookingSnapshot();
  if (!current?.promptOpen || current.returned) {
    return;
  }
  writeAttempt({ ...current, returned: true });
}

export function openBookingPrompt() {
  const current = getBookingSnapshot();
  if (!current) {
    return;
  }
  writeAttempt({ ...current, promptOpen: true });
}

export function readBookedStepIds(): string[] {
  return getBookedStepSnapshot();
}

function rememberBookedStep(stepNodeId: string) {
  if (!stepNodeId) {
    return;
  }
  const ids = readBookedStepIds();
  const next = ids.includes(stepNodeId) ? ids : [...ids, stepNodeId];
  try {
    const raw = JSON.stringify(next);
    sessionStorage.setItem(BOOKED_STEPS_KEY, raw);
    bookedRaw = raw;
    bookedSteps = next;
  } catch {
    // The green step mark lasts for this visit. The booking status is already saved.
  }
  window.dispatchEvent(
    new CustomEvent(STEP_BOOKED_EVENT, { detail: { stepNodeId } }),
  );
}

export async function patchBookingStatus(
  status: "booked" | "remind_later" | "dismissed" | "expired",
): Promise<boolean> {
  const current = getBookingSnapshot();
  if (!current) {
    return false;
  }
  try {
    const response = await fetch(`/api/booking-attempts/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok && response.status !== 404) {
      return false;
    }
  } catch {
    return false;
  }
  const saved = writeAttempt({ ...current, status, promptOpen: false });
  if (saved && status === "booked") {
    rememberBookedStep(current.stepNodeId);
  }
  return saved;
}
