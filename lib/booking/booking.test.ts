import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { SHARED_BOOKING_URL } from "./link";
import { recordBooking, updateBookingStatus } from "./record";
import { CLINIC_REFERRAL_EMAIL } from "./notify";
import { buildResultsFile } from "./snapshot";
import {
  BOOKING_ATTEMPT_TTL_MS,
  badgeVisible,
  clinicIdFromName,
  consentCanContinue,
} from "./model";
import { CONSENT_TEXT_VERSION } from "./consent";

const dirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.CARENAV_CLINIC_NOTIFY_EMAIL;
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function useStore() {
  const dir = await mkdtemp(path.join(tmpdir(), "carenav-booking-"));
  dirs.push(dir);
  process.env.BOOKING_STORE_PATH = path.join(dir, "bookings.json");
  return process.env.BOOKING_STORE_PATH;
}

async function savedStore(file: string) {
  return JSON.parse(await readFile(file, "utf8")) as {
    attempts: { id: string; sharedWithClinic: boolean; status: string }[];
    referrals: {
      attemptId: string;
      snapshot: { marker?: string };
      patient?: { name: string; email: string };
    }[];
  };
}

function bookingForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const fields: Record<string, string> = {
    attemptId: randomUUID(),
    createdAt: new Date().toISOString(),
    clinicId: clinicIdFromName("Lantern Bend Vestibular Studio"),
    pathwayId: "vestibular",
    sessionId: randomUUID(),
    sharedWithClinic: "false",
    parentalConsent: "false",
    consentTextVersion: CONSENT_TEXT_VERSION,
    ageBand: "18+",
    destination: "booking",
    snapshot: "",
    ...overrides,
  };
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value);
  }
  return form;
}

it("lets an adult continue with or without sharing, and a teen share only with permission", () => {
  expect(consentCanContinue({ shared: false, under18: false, parentalConsent: false })).toBe(true);
  expect(consentCanContinue({ shared: true, under18: false, parentalConsent: false })).toBe(true);
  expect(consentCanContinue({ shared: false, under18: true, parentalConsent: false })).toBe(true);
  expect(consentCanContinue({ shared: true, under18: true, parentalConsent: false })).toBe(false);
  expect(consentCanContinue({ shared: true, under18: true, parentalConsent: true })).toBe(true);
});

it("hides the badge after booking, dismissal, or 7 days", () => {
  const createdAt = new Date().toISOString();
  expect(badgeVisible("clicked", createdAt, Date.now())).toBe(true);
  expect(badgeVisible("remind_later", createdAt, Date.now())).toBe(true);
  expect(badgeVisible("booked", createdAt, Date.now())).toBe(false);
  expect(badgeVisible("dismissed", createdAt, Date.now())).toBe(false);
  expect(badgeVisible("clicked", createdAt, Date.now() + BOOKING_ATTEMPT_TTL_MS)).toBe(false);
});

it("builds a results file that keeps the survey answer and the step label", () => {
  const file = buildResultsFile({
    capturedAt: "2026-11-06T00:00:00.000Z",
    showAllPatterns: false,
    treeDetail: "simple",
    intake: {
      ageBand: "18+",
      ageLabel: "18 or older",
      city: "Kelowna",
      timeline: "1 week",
      symptoms: ["Dizziness"],
      symptomText: "Dizziness",
      concerns: "ONLY-IN-SNAPSHOT",
      pastAttempts: "Not added",
    },
    surveyAnswers: [{ question_id: "Q1", option_ids: ["A"] }],
    scores: null,
    journalNote: null,
    journalEntries: [],
    refineNote: null,
    draftBanner: null,
    teenNote: null,
    disclaimer: "Not medical advice",
    footer: "Demo only",
    visibleCategoryIds: ["vestibular"],
    pathways: [
      {
        category_id: "vestibular",
        name: "Balance, dizziness and visual motion",
        evidence_badge: "Guideline",
        why_it_may_apply: "Dizziness came up in the intake.",
        note: null,
        sources: [],
        scoreText: "Strong · 9 of 9 · 100%",
        steps: [
          {
            order: 1,
            title: "Get a balance and dizziness assessment",
            practitioner_type: "vestibular_physio",
            rationale: "A clinician can sort the dizziness questions.",
            step_id: "VES-01",
            draft_label: null,
            safety_note: "",
            sources: [],
          },
        ],
      },
    ],
  });

  expect(file.kind).toBe("results-file");
  expect(file.intake?.concerns).toBe("ONLY-IN-SNAPSHOT");
  expect(file.survey[0]?.selected[0]?.text).toContain("brain fog");
  expect(file.pathways[0]?.steps[0]?.shortLabel).toBe("Assess balance and dizziness");
  expect(file.pathways[0]?.shownOnPage).toBe(true);
  expect(file.pathways[0]?.scoreText).toBe("Strong · 9 of 9 · 100%");
});

