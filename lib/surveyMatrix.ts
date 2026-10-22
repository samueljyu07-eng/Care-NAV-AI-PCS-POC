import surveyFile from "../data/survey-matrix.json";
import { categoryById, listCategories } from "./catalog";

export type SurveySignal = {
  symptoms?: string[];
  phrases?: string[];
};

export type SurveyOption = {
  id: string;
  text: string;
  category_id: string | null;
  weight: number;
  exclusive: boolean;
  prefill?: SurveySignal;
};

export type SurveyQuestion = {
  id: string;
  summary: string;
  text: string;
  selection: "single" | "multi";
  relevance_hints?: SurveySignal;
  options: SurveyOption[];
};

export type SurveyRules = {
  secondary_min_percentage: number;
  secondary_within_points_of_primary: number;
  strength_labels: { label: string; min_percentage: number }[];
  none_scores_zero: boolean;
  intake_adds_points: boolean;
  tie_followups: { category_ids: string[]; question_ids: string[] }[];
};

type RawOption = {
  id: string;
  text: string;
  category?: string | null;
  category_id?: string | null;
  weight: number;
  exclusive: boolean;
  prefill?: SurveySignal;
};

type RawQuestion = {
  id: string;
  summary: string;
  text?: string;
  patient_text?: string | null;
  selection?: "single" | "multi";
  select?: "single" | "multi";
  relevance_hints?: SurveySignal;
  options: RawOption[];
};

type RawRules = {
  secondary_min_percentage?: number;
  secondary_min_percent?: number;
  secondary_within_points_of_primary?: number;
  secondary_within_percentage_points_of_primary?: number;
  strength_labels?: { label: string; min_percentage: number }[];
  match_labels_draft?: { label: string; min_percent: number }[];
  none_scores_zero?: boolean;
  intake_adds_points?: boolean;
  tie_followups?: { category_ids: string[]; question_ids: string[] }[];
  tie_follow_up_examples?: Record<string, string>;
};

function readOption(option: RawOption): SurveyOption {
  const categoryId = option.category_id ?? option.category ?? null;
  return {
    id: option.id,
    text: option.text,
    category_id: categoryId,
    weight: option.weight,
    exclusive: option.exclusive,
    prefill: option.prefill,
  };
}

function readQuestion(question: RawQuestion): SurveyQuestion {
  const selection = question.selection ?? question.select;
  const patientText =
    typeof question.patient_text === "string" ? question.patient_text.trim() : "";
  return {
    id: question.id,
    summary: question.summary,
    text: question.text?.trim() || patientText || question.summary,
    selection: selection === "multi" ? "multi" : "single",
    relevance_hints: question.relevance_hints,
    options: question.options.map(readOption),
  };
}

function categoriesOn(question: SurveyQuestion): string[] {
  const ids: string[] = [];
  for (const option of question.options) {
    if (
      option.category_id &&
      !option.exclusive &&
      option.weight > 0 &&
      !ids.includes(option.category_id)
    ) {
      ids.push(option.category_id);
    }
  }
  return ids;
}

function tieFollowups(
  rules: RawRules,
  questions: SurveyQuestion[],
): SurveyRules["tie_followups"] {
  if (rules.tie_followups) {
    return rules.tie_followups;
  }
  const examples = rules.tie_follow_up_examples ?? {};
  const followups: SurveyRules["tie_followups"] = [];
  for (const key of Object.keys(examples)) {
    const questionIds = key.split("_vs_");
    const categoryIds: string[] = [];
    for (const questionId of questionIds) {
      const question = questions.find((item) => item.id === questionId);
      if (!question) {
        continue;
      }
      for (const categoryId of categoriesOn(question)) {
        if (!categoryIds.includes(categoryId)) {
          categoryIds.push(categoryId);
        }
      }
    }
    if (questionIds.length > 0 && categoryIds.length > 0) {
      followups.push({ category_ids: categoryIds, question_ids: questionIds });
    }
  }
  return followups;
}

function readRules(rules: RawRules, questions: SurveyQuestion[]): SurveyRules {
  const labels =
    rules.strength_labels ??
    (rules.match_labels_draft ?? []).map((label) => ({
      label: label.label,
      min_percentage: label.min_percent,
    }));
  return {
    secondary_min_percentage:
      rules.secondary_min_percentage ?? rules.secondary_min_percent ?? 40,
    secondary_within_points_of_primary:
      rules.secondary_within_points_of_primary ??
      rules.secondary_within_percentage_points_of_primary ??
      20,
    strength_labels: labels,
    none_scores_zero: rules.none_scores_zero ?? true,
    intake_adds_points: rules.intake_adds_points ?? false,
    tie_followups: tieFollowups(rules, questions),
  };
}

const questions = (surveyFile.questions as RawQuestion[]).map(readQuestion);
const rules = readRules(surveyFile.rules as RawRules, questions);

function assertSurveyMatrix() {
  const categoryIds = new Set(listCategories().map((category) => category.id));
  for (const question of questions) {
    if (question.selection !== "single" && question.selection !== "multi") {
      throw new Error(`Question ${question.id} has an unknown selection mode.`);
    }
    for (const option of question.options) {
      if (option.category_id && !categoryIds.has(option.category_id)) {
        throw new Error(
          `Question ${question.id} option ${option.id} uses unknown category ${option.category_id}.`,
        );
      }
      if (option.category_id && !categoryById(option.category_id)) {
        throw new Error(`Missing category ${option.category_id}.`);
      }
    }
  }
  if (rules.intake_adds_points) {
    throw new Error("The survey matrix must not let the intake add points.");
  }
}

assertSurveyMatrix();

export function listQuestions(): SurveyQuestion[] {
  return questions;
}

export function questionById(id: string): SurveyQuestion | undefined {
  return questions.find((question) => question.id === id);
}

export function surveyRules(): SurveyRules {
  return rules;
}
