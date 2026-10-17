"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  getIntakeServerSnapshot,
  getIntakeSnapshot,
  isIntakePending,
  readIntakeAnswers,
  type IntakeAnswers,
  subscribeToIntake,
} from "../intake-answers";
import CareTree, { type CarePathway } from "./care-tree";

function answerText(value: string, emptyLabel: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : emptyLabel;
}

function hasWrittenAnswer(answers: IntakeAnswers) {
  return answers.concerns.trim() !== "" || answers.pastAttempts.trim() !== "";
}

type PathwayState =
  | { kind: "waiting" }
  | { kind: "loading" }
  | { kind: "ready"; pathways: CarePathway[] }
  | { kind: "urgent"; message: string }
  | { kind: "message"; text: string };

export default function SavedIntake({ children }: { children?: ReactNode }) {
  const storedAnswers = useSyncExternalStore(
    subscribeToIntake,
    getIntakeSnapshot,
    getIntakeServerSnapshot,
  );
  const pending = isIntakePending(storedAnswers);
  const answers = readIntakeAnswers(storedAnswers);
  const [pathwayState, setPathwayState] = useState<PathwayState>({
    kind: "waiting",
  });

  useEffect(() => {
    if (pending) {
      return;
    }

    const saved = readIntakeAnswers(storedAnswers);
    if (!saved) {
      return;
    }

    if (saved.symptoms.length === 0 && !hasWrittenAnswer(saved)) {
      setPathwayState({
        kind: "message",
        text: "Select a primary symptom, or write your concerns, so the pathways can follow your answers.",
      });
      return;
    }

    const controller = new AbortController();
    setPathwayState({ kind: "loading" });

    fetch("/api/pathways", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        address: saved.city,
        concerns: saved.concerns,
        primary_symptoms: saved.symptoms,
        past_attempts: saved.pastAttempts,
        timeline: saved.timeline,
      }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          urgent?: boolean;
          message?: string;
          error?: string;
          pathways?: CarePathway[];
        };

        if (payload.urgent && payload.message) {
          setPathwayState({ kind: "urgent", message: payload.message });
          return;
        }

        if (!response.ok || !payload.pathways) {
          setPathwayState({
            kind: "message",
            text:
              payload.error ??
              "We couldn't build pathways for that answer. Please try again.",
          });
          return;
        }

        setPathwayState({ kind: "ready", pathways: payload.pathways });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setPathwayState({
          kind: "message",
          text: "We couldn't build pathways for that answer. Please try again.",
        });
      });

    return () => controller.abort();
  }, [pending, storedAnswers]);

  const symptomText =
    answers && answers.symptoms.length > 0
      ? answers.symptoms.join(", ")
      : "None selected";

  return (
    <>
      <section
        aria-label="Your intake answers"
        className="rounded-xl border border-[#E2E2E2] bg-[#F6F6F6] px-4 py-4"
      >
        <h2 className="text-base font-semibold text-black">Your answers</h2>
        {answers ? (
          <dl className="mt-3 grid gap-3 text-base leading-7 text-black sm:grid-cols-2">
            <div>
              <dt className="text-sm text-[#545454]">City</dt>
              <dd>{answerText(answers.city, "Not added")}</dd>
            </div>
            <div>
              <dt className="text-sm text-[#545454]">Timeline</dt>
              <dd>{answerText(answers.timeline, "Not added")}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-[#545454]">Primary symptoms</dt>
              <dd>{symptomText}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-[#545454]">Main concerns</dt>
              <dd className="line-clamp-2">
                {answerText(answers.concerns, "Not added")}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-[#545454]">Past attempts</dt>
              <dd className="line-clamp-2">
                {answerText(answers.pastAttempts, "Not added")}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-base leading-7 text-[#545454]">
            {pending
              ? "Loading your answers…"
              : "No intake answers are saved for this visit. Go back to the form, fill it in, and submit."}
          </p>
        )}
      </section>
      {children}
      {pending ? (
        <p className="text-base leading-7 text-[#545454]">Loading care pathways…</p>
      ) : pathwayState.kind === "loading" || pathwayState.kind === "waiting" ? (
        answers ? (
          <p className="text-base leading-7 text-[#545454]">
            Building pathways from your symptoms…
          </p>
        ) : null
      ) : pathwayState.kind === "urgent" ? (
        <aside
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-4"
          role="alert"
        >
          <p className="text-base font-semibold text-red-950">Urgent care</p>
          <p className="mt-1 text-base leading-7 text-red-950">
            {pathwayState.message}
          </p>
        </aside>
      ) : pathwayState.kind === "message" ? (
        <p className="text-base leading-7 text-[#545454]">{pathwayState.text}</p>
      ) : (
        <CareTree
          pathways={pathwayState.pathways}
          patientCity={answers?.city ?? ""}
        />
      )}
    </>
  );
}
