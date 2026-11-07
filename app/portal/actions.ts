"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  PORTAL_COOKIE,
  passcodeMatches,
  portalConfigured,
  portalCookieOptions,
  sessionToken,
} from "../../lib/portal/auth";

export async function unlockPortal(
  _previous: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  // TODO: replace passcode with real auth + clinic scoping.
  if (!portalConfigured()) {
    return { error: "The portal passcode is not set." };
  }
  const input = String(formData.get("passcode") ?? "");
  const token = sessionToken();
  if (!token || !passcodeMatches(input)) {
    return { error: "That passcode is not right." };
  }
  const jar = await cookies();
  jar.set(PORTAL_COOKIE, token, portalCookieOptions());
  redirect("/portal");
}

export async function signOutPortal(): Promise<void> {
  const jar = await cookies();
  jar.set(PORTAL_COOKIE, "", { ...portalCookieOptions(), maxAge: 0 });
  redirect("/portal");
}
