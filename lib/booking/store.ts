import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ACCESS_ACTIONS,
  isReferralStatus,
  type AccessAction,
  type AccessLog,
  type BookingAttempt,
  type PatientContact,
  type Referral,
  type ReferralStatus,
} from "./model";

export type BookingStoreData = {
  attempts: BookingAttempt[];
  referrals: Referral[];
  accessLogs: AccessLog[];
};

const DEFAULT_PATH = path.join(process.cwd(), "data", "runtime", "bookings.json");

export function bookingStorePath(): string {
  const override = process.env.BOOKING_STORE_PATH?.trim();
  return override || DEFAULT_PATH;
}

function emptyStore(): BookingStoreData {
  return { attempts: [], referrals: [], accessLogs: [] };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function upgradePatient(value: unknown): PatientContact {
  const record = value && typeof value === "object" ? (value as Partial<PatientContact>) : {};
  return {
    name: text(record.name),
    phone: text(record.phone),
    email: text(record.email),
  };
}

function upgradeReferral(value: unknown): Referral | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const referral = value as Partial<Referral>;
  if (typeof referral.id !== "string" || typeof referral.attemptId !== "string") {
    return null;
  }
  if (typeof referral.clinicId !== "string" || typeof referral.createdAt !== "string") {
    return null;
  }
  if (!referral.snapshot || typeof referral.snapshot !== "object") {
    return null;
  }
  const status: ReferralStatus = isReferralStatus(referral.status) ? referral.status : "new";
  return {
    id: referral.id,
    attemptId: referral.attemptId,
    clinicId: referral.clinicId,
    createdAt: referral.createdAt,
    snapshot: referral.snapshot,
    status,
    statusUpdatedAt: text(referral.statusUpdatedAt) || referral.createdAt,
    firstViewedAt: text(referral.firstViewedAt) || null,
    patient: upgradePatient(referral.patient),
  };
}

function upgradeAccessLog(value: unknown): AccessLog | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const entry = value as Partial<AccessLog>;
  if (typeof entry.id !== "string" || typeof entry.timestamp !== "string") {
    return null;
  }
  if (typeof entry.clinicId !== "string" || entry.actor !== "shared-portal") {
    return null;
  }
  if (typeof entry.action !== "string" || !(ACCESS_ACTIONS as readonly string[]).includes(entry.action)) {
    return null;
  }
  const details = text(entry.details);
  if (details.length > 200 || details.includes("@")) {
    return null;
  }
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    referralId: typeof entry.referralId === "string" ? entry.referralId : null,
    clinicId: entry.clinicId,
    actor: "shared-portal",
    action: entry.action as AccessAction,
    details,
  };
}

export function normalizeBookingStore(parsed: unknown): BookingStoreData {
  const record = parsed && typeof parsed === "object" ? (parsed as Partial<BookingStoreData>) : {};
  return {
    attempts: Array.isArray(record.attempts) ? record.attempts : [],
    referrals: Array.isArray(record.referrals)
      ? record.referrals.flatMap((item) => {
          const referral = upgradeReferral(item);
          return referral ? [referral] : [];
        })
      : [],
    accessLogs: Array.isArray(record.accessLogs)
      ? record.accessLogs.flatMap((item) => {
          const entry = upgradeAccessLog(item);
          return entry ? [entry] : [];
        })
      : [],
  };
}

async function readStore(): Promise<BookingStoreData> {
  try {
    const raw = await readFile(bookingStorePath(), "utf8");
    return normalizeBookingStore(JSON.parse(raw) as unknown);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return emptyStore();
    }
    throw error;
  }
}

async function writeStore(store: BookingStoreData): Promise<void> {
  const filePath = bookingStorePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(store, null, 2), "utf8");
  await rename(tempPath, filePath);
}

let chain: Promise<void> = Promise.resolve();

export function updateBookingStore<T>(
  change: (store: BookingStoreData) => T | Promise<T>,
): Promise<T> {
  const run = chain.then(async () => {
    const store = await readStore();
    const result = await change(store);
    await writeStore(store);
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
