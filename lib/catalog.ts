import categoriesFile from "../data/categories.json";

export type AgeBand = "13-17" | "18+";

export type CategorySource = {
  name: string;
  url: string;
  applies_to: string[];
};

export type PractitionerTypeDraft = {
  id: string;
  label: string;
};

export type Category = {
  id: string;
  patient_label: string;
  possible_mechanism: string;
  evidence_level: string;
  evidence_level_label: string;
  evidence_applies_to: string[];
  fallback_evidence_label: string;
  sources: CategorySource[];
  practitioner_types_draft: PractitionerTypeDraft[];
  who_to_raise_with: {
    adult: string;
    teen: string;
  };
  teen_note: string;
  review_note: string;
};

const categories = categoriesFile.categories as Category[];

const ADDED_PRACTITIONER_TYPES = [
  { id: "gp_family_physician", label: "GP or family physician" },
] as const;

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
  for (const type of ADDED_PRACTITIONER_TYPES) {
    if (!ids.includes(type.id)) {
      ids.push(type.id);
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
  const added = ADDED_PRACTITIONER_TYPES.find((type) => type.id === id);
  if (added) {
    return added.label;
  }
  for (const category of categories) {
    const match = category.practitioner_types_draft.find((type) => type.id === id);
    if (match) {
      return match.label;
    }
  }
  return id.replaceAll("_", " ");
}

export function sourcesFor(category: Category, ageBand: AgeBand): CategorySource[] {
  return category.sources.filter((source) => source.applies_to.includes(ageBand));
}

export function evidenceBadge(category: Category, ageBand: AgeBand): string {
  if (!category.evidence_applies_to.includes(ageBand)) {
    return category.fallback_evidence_label;
  }
  return category.evidence_level_label;
}

export function whoToRaiseWith(category: Category, ageBand: AgeBand): string {
  return ageBand === "13-17"
    ? category.who_to_raise_with.teen
    : category.who_to_raise_with.adult;
}
