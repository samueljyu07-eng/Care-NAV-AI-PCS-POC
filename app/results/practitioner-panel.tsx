"use client";

import type { AgeBand } from "../../lib/catalog";
import { matchPractitioners } from "../../lib/matchPractitioners";

function emptyMessage(patientCity: string) {
  const city = patientCity.trim();
  if (!city) {
    return "Add a city on the intake form, such as Kelowna or Calgary, to see sample practitioners for this step.";
  }

  return `No sample practitioners in ${city} match this step. The people and clinics in this demo are fictional.`;
}

export default function PractitionerPanel({
  open,
  stepTitle,
  practitionerType,
  patientCity,
  ageBand,
  chosenId,
  onChoose,
}: {
  open: boolean;
  stepTitle: string | null;
  practitionerType: string | null;
  patientCity: string;
  ageBand: AgeBand | null;
  chosenId: string | null;
  onChoose: (practitionerId: string) => void;
}) {
  const matches = practitionerType
    ? matchPractitioners(practitionerType, patientCity, ageBand ?? undefined)
    : [];

  return (
    <div
      className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div className="min-h-0 overflow-hidden" inert={!open}>
        <section
          aria-label="Sample practitioners"
          className="mt-3 break-words rounded-xl border border-[#E2E2E2] bg-white p-4"
        >
          {stepTitle ? (
            <h2 className="text-lg font-bold tracking-tight text-black">{stepTitle}</h2>
          ) : null}
          {practitionerType && matches.length === 0 ? (
            <ul className="mt-3">
              <li className="rounded-xl border border-[#E2E2E2] bg-[#F6F6F6] p-4">
                <p className="text-sm font-medium text-[#545454]">
                  No match
                </p>
                <p className="mt-1 text-base font-semibold text-black">
                  No sample practitioner for this step
                </p>
                <p className="mt-3 text-base leading-7 text-[#545454]">
                  {emptyMessage(patientCity)}
                </p>
              </li>
            </ul>
          ) : matches.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {matches.map((person) => {
                const chosen = person.id === chosenId;
                return (
                  <li
                    key={person.id}
                    className={
                      chosen
                        ? "rounded-xl border border-black bg-[#F6F6F6] p-4"
                        : "rounded-xl border border-[#E2E2E2] bg-white p-4"
                    }
                  >
                    {chosen ? (
                      <p className="text-sm font-medium text-[#545454]">
                        Selected
                      </p>
                    ) : null}
                    <p
                      className={
                        chosen
                          ? "mt-1 text-base font-semibold text-black"
                          : "text-base font-semibold text-black"
                      }
                    >
                      {person.name}
                    </p>
                    <p className="mt-1 text-base text-[#545454]">{person.clinic}</p>
                    <p className="mt-3 text-base leading-7 text-black">
                      {person.about}
                    </p>
                    {ageBand === "13-17" ? (
                      <p className="mt-3 text-base leading-7 text-black">
                        For a teen, a parent or guardian can use this visit to
                        gather questions for a pediatric clinician.
                      </p>
                    ) : null}
                    <p className="mt-3 text-base text-[#545454]">
                      Availability: {person.details.availability}
                    </p>
                    <p className="mt-1 text-base text-[#545454]">
                      Languages: {person.details.languages.join(", ")}
                    </p>
                    <button
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => onChoose(person.id)}
                      className={
                        chosen
                          ? "mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-black px-4 text-base font-medium text-white transition-colors duration-200 hover:bg-[#1A1A1A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                          : "mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#F6F6F6] px-4 text-base font-medium text-black transition-colors duration-200 hover:bg-[#E2E2E2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                      }
                    >
                      {chosen ? "Chosen" : "Choose this practitioner"}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
