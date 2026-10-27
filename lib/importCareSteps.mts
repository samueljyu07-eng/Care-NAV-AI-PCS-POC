import { z } from "zod";

export const CATEGORY_IDS = [
  "fatigue_activity",
  "exertional_symptoms",
  "neuroendocrine",
  "vestibular",
  "oculomotor",
  "sensory_peripheral",
] as const;

export const STEP_TYPES = [
  "assessment",
  "care",
  "self_management",
  "ask_your_gp",
] as const;

export const APPLIES_TO_AGES = ["13-17", "18+", "both"] as const;

export const EVIDENCE_LEVELS = ["guideline_supported", "emerging"] as const;

export const CLINICIAN_STATUSES = ["draft"] as const;

export const CLAIM_VERIFICATIONS = [
  "supported",
  "partially supported",
  "scope-limited",
  "unsupported",
  "contradicted",
] as const;

export const AGE_BANDS = ["13-17", "18+"] as const;

const COLUMNS = [
  "step_id",
  "category_id",
  "order_hint",
  "step_type",
  "title",
  "short_label",
  "who_to_see",
  "what_it_involves",
  "why_it_may_help",
  "safety_note",
  "applies_to_ages",
  "teen_note",
  "source_title",
  "source_url",
  "evidence_level",
  "clinician_status",
  "clinician_notes",
  "claim_verification",
] as const;

export type AgeBand = (typeof AGE_BANDS)[number];

export type CareStep = {
  step_id: string;
  category_id: (typeof CATEGORY_IDS)[number];
  order_hint: number;
  step_type: (typeof STEP_TYPES)[number];
  title: string;
  short_label: string;
  who_to_see: string;
  what_it_involves: string;
  why_it_may_help: string;
  safety_note: string;
  applies_to_ages: (typeof APPLIES_TO_AGES)[number];
  teen_note: string;
  source_title: string[];
  source_url: string[];
  evidence_level: (typeof EVIDENCE_LEVELS)[number];
  clinician_status: (typeof CLINICIAN_STATUSES)[number];
  clinician_notes: string;
  claim_verification: (typeof CLAIM_VERIFICATIONS)[number];
};

export type StepCount = {
  categoryId: (typeof CATEGORY_IDS)[number];
  ageBand: AgeBand;
  count: number;
};

export type SourceRecord = {
  url: string;
  do_not_use?: boolean;
};

export type ImportResult = {
  steps: CareStep[];
  errors: string[];
  warnings: string[];
  counts: StepCount[];
};

const SOURCE_SEPARATOR = " ; ";

export function splitSourceField(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed === "") {
    return [];
  }
  // Titles in the sheet are separated by "; ". URLs use " ; ".
  return trimmed
    .split(SOURCE_SEPARATOR)
    .flatMap((part) => part.split("; "))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function practitionerTypesFromCategories(file: {
  categories?: { practitioner_types?: string[] }[];
}): string[] {
  const ids: string[] = [];
  for (const category of file.categories ?? []) {
    for (const id of category.practitioner_types ?? []) {
      if (!ids.includes(id)) {
        ids.push(id);
      }
    }
  }
  return ids;
}

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    field += char;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }
  }

  const [header, ...body] = rows;
  return { header: header ?? [], rows: body };
}

function stepSchema(practitionerTypes: readonly string[]) {
  return z
    .object({
      step_id: z.string().trim().min(1, "step_id is required"),
      category_id: z.enum(CATEGORY_IDS),
      order_hint: z
        .string()
        .trim()
        .regex(/^-?\d+$/, "order_hint must be a whole number")
        .transform(Number),
      step_type: z.enum(STEP_TYPES),
      title: z.string(),
      short_label: z.string().trim().min(1, "short_label is required"),
      who_to_see: z.string().refine((value) => practitionerTypes.includes(value), {
        message: "must be a known practitioner type",
      }),
      what_it_involves: z.string(),
      why_it_may_help: z.string(),
      safety_note: z.string(),
      applies_to_ages: z.enum(APPLIES_TO_AGES),
      teen_note: z.string(),
      source_title: z.array(z.string()),
      source_url: z.array(z.string()),
      evidence_level: z.enum(EVIDENCE_LEVELS),
      clinician_status: z.enum(CLINICIAN_STATUSES),
      clinician_notes: z.string(),
      claim_verification: z.enum(CLAIM_VERIFICATIONS),
    })
    .superRefine((step, context) => {
      if (step.step_type === "self_management" && step.safety_note.trim() === "") {
        context.addIssue({
          code: "custom",
          message: "is required for self_management",
          path: ["safety_note"],
        });
      }
    });
}

