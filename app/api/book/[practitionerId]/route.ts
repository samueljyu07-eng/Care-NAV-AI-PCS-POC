import { NextResponse } from "next/server";
import { SHARED_BOOKING_URL } from "../../../../lib/booking/link";
import { practitionerById } from "../../../../lib/booking/practitioners";
import { PHONE_TAB_HTML, recordBooking } from "../../../../lib/booking/record";

type BookContext = {
  params: Promise<{ practitionerId: string }>;
};

export async function GET(_request: Request, context: BookContext) {
  const { practitionerId } = await context.params;
  if (!practitionerById(practitionerId)) {
    return new Response("That clinician is not in the demo list.", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }
  const destination = JSON.stringify(SHARED_BOOKING_URL);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Opening booking</title>
  </head>
  <body>
    <p>Opening the booking page…</p>
    <script>location.replace(${destination})</script>
  </body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: Request, context: BookContext) {
  const { practitionerId } = await context.params;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response("The booking form could not be read.", {
      status: 400,
      headers: { "cache-control": "no-store" },
    });
  }

  const result = await recordBooking(practitionerId, form);
  if (!result.ok) {
    return new Response(result.message, {
      status: result.status,
      headers: { "cache-control": "no-store" },
    });
  }
  if (result.redirectUrl && request.headers.get("sec-fetch-mode") === "navigate") {
    return NextResponse.redirect(result.redirectUrl, 302);
  }
  if (result.redirectUrl) {
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  }
  return new Response(PHONE_TAB_HTML, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
