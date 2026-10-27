"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { AgeBand } from "../../lib/catalog";
import { categoryById } from "../../lib/catalog";
import {
  RESULTS_FOOTER,
  TEEN_FRAMING,
  pathwayDisclaimer,
} from "../../lib/copy";
import { intakeTextIsUrgent } from "../../lib/intakeBody";
import {
  getIntakeServerSnapshot,
  getIntakeSnapshot,
  getSurveySnapshot,
  getSurveySubmittedServerSnapshot,
  getSurveySubmittedSnapshot,
  isIntakePending,
  isSurveySubmitted,
  readIntakeAnswers,
  readSurveySelection,
  subscribeToIntake,
  subscribeToSurveySubmitted,
} from "../intake-answers";
import { surveyAnswersFromSelection } from "../questions/survey-form";
import CareTree, { type CarePathway } from "./care-tree";
import { ProvisionalCards, type CardPathway } from "./path-details";
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
  | { kind: "ready"; pathways: DisplayPathway[]; note: string | null }
  | { kind: "urgent"; message: string }
  | { kind: "message"; text: string };

const PATHS_UNAVAILABLE =
  "Suggested paths are not available right now. Go back and try again.";

function PathwayProgress({ label, cap }: { label: string; cap: number }) {
  const [value, setValue] = useState(8);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setValue((current) => {
        if (current >= cap) {
          return current;
        }
        return Math.min(cap, current + Math.max(0.6, (cap - current) * 0.06));
      });
    }, 200);
    return () => window.clearInterval(timer);
  }, [cap]);

  const shown = Math.round(value);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base leading-7 text-[#545454]">{label}</p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-[#E2E2E2]"
      >
        <div className="h-full rounded-full bg-black" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function SavedIntake({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const storedAnswers = useSyncExternalStore(
    subscribeToIntake,
    getIntakeSnapshot,
    getIntakeServerSnapshot,
  );
  const surveySubmittedFlag = useSyncExternalStore(
    subscribeToSurveySubmitted,
    getSurveySubmittedSnapshot,
    getSurveySubmittedServerSnapshot,
  );
  const pending = isIntakePending(storedAnswers);
  const answers = readIntakeAnswers(storedAnswers);
  const textUrgent = Boolean(
    answers?.ageBand &&
      intakeTextIsUrgent({
        concerns: answers.concerns,
        pastAttempts: answers.pastAttempts,
        symptoms: answers.symptoms,
        ageBand: answers.ageBand,
      }),
  );
  const surveySubmitted = surveySubmittedFlag === "yes";
  const shouldAskQuestions =
    !pending && Boolean(answers?.ageBand) && !textUrgent && !surveySubmitted;
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
    if (
      !intakeTextIsUrgent({
        concerns: saved.concerns,
        pastAttempts: saved.pastAttempts,
        symptoms: saved.symptoms,
        ageBand: saved.ageBand,
      }) &&
      !isSurveySubmitted()
    ) {
      router.replace("/questions");
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
              text: payload.error ?? PATHS_UNAVAILABLE,
            },
          });
          return;
        }
        const pathways = payload.pathways ?? [];
        setProvisionalRecord({
          id: requestKey,
          state: {
            kind: "ready",
            pathways,
            notice: payload.notice ?? null,
          },
        });
        const selected = readSurveySelection(getSurveySnapshot());
        submitSurvey(
          surveyAnswersFromSelection(saved.symptoms, selected),
          pathways,
          saved,
          requestKey,
        );
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
            text: PATHS_UNAVAILABLE,
          },
        });
      });

    return () => {
      controller.abort();
      refineAbort.current?.abort();
    };
  }, [pending, storedAnswers, router]);

  function submitSurvey(
    surveyAnswers: SurveyAnswer[],
    provisionalPaths: PresentedPathway[],
    saved: NonNullable<typeof answers>,
    requestKey: string,
  ) {
    if (!saved.ageBand) {
      return;
    }
    const result = scoreSurvey(surveyAnswers);
    setScoreRecord({ id: requestKey, result });
    refineAbort.current?.abort();
    const controller = new AbortController();
    refineAbort.current = controller;
    latestIntake.current = requestKey;
    setRefineRecord({ id: requestKey, state: { kind: "loading" } });
    fetch("/api/refine", {
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
          state: {
            kind: "ready",
            pathways: payload.pathways ?? [],
            note: payload.message ?? null,
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
  const pathwaySettled = refine.kind === "ready" || refine.kind === "message";
  const shownPathways: PresentedPathway[] =
    refine.kind === "ready"
      ? refine.pathways
      : refine.kind === "message" && provisional.kind === "ready"
        ? provisional.pathways
        : [];
  const cardPathways = withScores(shownPathways, scores);
  const treePathways = toTree(cardPathways);
  const backHref =
    answers?.ageBand &&
    !textUrgent &&
    provisional.kind !== "urgent" &&
    refine.kind !== "urgent"
      ? "/questions"
      : "/";

  if (shouldAskQuestions) {
    return (
      <p className="text-base leading-7 text-[#545454]">
        Taking you to the questions…
      </p>
    );
  }

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

      {provisional.kind === "loading" ||
      (provisional.kind === "ready" && !pathwaySettled && refine.kind !== "urgent") ? (
        <PathwayProgress
          label={
            provisional.kind === "loading"
              ? "Looking at the intake…"
              : "Building your care pathway…"
          }
          cap={provisional.kind === "loading" ? 55 : 92}
        />
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
      {provisional.kind === "ready" && pathwaySettled ? (
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
      {refine.kind === "message" ? (
        <p className="text-base leading-7 text-[#545454]">{refine.text}</p>
      ) : null}
      {refine.kind === "ready" && refine.note ? (
        <p className="text-base leading-7 text-[#545454]">{refine.note}</p>
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

      {scores && treePathways.length === 0 && pathwaySettled ? (
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
          href={backHref}
          className="text-base font-medium text-black underline decoration-black underline-offset-4"
        >
          Back
        </Link>
      </p>
      <p className="text-base leading-7 text-[#545454]">{RESULTS_FOOTER}</p>
    </>
  );
}
