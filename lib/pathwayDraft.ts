import {
  categoryById,
  evidenceBadge,
  practitionerTypesFor,
  sourcesFor,
  whoToRaiseWith,
  type AgeBand,
} from "./catalog";
import { questionById } from "./surveyMatrix";
import { categoriesForSymptoms, symptomsForCategory } from "./surveyPlan";
import {
  formatPercentage,
  type CategoryScore,
  type ScoreResult,
} from "./scoring";

export type DraftStep = {
  order: number;
  title: string;
  practitioner_type: string;
  rationale: string;
};

export type DraftPathway = {
  category_id: string;
  why_it_may_apply: string;
  steps: DraftStep[];
};

export type PresentedPathway = DraftPathway & {
  name: string;
  evidence_badge: string;
  sources: { name: string; url: string }[];
  note: string | null;
};

export type DisplayPathway = PresentedPathway & {
  percentage: number;
  percentage_label: string;
  points: number;
  max_points: number;
  strength_label: string | null;
  role: CategoryScore["role"];
  drivers: CategoryScore["drivers"];
};

const PROVISIONAL_LIMIT = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function fallbackPathway(categoryId: string, ageBand: AgeBand): DraftPathway | null {
  const category = categoryById(categoryId);
  const type = category?.practitioner_types_draft[0];
  if (!category || !type) {
    return null;
  }
  return {
    category_id: category.id,
    why_it_may_apply: category.possible_mechanism,
    steps: [
      {
        order: 1,
        title: `Talk with a ${type.label.toLowerCase()}`,
        practitioner_type: type.id,
        rationale: whoToRaiseWith(category, ageBand),
      },
    ],
  };
}

function readStep(value: unknown, categoryId: string): DraftStep | null {
  if (!isRecord(value)) {
    return null;
  }
  const practitionerType = value.practitioner_type;
  if (
    typeof value.title !== "string" ||
    typeof value.rationale !== "string" ||
    typeof practitionerType !== "string" ||
    value.title.trim() === "" ||
    value.rationale.trim() === "" ||
    !practitionerTypesFor(categoryId).includes(practitionerType)
  ) {
    return null;
  }
  return {
    order: 0,
    title: value.title.trim(),
    practitioner_type: practitionerType,
    rationale: value.rationale.trim(),
  };
}

function readPathway(value: unknown, ageBand: AgeBand): DraftPathway | null {
  if (!isRecord(value) || typeof value.category_id !== "string") {
    return null;
  }
  const category = categoryById(value.category_id);
  if (!category) {
    return null;
  }
  const rawSteps = Array.isArray(value.steps) ? value.steps : [];
  const steps = rawSteps
    .map((step) => readStep(step, category.id))
    .filter((step): step is DraftStep => step !== null)
    .map((step, index) => ({ ...step, order: index + 1 }));
  const written =
    typeof value.why_it_may_apply === "string" ? value.why_it_may_apply.trim() : "";
  const whyItMayApply = written !== "" ? written : category.possible_mechanism;
  if (steps.length === 0) {
    const fallback = fallbackPathway(category.id, ageBand);
    if (!fallback) {
      return null;
    }
    return written !== "" ? { ...fallback, why_it_may_apply: written } : fallback;
  }
  return {
    category_id: category.id,
    why_it_may_apply: whyItMayApply,
    steps,
  };
}

export function demoPathways(symptoms: string[], ageBand: AgeBand): DraftPathway[] {
  const pathways: DraftPathway[] = [];
  for (const categoryId of categoriesForSymptoms(symptoms)) {
    const category = categoryById(categoryId);
    const draft = fallbackPathway(categoryId, ageBand);
    if (!category || !draft) {
      continue;
    }
    const noted = symptomsForCategory(symptoms, categoryId);
    draft.why_it_may_apply =
      noted.length > 0
        ? `You noted ${noted.join(", ")}. ${category.possible_mechanism}`
        : category.possible_mechanism;
    pathways.push(draft);
    if (pathways.length === PROVISIONAL_LIMIT) {
      break;
    }
  }
  return pathways;
}

