"use client";

import { useActionState } from "react";
import { unlockPortal } from "./actions";

export function PasscodeForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(unlockPortal, null);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black">Clinic portal</h1>
        <p className="mt-3 text-base leading-7 text-[#545454]">
          Shared sign-in for clinic staff reviewing CareNav referrals.
        </p>
      </div>
      {configured ? (
        <form action={action} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-[#545454]">
            Passcode
            <input
              name="passcode"
              type="password"
              autoComplete="current-password"
              required
              className="min-h-12 rounded-xl border border-[#E2E2E2] bg-white px-3 text-base text-black"
            />
          </label>
          {state?.error ? <p className="text-base leading-7 text-red-950">{state.error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-black px-5 text-base font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Checking…" : "Continue"}
          </button>
        </form>
      ) : (
        <p className="text-base leading-7 text-black">
          The portal passcode is not set. Add PORTAL_PASSCODE to the server environment, then
          reload this page.
        </p>
      )}
    </main>
  );
}
