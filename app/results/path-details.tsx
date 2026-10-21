import { PROVISIONAL_LABEL } from "../../lib/copy";
import type { DisplayPathway, PresentedPathway } from "../../lib/pathwayDraft";

export type CardPathway = PresentedPathway & {
  scoreText?: string | null;
};

function roleLabel(role: DisplayPathway["role"]) {
  if (role === "co-primary") {
    return "Co-primary";
  }
  if (role === "secondary") {
    return "Secondary";
  }
  return "Primary";
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
          <li
            key={pathway.category_id}
            className="rounded-xl border border-[#E2E2E2] bg-white px-4 py-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight text-black">{pathway.name}</h3>
              <span className="rounded-full bg-[#F6F6F6] px-3 py-1 text-sm text-black">
                {pathway.evidence_badge}
              </span>
            </div>
            {pathway.scoreText ? (
              <p className="mt-2 text-base font-medium text-black">{pathway.scoreText}</p>
            ) : null}
            <p className="mt-3 text-base leading-7 text-black">{pathway.why_it_may_apply}</p>
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
          </li>
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
