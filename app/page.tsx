"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { saveIntakeAnswers, type AgeBand } from "./intake-answers";
import { UNDER_13_MESSAGE } from "../lib/copy";

const TIMELINE_STOPS = [
  "1 week",
  "2 weeks",
  "1 month",
  "3 months",
  "6 months",
  "1 year",
  "2 years",
] as const;

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
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [pastAttempts, setPastAttempts] = useState("");
  const [ageChoice, setAgeChoice] = useState<AgeBand | "under-13" | "">("");

  function toggleSymptom(id: string) {
    setSymptoms((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ageChoice !== "13-17" && ageChoice !== "18+") {
      return;
    }
    saveIntakeAnswers({
      city: location.trim(),
      concerns: concerns.trim(),
      symptoms: SYMPTOMS.filter((symptom) => symptoms.includes(symptom.id)).map(
        (symptom) => symptom.label,
      ),
      timeline: TIMELINE_STOPS[timelineIndex],
      pastAttempts: pastAttempts.trim(),
      ageBand: ageChoice,
    });
    router.push("/results");
  }

  return (
    <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-10">
        <p className="text-sm text-[#545454]">
          Post-concussion care
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-black sm:text-5xl">
          Patient intake
        </h1>
        <p className="mt-3 text-base leading-7 text-[#545454]">
          Share a few details so a care navigator can better understand what
          you are looking for.
        </p>
      </header>

      <aside
        className="mb-10 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4"
        role="note"
      >
        <p className="text-base leading-7 text-amber-950">
          If symptoms are severe or getting worse, call{" "}
          <span className="font-semibold">911</span> or go to the nearest
          emergency department. This tool does not give medical advice.
        </p>
      </aside>

      <form
        onSubmit={handleSubmit}
        className="space-y-10"
      >
        <div className="space-y-8">
          <fieldset>
            <legend className="text-base font-medium text-black">
              Who are these answers about?
            </legend>
            <p className="mt-1 text-sm leading-6 text-[#545454]">
              This demo is for teens and adults.
            </p>
            <div className="mt-4 flex flex-col gap-2" role="group" aria-label="Age">
              {(
                [
                  ["13-17", "Teen, 13 to 17"],
                  ["18+", "Adult, 18 or older"],
                  ["under-13", "Child, 12 or younger"],
                ] as const
              ).map(([value, label]) => {
                const selected = ageChoice === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setAgeChoice(value)}
                    className={
                      selected
                        ? "flex min-h-12 cursor-pointer items-center rounded-xl bg-black px-4 text-left text-base text-white"
                        : "flex min-h-12 cursor-pointer items-center rounded-xl bg-[#F6F6F6] px-4 text-left text-base text-black"
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {ageChoice === "13-17" ? (
              <p className="mt-3 text-sm leading-6 text-[#545454]">
                A parent or guardian should complete this with the teen. Results
                are written for a pediatric clinician.
              </p>
            ) : null}
            {ageChoice === "under-13" ? (
              <p className="mt-3 text-base leading-7 text-black" role="status">
                {UNDER_13_MESSAGE}
              </p>
            ) : null}
          </fieldset>

          <div>
            <label
              htmlFor="location"
              className="block text-base font-medium text-black"
            >
              City and province
            </label>
            <p id="location-hint" className="mt-1 text-sm leading-6 text-[#545454]">
              Example: Vancouver, British Columbia
            </p>
            <input
              id="location"
              type="text"
              autoComplete="address-level2"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              aria-describedby="location-hint"
              className="mt-2 w-full rounded-xl border border-transparent bg-[#F6F6F6] px-4 py-3.5 text-base text-black outline-none placeholder:text-[#545454] focus:border-black focus:bg-white"
              placeholder="City, province"
            />
          </div>

          <div>
            <label
              htmlFor="concerns"
              className="block text-base font-medium text-black"
            >
              Main concerns
            </label>
            <p id="concerns-hint" className="mt-1 text-sm leading-6 text-[#545454]">
              What is most important for you right now?
            </p>
            <textarea
              id="concerns"
              rows={6}
              value={concerns}
              onChange={(event) => setConcerns(event.target.value)}
              aria-describedby="concerns-hint"
              className="mt-2 w-full resize-y rounded-xl border border-transparent bg-[#F6F6F6] px-4 py-3.5 text-base leading-7 text-black outline-none placeholder:text-[#545454] focus:border-black focus:bg-white"
              placeholder="Write in your own words."
            />
          </div>

          <fieldset>
            <legend className="text-base font-medium text-black">
              Primary symptoms
            </legend>
            <p className="mt-1 text-sm leading-6 text-[#545454]">
              Select all that apply.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SYMPTOMS.map((symptom) => (
                <label
                  key={symptom.id}
                  htmlFor={symptom.id}
                  className="relative inline-flex min-h-11 cursor-pointer items-center rounded-full bg-[#F6F6F6] px-4 text-base text-black has-[:checked]:bg-black has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-black"
                >
                  <input
                    id={symptom.id}
                    type="checkbox"
                    value={symptom.id}
                    checked={symptoms.includes(symptom.id)}
                    onChange={() => toggleSymptom(symptom.id)}
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  />
                  <span className="pointer-events-none">{symptom.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="timeline"
              className="block text-base font-medium text-black"
            >
              Timeline
            </label>
            <p id="timeline-hint" className="mt-1 text-sm leading-6 text-[#545454]">
              Drag the handle to show how long symptoms have lasted.
            </p>
            <p className="mt-3 text-base font-medium text-black">
              {TIMELINE_STOPS[timelineIndex]}
            </p>
            <input
              id="timeline"
              type="range"
              min={0}
              max={TIMELINE_STOPS.length - 1}
              step={1}
              value={timelineIndex}
              onChange={(event) => setTimelineIndex(Number(event.target.value))}
              aria-valuetext={TIMELINE_STOPS[timelineIndex]}
              aria-describedby="timeline-hint"
              className="mt-2 h-2 w-full cursor-pointer accent-black"
            />
            <div className="mt-2 grid grid-cols-7 gap-1 text-xs leading-4 text-[#545454]">
              {TIMELINE_STOPS.map((stop) => {
                const [amount, ...unit] = stop.split(" ");
                return (
                  <span key={stop} className="text-center">
                    <span className="block">{amount}</span>
                    <span className="block">{unit.join(" ")}</span>
                  </span>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="past-attempts"
              className="block text-base font-medium text-black"
            >
              Past attempts to resolve this
            </label>
            <p id="past-attempts-hint" className="mt-1 text-sm leading-6 text-[#545454]">
              Treatments, appointments, rest, or anything else you have tried.
            </p>
            <textarea
              id="past-attempts"
              rows={6}
              value={pastAttempts}
              onChange={(event) => setPastAttempts(event.target.value)}
              aria-describedby="past-attempts-hint"
              className="mt-2 w-full resize-y rounded-xl border border-transparent bg-[#F6F6F6] px-4 py-3.5 text-base leading-7 text-black outline-none placeholder:text-[#545454] focus:border-black focus:bg-white"
              placeholder="Write in your own words."
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={ageChoice !== "13-17" && ageChoice !== "18+"}
          className="mt-10 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-black px-5 text-base font-medium text-white transition-colors duration-200 hover:bg-[#1A1A1A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          Submit
        </button>
        {ageChoice !== "13-17" && ageChoice !== "18+" ? (
          <p className="mt-3 text-sm leading-6 text-[#545454]">
            Choose Teen, 13 to 17 or Adult, 18 or older above. Submit stays off
            until one of those is selected. A child 12 or younger cannot continue.
          </p>
        ) : null}
      </form>
    </main>
  );
}