it("logs an attempt and skips the referral when the file is not shared", async () => {
  const file = await useStore();
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const form = bookingForm();
  const result = await recordBooking("p001", form);

  expect(result).toEqual({ ok: true, redirectUrl: SHARED_BOOKING_URL });
  const store = await savedStore(file);
  expect(store.attempts).toHaveLength(1);
  expect(store.attempts[0]?.sharedWithClinic).toBe(false);
  expect(store.referrals).toEqual([]);
  expect(info).not.toHaveBeenCalled();
});

it("stores the shared results file and logs a clinic email with no patient details", async () => {
  const file = await useStore();
  process.env.CARENAV_CLINIC_NOTIFY_EMAIL = "clinic@example.com";
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const snapshot = {
    kind: "results-file",
    marker: "ONLY-IN-SNAPSHOT",
    intake: { concerns: "ONLY-IN-SNAPSHOT" },
  };
  const form = bookingForm({
    sharedWithClinic: "true",
    snapshot: JSON.stringify(snapshot),
    patientName: "ONLY-IN-NAME",
    patientPhone: "250-555-0199",
    patientEmail: "only-in-name@example.com",
  });
  const result = await recordBooking("p001", form);

  expect(result.ok).toBe(true);
  const store = await savedStore(file);
  expect(store.referrals).toHaveLength(1);
  expect(store.referrals[0]?.snapshot).toEqual(snapshot);
  expect(store.referrals[0]?.patient).toEqual({
    name: "ONLY-IN-NAME",
    phone: "250-555-0199",
    email: "only-in-name@example.com",
  });
  expect(info).toHaveBeenCalledTimes(1);
  const line = String(info.mock.calls[0]?.[0]);
  expect(line).toContain(CLINIC_REFERRAL_EMAIL);
  expect(line).toContain("/portal");
  expect(line).toContain("clinic@example.com");
  expect(line).toContain("lantern-bend-vestibular-studio");
  expect(line).not.toContain("ONLY-IN-SNAPSHOT");
  expect(line).not.toContain("ONLY-IN-NAME");
  expect(line).not.toContain("only-in-name@example.com");
});

it("refuses a shared teen file without parent permission and does not save it", async () => {
  const file = await useStore();
  const result = await recordBooking(
    "p001",
    bookingForm({
      ageBand: "13-17",
      sharedWithClinic: "true",
      parentalConsent: "false",
      snapshot: JSON.stringify({ kind: "results-file" }),
    }),
  );

  expect(result).toMatchObject({ ok: false, status: 400 });
  await expect(readFile(file, "utf8")).rejects.toThrow();
});

it("refuses a shared file that has no contact details", async () => {
  const file = await useStore();
  const result = await recordBooking(
    "p001",
    bookingForm({
      sharedWithClinic: "true",
      snapshot: JSON.stringify({ kind: "results-file" }),
    }),
  );

  expect(result).toMatchObject({ ok: false, status: 400 });
  await expect(readFile(file, "utf8")).rejects.toThrow();
});

it("accepts a shared teen file when a parent confirms", async () => {
  const file = await useStore();
  vi.spyOn(console, "info").mockImplementation(() => {});
  const result = await recordBooking(
    "p001",
    bookingForm({
      ageBand: "13-17",
      sharedWithClinic: "true",
      parentalConsent: "true",
      snapshot: JSON.stringify({ kind: "results-file", marker: "teen-file" }),
      patientName: "Teen Demo",
      patientPhone: "250-555-0198",
      patientEmail: "teen.demo@example.com",
    }),
  );

  expect(result.ok).toBe(true);
  const store = await savedStore(file);
  expect(store.referrals[0]?.snapshot.marker).toBe("teen-file");
});

it("redirects every clinician to the shared booking page", async () => {
  await useStore();
  const booked = await recordBooking(
    "p001",
    bookingForm({ redirectUrl: "https://evil.example/steal" }),
  );
  expect(booked).toEqual({ ok: true, redirectUrl: SHARED_BOOKING_URL });

  const alsoShared = await recordBooking(
    "p009",
    bookingForm({
      attemptId: randomUUID(),
      clinicId: clinicIdFromName("Ridgepath Movement Clinic"),
      destination: "booking",
    }),
  );
  expect(alsoShared).toEqual({ ok: true, redirectUrl: SHARED_BOOKING_URL });
});

it("updates the attempt and expires it only after 7 days", async () => {
  await useStore();
  const attemptId = randomUUID();
  const created = await recordBooking("p001", bookingForm({ attemptId }));
  expect(created.ok).toBe(true);

  const tooSoon = await updateBookingStatus(attemptId, "expired", Date.now());
  expect(tooSoon).toMatchObject({ ok: false, status: 409 });

  const later = await updateBookingStatus(attemptId, "remind_later", Date.now());
  expect(later).toEqual({ ok: true, status: "remind_later" });

  const expired = await updateBookingStatus(
    attemptId,
    "expired",
    Date.now() + BOOKING_ATTEMPT_TTL_MS,
  );
  expect(expired).toEqual({ ok: true, status: "expired" });

  const after = await updateBookingStatus(attemptId, "booked", Date.now() + BOOKING_ATTEMPT_TTL_MS);
  expect(after).toMatchObject({ ok: false, status: 409 });
});
