import { randomUUID } from "node:crypto";
import {
  isClinicReferralStatus,
  isUuid,
  PATIENT_SAYS_LABEL,
  patientSays,
  REFERRAL_STATUS_LABEL,
  type AccessLog,
  type BookingAttempt,
  type Referral,
} from "../booking/model";
import { clinicIdFor, listPractitioners, practitionerById } from "../booking/practitioners";
import { updateBookingStore, type BookingStoreData } from "../booking/store";
import type {
  PortalOption,
  ReferralDetail,
  ReferralListItem,
  ReferralListResult,
  ReferralQuery,
} from "./types";

export type {
  PortalOption,
  ReferralDetail,
  ReferralListItem,
  ReferralListResult,
  ReferralQuery,
  ReferralSummary,
} from "./types";

const MONTH_ZONE = "America/Vancouver";
const ACTOR = "shared-portal" as const;

type Joined = {
  referral: Referral;
  attempt: BookingAttempt | undefined;
};

function yearMonth(iso: string): string | null {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) {
    return null;
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MONTH_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(time));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) {
    return null;
  }
  return `${year}-${month}`;
}

export function formatReceived(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) {
    return "Unknown time";
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MONTH_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(time));
}

function clinicName(clinicId: string): string {
  const match = listPractitioners().find((person) => clinicIdFor(person) === clinicId);
  return match?.clinic ?? "Unknown clinic";
}

function joined(store: BookingStoreData): Joined[] {
  return store.referrals.map((referral) => ({
    referral,
    attempt: store.attempts.find((item) => item.id === referral.attemptId),
  }));
}

function toListItem(row: Joined): ReferralListItem {
  const says = patientSays(row.attempt?.status);
  const clinician = row.attempt ? practitionerById(row.attempt.practitionerId) : undefined;
  return {
    id: row.referral.id,
    createdAt: row.referral.createdAt,
    receivedLabel: formatReceived(row.referral.createdAt),
    patientName: row.referral.patient.name.trim() || "Not shared",
    ageLabel: row.referral.snapshot.intake?.ageLabel?.trim() || "Not shared",
    clinicianId: clinician?.id ?? "",
    clinicianName: clinician?.name ?? "Unknown clinician",
    clinicId: row.referral.clinicId,
    clinicName: clinicName(row.referral.clinicId),
    status: row.referral.status,
    statusLabel: REFERRAL_STATUS_LABEL[row.referral.status],
    patientSays: says,
    patientSaysLabel: PATIENT_SAYS_LABEL[says],
  };
}

function toDetail(row: Joined): ReferralDetail {
  const item = toListItem(row);
  return {
    id: item.id,
    createdAt: item.createdAt,
    receivedLabel: item.receivedLabel,
    clinicId: item.clinicId,
    clinicName: item.clinicName,
    clinicianId: item.clinicianId,
    clinicianName: item.clinicianName,
    status: item.status,
    statusLabel: item.statusLabel,
    statusUpdatedAt: row.referral.statusUpdatedAt,
    firstViewedAt: row.referral.firstViewedAt,
    patient: row.referral.patient,
    patientSays: item.patientSays,
    patientSaysLabel: item.patientSaysLabel,
    ageLabel: item.ageLabel,
    snapshot: row.referral.snapshot,
  };
}

function pushLog(store: BookingStoreData, entry: Omit<AccessLog, "id" | "actor"> & { timestamp: string }): void {
  store.accessLogs.push({
    id: randomUUID(),
    actor: ACTOR,
    ...entry,
  });
}

