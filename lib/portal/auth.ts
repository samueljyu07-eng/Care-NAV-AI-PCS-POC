import { createHmac, timingSafeEqual } from "node:crypto";

export const PORTAL_COOKIE = "carenav_portal";
export const PORTAL_SESSION_SECONDS = 12 * 60 * 60;

// TODO: replace passcode with real auth + clinic scoping.
function digest(value: string): Buffer {
  return createHmac("sha256", "carenav-portal-compare").update(value).digest();
}

function safeEqual(left: string, right: string): boolean {
  const a = digest(left);
  const b = digest(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function portalPasscode(): string {
  return process.env.PORTAL_PASSCODE?.trim() ?? "";
}

export function portalConfigured(): boolean {
  return portalPasscode().length > 0;
}

export function passcodeMatches(input: string): boolean {
  const expected = portalPasscode();
  if (!expected || !input) {
    return false;
  }
  return safeEqual(input, expected);
}

export function sessionToken(): string | null {
  const passcode = portalPasscode();
  if (!passcode) {
    return null;
  }
  return createHmac("sha256", passcode).update("carenav-portal-v1").digest("hex");
}

export function sessionMatches(value: string | undefined): boolean {
  const token = sessionToken();
  if (!token || !value) {
    return false;
  }
  return safeEqual(value, token);
}

export function portalCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PORTAL_SESSION_SECONDS,
  };
}

export function readRequestCookie(header: string | null, name: string): string | undefined {
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) {
      continue;
    }
    if (part.slice(0, eq).trim() !== name) {
      continue;
    }
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

export function requestHasPortalSession(request: Request): boolean {
  return sessionMatches(readRequestCookie(request.headers.get("cookie"), PORTAL_COOKIE));
}

export function portalDenied(): Response {
  return Response.json(
    { error: "Sign in required." },
    {
      status: 401,
      headers: {
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    },
  );
}
