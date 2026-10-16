"use client";

export type Practitioner = {
  id: string;
  name: string;
  practitioner_type: string;
  city: string;
  clinic: string;
  about: string;
  details: {
    availability: string;
    languages: string[];
    accepting_new_patients: boolean;
  };
};

function cityMatches(patientLocation: string, practitionerCity: string) {
  const location = patientLocation.trim().toLowerCase();
  const city = practitionerCity.trim().toLowerCase();
  if (!location || !city) {
    return false;
  }

  const beforeComma = location.split(",")[0]?.trim();
  if (beforeComma === city) {
    return true;
  }

  const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(patientLocation);
}

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
  practitioners,
  chosenId,
  onChoose,
}: {
  open: boolean;
  stepTitle: string | null;
  practitionerType: string | null;
  patientCity: string;
  practitioners: Practitioner[];
  chosenId: string | null;
  onChoose: (practitionerId: string) => void;
}) {
  const matches = practitioners.filter(
    (person) =>
      person.practitioner_type === practitionerType &&
      cityMatches(patientCity, person.city),
  );

  return (
    <div
      className="grid transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div className="min-h-0 overflow-hidden" inert={!open}>
        <section
          aria-label="Sample practitioners"
          className="mt-1 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
        >
          {stepTitle ? (
            <h2 className="text-lg font-semibold text-slate-800">{stepTitle}</h2>
          ) : null}
          {practitionerType && matches.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {emptyMessage(patientCity)}
            </p>
          ) : matches.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {matches.map((person) => {
                const chosen = person.id === chosenId;
                return (
                  <li
                    key={person.id}
                    className={
                      chosen
                        ? "rounded-xl border-2 border-teal-700 bg-teal-50 p-4"
                        : "rounded-xl border border-slate-200 bg-slate-50 p-4"
                    }
                  >
                    {chosen ? (
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                        Selected
                      </p>
                    ) : null}
                    <p
                      className={
                        chosen
                          ? "mt-1 text-base font-semibold text-slate-900"
                          : "text-base font-semibold text-slate-900"
                      }
                    >
                      {person.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{person.clinic}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {person.about}
                    </p>
                    <p className="mt-3 text-sm text-slate-700">
                      Availability: {person.details.availability}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Languages: {person.details.languages.join(", ")}
                    </p>
                    <button
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => onChoose(person.id)}
                      className={
                        chosen
                          ? "mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-800 px-4 text-sm font-semibold text-white"
                          : "mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
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
