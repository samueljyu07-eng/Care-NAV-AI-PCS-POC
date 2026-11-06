import { categoryById, practitionerTypeLabel } from "../catalog";
import { libraryStepById } from "../careSteps";
import { pathwayColor } from "../pathwayColors";
import { formatPercentage, type CategoryScore, type ScoreResult, type SurveyAnswer } from "../scoring";
import { questionById } from "../surveyMatrix";

export type ResultsFile = {
  kind: "results-file";
  capturedAt: string;
  view: {
    showAllPatterns: boolean;
    treeDetail: "simple" | "detailed";
  };
  intake: {
    ageBand: "13-17" | "18+" | null;
    ageLabel: string;
    city: string;
    timeline: string;
    symptoms: string[];
    symptomText: string;
    concerns: string;
    pastAttempts: string;
  } | null;
  survey: {
    questionId: string;
    summary: string;
    questionText: string;
    selection: "single" | "multi";
    selected: { optionId: string; text: string }[];
  }[];
  scores: {
    primaryIds: string[];
    secondaryIds: string[];
    tie: boolean;
    followUpQuestionIds: string[];
    categories: {
      categoryId: string;
      label: string;
      scoreText: string;
      points: number;
      maxPoints: number;
      percentage: number;
      strengthLabel: string | null;
      role: CategoryScore["role"];
      drivers: {
        questionId: string;
        questionText: string;
        optionId: string;
        optionText: string;
        weight: number;
      }[];
    }[];
  } | null;
  journal: {
    note: string | null;
    entries: { date: string; severities: Record<string, number>; updatedAt: string }[];
  };
  notices: {
    draftBanner: string | null;
    teenNote: string | null;
    disclaimer: string;
    footer: string;
    refineNote: string | null;
  };
  pathways: {
    categoryId: string;
    name: string;
    evidenceBadge: string;
    whyItMayApply: string;
    scoreText: string | null;
    percentage: number | null;
    points: number | null;
    maxPoints: number | null;
    strengthLabel: string | null;
    role: string | null;
    note: string | null;
    sources: { name: string; url: string }[];
    color: { background: string; border: string };
    shownOnPage: boolean;
    steps: {
      order: number;
      stepId: string | null;
      title: string;
      shortLabel: string;
      practitionerTypeId: string;
      practitionerTypeLabel: string;
      rationale: string;
      safetyNote: string;
      draftLabel: string | null;
      sources: { title: string; url: string; limits: string }[];
    }[];
  }[];
};

export type ResultsFileInput = {
  capturedAt: string;
  showAllPatterns: boolean;
  treeDetail: "simple" | "detailed";
  intake: ResultsFile["intake"];
  surveyAnswers: SurveyAnswer[];
  scores: ScoreResult | null;
  journalNote: string | null;
  journalEntries: ResultsFile["journal"]["entries"];
  refineNote: string | null;
  draftBanner: string | null;
  teenNote: string | null;
  disclaimer: string;
  footer: string;
  visibleCategoryIds: string[];
  pathways: {
    category_id: string;
    name: string;
    evidence_badge: string;
    why_it_may_apply: string;
    note: string | null;
    sources: { name: string; url: string }[];
    scoreText?: string | null;
    percentage?: number;
    points?: number;
    max_points?: number;
    strength_label?: string | null;
    role?: string | null;
    steps: {
      order: number;
      title: string;
      practitioner_type: string;
      rationale: string;
      step_id: string | null;
      draft_label: string | null;
      safety_note: string;
      sources: { title: string; url: string; limits: string }[];
    }[];
  }[];
};

export function scoreLine(score: CategoryScore): string {
  const percent = formatPercentage(score.percentage);
  const points = `${score.points} of ${score.max_points}`;
  if (!score.strength_label) {
    return `${points} · ${percent}`;
  }
  return `${score.strength_label} · ${points} · ${percent}`;
}

export function buildResultsFile(input: ResultsFileInput): ResultsFile {
  const visible = new Set(input.visibleCategoryIds);
  return {
    kind: "results-file",
    capturedAt: input.capturedAt,
    view: {
      showAllPatterns: input.showAllPatterns,
      treeDetail: input.treeDetail,
    },
    intake: input.intake,
    survey: input.surveyAnswers.map((answer) => {
      const question = questionById(answer.question_id);
      const selectedIds = new Set(answer.option_ids);
      return {
        questionId: answer.question_id,
        summary: question?.summary ?? "",
        questionText: question?.text ?? "",
        selection: question?.selection ?? "single",
        selected: (question?.options ?? [])
          .filter((option) => selectedIds.has(option.id))
          .map((option) => ({ optionId: option.id, text: option.text })),
      };
    }),
    scores: input.scores
      ? {
          primaryIds: input.scores.primary_ids,
          secondaryIds: input.scores.secondary_ids,
          tie: input.scores.tie,
          followUpQuestionIds: input.scores.follow_up_question_ids,
          categories: input.scores.categories.map((category) => ({
            categoryId: category.category_id,
            label: categoryById(category.category_id)?.patient_label ?? category.category_id,
            scoreText: scoreLine(category),
            points: category.points,
            maxPoints: category.max_points,
            percentage: category.percentage,
            strengthLabel: category.strength_label,
            role: category.role,
            drivers: category.drivers.map((driver) => ({
              questionId: driver.question_id,
              questionText: driver.question_text,
              optionId: driver.option_id,
              optionText: driver.option_text,
              weight: driver.weight,
            })),
          })),
        }
      : null,
    journal: {
      note: input.journalNote,
      entries: input.journalEntries,
    },
    notices: {
      draftBanner: input.draftBanner,
      teenNote: input.teenNote,
      disclaimer: input.disclaimer,
      footer: input.footer,
      refineNote: input.refineNote,
    },
    pathways: input.pathways.map((pathway) => ({
      categoryId: pathway.category_id,
      name: pathway.name,
      evidenceBadge: pathway.evidence_badge,
      whyItMayApply: pathway.why_it_may_apply,
      scoreText: pathway.scoreText ?? null,
      percentage: typeof pathway.percentage === "number" ? pathway.percentage : null,
      points: typeof pathway.points === "number" ? pathway.points : null,
      maxPoints: typeof pathway.max_points === "number" ? pathway.max_points : null,
      strengthLabel: pathway.strength_label ?? null,
      role: pathway.role ?? null,
      note: pathway.note,
      sources: pathway.sources,
      color: pathwayColor(pathway.name),
      shownOnPage: visible.has(pathway.category_id),
      steps: [...pathway.steps]
        .sort((left, right) => left.order - right.order)
        .map((step) => ({
          order: step.order,
          stepId: step.step_id,
          title: step.title,
          shortLabel: libraryStepById(step.step_id)?.short_label ?? "",
          practitionerTypeId: step.practitioner_type,
          practitionerTypeLabel: practitionerTypeLabel(step.practitioner_type),
          rationale: step.rationale,
          safetyNote: step.safety_note,
          draftLabel: step.draft_label,
          sources: step.sources,
        })),
    })),
  };
}
