import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import {
  importCareSteps,
  practitionerTypesFromCategories,
  splitSourceField,
  type SourceRecord,
} from "./importCareSteps";

const PRACTITIONERS = [
  "gp_family_physician",
  "sports_medicine_physician",
  "vestibular_physio",
  "physiotherapist",
  "optometrist",
];

const HEADER = [
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
].join(",");

function row(values: Record<string, string>): string {
  const cells = HEADER.split(",").map((column) => {
    const value = values[column] ?? "";
    return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  });
  return cells.join(",");
}

function base(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    step_id: "VES-01",
    category_id: "vestibular",
    order_hint: "1",
    step_type: "assessment",
    title: "Get an assessment",
    short_label: "Get an assessment",
    who_to_see: "vestibular_physio",
    what_it_involves: "A clinician asks about dizziness.",
    why_it_may_help: "It may guide next steps.",
    safety_note: "",
    applies_to_ages: "both",
    teen_note: "",
    source_title: "Guideline A ; Guideline B",
    source_url: "https://example.com/a ; https://example.com/b",
    evidence_level: "guideline_supported",
    clinician_status: "draft",
    clinician_notes: "",
    claim_verification: "supported",
    ...overrides,
  };
}

const SOURCES: SourceRecord[] = [
  { url: "https://example.com/a", do_not_use: false },
  { url: "https://example.com/b", do_not_use: false },
  { url: "https://example.com/blocked", do_not_use: true },
];

function run(lines: string[], sources: SourceRecord[] = SOURCES) {
  return importCareSteps([HEADER, ...lines].join("\n"), {
    sources,
    practitionerTypes: PRACTITIONERS,
  });
}

it("splits source titles and urls on the separator", () => {
  expect(splitSourceField("Guideline A ; Guideline B")).toEqual([
    "Guideline A",
    "Guideline B",
  ]);
  expect(splitSourceField("https://example.com/a ; https://example.com/b")).toEqual([
    "https://example.com/a",
    "https://example.com/b",
  ]);

  const result = run([row(base())]);
  expect(result.errors).toEqual([]);
  expect(result.steps[0]?.source_title).toEqual(["Guideline A", "Guideline B"]);
  expect(result.steps[0]?.source_url).toEqual([
    "https://example.com/a",
    "https://example.com/b",
  ]);
});

it("also splits titles that use a semicolon without a leading space", () => {
  const result = run([
    row(
      base({
        source_title: "Guideline A; Guideline B",
        source_url: "https://example.com/a",
      }),
    ),
  ]);
  expect(result.steps[0]?.source_title).toEqual(["Guideline A", "Guideline B"]);
});

it("skips example rows that start with EX-", () => {
  const result = run([
    row(base({ step_id: "EX-01", category_id: "not-a-category" })),
    row(base()),
    row(
      base({
        step_id: "VES-02",
        order_hint: "2",
        source_url: "https://example.com/a",
        source_title: "Guideline A",
      }),
    ),
  ]);
  expect(result.steps.map((step) => step.step_id)).toEqual(["VES-01", "VES-02"]);
  expect(result.errors).toEqual([]);
});

it("rejects a repeated step id, an unknown category, and an unknown practitioner", () => {
  const result = run([
    row(base()),
    row(base({ order_hint: "2" })),
    row(base({ step_id: "BAD-01", category_id: "metabolic_cellular" })),
    row(base({ step_id: "BAD-02", who_to_see: "vision_therapist", order_hint: "3" })),
  ]);
  expect(result.errors).toEqual(
    expect.arrayContaining([
      "step_id VES-01 is used 2 times.",
      expect.stringContaining("BAD-01: category_id"),
      expect.stringContaining("BAD-02: who_to_see must be a known practitioner type"),
    ]),
  );
});

