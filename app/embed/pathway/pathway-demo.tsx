"use client";

// /embed/pathway: the real care pathway tree, replaying one saved mock-patient visit.
// Everything comes from data/demo.json. Booking is switched off (readOnly), and nothing
// here calls an API or an AI.
import { useState } from "react";
import demo from "../../../data/demo.json";
import { RESULTS_FOOTER } from "../../../lib/copy";
import type { ResultsFile } from "../../../lib/booking/snapshot";
import CareTree, { type CarePathway } from "../../results/care-tree";
import { IntakeSummary } from "../../results/intake-summary";
import { ProvisionalCards, type CardPathway } from "../../results/path-details";

const PATHWAYS = demo.pathways as unknown as CardPathway[];
const RESULTS_FILE = demo.resultsFile as unknown as ResultsFile;
const INTAKE = demo.intake;

function toTree(pathways: CardPathway[]): CarePathway[] {
  return pathways.map((pathway) => ({
    categoryId: pathway.category_id,
    name: pathway.name,
    scoreText: pathway.scoreText,
    steps: pathway.steps,
  }));
}

export default function PathwayDemo() {
  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const visible = showAllPatterns ? PATHWAYS : PATHWAYS.slice(0, 3);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 px-3 py-3 sm:px-5 sm:py-4">
      <p
        role="note"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold leading-6 text-amber-950"
      >
        Prototype demo · mock patient · not medical advice
      </p>

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-black sm:text-2xl">Care pathways</h1>
        <p className="text-sm leading-6 text-[#545454]">
          Mock patient: {INTAKE.ageLabel}, {INTAKE.city}, symptoms for {INTAKE.timeline}.{" "}
          {INTAKE.symptomText}. “{INTAKE.concerns}”
        </p>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-black">Full intake answers</summary>
          <div className="mt-2">
            <IntakeSummary
              age={INTAKE.ageLabel}
              city={INTAKE.city}
              timeline={INTAKE.timeline}
              symptoms={INTAKE.symptomText}
              concerns={INTAKE.concerns}
              pastAttempts={INTAKE.pastAttempts}
            />
          </div>
        </details>
      </header>

      <section aria-label="Care pathway tree" className="flex flex-col gap-2">
        <CareTree
          pathways={toTree(visible)}
          patientCity={INTAKE.city}
          ageBand={INTAKE.ageBand === "13-17" ? "13-17" : "18+"}
          showAllPatterns={showAllPatterns}
          onShowAllPatterns={setShowAllPatterns}
          buildSnapshot={() => RESULTS_FILE}
          readOnly
          diagramSizeClass="h-[58svh] min-h-[320px] max-h-[460px]"
        />
        <p className="text-sm leading-6 text-[#545454]">
          Click a step to see what happens, why it may help, and its guideline sources. Drag to move the diagram and
          use + and − to zoom.
        </p>
      </section>

      <section aria-label="Why each pattern may apply" className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-black">Why each pattern may apply</h2>
        <ProvisionalCards pathways={visible} label={null} />
      </section>

      <p className="text-xs leading-5 text-[#545454]">
        Saved example from a mock visit on {new Date(demo.capturedAt).toLocaleDateString("en-CA")}. {RESULTS_FOOTER}
      </p>
    </main>
  );
}
