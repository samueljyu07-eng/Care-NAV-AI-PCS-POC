"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { AgeBand } from "../../lib/catalog";
import { categoryById } from "../../lib/catalog";
import {
  RESULTS_FOOTER,
  TEEN_FRAMING,
  pathwayDisclaimer,
} from "../../lib/copy";
import {
  getIntakeServerSnapshot,
  getIntakeSnapshot,
  isIntakePending,
  readIntakeAnswers,
  subscribeToIntake,
} from "../intake-answers";
import CareTree, { type CarePathway } from "./care-tree";
import { ProvisionalCards, type CardPathway } from "./path-details";
import SurveyForm from "./survey-form";
import type { DisplayPathway, PresentedPathway } from "../../lib/pathwayDraft";
import {
  formatPercentage,
  scoreSurvey,
  type CategoryScore,
  type ScoreResult,
  type SurveyAnswer,
} from "../../lib/scoring";

function answerText(value: string, emptyLabel: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : emptyLabel;
}

function ageLabel(ageBand: AgeBand) {
  return ageBand === "13-17" ? "13 to 17" : "18 or older";
}

function pathScoreText(score: CategoryScore): string {
  const percent = formatPercentage(score.percentage);
  const points = `${score.points} of ${score.max_points}`;
  if (!score.strength_label) {
    return `${points} · ${percent}`;
  }
  return `${score.strength_label} · ${points} · ${percent}`;
}

function toTree(pathways: CardPathway[]): CarePathway[] {
  return pathways.map((pathway) => ({
    name: pathway.name,
    scoreText: pathway.scoreText,
    steps: pathway.steps,
  }));
}

function withScores(
  pathways: PresentedPathway[],
  scores: ScoreResult | null,
): CardPathway[] {
  return pathways.map((pathway) => {
    const score = scores?.categories.find(
      (category) => category.category_id === pathway.category_id,
    );
    return {
      ...pathway,
      scoreText: score ? pathScoreText(score) : null,
    };
  });
}

type ProvisionalState =
  | { kind: "waiting" }
  | { kind: "loading" }
  | { kind: "ready"; pathways: PresentedPathway[]; notice: string | null }
  | { kind: "urgent"; message: string }
  | { kind: "unsupported"; message: string }
  | { kind: "message"; text: string };

