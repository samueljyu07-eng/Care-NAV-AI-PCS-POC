import { portalDenied, requestHasPortalSession } from "../../../../../../lib/portal/auth";
import { logReferralPrint } from "../../../../../../lib/portal/referrals";

type PrintContext = {
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

export async function POST(request: Request, context: PrintContext) {
  if (!requestHasPortalSession(request)) {
    return portalDenied();
  }
  const { id } = await context.params;
  const result = await logReferralPrint(id);
  if (!result.ok) {
    return noStore({ error: result.message }, result.status);
  }
  return noStore({ ok: true });
}