export function presentPathway(draft: DraftPathway, ageBand: AgeBand): PresentedPathway | null {
  const category = categoryById(draft.category_id);
  if (!category) {
    return null;
  }
  const notes = [
    ageBand === "13-17" ? category.teen_note : "",
    category.review_note,
  ].filter((note) => note.trim() !== "");
  return {
    ...draft,
    name: category.patient_label,
    evidence_badge: evidenceBadge(category, ageBand),
    sources: sourcesFor(category, ageBand).map((source) => ({
      name: source.name,
      url: source.url,
    })),
    note: notes.length > 0 ? notes.join(" ") : null,
  };
}

export function presentPathways(drafts: DraftPathway[], ageBand: AgeBand): PresentedPathway[] {
  return drafts
    .map((draft) => presentPathway(draft, ageBand))
    .filter((pathway): pathway is PresentedPathway => pathway !== null);
}

export function sanitizeProvisional(value: unknown, ageBand: AgeBand): DraftPathway[] {
  if (!isRecord(value) || !Array.isArray(value.pathways)) {
    return [];
  }
  const seen = new Set<string>();
  const pathways: DraftPathway[] = [];
  for (const item of value.pathways) {
    const pathway = readPathway(item, ageBand);
    if (!pathway || seen.has(pathway.category_id)) {
      continue;
    }
    seen.add(pathway.category_id);
    pathways.push(pathway);
    if (pathways.length === PROVISIONAL_LIMIT) {
      break;
    }
  }
  return pathways;
}

function narrativePathways(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value) || !Array.isArray(value.pathways)) {
    return [];
  }
  return value.pathways.filter(isRecord);
}

export function displayFromScore(
  score: CategoryScore,
  narrative: DraftPathway | null,
  ageBand: AgeBand,
): DisplayPathway | null {
  const category = categoryById(score.category_id);
  if (!category || score.role === "unmatched") {
    return null;
  }
  const draft = narrative ?? fallbackPathway(category.id, ageBand);
  if (!draft) {
    return null;
  }
  const presented = presentPathway(draft, ageBand);
  if (!presented) {
    return null;
  }
  return {
    ...presented,
    percentage: score.percentage,
    percentage_label: formatPercentage(score.percentage),
    points: score.points,
    max_points: score.max_points,
    strength_label: score.strength_label,
    role: score.role,
    drivers: score.drivers,
  };
}

export function mergeNarratives(
  result: ScoreResult,
  narrative: unknown,
  ageBand: AgeBand,
): DisplayPathway[] {
  const allowed = new Set(result.displayed.map((score) => score.category_id));
  const byId = new Map<string, DraftPathway>();
  for (const item of narrativePathways(narrative)) {
    if (typeof item.category_id !== "string" || !allowed.has(item.category_id)) {
      continue;
    }
    const pathway = readPathway(item, ageBand);
    if (pathway) {
      byId.set(pathway.category_id, pathway);
    }
  }

  const aiOrder = narrativePathways(narrative)
    .map((item) => item.category_id)
    .filter((id): id is string => typeof id === "string" && allowed.has(id));
  const seen = new Set<string>();
  const orderedIds: string[] = [];
  for (const id of aiOrder) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    orderedIds.push(id);
  }
  for (const score of result.displayed) {
    if (!seen.has(score.category_id)) {
      orderedIds.push(score.category_id);
    }
  }

  return orderedIds
    .map((id) => {
      const score = result.displayed.find((item) => item.category_id === id);
      if (!score) {
        return null;
      }
      return displayFromScore(score, byId.get(id) ?? null, ageBand);
    })
    .filter((pathway): pathway is DisplayPathway => pathway !== null);
}

export function followUpQuestions(questionIds: string[]) {
  return questionIds
    .map((id) => questionById(id))
    .filter((question) => question !== undefined)
    .map((question) => ({ id: question.id, text: question.text }));
}
