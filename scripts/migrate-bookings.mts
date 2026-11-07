import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STATUSES = new Set(["new", "viewed", "contacted", "booked", "closed"]);
const ACTIONS = new Set(["viewed_list", "opened_referral", "status_changed", "printed"]);

function bookingFilePath(): string {
  const override = process.env.BOOKING_STORE_PATH?.trim();
  if (override) {
    return override;
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  return path.join(root, "data", "runtime", "bookings.json");
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function upgradeReferral(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const referral = value as Record<string, unknown>;
  if (typeof referral.id !== "string" || typeof referral.createdAt !== "string") {
    return null;
  }
  const patient =
    referral.patient && typeof referral.patient === "object"
      ? (referral.patient as Record<string, unknown>)
      : {};
  const status = STATUSES.has(String(referral.status)) ? referral.status : "new";
  return {
    ...referral,
    status,
    statusUpdatedAt: text(referral.statusUpdatedAt) || referral.createdAt,
    firstViewedAt: text(referral.firstViewedAt) || null,
    patient: {
      name: text(patient.name),
      phone: text(patient.phone),
      email: text(patient.email),
    },
  };
}

function upgradeLog(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const entry = value as Record<string, unknown>;
  const details = text(entry.details);
  if (!ACTIONS.has(String(entry.action)) || entry.actor !== "shared-portal") {
    return null;
  }
  if (details.length > 200 || details.includes("@")) {
    return null;
  }
  return {
    ...entry,
    referralId: typeof entry.referralId === "string" ? entry.referralId : null,
    details,
  };
}

const filePath = bookingFilePath();
let parsed: { attempts?: unknown; referrals?: unknown; accessLogs?: unknown } = {};
try {
  parsed = JSON.parse(readFileSync(filePath, "utf8")) as typeof parsed;
} catch (error) {
  if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
    throw error;
  }
}

const store = {
  attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
  referrals: Array.isArray(parsed.referrals)
    ? parsed.referrals.flatMap((item) => {
        const referral = upgradeReferral(item);
        return referral ? [referral] : [];
      })
    : [],
  accessLogs: Array.isArray(parsed.accessLogs)
    ? parsed.accessLogs.flatMap((item) => {
        const entry = upgradeLog(item);
        return entry ? [entry] : [];
      })
    : [],
};

mkdirSync(path.dirname(filePath), { recursive: true });
const tempPath = `${filePath}.tmp`;
writeFileSync(tempPath, JSON.stringify(store, null, 2));
renameSync(tempPath, filePath);
console.log(
  `Updated booking file: ${store.referrals.length} referrals, ${store.attempts.length} booking attempts, ${store.accessLogs.length} access log rows.`,
);
