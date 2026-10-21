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

const questions = surveyFile.questions as SurveyQuestion[];
const rules = surveyFile.rules as SurveyRules;

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
