"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  getSurveyServerSnapshot,
  getSurveySnapshot,
  readSurveySelection,
  saveSurveySelection,
  subscribeToSurvey,
} from "../intake-answers";
import type { SurveyAnswer } from "../../lib/scoring";
import { orderQuestions, prefillAnswers } from "../../lib/surveyPlan";
import type { SurveyQuestion } from "../../lib/surveyMatrix";

function choiceClass(selected: boolean) {
  return selected
    ? "flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-black bg-black px-4 py-3 text-base leading-7 text-white"
    : "flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-[#E2E2E2] bg-white px-4 py-3 text-base leading-7 text-black";
}

function prefillSelection(symptoms: string[]): Record<string, string[]> {
  const selected: Record<string, string[]> = {};
  for (const answer of prefillAnswers({ symptoms })) {
    selected[answer.question_id] = answer.option_ids;
  }
  return selected;
}

export default function SurveyForm({
  symptoms,
  onSubmit,
}: {
  symptoms: string[];
  onSubmit: (answers: SurveyAnswer[]) => void;
}) {
  const storedRaw = useSyncExternalStore(
    subscribeToSurvey,
    getSurveySnapshot,
    getSurveyServerSnapshot,
  );
  const questions = useMemo(() => orderQuestions({ symptoms }), [symptoms]);
  const prefill = useMemo(() => prefillSelection(symptoms), [symptoms]);
  const [edits, setEdits] = useState<Record<string, string[]> | null>(null);
  const selected =
    edits ?? (storedRaw ? readSurveySelection(storedRaw) : prefill);

  function choose(question: SurveyQuestion, optionId: string, exclusive: boolean) {
    const base = edits ?? (storedRaw ? readSurveySelection(storedRaw) : prefill);
    const currentIds = base[question.id] ?? [];
    let nextIds: string[];
    if (question.selection === "single") {
      nextIds = [optionId];
    } else if (exclusive) {
      nextIds = currentIds.includes(optionId) ? [] : [optionId];
    } else {
      const withoutExclusive = currentIds.filter((id) => {
        const option = question.options.find((item) => item.id === id);
        return option ? !option.exclusive : false;
      });
      nextIds = withoutExclusive.includes(optionId)
        ? withoutExclusive.filter((id) => id !== optionId)
        : [...withoutExclusive, optionId];
    }
    const next = { ...base, [question.id]: nextIds };
    saveSurveySelection(next);
    setEdits(next);
  }

  function handleSubmit() {
    const answers = questions.map((question) => ({
      question_id: question.id,
      option_ids: selected[question.id] ?? [],
    }));
    saveSurveySelection(
      Object.fromEntries(answers.map((answer) => [answer.question_id, answer.option_ids])),
    );
    onSubmit(answers);
  }

  return (
    <section aria-label="Help us narrow this down" className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-black">
          Help us narrow this down
        </h2>
        <p className="mt-2 max-w-3xl text-base leading-7 text-[#545454]">
          These answers are saved for this visit. Change any filled-in answer,
          then update your results.
        </p>
      </div>
      <ol className="flex flex-col gap-8">
        {questions.map((question, index) => (
          <li key={question.id}>
            <fieldset>
              <legend className="text-base font-medium text-black">
                {index + 1}. {question.summary}
              </legend>
              <p className="mt-1 text-sm leading-6 text-[#545454]">
                {question.selection === "multi"
                  ? "Select all that apply."
                  : "Choose one."}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {question.options.map((option) => {
                  const checked = (selected[question.id] ?? []).includes(option.id);
                  const inputId = `${question.id}-${option.id}`;
                  return (
                    <label key={option.id} htmlFor={inputId} className={choiceClass(checked)}>
                      <input
                        id={inputId}
                        type={question.selection === "multi" ? "checkbox" : "radio"}
                        name={question.id}
                        checked={checked}
                        onChange={() => choose(question, option.id, option.exclusive)}
                        className="sr-only"
                      />
                      <span>{option.text}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={handleSubmit}
        className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-black px-5 text-base font-medium text-white transition-colors duration-200 hover:bg-[#1A1A1A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black sm:w-auto"
      >
        Update my results
      </button>
    </section>
  );
}