type RefineState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; pathways: DisplayPathway[] }
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
  const [provisionalRecord, setProvisionalRecord] = useState<{
    id: string;
    state: ProvisionalState;
  } | null>(null);
  const [scoreRecord, setScoreRecord] = useState<{
    id: string;
    result: ScoreResult;
  } | null>(null);
  const [refineRecord, setRefineRecord] = useState<{
    id: string;
    state: RefineState;
  } | null>(null);
  const refineAbort = useRef<AbortController | null>(null);
  const latestIntake = useRef(storedAnswers);
  const provisional: ProvisionalState =
    pending || !answers?.ageBand
      ? { kind: "waiting" }
      : provisionalRecord?.id === storedAnswers
        ? provisionalRecord.state
        : { kind: "loading" };
  const scores = scoreRecord?.id === storedAnswers ? scoreRecord.result : null;
  const refine: RefineState =
    refineRecord?.id === storedAnswers ? refineRecord.state : { kind: "idle" };

  useEffect(() => {
    if (pending) {
      return;
    }
    const saved = readIntakeAnswers(storedAnswers);
    if (!saved || !saved.ageBand) {
      return;
    }

    const controller = new AbortController();
    const requestKey = storedAnswers;
    latestIntake.current = requestKey;

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
        age_band: saved.ageBand,
      }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          urgent?: boolean;
          unsupported_age?: boolean;
          message?: string;
          error?: string;
          notice?: string | null;
          pathways?: PresentedPathway[];
        };
        if (latestIntake.current !== requestKey) {
          return;
        }
        if (payload.urgent && payload.message) {
          setProvisionalRecord({
            id: requestKey,
            state: { kind: "urgent", message: payload.message },
          });
          return;
        }
        if (payload.unsupported_age && payload.message) {
          setProvisionalRecord({
            id: requestKey,
            state: { kind: "unsupported", message: payload.message },
          });
          return;
        }
        if (!response.ok) {
          setProvisionalRecord({
            id: requestKey,
            state: {
              kind: "message",
              text:
                payload.error ??
                "Suggested paths from the intake are not available right now. You can still answer the survey.",
            },
          });
          return;
        }
        setProvisionalRecord({
          id: requestKey,
          state: {
            kind: "ready",
            pathways: payload.pathways ?? [],
            notice: payload.notice ?? null,
          },
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (latestIntake.current !== requestKey) {
          return;
        }
        setProvisionalRecord({
          id: requestKey,
          state: {
            kind: "message",
            text: "Suggested paths from the intake are not available right now. You can still answer the survey.",
          },
        });
      });

    return () => {
      controller.abort();
      refineAbort.current?.abort();
    };
  }, [pending, storedAnswers]);

  function submitSurvey(surveyAnswers: SurveyAnswer[]) {
    if (!answers?.ageBand) {
      return;
    }
    const result = scoreSurvey(surveyAnswers);
    setScoreRecord({ id: storedAnswers, result });
    refineAbort.current?.abort();
    const controller = new AbortController();
    refineAbort.current = controller;
    const requestKey = storedAnswers;
    latestIntake.current = requestKey;
    setRefineRecord({ id: requestKey, state: { kind: "loading" } });
    const provisionalPaths = provisional.kind === "ready" ? provisional.pathways : [];
    fetch("/api/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        address: answers.city,
        concerns: answers.concerns,
        primary_symptoms: answers.symptoms,
        past_attempts: answers.pastAttempts,
        timeline: answers.timeline,
        age_band: answers.ageBand,
        survey_answers: surveyAnswers,
        provisional_paths: provisionalPaths,
      }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          urgent?: boolean;
          message?: string | null;
          error?: string;
          pathways?: DisplayPathway[];
        };
        if (latestIntake.current !== requestKey) {
          return;
        }
        if (payload.urgent && payload.message) {
          setRefineRecord({
            id: requestKey,
            state: { kind: "urgent", message: payload.message },
          });
          return;
        }
        if (!response.ok) {
          setRefineRecord({
            id: requestKey,
            state: {
              kind: "message",
              text: payload.error ?? "The explanations could not be updated. The scores below still stand.",
            },
          });
          return;
        }
        setRefineRecord({
          id: requestKey,
          state: { kind: "ready", pathways: payload.pathways ?? [] },
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (latestIntake.current !== requestKey) {
          return;
        }
        setRefineRecord({
          id: requestKey,
          state: {
            kind: "message",
            text: "The explanations could not be updated. The scores below still stand.",
          },
        });
      });
  }

  const ageBand = answers?.ageBand ?? null;
  const symptomText =
    answers && answers.symptoms.length > 0
      ? answers.symptoms.join(", ")
      : "None selected";
  const shownPathways: PresentedPathway[] =
    refine.kind === "ready"
      ? refine.pathways
      : provisional.kind === "ready"
        ? provisional.pathways
        : [];
  const cardPathways = withScores(shownPathways, scores);
  const treePathways = toTree(cardPathways);
  const showSurvey =
    Boolean(ageBand) &&
    provisional.kind !== "urgent" &&
    provisional.kind !== "unsupported" &&
    provisional.kind !== "waiting" &&
    refine.kind !== "urgent";

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
              <dt className="text-sm text-[#545454]">Age</dt>
              <dd>{ageBand ? ageLabel(ageBand) : "Not added"}</dd>
            </div>
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

      {showSurvey && answers ? (
        <SurveyForm
          key={storedAnswers}
          symptoms={answers.symptoms}
          onSubmit={submitSurvey}
        />
      ) : null}

      {ageBand === "13-17" ? (
        <aside className="rounded-xl border border-[#E2E2E2] bg-[#F6F6F6] px-4 py-4" role="note">
          <p className="text-base leading-7 text-black">{TEEN_FRAMING}</p>
        </aside>
      ) : null}

      <aside className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4" role="note">
        <p className="text-base font-semibold text-amber-950">Not medical advice</p>
        <p className="mt-1 text-base leading-7 text-amber-950">
          {pathwayDisclaimer(ageBand ?? "18+")}
        </p>
      </aside>

      {children}

      {answers && !ageBand ? (
        <p className="text-base leading-7 text-[#545454]">
          Choose an age on the intake form, then submit again. This demo is for
          ages 13 and up.
        </p>
      ) : null}

      {provisional.kind === "loading" ? (
        <p className="text-base leading-7 text-[#545454]">
          Looking at the intake…
        </p>
      ) : null}
      {provisional.kind === "urgent" || refine.kind === "urgent" ? (
        <aside className="rounded-xl border border-red-200 bg-red-50 px-4 py-4" role="alert">
          <p className="text-base font-semibold text-red-950">Urgent care</p>
          <p className="mt-1 text-base leading-7 text-red-950">
            {refine.kind === "urgent" ? refine.message : provisional.kind === "urgent" ? provisional.message : ""}
          </p>
        </aside>
      ) : null}
      {provisional.kind === "unsupported" ? (
        <p className="text-base leading-7 text-black">{provisional.message}</p>
      ) : null}
      {provisional.kind === "message" ? (
        <p className="text-base leading-7 text-[#545454]">{provisional.text}</p>
      ) : null}
      {provisional.kind === "ready" && refine.kind !== "urgent" ? (
        <>
          {provisional.notice && refine.kind !== "ready" ? (
            <p className="text-base leading-7 text-[#545454]">{provisional.notice}</p>
          ) : null}
          <ProvisionalCards
            pathways={cardPathways}
            label={refine.kind === "ready" ? null : undefined}
          />
        </>
      ) : null}
      {refine.kind === "loading" ? (
        <p className="text-base leading-7 text-[#545454]">Updating the explanations…</p>
      ) : null}
      {refine.kind === "message" ? (
        <p className="text-base leading-7 text-[#545454]">{refine.text}</p>
      ) : null}

      {treePathways.length > 0 && provisional.kind !== "urgent" && refine.kind !== "urgent" ? (
        <div id="care-paths" className="flex flex-col gap-3">
          <p className="text-base leading-7 text-[#545454]">
            Use the + and − buttons to zoom. On a phone, drag to move the
            diagram. On a larger screen, drag the background and scroll to
            zoom. Click a step to open practitioners under that step, and
            click it again to close them.
          </p>
          <CareTree
            pathways={treePathways}
            patientCity={answers?.city ?? ""}
            ageBand={ageBand}
          />
        </div>
      ) : null}

      {scores && treePathways.length === 0 ? (
        <section aria-label="Survey scores" className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-black">Survey scores</h2>
          <ul className="flex flex-col gap-2">
            {scores.categories.map((category) => (
              <li key={category.category_id} className="text-base leading-7 text-black">
                {categoryById(category.category_id)?.patient_label ?? category.category_id}
                <span className="mt-0.5 block text-sm leading-6 text-[#545454]">
                  {pathScoreText(category)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p>
        <Link
          href="/"
          className="text-base font-medium text-black underline decoration-black underline-offset-4"
        >
          Back
        </Link>
      </p>
      <p className="text-base leading-7 text-[#545454]">{RESULTS_FOOTER}</p>
    </>
  );
}