function optionLists(rows: Joined[], clinicId?: string): { clinics: PortalOption[]; clinicians: PortalOption[] } {
  const clinics = new Map<string, string>();
  const clinicians = new Map<string, PortalOption>();
  for (const row of rows) {
    clinics.set(row.referral.clinicId, clinicName(row.referral.clinicId));
    if (clinicId && row.referral.clinicId !== clinicId) {
      continue;
    }
    const person = row.attempt ? practitionerById(row.attempt.practitionerId) : undefined;
    if (!person) {
      continue;
    }
    clinicians.set(person.id, {
      id: person.id,
      name: person.name,
      clinicId: row.referral.clinicId,
    });
  }
  return {
    clinics: [...clinics.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    clinicians: [...clinicians.values()].sort((left, right) => left.name.localeCompare(right.name)),
  };
}

// TODO: replace passcode with real auth + clinic scoping.
// A signed-in clinic passes its id here. Until then the page can pass any clinic.
export async function getReferrals(
  query: ReferralQuery = {},
  now = Date.now(),
): Promise<ReferralListResult> {
  return updateBookingStore((store) => {
    const rows = joined(store);
    const scoped = rows.filter((row) => {
      if (query.clinicId && row.referral.clinicId !== query.clinicId) {
        return false;
      }
      if (query.clinicianId && row.attempt?.practitionerId !== query.clinicianId) {
        return false;
      }
      return true;
    });
    const month = yearMonth(new Date(now).toISOString());
    const inMonth = scoped.filter((row) => yearMonth(row.referral.createdAt) === month);
    const visible = query.status
      ? scoped.filter((row) => row.referral.status === query.status)
      : scoped;
    visible.sort((left, right) => Date.parse(right.referral.createdAt) - Date.parse(left.referral.createdAt));
    const options = optionLists(rows, query.clinicId);
    pushLog(store, {
      timestamp: new Date(now).toISOString(),
      referralId: null,
      clinicId: query.clinicId || "all",
      action: "viewed_list",
      details: `clinic=${query.clinicId || "all"} clinician=${query.clinicianId || "all"} status=${query.status || "all"}`,
    });
    return {
      referrals: visible.map(toListItem),
      summary: {
        thisMonth: inMonth.length,
        selfReportedBooked: inMonth.filter((row) => row.attempt?.status === "booked").length,
        clinicConfirmedBooked: inMonth.filter((row) => row.referral.status === "booked").length,
      },
      clinics: options.clinics,
      clinicians: options.clinicians,
    };
  });
}

export async function openReferral(
  id: string,
  now = Date.now(),
): Promise<ReferralDetail | null> {
  if (!isUuid(id)) {
    return null;
  }
  return updateBookingStore((store) => {
    const referral = store.referrals.find((item) => item.id === id);
    if (!referral) {
      return null;
    }
    const before = referral.status;
    if (referral.status === "new") {
      const stamp = new Date(now).toISOString();
      referral.status = "viewed";
      referral.firstViewedAt = referral.firstViewedAt ?? stamp;
      referral.statusUpdatedAt = stamp;
    }
    pushLog(store, {
      timestamp: new Date(now).toISOString(),
      referralId: referral.id,
      clinicId: referral.clinicId,
      action: "opened_referral",
      details: before === "new" ? "new → viewed" : before,
    });
    const row = joined(store).find((item) => item.referral.id === id);
    return row ? toDetail(row) : null;
  });
}

export async function setReferralStatus(
  id: string,
  status: unknown,
  now = Date.now(),
): Promise<{ ok: true; detail: ReferralDetail } | { ok: false; status: number; message: string }> {
  if (!isUuid(id)) {
    return { ok: false, status: 400, message: "That referral id is not valid." };
  }
  if (!isClinicReferralStatus(status)) {
    return { ok: false, status: 400, message: "That status is not valid." };
  }
  return updateBookingStore((store) => {
    const referral = store.referrals.find((item) => item.id === id);
    if (!referral) {
      return { ok: false as const, status: 404, message: "That referral was not found." };
    }
    const before = referral.status;
    if (before !== status) {
      referral.status = status;
      referral.statusUpdatedAt = new Date(now).toISOString();
      pushLog(store, {
        timestamp: referral.statusUpdatedAt,
        referralId: referral.id,
        clinicId: referral.clinicId,
        action: "status_changed",
        details: `${before} → ${status}`,
      });
    }
    const row = joined(store).find((item) => item.referral.id === id);
    if (!row) {
      return { ok: false as const, status: 404, message: "That referral was not found." };
    }
    return { ok: true as const, detail: toDetail(row) };
  });
}

export async function logReferralPrint(
  id: string,
  now = Date.now(),
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (!isUuid(id)) {
    return { ok: false, status: 400, message: "That referral id is not valid." };
  }
  return updateBookingStore((store) => {
    const referral = store.referrals.find((item) => item.id === id);
    if (!referral) {
      return { ok: false as const, status: 404, message: "That referral was not found." };
    }
    pushLog(store, {
      timestamp: new Date(now).toISOString(),
      referralId: referral.id,
      clinicId: referral.clinicId,
      action: "printed",
      details: "print",
    });
    return { ok: true as const };
  });
}
