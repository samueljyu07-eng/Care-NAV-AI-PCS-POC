import { listQuestions, type SurveyQuestion } from "./surveyMatrix";

export type IntakeContext = {
  symptoms: string[];
};

export type PrefillAnswer = {
  question_id: string;
  option_ids: string[];
};

const SYMPTOM_CATEGORY: Record<string, string> = {
  headache: "sensory_peripheral",
  neck_pain: "sensory_peripheral",
  noise_sensitivity: "sensory_peripheral",
  light_sensitivity: "sensory_peripheral",
  dizziness: "vestibular",
  vision_problems: "oculomotor",
  fatigue: "fatigue_activity",
  brain_fog: "fatigue_activity",
  sleep_problems: "neuroendocrine",
  mood_changes: "neuroendocrine",
};

export function symptomKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function categoriesForSymptoms(symptoms: string[]): string[] {
  const ids: string[] = [];
  for (const symptom of symptoms) {
    const categoryId = SYMPTOM_CATEGORY[symptomKey(symptom)];
    if (categoryId && !ids.includes(categoryId)) {
      ids.push(categoryId);
    }
  }
  return ids;
}

export function symptomsForCategory(symptoms: string[], categoryId: string): string[] {
  return symptoms.filter(
    (symptom) => SYMPTOM_CATEGORY[symptomKey(symptom)] === categoryId,
  );
}

function questionMatches(question: SurveyQuestion, matched: Set<string>): boolean {
  return question.options.some(
    (option) =>
      !option.exclusive &&
      option.category_id !== null &&
      matched.has(option.category_id),
  );
}

export function orderQuestions(intake: IntakeContext): SurveyQuestion[] {
  const matched = new Set(categoriesForSymptoms(intake.symptoms));
  return listQuestions()
    .map((question, index) => ({
      question,
      index,
      relevant: questionMatches(question, matched),
    }))
    .sort(
      (left, right) =>
        Number(right.relevant) - Number(left.relevant) || left.index - right.index,
    )
    .map((item) => item.question);
}

export function prefillAnswers(intake: IntakeContext): PrefillAnswer[] {
  const hasLight = intake.symptoms.some(
    (symptom) => symptomKey(symptom) === "light_sensitivity",
  );
  if (!hasLight) {
    return [];
  }
  const question = listQuestions().find((item) => item.id === "Q7");
  const option = question?.options.find((item) => item.id === "A" && !item.exclusive);
  if (!question || !option) {
    return [];
  }
  return [{ question_id: question.id, option_ids: [option.id] }];
}
