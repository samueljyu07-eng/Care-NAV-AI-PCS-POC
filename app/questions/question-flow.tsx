"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import {
  getIntakeServerSnapshot,
  getIntakeSnapshot,
  isIntakePending,
  readIntakeAnswers,
  subscribeToIntake,
} from "../intake-answers";
import { intakeTextIsUrgent } from "../../lib/intakeBody";
import SurveyForm from "./survey-form";

export default function QuestionFlow() {
  const router = useRouter();
  const stored = useSyncExternalStore(
    subscribeToIntake,
    getIntakeSnapshot,
    getIntakeServerSnapshot,
  );
  const pending = isIntakePending(stored);
  const answers = readIntakeAnswers(stored);
  const urgent = Boolean(
    answers?.ageBand &&
      intakeTextIsUrgent({
        concerns: answers.concerns,
        pastAttempts: answers.pastAttempts,
        symptoms: answers.symptoms,
        ageBand: answers.ageBand,
      }),
  );

  useEffect(() => {
    if (pending || !urgent) {
      return;
    }
    router.replace("/results");
  }, [pending, urgent, router]);

  if (pending || urgent) {
    return <p className="text-base leading-7 text-[#545454]">Loading…</p>;
  }

  if (!answers?.ageBand) {
    return (
      <p className="text-base leading-7 text-[#545454]">
        No intake answers are saved for this visit.{" "}
        <Link
          href="/"
          className="font-medium text-black underline decoration-black underline-offset-4"
        >
          Go back to the form
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      <header className="mb-10">
        <p className="text-sm text-[#545454]">Post-concussion care</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-black sm:text-5xl">
          Narrow this down
        </h1>
        <p className="mt-3 text-base leading-7 text-[#545454]">
          Answer what applies. You can leave a question blank. This is not a
          diagnosis.
        </p>
      </header>
      <SurveyForm
        symptoms={answers.symptoms}
        onSubmit={() => {
          router.push("/results");
        }}
      />
      <p className="mt-8">
        <Link
          href="/"
          className="text-base font-medium text-black underline decoration-black underline-offset-4"
        >
          Back
        </Link>
      </p>
    </>
  );
}
