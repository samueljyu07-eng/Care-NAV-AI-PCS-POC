import {
  draftLabelFor,
  libraryStepSources,
  libraryStepsFor,
  type LibraryStep,
} from "./careSteps";
import {
  categoryById,
  categoryDescription,
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
  step_id: string | null;
  from_library: boolean;
  draft_label: string | null;
  safety_note: string;
  sources: { title: string; url: string; limits: string }[];
};

const MAX_STEPS = 4;
const MIN_LIBRARY_STEPS = 2;

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

function blankAuthoredStep(step: {
  title: string;
  practitioner_type: string;
  rationale: string;
}): DraftStep {
  return {
    order: 0,
    title: step.title,
    practitioner_type: step.practitioner_type,
    rationale: step.rationale,
    step_id: null,
    from_library: false,
    draft_label: null,
    safety_note: "",
    sources: [],
  };
}

function draftFromLibrary(step: LibraryStep): DraftStep {
  return {
    order: step.order_hint,
    title: step.title,
    practitioner_type: step.who_to_see,
    rationale: step.why_it_may_help,
    step_id: step.step_id,
    from_library: true,
    draft_label: draftLabelFor(step),
    safety_note: step.safety_note,
    sources: libraryStepSources(step),
  };
}

export function fallbackPathway(categoryId: string, ageBand: AgeBand): DraftPathway | null {
  const category = categoryById(categoryId);
  const type = category?.practitioner_types_draft[0];
  if (!category || !type) {
    return null;
  }
  const library = libraryStepsFor(category.id, ageBand)
    .slice(0, MAX_STEPS)
    .map((step, index) => ({ ...draftFromLibrary(step), order: index + 1 }));
  return {
    category_id: category.id,
    why_it_may_apply: categoryDescription(category),
    steps:
      library.length > 0
        ? library
        : [
            {
              ...blankAuthoredStep({
                title: `Talk with a ${type.label.toLowerCase()}`,
                practitioner_type: type.id,
                rationale: whoToRaiseWith(category, ageBand),
              }),
              order: 1,
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
  return blankAuthoredStep({
    title: value.title.trim(),
    practitioner_type: practitionerType,
    rationale: value.rationale.trim(),
  });
}

function assembleSteps(
  rawSteps: unknown[],
  categoryId: string,
  ageBand: AgeBand,
): DraftStep[] {
  const eligible = libraryStepsFor(categoryId, ageBand);
  const byId = new Map(eligible.map((step) => [step.step_id, step]));
  const selected: LibraryStep[] = [];
  const authored: DraftStep[] = [];

  for (const value of rawSteps) {
    if (!isRecord(value)) {
      continue;
    }
    const stepId = typeof value.step_id === "string" ? value.step_id.trim() : "";
    if (stepId !== "") {
      const libraryStep = byId.get(stepId);
      if (libraryStep && !selected.some((step) => step.step_id === stepId)) {
        selected.push(libraryStep);
      }
      continue;
    }
    const written = readStep(value, categoryId);
    if (written) {
      authored.push(written);
    }
  }

  let library = [...selected].sort((a, b) => a.order_hint - b.order_hint);
  if (library.length === 0) {
    library = eligible.slice(0, MAX_STEPS);
  } else {
    for (const step of eligible) {
      if (library.length >= Math.min(MIN_LIBRARY_STEPS, eligible.length)) {
        break;
      }
      if (!library.some((item) => item.step_id === step.step_id)) {
        library.push(step);
      }
    }
    library.sort((a, b) => a.order_hint - b.order_hint);
  }

  const libraryDrafts = library.slice(0, MAX_STEPS).map(draftFromLibrary);
  const room = MAX_STEPS - libraryDrafts.length;
  return [...libraryDrafts, ...authored.slice(0, room)].map((step, index) => ({
    ...step,
    order: index + 1,
  }));
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
  const steps = assembleSteps(rawSteps, category.id, ageBand);
  const written =
    typeof value.why_it_may_apply === "string" ? value.why_it_may_apply.trim() : "";
  const whyItMayApply = written !== "" ? written : categoryDescription(category);
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
        ? `You noted ${noted.join(", ")}. ${categoryDescription(category)}`
        : categoryDescription(category);
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