function bandsFor(appliesTo: CareStep["applies_to_ages"]): AgeBand[] {
  if (appliesTo === "both") {
    return ["13-17", "18+"];
  }
  return [appliesTo];
}

function countSteps(steps: CareStep[]): StepCount[] {
  return CATEGORY_IDS.flatMap((categoryId) =>
    AGE_BANDS.map((ageBand) => ({
      categoryId,
      ageBand,
      count: steps.filter(
        (step) =>
          step.category_id === categoryId &&
          bandsFor(step.applies_to_ages).includes(ageBand),
      ).length,
    })),
  );
}

export function importCareSteps(
  csv: string,
  context: {
    sources: SourceRecord[];
    practitionerTypes: readonly string[];
  },
): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsedTable = parseCsv(csv);

  if (parsedTable.header.length === 0) {
    return { steps: [], errors: ["CSV has no header row."], warnings, counts: countSteps([]) };
  }

  const missing = COLUMNS.filter((column) => !parsedTable.header.includes(column));
  if (missing.length > 0) {
    return {
      steps: [],
      errors: [`CSV is missing columns: ${missing.join(", ")}`],
      warnings,
      counts: countSteps([]),
    };
  }

  const columnIndex = new Map(parsedTable.header.map((name, index) => [name, index]));
  const sourcesByUrl = new Map<string, boolean[]>();
  for (const source of context.sources) {
    const flags = sourcesByUrl.get(source.url) ?? [];
    flags.push(source.do_not_use === true);
    sourcesByUrl.set(source.url, flags);
  }

  const schema = stepSchema(context.practitionerTypes);
  const steps: CareStep[] = [];
  const seenIds = new Map<string, number>();

  for (const cells of parsedTable.rows) {
    const read = (column: (typeof COLUMNS)[number]) =>
      cells[columnIndex.get(column) ?? -1] ?? "";
    const stepId = read("step_id").trim();
    if (stepId.startsWith("EX-")) {
      continue;
    }

    seenIds.set(stepId, (seenIds.get(stepId) ?? 0) + 1);
    const label = stepId === "" ? "(missing step_id)" : stepId;
    const candidate = {
      step_id: read("step_id"),
      category_id: read("category_id").trim(),
      order_hint: read("order_hint"),
      step_type: read("step_type").trim(),
      title: read("title"),
      short_label: read("short_label"),
      who_to_see: read("who_to_see").trim(),
      what_it_involves: read("what_it_involves"),
      why_it_may_help: read("why_it_may_help"),
      safety_note: read("safety_note"),
      applies_to_ages: read("applies_to_ages").trim(),
      teen_note: read("teen_note"),
      source_title: splitSourceField(read("source_title")),
      source_url: splitSourceField(read("source_url")),
      evidence_level: read("evidence_level").trim(),
      clinician_status: read("clinician_status").trim(),
      clinician_notes: read("clinician_notes"),
      claim_verification: read("claim_verification").trim(),
    };

    const parsed = schema.safeParse(candidate);
    if (parsed.success) {
      steps.push(parsed.data);
    } else {
      for (const issue of parsed.error.issues) {
        const field = issue.path.join(".");
        errors.push(field === "" ? `${label}: ${issue.message}` : `${label}: ${field} ${issue.message}`);
      }
    }

    for (const url of candidate.source_url) {
      const matches = sourcesByUrl.get(url);
      if (!matches) {
        warnings.push(`${label}: source URL is not in data/sources.json: ${url}`);
      } else if (matches.some(Boolean)) {
        errors.push(`${label}: source is marked do_not_use: ${url}`);
      }
    }
  }

  for (const [stepId, count] of seenIds) {
    if (stepId !== "" && count > 1) {
      errors.push(`step_id ${stepId} is used ${count} times.`);
    }
  }

  const counts = countSteps(steps);
  for (const count of counts) {
    if (count.count < 2) {
      const noun = count.count === 1 ? "step" : "steps";
      warnings.push(`${count.categoryId} ${count.ageBand} has ${count.count} ${noun}.`);
    }
  }

  return { steps, errors, warnings, counts };
}

export function reportLines(result: ImportResult): string[] {
  const lines = [`Steps: ${result.steps.length}`];
  for (const count of result.counts) {
    lines.push(`${count.categoryId} ${count.ageBand}: ${count.count}`);
  }
  for (const warning of result.warnings) {
    lines.push(`Warning: ${warning}`);
  }
  for (const error of result.errors) {
    lines.push(`Error: ${error}`);
  }
  return lines;
}
