"use client";

import { useState } from "react";
import type { AgeBand } from "../../lib/catalog";
import { DRAFT_STEP_LABEL, SHOW_DRAFT_STEPS } from "../../lib/copy";
import type { ResultsFile } from "../../lib/booking/snapshot";
import type { ReferralDetail } from "../../lib/portal/types";
import CareTree, { type CarePathway } from "../results/care-tree";
import { IntakeSummary } from "../results/intake-summary";
import { ProvisionalCards, type CardPathway } from "../results/path-details";

function ageBandOf(value: string | null | undefined): AgeBand | null {
  if (value === "13-17" || value === "18+") {
    return value;
  }
  return null;
}

function cardsFrom(file: ResultsFile, showAll: boolean): CardPathway[] {
  const pathways = Array.isArray(file.pathways) ? file.pathways : [];
  const visible = showAll ? pathways : pathways.slice(0, 3);
  return visible.map((pathway) => ({
    category_id: pathway.categoryId,
    name: pathway.name,
    evidence_badge: pathway.evidenceBadge,
    why_it_may_apply: pathway.whyItMayApply,
    note: pathway.note,
    sources: pathway.sources ?? [],
    scoreText: pathway.scoreText,
    steps: (pathway.steps ?? []).map((step) => ({
      order: step.order,
      title: step.title,
      practitioner_type: step.practitionerTypeId,
      rationale: step.rationale,
      step_id: step.stepId,
      from_library: Boolean(step.stepId),
      draft_label: step.draftLabel,
      safety_note: step.safetyNote,
      sources: step.sources ?? [],
    })),
  }));
}

function treeFrom(pathways: CardPathway[]): CarePathway[] {
  return pathways.map((pathway) => ({
    categoryId: pathway.category_id,
    name: pathway.name,
    scoreText: pathway.scoreText,
    steps: pathway.steps,
  }));
}

function phoneHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.length >= 7 ? `tel:${digits}` : null;
}

export function PatientCard({
  detail,
  forceOpen,
}: {
  detail: ReferralDetail;
  forceOpen: boolean;
}) {
  const file = detail.snapshot;
  const [showAll, setShowAll] = useState(file.view?.showAllPatterns === true);
  const intake = file.intake;
  const survey = Array.isArray(file.survey) ? file.survey : [];
  const cards = file.kind === "results-file" ? cardsFrom(file, showAll) : [];
  const tree = treeFrom(cards);
  const draft = file.notices?.draftBanner || (SHOW_DRAFT_STEPS ? DRAFT_STEP_LABEL : null);
  const phoneLink = phoneHref(detail.patient.phone);

  return (
    <article id="patient-card" className="patient-card flex flex-col gap-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-black">
          {detail.patient.name.trim() || "Not shared"}
        </h1>
        <p className="mt-3 text-base leading-7 text-[#545454]">
          {detail.clinicName} · {detail.clinicianName}
        </p>
        <p className="mt-1 text-base leading-7 text-black">
          Clinic status: {detail.statusLabel}. Patient says: {detail.patientSaysLabel}.
        </p>
      </header>

      <section
        aria-label="Contact details"
        className="rounded-xl border border-[#E2E2E2] bg-[#F6F6F6] px-4 py-4"
      >
        <h2 className="text-base font-semibold text-black">Contact</h2>
        <dl className="mt-3 grid gap-3 text-base leading-7 text-black sm:grid-cols-2">
          <div>
            <dt className="text-sm text-[#545454]">Name</dt>
            <dd>{detail.patient.name.trim() || "Not shared"}</dd>
          </div>
          <div>
            <dt className="text-sm text-[#545454]">Phone</dt>
            <dd>
              {detail.patient.phone.trim() ? (
                phoneLink ? (
                  <a className="underline decoration-black underline-offset-4" href={phoneLink}>
                    {detail.patient.phone}
                  </a>
                ) : (
                  detail.patient.phone
                )
              ) : (
                "Not shared"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-[#545454]">Email</dt>
            <dd>
              {detail.patient.email.trim() ? (
                <a
                  className="underline decoration-black underline-offset-4"
                  href={`mailto:${detail.patient.email}`}
                >
                  {detail.patient.email}
                </a>
              ) : (
                "Not shared"
              )}
            </dd>
          </div>
        </dl>
      </section>

      {draft ? (
        <p className="rounded-xl border border-[#E2E2E2] bg-[#F6F6F6] px-4 py-4 text-base leading-7 text-black">
          {draft}
        </p>
      ) : null}

      {intake ? (
        <IntakeSummary
          age={intake.ageLabel}
          city={intake.city}
          timeline={intake.timeline}
          symptoms={intake.symptomText || intake.symptoms.join(", ")}
          concerns={intake.concerns}
          pastAttempts={intake.pastAttempts}
        />
      ) : (
        <p className="text-base leading-7 text-[#545454]">No intake answers were stored with this referral.</p>
      )}

      {file.notices?.teenNote ? (
        <aside className="rounded-xl border border-[#E2E2E2] bg-[#F6F6F6] px-4 py-4" role="note">
          <p className="text-base leading-7 text-black">{file.notices.teenNote}</p>
        </aside>
      ) : null}

      <aside className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4" role="note">
        <p className="text-base font-semibold text-amber-950">Not medical advice</p>
        <p className="mt-1 text-base leading-7 text-amber-950">
          {file.notices?.disclaimer ||
            "These pathways are a navigation roadmap to take to a GP. They are not a diagnosis, a prescription, or medical advice."}
        </p>
      </aside>

      <section aria-label="Survey results" className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black">Survey results</h2>
        {survey.length === 0 ? (
          <p className="text-base leading-7 text-[#545454]">No survey answers were stored with this referral.</p>
        ) : (
          <dl className="grid gap-3 text-base leading-7 text-black">
            {survey.map((item) => (
              <div key={item.questionId}>
                <dt className="text-sm text-[#545454]">{item.summary || item.questionText}</dt>
                <dd>
                  {item.selected.length > 0
                    ? item.selected.map((option) => option.text).join(", ")
                    : "Not answered"}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {file.journal?.note ? (
        <section
          aria-label="What changed since your survey"
          className="rounded-xl border border-[#E2E2E2] bg-[#F6F6F6] px-4 py-4"
        >
          <h2 className="text-base font-semibold text-black">What changed since your survey</h2>
          <p className="mt-2 text-base leading-7 text-black">{file.journal.note}</p>
        </section>
      ) : null}

      <ProvisionalCards pathways={cards} label={null} forceOpen={forceOpen} />
      {file.notices?.refineNote ? (
        <p className="text-base leading-7 text-[#545454]">{file.notices.refineNote}</p>
      ) : null}

      {tree.length > 0 ? (
        <div id="care-paths" className="flex flex-col gap-3">
          <p className="text-base leading-7 text-[#545454] print:hidden">
            Use the + and − buttons to zoom. On a phone, drag to move the diagram. On a larger
            screen, drag the background and scroll to zoom. Click a step to open it. Booking stays
            off in the clinic portal.
          </p>
          <CareTree
            pathways={tree}
            patientCity={intake?.city ?? ""}
            ageBand={ageBandOf(intake?.ageBand)}
            showAllPatterns={showAll}
            onShowAllPatterns={setShowAll}
            buildSnapshot={() => file}
            readOnly
          />
        </div>
      ) : null}

      <p className="text-base leading-7 text-[#545454]">{file.notices?.footer || ""}</p>
    </article>
  );
}