it("rejects invalid step type, age, evidence, clinician status, and claim verification", () => {
  const result = run([
    row(base({ step_id: "BAD-01", step_type: "exercise" })),
    row(base({ step_id: "BAD-02", applies_to_ages: "teen", order_hint: "2" })),
    row(base({ step_id: "BAD-03", evidence_level: "anecdote", order_hint: "3" })),
    row(base({ step_id: "BAD-04", clinician_status: "published", order_hint: "4" })),
    row(base({ step_id: "BAD-05", claim_verification: "maybe", order_hint: "5" })),
  ]);
  expect(result.errors.join("\n")).toContain("BAD-01: step_type");
  expect(result.errors.join("\n")).toContain("BAD-02: applies_to_ages");
  expect(result.errors.join("\n")).toContain("BAD-03: evidence_level");
  expect(result.errors.join("\n")).toContain("BAD-04: clinician_status");
  expect(result.errors.join("\n")).toContain("BAD-05: claim_verification");
});

it("requires a safety note only for self-management steps", () => {
  const missing = run([
    row(base({ step_type: "self_management", safety_note: "  " })),
  ]);
  expect(missing.errors).toEqual([
    "VES-01: safety_note is required for self_management",
  ]);

  const present = run([
    row(
      base({
        step_type: "self_management",
        safety_note: "Stop and contact your clinician if symptoms worsen.",
      }),
    ),
  ]);
  expect(present.errors).toEqual([]);
});

it("warns when a source url is unknown and errors when that source is do_not_use", () => {
  const unknown = run([
    row(base({ source_url: "https://example.com/missing", source_title: "Missing" })),
    row(
      base({
        step_id: "VES-02",
        order_hint: "2",
        source_url: "https://example.com/a",
        source_title: "Guideline A",
      }),
    ),
  ]);
  expect(unknown.errors).toEqual([]);
  expect(unknown.warnings).toContain(
    "VES-01: source URL is not in data/sources.json: https://example.com/missing",
  );

  const blocked = run([
    row(base({ source_url: "https://example.com/blocked", source_title: "Blocked" })),
  ]);
  expect(blocked.errors).toEqual([
    "VES-01: source is marked do_not_use: https://example.com/blocked",
  ]);
});

it("counts steps for each age band and warns when a band has fewer than 2", () => {
  const result = run([
    row(base({ applies_to_ages: "13-17", source_url: "https://example.com/a", source_title: "A" })),
    row(
      base({
        step_id: "VES-02",
        order_hint: "2",
        applies_to_ages: "both",
        source_url: "https://example.com/a",
        source_title: "A",
      }),
    ),
  ]);
  const vestibular = result.counts.filter((count) => count.categoryId === "vestibular");
  expect(vestibular).toEqual([
    { categoryId: "vestibular", ageBand: "13-17", count: 2 },
    { categoryId: "vestibular", ageBand: "18+", count: 1 },
  ]);
  expect(result.warnings).toContain("vestibular 18+ has 1 step.");
  expect(result.warnings).toContain("fatigue_activity 13-17 has 0 steps.");
});

it("imports the care step sheet without errors", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const csv = readFileSync(path.join(root, "data/care-steps.csv"), "utf8");
  const sources = JSON.parse(readFileSync(path.join(root, "data/sources.json"), "utf8")) as {
    sources: SourceRecord[];
  };
  const categories = JSON.parse(
    readFileSync(path.join(root, "data/categories.json"), "utf8"),
  ) as { categories?: { practitioner_types?: string[] }[] };

  const result = importCareSteps(csv, {
    sources: sources.sources,
    practitionerTypes: practitionerTypesFromCategories(categories),
  });

  expect(result.errors).toEqual([]);
  expect(result.steps).toHaveLength(24);
  expect(result.steps.some((step) => step.step_id.startsWith("EX-"))).toBe(false);
  const first = result.steps.find((step) => step.step_id === "VES-01");
  expect(first?.short_label).toBe("Assess balance and dizziness");
  expect(first?.title).toBe("Get a balance and dizziness assessment");
  expect(first?.source_title.length).toBeGreaterThan(1);
  expect(first?.source_url.length).toBe(first?.source_title.length);
  expect(result.warnings.filter((warning) => warning.includes("has "))).toEqual([]);
});
