"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getBookingClock,
  getBookingClockServer,
  getBookingServerSnapshot,
  getBookingSnapshot,
  markBookingReturned,
  openBookingPrompt,
  patchBookingStatus,
  subscribeBooking,
  subscribeBookingClock,
} from "../lib/booking/browser";
import {
  BADGE_LABEL,
  BOOKED_LABEL,
  LATER_LABEL,
  PROMPT_RETURNED,
  PROMPT_WAITING,
  SAVE_ERROR,
  callLabel,
} from "../lib/booking/consent";
import { badgeVisible } from "../lib/booking/model";

export default function BookingFollowUp() {
  const attempt = useSyncExternalStore(
    subscribeBooking,
    getBookingSnapshot,
    getBookingServerSnapshot,
  );
  const now = useSyncExternalStore(
    subscribeBookingClock,
    getBookingClock,
    getBookingClockServer,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leftTab = useRef(false);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        leftTab.current = true;
        return;
      }
      if (leftTab.current) {
        markBookingReturned();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!attempt) {
      return;
    }
    if (attempt.status !== "clicked" && attempt.status !== "remind_later") {
      return;
    }
    if (badgeVisible(attempt.status, attempt.createdAt, now)) {
      return;
    }
    void patchBookingStatus("expired");
  }, [attempt, now]);

  if (!attempt || now === 0) {
    return null;
  }

  const stillOpen =
    (attempt.status === "clicked" || attempt.status === "remind_later") &&
    badgeVisible(attempt.status, attempt.createdAt, now);
  const showPrompt = attempt.promptOpen && stillOpen;
  const showBadge = !showPrompt && stillOpen;

  async function choose(status: "booked" | "remind_later" | "dismissed") {
    setPending(true);
    setError(null);
    const saved = await patchBookingStatus(status);
    setPending(false);
    if (!saved) {
      setError(SAVE_ERROR);
    }
  }

  const prompt = showPrompt ? (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-follow-up-title"
        className="absolute inset-x-4 top-1/2 mx-auto w-full max-w-md -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <p id="booking-follow-up-title" className="text-base leading-7 text-black">
            {attempt.returned ? PROMPT_RETURNED : PROMPT_WAITING}
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            disabled={pending}
            onClick={() => void choose("dismissed")}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-black hover:bg-[#F6F6F6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
              <path
                d="M5 5 15 15M15 5 5 15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {attempt.destination === "phone" && attempt.phone ? (
          <a
            href={`tel:${attempt.phone.replace(/[^\d+]/g, "")}`}
            className="mt-3 inline-flex text-base font-medium text-black underline decoration-black underline-offset-4"
          >
            {callLabel(attempt.phone)}
          </a>
        ) : null}
        {error ? <p className="mt-3 text-base leading-7 text-red-950">{error}</p> : null}
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => void choose("booked")}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-black px-5 text-base font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {BOOKED_LABEL}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void choose("remind_later")}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border border-[#E2E2E2] bg-white px-5 text-base font-medium text-black hover:bg-[#F6F6F6] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {LATER_LABEL}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const badge = showBadge ? (
    <button
      type="button"
      onClick={() => {
        setError(null);
        openBookingPrompt();
      }}
      className="fixed right-4 bottom-4 z-40 inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-black px-4 text-sm font-medium text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
    >
      {BADGE_LABEL}
    </button>
  ) : null;

  return (
    <>
      {prompt}
      {badge}
    </>
  );
}
