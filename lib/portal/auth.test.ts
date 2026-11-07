import { afterEach, expect, it } from "vitest";
import {
  PORTAL_COOKIE,
  passcodeMatches,
  requestHasPortalSession,
  sessionMatches,
  sessionToken,
} from "./auth";

afterEach(() => {
  delete process.env.PORTAL_PASSCODE;
});

it("keeps the portal closed when the passcode is missing or wrong", () => {
  expect(passcodeMatches("demo-portal")).toBe(false);
  expect(sessionToken()).toBeNull();
  expect(sessionMatches("anything")).toBe(false);
  expect(requestHasPortalSession(new Request("http://localhost/api/portal/referrals"))).toBe(false);

  process.env.PORTAL_PASSCODE = "demo-portal";
  expect(passcodeMatches("nope")).toBe(false);
  expect(passcodeMatches("demo-portal")).toBe(true);
  const token = sessionToken();
  expect(token).toBeTruthy();
  expect(sessionMatches(token ?? undefined)).toBe(true);
  expect(sessionMatches(`${token}x`)).toBe(false);

  const signedIn = new Request("http://localhost/api/portal/referrals", {
    headers: { cookie: `theme=light; ${PORTAL_COOKIE}=${token}` },
  });
  expect(requestHasPortalSession(signedIn)).toBe(true);
});
