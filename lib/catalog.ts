import categoriesFile from "../data/categories.json";
import sourcesFile from "../data/sources.json";

export type AgeBand = "13-17" | "18+";

export type CategorySource = {
  name: string;
  url: string;
  applies_to: AgeBand[];
};

export type PractitionerTypeDraft = {
  id: string;
  label: string;
};

export type Category = {
  id: string;
  patient_label: string;
  mechanism: string | null;
  typical_features: string;
  distinguishing_factors: string;
  practitioner_types_draft: PractitionerTypeDraft[];
  source_ids: string[];
  teen_note: string;
  review_note: string;
};

type RawCategory = {
  id: string;
  patient_label: string;
  mechanism: string | null;
  typical_features?: string;
  distinguishing_factors?: string;
  practitioner_types?: string[];
  source_ids?: string[];
};

type RawSource = {
  id: string;
  title: string;
  url: string;
  type_and_population: string;
  do_not_use: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  gp_family_physician: "GP or family physician",
  sports_medicine_physician: "Sports medicine physician",
  vestibular_physio: "Vestibular physiotherapist",
  physiotherapist: "Physiotherapist",
  optometrist: "Optometrist",
  vision_therapist: "Vision therapist",
  sleep_specialist: "Sleep specialist",
  psychologist: "Psychologist",
};

const rawCategories = categoriesFile.categories as RawCategory[];
const rawSources = sourcesFile.sources as RawSource[];

function practitionerDraft(id: string): PractitionerTypeDraft {
  return { id, label: TYPE_LABELS[id] ?? id.replaceAll("_", " ") };
}

const categories: Category[] = rawCategories.map((category) => ({
  id: category.id,
  patient_label: category.patient_label,
  mechanism: category.mechanism,
  typical_features: category.typical_features ?? "",
  distinguishing_factors: category.distinguishing_factors ?? "",
  practitioner_types_draft: (category.practitioner_types ?? []).map(practitionerDraft),
  source_ids: category.source_ids ?? [],
  teen_note: "",
  review_note: "",
}));

function sourceAges(population: string): AgeBand[] {
  const text = population.toLowerCase();
  const explicitlyAdult =
    text.includes("adult-oriented") || text.includes("adult clinical");
  const explicitlyYoung =
    /children|adolescent|youth|11[–-]25|(?<!not )pediatric/.test(text);
  if (explicitlyAdult && !explicitlyYoung) {
    return ["18+"];
  }
  if (text.includes("not pediatric")) {
    return ["18+"];
  }
  if (text.includes("pediatric") && !text.includes("adult")) {
    return ["13-17"];
  }
  return ["13-17", "18+"];
}

const sourcesById = new Map(
  rawSources
    .filter((source) => !source.do_not_use)
    .map((source) => [
      source.id,
      {
        name: source.title,
        url: source.url,
        applies_to: sourceAges(source.type_and_population),
      } satisfies CategorySource,
    ]),
);

export function listCategories(): Category[] {
  return categories;
}

export function categoryById(id: string): Category | undefined {
  return categories.find((category) => category.id === id);
}

export function categoryIds(): [string, ...string[]] {
  const ids = categories.map((category) => category.id);
  if (ids.length === 0) {
    throw new Error("data/categories.json has no categories.");
  }
  return [ids[0], ...ids.slice(1)];
}

export function practitionerTypeIds(): [string, ...string[]] {
  const ids: string[] = [];
  for (const category of categories) {
    for (const type of category.practitioner_types_draft) {
      if (!ids.includes(type.id)) {
        ids.push(type.id);
      }
    }
  }
  if (ids.length === 0) {
    throw new Error("data/categories.json has no practitioner types.");
  }
  return [ids[0], ...ids.slice(1)];
}

export function practitionerTypesFor(categoryId: string): string[] {
  return (
    categoryById(categoryId)?.practitioner_types_draft.map((type) => type.id) ??
    []
  );
}

export function practitionerTypeLabel(id: string): string {
  return TYPE_LABELS[id] ?? id.replaceAll("_", " ");
}

export function categoryDescription(category: Category): string {
  const features = category.typical_features.trim();
  return features !== "" ? features : category.patient_label;
}

export function sourcesFor(category: Category, ageBand: AgeBand): CategorySource[] {
  const sources: CategorySource[] = [];
  for (const sourceId of category.source_ids) {
    const source = sourcesById.get(sourceId);
    if (source && source.applies_to.includes(ageBand)) {
      sources.push(source);
    }
  }
  return sources;
}

export function evidenceBadge(category: Category, ageBand: AgeBand): string {
  if (ageBand === "13-17") {
    return "Pending clinician review";
  }
  const sources = sourcesFor(category, ageBand);
  if (sources.some((source) => /guideline|consensus/i.test(source.name))) {
    return "Guideline";
  }
  if (sources.length > 0) {
    return "Research";
  }
  return "Pending clinician review";
}

export function whoToRaiseWith(category: Category, ageBand: AgeBand): string {
  const label = category.practitioner_types_draft[0]?.label ?? "clinician";
  const topic = category.patient_label.toLowerCase();
  if (ageBand === "13-17") {
    return `A ${label} can help a parent or guardian describe what the teen notices about ${topic}, so a pediatric clinician can review it. This visit is for those details, not a treatment plan.`;
  }
  return `A ${label} can help you describe what you notice about ${topic}, so a GP can review it. This visit is for those details, not a treatment plan.`;
}
