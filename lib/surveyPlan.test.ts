import { expect, it } from "vitest";
import { orderQuestions, prefillAnswers } from "./surveyPlan";

const blank = { symptoms: [] as string[] };

it("asks all nine questions and keeps file order when nothing matches", () => {
  expect(orderQuestions(blank).map((question) => question.id)).toEqual([
    "Q1",
    "Q2",
    "Q3",
    "Q4",
    "Q5",
    "Q6",
    "Q7",
    "Q8",
    "Q9",
  ]);
});

it("puts sensory questions first for headache, neck, noise, and light", () => {
  const ordered = orderQuestions({
    symptoms: [
      "Headache",
      "Neck pain",
      "Noise sensitivity",
      "Light sensitivity",
    ],
  }).map((question) => question.id);

  expect(ordered).toEqual(["Q7", "Q8", "Q9", "Q1", "Q2", "Q3", "Q4", "Q5", "Q6"]);
});

it("puts the vestibular question first for dizziness", () => {
  expect(
    orderQuestions({ symptoms: ["Dizziness"] }).map((question) => question.id),
  ).toEqual(["Q5", "Q1", "Q2", "Q3", "Q4", "Q6", "Q7", "Q8", "Q9"]);
});

it("puts the oculomotor question first for vision problems", () => {
  expect(
    orderQuestions({ symptoms: ["vision_problems"] }).map((question) => question.id),
  ).toEqual(["Q6", "Q1", "Q2", "Q3", "Q4", "Q5", "Q7", "Q8", "Q9"]);
});

it("puts metabolic questions first for fatigue and brain fog", () => {
  expect(
    orderQuestions({ symptoms: ["Fatigue", "Brain fog"] }).map(
      (question) => question.id,
    ),
  ).toEqual(["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9"]);
});

it("puts the neuroendocrine question first for sleep and mood", () => {
  expect(
    orderQuestions({ symptoms: ["sleep-problems", "mood_changes"] }).map(
      (question) => question.id,
    ),
  ).toEqual(["Q4", "Q1", "Q2", "Q3", "Q5", "Q6", "Q7", "Q8", "Q9"]);
});

it("keeps matched questions in file order and leaves unmatched categories last", () => {
  expect(
    orderQuestions({ symptoms: ["Dizziness", "Light sensitivity"] }).map(
      (question) => question.id,
    ),
  ).toEqual(["Q5", "Q7", "Q8", "Q9", "Q1", "Q2", "Q3", "Q4", "Q6"]);
});

it("pre-selects only Q7 A when light sensitivity is checked", () => {
  expect(prefillAnswers({ symptoms: ["Light sensitivity"] })).toEqual([
    { question_id: "Q7", option_ids: ["A"] },
  ]);
  expect(
    prefillAnswers({
      symptoms: [
        "Headache",
        "Dizziness",
        "Neck pain",
        "Sleep problems",
        "Mood changes",
        "Fatigue",
        "Brain fog",
        "Vision problems",
      ],
    }),
  ).toEqual([]);
  expect(prefillAnswers(blank)).toEqual([]);
});
