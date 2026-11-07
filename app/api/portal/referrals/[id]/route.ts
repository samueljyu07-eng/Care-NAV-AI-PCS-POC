import { portalDenied, requestHasPortalSession } from "../../../../../lib/portal/auth";
import { openReferral } from "../../../../../lib/portal/referrals";

type ReferralContext = {
  params: Promise<{ id: string }>;
};

function noStore(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

export async function GET(request: Request, context: ReferralContext) {
  if (!requestHasPortalSession(request)) {
    return portalDenied();
  }
  const { id } = await context.params;
  const detail = await openReferral(id);
  if (!detail) {
    return noStore({ error: "That referral was not found." }, 404);
  }
  return noStore(detail);
}
