"use client";

import { useState } from "react";
import { PROVISIONAL_LABEL } from "../../lib/copy";
import { pathwayColor } from "../../lib/pathwayColors";
import type { DisplayPathway, PresentedPathway } from "../../lib/pathwayDraft";

export type CardPathway = PresentedPathway & {
  scoreText?: string | null;
};

function StepList({ steps }: { steps: DisplayPathway["steps"] }) {
  if (steps.length === 0) {
    return null;
  }
  return (
    <ol className="mt-4 flex list-decimal flex-col gap-4 pl-5">
      {steps.map((step) => (
        <li key={`${step.order}-${step.title}`} className="text-base leading-7 text-black">
          <p className="font-medium">{step.title}</p>
          <p>{step.rationale}</p>
          {step.safety_note ? <p className="mt-2">{step.safety_note}</p> : null}
          {step.sources.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer font-medium">Sources and limits</summary>
              <ul className="mt-2 flex flex-col gap-3">
                {step.sources.map((source) => (
                  <li key={`${source.title}-${source.url}`}>
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium underline decoration-black underline-offset-4"
                      >
                        {source.title || source.url}
                      </a>
                    ) : (
                      <p className="font-medium">{source.title}</p>
                    )}
                    {source.limits ? (
                      <p className="text-sm leading-6 text-[#545454]">{source.limits}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function roleLabel(role: DisplayPathway["role"]) {
  if (role === "co-primary") {
    return "Co-primary";
  }
  if (role === "secondary") {
    return "Secondary";
  }
  return "Primary";
}

function scorePercent(scoreText: string | null | undefined): number | null {
  if (!scoreText) {
    return null;
  }
  const match = /(\d+(?:\.\d+)?)%\s*$/.exec(scoreText);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.min(100, Math.max(0, value));
}

function ScorePie({ percent }: { percent: number }) {
  const filled = Math.min(100, Math.max(0, percent));
  return (
    <span
      aria-hidden="true"
      className="h-6 w-6 shrink-0 rounded-full"
      style={{
        background: `conic-gradient(#000 ${filled}%, #E2E2E2 ${filled}%)`,
      }}
    />
  );
}

function PathwayCard({ pathway }: { pathway: CardPathway }) {
  const [open, setOpen] = useState(false);
  const bodyId = `${pathway.category_id}-details`;
  const percent = scorePercent(pathway.scoreText);
  const color = pathwayColor(pathway.name);

  return (
    <li
      className="rounded-xl border-2 bg-white px-4 py-4"
      style={{ borderColor: color.border }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-start justify-between gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          {percent !== null ? <ScorePie percent={percent} /> : null}
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span
                aria-hidden="true"
                className="size-3.5 shrink-0 rounded-sm border"
                style={{ background: color.background, borderColor: color.border }}
              />
              <h3 className="text-xl font-bold tracking-tight text-black">{pathway.name}</h3>
              <span className="rounded-full bg-[#F6F6F6] px-3 py-1 text-sm text-black">
                {pathway.evidence_badge}
              </span>
            </span>
            {pathway.scoreText ? (
              <span className="mt-2 block text-base font-medium text-black">
                {pathway.scoreText}
              </span>
            ) : null}
          </span>
        </span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`mt-1 h-5 w-5 shrink-0 text-black transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M5 7.5 10 12.5 15 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        id={bodyId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden" inert={open ? undefined : true}>
          <p className="mt-3 text-base leading-7 text-black">{pathway.why_it_may_apply}</p>
          <StepList steps={pathway.steps} />
          {pathway.sources.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {pathway.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-base font-medium text-black underline decoration-black underline-offset-4"
                  >
                    {source.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-base leading-7 text-[#545454]">
              No source link is shown for this age. Matching sources are pending clinician review.
            </p>
          )}
          {pathway.note ? (
            <p className="mt-3 text-base leading-7 text-[#545454]">{pathway.note}</p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function ProvisionalCards({
  pathways,
  label = PROVISIONAL_LABEL,
}: {
  pathways: CardPathway[];
  label?: string | null;
}) {
  if (pathways.length === 0) {
    return null;
  }
  return (
    <section aria-label="Intake paths" className="flex flex-col gap-4">
      {label ? <p className="text-base font-semibold text-black">{label}</p> : null}
      <ul className="flex flex-col gap-4">
        {pathways.map((pathway) => (
          <PathwayCard key={pathway.category_id} pathway={pathway} />
        ))}
      </ul>
    </section>
  );
}

export function ScoredCards({
  pathways,
  tie,
  followUps,
}: {
  pathways: DisplayPathway[];
  tie: boolean;
  followUps: { id: string; text: string }[];
}) {
  return (
    <section id="scored-paths" aria-label="Scored paths" className="flex flex-col gap-4">
      {tie ? (
        <p className="rounded-xl border border-[#E2E2E2] bg-[#F6F6F6] px-4 py-4 text-base leading-7 text-black">
          These patterns tied. Both are shown as co-primary.
          {followUps.length > 0
            ? " A question that can separate them:"
            : ""}
        </p>
      ) : null}
      {followUps.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {followUps.map((question) => (
            <li key={question.id} className="text-base leading-7 text-black">
              {question.text}
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="flex flex-col gap-4">
        {pathways.map((pathway) => (
          <li
            key={pathway.category_id}
            className="rounded-xl border border-[#E2E2E2] bg-white px-4 py-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight text-black">
                {pathway.name}
              </h3>
              <span className="rounded-full bg-[#F6F6F6] px-3 py-1 text-sm text-black">
                {pathway.evidence_badge}
              </span>
            </div>
            <p className="mt-2 text-base font-medium text-black">
              {roleLabel(pathway.role)}
              {pathway.strength_label ? ` · ${pathway.strength_label} match` : ""}
              {" · "}
              {pathway.percentage_label}
            </p>
            <p className="mt-1 text-sm leading-6 text-[#545454]">
              {pathway.points} of {pathway.max_points} points
            </p>
            <p className="mt-3 text-base leading-7 text-black">{pathway.why_it_may_apply}</p>
            <StepList steps={pathway.steps} />
            {pathway.drivers.length > 0 ? (
              <div className="mt-4">
                <h4 className="text-base font-medium text-black">
                  Answers that raised this pattern
                </h4>
                <ul className="mt-2 flex flex-col gap-2">
                  {pathway.drivers.map((driver) => (
                    <li
                      key={`${driver.question_id}-${driver.option_id}`}
                      className="text-base leading-7 text-[#545454]"
                    >
                      {driver.option_text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {pathway.sources.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2">
                {pathway.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-base font-medium text-black underline decoration-black underline-offset-4"
                    >
                      {source.name}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-base leading-7 text-[#545454]">
                No source link is shown for this age. Matching sources are
                pending clinician review.
              </p>
            )}
            {pathway.note ? (
              <p className="mt-3 text-base leading-7 text-[#545454]">{pathway.note}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
