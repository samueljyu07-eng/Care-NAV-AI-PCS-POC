import { isReferralStatus, type ReferralStatus } from "../../../../lib/booking/model";
import { portalDenied, requestHasPortalSession } from "../../../../lib/portal/auth";
import { getReferrals, type ReferralQuery } from "../../../../lib/portal/referrals";

const CLINIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CLINICIAN_ID = /^p\d{3}$/;

function noStore(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

export async function GET(request: Request) {
  if (!requestHasPortalSession(request)) {
    return portalDenied();
  }
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinicId")?.trim() ?? "";
  const clinicianId = url.searchParams.get("clinicianId")?.trim() ?? "";
  const status = url.searchParams.get("status")?.trim() ?? "";
  if (clinicId && !CLINIC_ID.test(clinicId)) {
    return noStore({ error: "That clinic filter is not valid." }, 400);
  }
  if (clinicianId && !CLINICIAN_ID.test(clinicianId)) {
    return noStore({ error: "That clinician filter is not valid." }, 400);
  }
  if (status && !isReferralStatus(status)) {
    return noStore({ error: "That status filter is not valid." }, 400);
  }
  const query: ReferralQuery = {};
  if (clinicId) {
    query.clinicId = clinicId;
  }
  if (clinicianId) {
    query.clinicianId = clinicianId;
  }
  if (status && isReferralStatus(status)) {
    query.status = status as ReferralStatus;
  }
  const result = await getReferrals(query);
  return noStore(result);
}
