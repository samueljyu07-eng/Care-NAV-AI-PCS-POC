import { randomUUID } from "node:crypto";
import { logClinicReferral } from "./notify";
import { destinationUrl, practitionerById } from "./practitioners";
import { updateBookingStore } from "./store";
import {
  clinicIdFromName,
  isPatientStatus,
  isUuid,
  nextStatusAllowed,
  parseBookForm,
  type BookingAttempt,
  type BookingStatus,
} from "./model";

export const PHONE_TAB_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Call the clinic</title>
  </head>
  <body style="font-family: sans-serif; padding: 24px; line-height: 1.5">
    <p>You can close this tab and call the clinic from the CareNav page.</p>
  </body>
</html>
`;

type Failure = { ok: false; status: number; message: string };
type Recorded = { ok: true; redirectUrl: string | null };
type Updated = { ok: true; status: BookingStatus };

export async function recordBooking(
  practitionerId: string,
  form: FormData,
  now = Date.now(),
): Promise<Recorded | Failure> {
  const person = practitionerById(practitionerId);
  if (!person) {
    return { ok: false, status: 404, message: "That clinician is not in the demo list." };
  }

  const parsed = parseBookForm(form, now);
  if (!parsed.ok) {
    return { ok: false, status: 400, message: parsed.error };
  }

  const clinicId = clinicIdFromName(person.clinic);
  if (parsed.value.clinicId !== clinicId) {
    return { ok: false, status: 400, message: "The clinic does not match that clinician." };
  }

  const destination = destinationUrl(person, parsed.value.destination);
  if (!destination.ok) {
    return { ok: false, status: 400, message: destination.error };
  }

  const input = parsed.value;
  const saved = await updateBookingStore((store) => {
    const existing = store.attempts.find((attempt) => attempt.id === input.attemptId);
    if (existing) {
      return {
        createdReferral: false,
        conflict: existing.practitionerId !== person.id,
      };
    }

    const attempt: BookingAttempt = {
      id: input.attemptId,
      createdAt: input.createdAt,
      practitionerId: person.id,
      clinicId,
      pathwayId: input.pathwayId,
      sessionId: input.sessionId,
      sharedWithClinic: input.sharedWithClinic,
      parentalConsent: input.parentalConsent,
      consentTextVersion: input.consentTextVersion,
      status: "clicked",
      statusUpdatedAt: input.createdAt,
    };
    store.attempts.push(attempt);

    if (input.sharedWithClinic && input.snapshot) {
      store.referrals.push({
        id: randomUUID(),
        attemptId: attempt.id,
        clinicId,
        createdAt: attempt.createdAt,
        snapshot: input.snapshot,
      });
      return { createdReferral: true, conflict: false };
    }

    return { createdReferral: false, conflict: false };
  });

  if (saved.conflict) {
    return { ok: false, status: 409, message: "That booking id is already used." };
  }

  if (saved.createdReferral) {
    logClinicReferral(clinicId);
  }

  return { ok: true, redirectUrl: destination.url };
}

export async function updateBookingStatus(
  id: string,
  status: unknown,
  now = Date.now(),
): Promise<Updated | Failure> {
  if (!isUuid(id)) {
    return { ok: false, status: 400, message: "That booking id is not valid." };
  }
  if (!isPatientStatus(status)) {
    return { ok: false, status: 400, message: "That status is not valid." };
  }

  return updateBookingStore((store) => {
    const attempt = store.attempts.find((item) => item.id === id);
    if (!attempt) {
      return { ok: false as const, status: 404, message: "That booking attempt was not found." };
    }
    if (!nextStatusAllowed(attempt.status, status, attempt.createdAt, now)) {
      return { ok: false as const, status: 409, message: "That booking update is not allowed." };
    }
    attempt.status = status;
    attempt.statusUpdatedAt = new Date(now).toISOString();
    return { ok: true as const, status: attempt.status };
  });
}
