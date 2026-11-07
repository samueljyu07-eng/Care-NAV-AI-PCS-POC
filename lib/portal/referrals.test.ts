import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { CONSENT_TEXT_VERSION } from "../booking/consent";
import { clinicIdFromName } from "../booking/model";
import { recordBooking, updateBookingStatus } from "../booking/record";
import { updateBookingStore, type BookingStoreData } from "../booking/store";
import { getReferrals, logReferralPrint, openReferral, setReferralStatus } from "./referrals";

const dirs: string[] = [];
const NOW = Date.parse("2026-11-06T18:00:00.000Z");

afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.CARENAV_CLINIC_NOTIFY_EMAIL;
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function useStore() {
  const dir = await mkdtemp(path.join(tmpdir(), "carenav-portal-"));
  dirs.push(dir);
  process.env.BOOKING_STORE_PATH = path.join(dir, "bookings.json");
  return process.env.BOOKING_STORE_PATH;
}

async function savedStore(file: string): Promise<BookingStoreData> {
  return JSON.parse(await readFile(file, "utf8")) as BookingStoreData;
}

function bookingForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const fields: Record<string, string> = {
    attemptId: randomUUID(),
    createdAt: new Date(NOW).toISOString(),
    clinicId: clinicIdFromName("Lantern Bend Vestibular Studio"),
    pathwayId: "vestibular",
    sessionId: randomUUID(),
    sharedWithClinic: "true",
    parentalConsent: "false",
    consentTextVersion: CONSENT_TEXT_VERSION,
    ageBand: "18+",
    destination: "booking",
    snapshot: JSON.stringify({
      kind: "results-file",
      intake: { ageLabel: "18 or older", concerns: "Demo concern" },
    }),
    patientName: "Alder Quinn",
    patientPhone: "250-555-0191",
    patientEmail: "alder.quinn.demo@example.com",
    ...overrides,
  };
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value);
  }
  return form;
}

async function shareReferral(practitionerId: string, overrides: Record<string, string> = {}) {
  vi.spyOn(console, "info").mockImplementation(() => {});
  const saved = await recordBooking(practitionerId, bookingForm(overrides), NOW);
  expect(saved.ok).toBe(true);
  return updateBookingStore((store) => store.referrals.at(-1)?.id ?? "");
}

it("marks a new referral viewed once and leaves later opens alone", async () => {
  const file = await useStore();
  const id = await shareReferral("p001");
  const first = await openReferral(id, NOW + 1000);
  const second = await openReferral(id, NOW + 5000);

  expect(first?.status).toBe("viewed");
  expect(first?.firstViewedAt).toBe(new Date(NOW + 1000).toISOString());
  expect(second?.status).toBe("viewed");
  expect(second?.firstViewedAt).toBe(first?.firstViewedAt);

  const store = await savedStore(file);
  const opened = store.accessLogs.filter((entry) => entry.action === "opened_referral");
  expect(opened.map((entry) => entry.details)).toEqual(["new → viewed", "viewed"]);
  expect(JSON.stringify(store.accessLogs)).not.toContain("Alder");
  expect(JSON.stringify(store.accessLogs)).not.toContain("alder.quinn.demo@example.com");
  expect(JSON.stringify(store.accessLogs)).not.toContain("250-555-0191");
});

it("keeps clinic status changes and counts booked rows without the status filter", async () => {
  const file = await useStore();
  const bookedId = await shareReferral("p001", { patientName: "Birch Ellison" });
  const newId = await shareReferral("p003", {
    attemptId: randomUUID(),
    clinicId: clinicIdFromName("Glasspine Vision Workshop"),
    pathwayId: "oculomotor",
    patientName: "Cedar Holm",
    patientEmail: "cedar.holm.demo@example.com",
  });
  await updateBookingStatus(
    (await savedStore(file)).referrals.find((item) => item.id === bookedId)?.attemptId ?? "",
    "booked",
    NOW,
  );
  const changed = await setReferralStatus(bookedId, "booked", NOW + 2000);
  expect(changed.ok).toBe(true);
  if (changed.ok) {
    expect(changed.detail.status).toBe("booked");
    expect(changed.detail.patientSaysLabel).toBe("Booked");
  }

  const filtered = await getReferrals({ status: "new" }, NOW);
  expect(filtered.referrals.map((item) => item.id)).toEqual([newId]);
  expect(filtered.summary).toEqual({
    thisMonth: 2,
    selfReportedBooked: 1,
    clinicConfirmedBooked: 1,
  });

  const again = await setReferralStatus(bookedId, "contacted", NOW + 3000);
  expect(again.ok).toBe(true);
  if (again.ok) {
    expect(again.detail.status).toBe("contacted");
  }
  const printed = await logReferralPrint(bookedId, NOW + 4000);
  expect(printed).toEqual({ ok: true });

  const store = await savedStore(file);
  const logs = JSON.stringify(store.accessLogs);
  expect(store.accessLogs.some((entry) => entry.action === "status_changed" && entry.details === "new → booked")).toBe(true);
  expect(store.accessLogs.some((entry) => entry.action === "status_changed" && entry.details === "booked → contacted")).toBe(true);
  expect(store.accessLogs.some((entry) => entry.action === "printed" && entry.details === "print")).toBe(true);
  expect(store.accessLogs.some((entry) => entry.action === "viewed_list")).toBe(true);
  expect(logs).not.toContain("Birch");
  expect(logs).not.toContain("Cedar");
  expect(logs).not.toContain("@");
});

it("rejects a status the clinic cannot set", async () => {
  await useStore();
  const id = await shareReferral("p001");
  const result = await setReferralStatus(id, "viewed", NOW);
  expect(result).toMatchObject({ ok: false, status: 400 });
});

it("leaves an October referral out of this month", async () => {
  await useStore();
  const id = await shareReferral("p001");
  await updateBookingStore((store) => {
    const referral = store.referrals.find((item) => item.id === id);
    if (referral) {
      referral.createdAt = "2026-10-02T18:00:00.000Z";
    }
  });
  const list = await getReferrals({}, NOW);
  expect(list.referrals).toHaveLength(1);
  expect(list.summary.thisMonth).toBe(0);
});
