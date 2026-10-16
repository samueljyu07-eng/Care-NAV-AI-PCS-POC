"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const SYMPTOMS = [
  { id: "headache", label: "Headache" },
  { id: "dizziness", label: "Dizziness" },
  { id: "light-sensitivity", label: "Light sensitivity" },
  { id: "noise-sensitivity", label: "Noise sensitivity" },
  { id: "neck-pain", label: "Neck pain" },
  { id: "sleep-problems", label: "Sleep problems" },
  { id: "mood-changes", label: "Mood changes" },
  { id: "brain-fog", label: "Brain fog" },
  { id: "vision-problems", label: "Vision problems" },
  { id: "fatigue", label: "Fatigue" },
] as const;

export default function Home() {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [concerns, setConcerns] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [timeline, setTimeline] = useState("");
  const [pastAttempts, setPastAttempts] = useState("");

  function toggleSymptom(id: string) {
    setSymptoms((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const city = location.trim();
    const query = city ? `?city=${encodeURIComponent(city)}` : "";
    router.push(`/results${query}`);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-800">
          Post-concussion care
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
          Patient intake
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Share a few details so a care navigator can better understand what
          you are looking for.
        </p>
      </header>

      <aside
        className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 sm:px-5"
        role="note"
      >
        <p className="text-base leading-7 text-amber-950">
          If symptoms are severe or getting worse, call{" "}
          <span className="font-semibold">911</span> or go to the nearest
          emergency department. This tool does not give medical advice.
        </p>
      </aside>

      <form
        action="/results"
        method="get"
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
      >
        <div className="space-y-8">
          <div>
            <label
              htmlFor="location"
              className="block text-base font-medium text-slate-800"
            >
              City and province
            </label>
            <p id="location-hint" className="mt-1 text-sm text-slate-500">
              Example: Vancouver, British Columbia
            </p>
            <input
              id="location"
              type="text"
              autoComplete="address-level2"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              aria-describedby="location-hint"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none ring-teal-700/20 placeholder:text-slate-400 focus:border-teal-700 focus:ring-4"
              placeholder="City, province"
            />
          </div>

          <div>
            <label
              htmlFor="concerns"
              className="block text-base font-medium text-slate-800"
            >
              Main concerns
            </label>
            <p id="concerns-hint" className="mt-1 text-sm text-slate-500">
              What is most important for you right now?
            </p>
            <textarea
              id="concerns"
              rows={6}
              value={concerns}
              onChange={(event) => setConcerns(event.target.value)}
              aria-describedby="concerns-hint"
              className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-base leading-7 text-slate-900 outline-none ring-teal-700/20 placeholder:text-slate-400 focus:border-teal-700 focus:ring-4"
              placeholder="Write in your own words."
            />
          </div>

          <fieldset>
            <legend className="text-base font-medium text-slate-800">
              Primary symptoms
            </legend>
            <p className="mt-1 text-sm text-slate-500">
              Select all that apply.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SYMPTOMS.map((symptom) => (
                <label
                  key={symptom.id}
                  htmlFor={symptom.id}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base text-slate-800 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50"
                >
                  <input
                    id={symptom.id}
                    type="checkbox"
                    value={symptom.id}
                    checked={symptoms.includes(symptom.id)}
                    onChange={() => toggleSymptom(symptom.id)}
                    className="size-5 shrink-0 rounded border-slate-300 text-teal-800 accent-teal-800"
                  />
                  {symptom.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="timeline"
              className="block text-base font-medium text-slate-800"
            >
              Timeline
            </label>
            <p id="timeline-hint" className="mt-1 text-sm text-slate-500">
              How long have symptoms persisted?
            </p>
            <input
              id="timeline"
              type="text"
              value={timeline}
              onChange={(event) => setTimeline(event.target.value)}
              aria-describedby="timeline-hint"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none ring-teal-700/20 placeholder:text-slate-400 focus:border-teal-700 focus:ring-4"
              placeholder="For example: 3 weeks, or since March"
            />
          </div>

          <div>
            <label
              htmlFor="past-attempts"
              className="block text-base font-medium text-slate-800"
            >
              Past attempts to resolve this
            </label>
            <p id="past-attempts-hint" className="mt-1 text-sm text-slate-500">
              Treatments, appointments, rest, or anything else you have tried.
            </p>
            <textarea
              id="past-attempts"
              rows={6}
              value={pastAttempts}
              onChange={(event) => setPastAttempts(event.target.value)}
              aria-describedby="past-attempts-hint"
              className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-base leading-7 text-slate-900 outline-none ring-teal-700/20 placeholder:text-slate-400 focus:border-teal-700 focus:ring-4"
              placeholder="Write in your own words."
            />
          </div>
        </div>

        <button
          type="submit"
          className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-teal-800 px-5 text-base font-semibold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 sm:w-auto sm:min-w-40"
        >
          Submit
        </button>
      </form>
    </main>
  );
}
