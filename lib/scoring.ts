import { listCategories } from "./catalog";
import {
  listQuestions,
  surveyRules,
  type SurveyOption,
  type SurveyQuestion,
} from "./surveyMatrix";

export type SurveyAnswer = {
  question_id: string;
  option_ids: string[];
};

export type ScoreDriver = {
  question_id: string;
  question_text: string;
  option_id: string;
  option_text: string;
  weight: number;
};

export type ScoreRole = "primary" | "co-primary" | "secondary" | "unmatched";

export type CategoryScore = {
  category_id: string;
  points: number;
  max_points: number;
  percentage: number;
  strength_label: string | null;
  role: ScoreRole;
  drivers: ScoreDriver[];
};

export type ScoreResult = {
  categories: CategoryScore[];
  primary_ids: string[];
  secondary_ids: string[];
  tie: boolean;
  follow_up_question_ids: string[];
  displayed: CategoryScore[];
};

const TIE_EPSILON = 1e-9;

function scoringOptions(question: SurveyQuestion, categoryId: string): SurveyOption[] {
  return question.options.filter(
    (option) =>
      !option.exclusive &&
      option.category_id === categoryId &&
      option.weight > 0,
  );
}

export function categoryMaxPoints(categoryId: string): number {
  let total = 0;
  for (const question of listQuestions()) {
    const options = scoringOptions(question, categoryId);
    if (options.length === 0) {
      continue;
    }
    if (question.selection === "single") {
      total += Math.max(...options.map((option) => option.weight));
    } else {
      total += options.reduce((sum, option) => sum + option.weight, 0);
    }
  }
  return total;
}

function strengthLabel(percentage: number): string | null {
  const labels = [...surveyRules().strength_labels].sort(
    (left, right) => right.min_percentage - left.min_percentage,
  );
  for (const label of labels) {
    if (percentage + TIE_EPSILON >= label.min_percentage) {
      return label.label;
    }
  }
  return null;
}

export function formatPercentage(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${rounded}%`;
  }
  return `${rounded.toFixed(1)}%`;
}

function selectedOptions(
  question: SurveyQuestion,
  optionIds: string[],
): SurveyOption[] {
  const wanted = new Set(optionIds);
  return question.options.filter((option) => wanted.has(option.id));
}

function driversFor(
  question: SurveyQuestion,
  optionIds: string[],
  categoryId: string,
): ScoreDriver[] {
  const selected = selectedOptions(question, optionIds);
  if (selected.some((option) => option.exclusive)) {
    return [];
  }
  let counted = selected.filter(
    (option) => !option.exclusive && option.category_id === categoryId,
  );
  if (question.selection === "single") {
    counted = counted.slice(0, 1);
  }
  return counted.map((option) => ({
    question_id: question.id,
    question_text: question.text,
    option_id: option.id,
    option_text: option.text,
    weight: option.weight,
  }));
}

function categoriesCovered(
  question: SurveyQuestion,
  tied: Set<string>,
): Set<string> {
  const scoring = question.options.filter(
    (option) =>
      !option.exclusive && option.category_id !== null && option.weight > 0,
  );
  if (
    scoring.length === 0 ||
    scoring.some((option) => !tied.has(option.category_id as string))
  ) {
    return new Set();
  }
  return new Set(scoring.map((option) => option.category_id as string));
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
  }
  return unique;
}

export function followUpQuestionIds(tiedCategoryIds: string[]): string[] {
  if (tiedCategoryIds.length < 2) {
    return [];
  }
  const tied = new Set(tiedCategoryIds);
  const ids: string[] = [];
  for (const rule of surveyRules().tie_followups) {
    if (
      rule.category_ids.length > 0 &&
      rule.category_ids.every((id) => tied.has(id))
    ) {
      ids.push(...rule.question_ids);
    }
  }
  const touching = listQuestions()
    .map((question) => ({
      id: question.id,
      covered: categoriesCovered(question, tied),
    }))
    .filter((question) => question.covered.size > 0);
  const spanning = touching.filter((question) => question.covered.size >= 2);
  const chosen = spanning.length > 0 ? spanning : touching;
  ids.push(...chosen.map((question) => question.id));
  return uniqueIds(ids);
}

function categoryOrder(categoryId: string): number {
  return listCategories().findIndex((category) => category.id === categoryId);
}

export function scoreSurvey(answers: SurveyAnswer[]): ScoreResult {
  const byQuestion = new Map(
    answers.map((answer) => [answer.question_id, answer.option_ids]),
  );
  const categories = listCategories().map((category) => {
    const drivers = listQuestions().flatMap((question) =>
      driversFor(question, byQuestion.get(question.id) ?? [], category.id),
    );
    const points = drivers.reduce((sum, driver) => sum + driver.weight, 0);
    const maxPoints = categoryMaxPoints(category.id);
    const percentage = maxPoints <= 0 ? 0 : (points / maxPoints) * 100;
    return {
      category_id: category.id,
      points,
      max_points: maxPoints,
      percentage,
      strength_label: strengthLabel(percentage),
      role: "unmatched" as ScoreRole,
      drivers,
    };
  });

  const ranked = categories
    .filter((category) => category.percentage > 0)
    .sort(
      (left, right) =>
        right.percentage - left.percentage ||
        categoryOrder(left.category_id) - categoryOrder(right.category_id),
    );

  if (ranked.length === 0) {
    return {
      categories,
      primary_ids: [],
      secondary_ids: [],
      tie: false,
      follow_up_question_ids: [],
      displayed: [],
    };
  }

  const top = ranked[0].percentage;
  const primaryIds = ranked
    .filter((category) => Math.abs(category.percentage - top) < TIE_EPSILON)
    .map((category) => category.category_id);
  const primaryRole: ScoreRole = primaryIds.length > 1 ? "co-primary" : "primary";
  const rules = surveyRules();
  const within = rules.secondary_within_points_of_primary;
  const minimum = rules.secondary_min_percentage;

  for (const category of categories) {
    if (primaryIds.includes(category.category_id)) {
      category.role = primaryRole;
      continue;
    }
    if (
      category.percentage > 0 &&
      (category.percentage + TIE_EPSILON >= minimum ||
        category.percentage + TIE_EPSILON >= top - within)
    ) {
      category.role = "secondary";
    }
  }

  const displayed = categories
    .filter((category) => category.role !== "unmatched")
    .sort((left, right) => {
      const roleOrder = (role: ScoreRole) => (role === "secondary" ? 1 : 0);
      return (
        roleOrder(left.role) - roleOrder(right.role) ||
        right.percentage - left.percentage ||
        categoryOrder(left.category_id) - categoryOrder(right.category_id)
      );
    });

  return {
    categories,
    primary_ids: primaryIds,
    secondary_ids: categories
      .filter((category) => category.role === "secondary")
      .map((category) => category.category_id),
    tie: primaryIds.length > 1,
    follow_up_question_ids: followUpQuestionIds(primaryIds),
    displayed,
  };
}
