import { updateBookingStatus } from "../../../../lib/booking/record";

type AttemptContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: AttemptContext) {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Send the booking update as JSON." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  const status =
    body && typeof body === "object" && "status" in body
      ? (body as { status?: unknown }).status
      : undefined;
  const result = await updateBookingStatus(id, status);
  if (!result.ok) {
    return Response.json(
      { error: result.message },
      { status: result.status, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { status: result.status },
    { headers: { "cache-control": "no-store" } },
  );
}
