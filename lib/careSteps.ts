import careStepsFile from "../data/care-steps.json";
import sourcesFile from "../data/sources.json";
import { categoryIds, type AgeBand } from "./catalog";
import { DRAFT_STEP_LABEL, SHOW_DRAFT_STEPS } from "./copy";

const HIDDEN_CLAIMS = new Set(["unsupported", "contradicted"]);

export type LibraryStep = {
  step_id: string;
  category_id: string;
  order_hint: number;
  step_type: string;
  title: string;
  short_label: string;
  who_to_see: string;
  what_it_involves: string;
  why_it_may_help: string;
  safety_note: string;
  applies_to_ages: "13-17" | "18+" | "both";
  teen_note: string;
  source_title: string[];
  source_url: string[];
  evidence_level: string;
  clinician_status: string;
  clinician_notes: string;
  claim_verification: string;
};

export type StepSource = {
  title: string;
  url: string;
  limits: string;
};

const sourceLimits = new Map(
  (sourcesFile.sources as { url: string; supports_and_limits?: string; do_not_use?: boolean }[])
    .filter((source) => source.do_not_use !== true)
    .map((source) => [source.url, source.supports_and_limits ?? ""]),
);

const librarySteps = careStepsFile as LibraryStep[];

export function libraryStepsFor(categoryId: string, ageBand: AgeBand): LibraryStep[] {
  return librarySteps
    .filter((step) => step.category_id === categoryId)
    .filter((step) => !HIDDEN_CLAIMS.has(step.claim_verification))
    .filter(
      (step) => step.applies_to_ages === "both" || step.applies_to_ages === ageBand,
    )
    .sort((a, b) => a.order_hint - b.order_hint);
}

export function libraryStepSources(step: LibraryStep): StepSource[] {
  const count = Math.max(step.source_title.length, step.source_url.length);
  const sources: StepSource[] = [];
  for (let index = 0; index < count; index += 1) {
    const title = step.source_title[index] ?? "";
    const url = step.source_url[index] ?? "";
    if (title === "" && url === "") {
      continue;
    }
    sources.push({ title, url, limits: sourceLimits.get(url) ?? "" });
  }
  return sources;
}

export function libraryStepById(stepId: string | null | undefined): LibraryStep | null {
  if (!stepId) {
    return null;
  }
  return librarySteps.find((step) => step.step_id === stepId) ?? null;
}

export function libraryStepType(stepId: string | null | undefined): string | null {
  return libraryStepById(stepId)?.step_type ?? null;
}

export function visibleLibraryStepSources(step: LibraryStep): StepSource[] {
  if (HIDDEN_CLAIMS.has(step.claim_verification)) {
    return [];
  }
  return libraryStepSources(step);
}

export function draftLabelFor(step: LibraryStep): string | null {
  if (!SHOW_DRAFT_STEPS || step.clinician_status !== "draft") {
    return null;
  }
  return DRAFT_STEP_LABEL;
}

export function libraryBrief(ageBand: AgeBand): string {
  const lines: string[] = [];
  for (const categoryId of categoryIds()) {
    const steps = libraryStepsFor(categoryId, ageBand);
    if (steps.length === 0) {
      lines.push(`- ${categoryId}: no library steps for this age`);
      continue;
    }
    for (const step of steps) {
      lines.push(
        `- step_id ${step.step_id} | category ${step.category_id} | order ${step.order_hint} | who ${step.who_to_see} | ${step.title}`,
      );
    }
  }
  return lines.join("\n");
}
