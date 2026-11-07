import { portalDenied, requestHasPortalSession } from "../../../../../../lib/portal/auth";
import { setReferralStatus } from "../../../../../../lib/portal/referrals";

type StatusContext = {
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

export async function PATCH(request: Request, context: StatusContext) {
  if (!requestHasPortalSession(request)) {
    return portalDenied();
  }
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "The status update could not be read." }, 400);
  }
  const status =
    body && typeof body === "object" && "status" in body
      ? (body as { status?: unknown }).status
      : undefined;
  const result = await setReferralStatus(id, status);
  if (!result.ok) {
    return noStore({ error: result.message }, result.status);
  }
  return noStore(result.detail);
}
