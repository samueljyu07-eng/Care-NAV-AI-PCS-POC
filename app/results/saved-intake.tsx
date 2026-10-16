"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import {
  getIntakeServerSnapshot,
  getIntakeSnapshot,
  isIntakePending,
  readIntakeAnswers,
  subscribeToIntake,
} from "../intake-answers";
import CareTree, { type CarePathway } from "./care-tree";
import type { Practitioner } from "./practitioner-panel";

function answerText(value: string, emptyLabel: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : emptyLabel;
}

export default function SavedIntake({
  pathways,
  practitioners,
  children,
}: {
  pathways: CarePathway[];
  practitioners: Practitioner[];
  children?: ReactNode;
}) {
  const storedAnswers = useSyncExternalStore(
    subscribeToIntake,
    getIntakeSnapshot,
    getIntakeServerSnapshot,
  );
  const pending = isIntakePending(storedAnswers);
  const answers = readIntakeAnswers(storedAnswers);

  const symptomText =
    answers && answers.symptoms.length > 0
      ? answers.symptoms.join(", ")
      : "None selected";

  return (
    <>
      <section
        aria-label="Your intake answers"
        className="rounded-xl border border-slate-200 bg-white px-4 py-3"
      >
        <h2 className="text-sm font-semibold text-slate-800">Your answers</h2>
        {answers ? (
          <dl className="mt-2 grid gap-3 text-sm leading-6 text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">City</dt>
              <dd>{answerText(answers.city, "Not added")}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Timeline</dt>
              <dd>{answerText(answers.timeline, "Not added")}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Primary symptoms</dt>
              <dd>{symptomText}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Main concerns</dt>
              <dd className="line-clamp-2">
                {answerText(answers.concerns, "Not added")}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Past attempts</dt>
              <dd className="line-clamp-2">
                {answerText(answers.pastAttempts, "Not added")}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {pending
              ? "Loading your answers…"
              : "No intake answers are saved for this visit. Go back to the form, fill it in, and submit."}
          </p>
        )}
      </section>
      {children}
      {!pending ? (
        <CareTree
          pathways={pathways}
          practitioners={practitioners}
          patientCity={answers?.city ?? ""}
        />
      ) : (
        <p className="text-sm text-slate-600">Loading care pathways…</p>
      )}
    </>
  );
}
