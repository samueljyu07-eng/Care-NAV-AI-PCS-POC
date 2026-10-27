import { expect, it } from "vitest";
import { evidenceBadge, sourcesFor, categoryById } from "./catalog";
import { demoPathways, mergeNarratives, sanitizeProvisional } from "./pathwayDraft";
import { scoreSurvey } from "./scoring";

it("keeps at most four unique categories and drops a practitioner type the category does not list", () => {
  const pathways = sanitizeProvisional(
    {
      pathways: [
        {
          category_id: "vestibular",
          why_it_may_apply: "A possible balance pattern.",
          steps: [
            {
              order: 1,
              title: "Talk with a vestibular physiotherapist",
              practitioner_type: "vision_therapist",
              rationale: "Wrong type for this category.",
            },
            {
              order: 2,
              title: "Describe dizziness",
              practitioner_type: "vestibular_physio",
              rationale: "This visit is for listing what brings on dizziness.",
            },
          ],
        },
        { category_id: "vestibular", why_it_may_apply: "Duplicate", steps: [] },
        { category_id: "not_a_category", why_it_may_apply: "No", steps: [] },
        {
          category_id: "oculomotor",
          why_it_may_apply: "A possible reading pattern.",
          steps: [
            {
              order: 1,
              title: "Describe screens",
              practitioner_type: "optometrist",
              rationale: "An optometrist can help list screen symptoms.",
            },
          ],
        },
        {
          category_id: "fatigue_activity",
          why_it_may_apply: "",
          steps: [],
        },
        {
          category_id: "exertional_symptoms",
          why_it_may_apply: "Possible activity pattern.",
          steps: [
            {
              order: 1,
              title: "Describe activity",
              practitioner_type: "sports_medicine_physician",
              rationale: "Who to see and why.",
            },
          ],
        },
        {
          category_id: "sensory_peripheral",
          why_it_may_apply: "Fifth path should be left out.",
          steps: [
            {
              order: 1,
              title: "Describe the neck",
              practitioner_type: "physiotherapist",
              rationale: "Who to see and why.",
            },
          ],
        },
      ],
    },
    "18+",
  );

  expect(pathways.map((pathway) => pathway.category_id)).toEqual([
    "vestibular",
    "oculomotor",
    "fatigue_activity",
    "exertional_symptoms",
  ]);
  expect(pathways[0].steps.map((step) => step.title)).toEqual([
    "Get a balance and dizziness assessment",
    "Clinician-directed vestibular rehabilitation",
    "Assess brief positional spinning (possible BPPV)",
    "Follow an individualized movement plan at home",
  ]);
  expect(pathways[0].steps.every((step) => step.from_library)).toBe(true);
  expect(pathways[1].steps.slice(0, 2).map((step) => step.title)).toEqual([
    "Get a vision and eye-movement assessment",
    "Ask about assessment before using visual supports",
  ]);
  expect(pathways[1].steps[2]?.title).toBe("Describe screens");
  expect(pathways[1].steps[2]?.from_library).toBe(false);
  expect(pathways[2].why_it_may_apply.length).toBeGreaterThan(0);
  expect(pathways[2].steps[0].title).toBe("Discuss fatigue and symptoms with your GP");
  expect(pathways[2].steps[0].practitioner_type).toBe("gp_family_physician");
});

it("keeps library wording when the model names a step id, then adds the model's own step", () => {
  const pathways = sanitizeProvisional(
    {
      pathways: [
        {
          category_id: "vestibular",
          why_it_may_apply: "You noted dizziness in stores.",
          steps: [
            {
              order: 1,
              step_id: "VES-02",
              title: "The model rewrote this title",
              practitioner_type: "vestibular_physio",
              rationale: "The model rewrote this reason.",
            },
            {
              order: 2,
              step_id: "",
              title: "Write down what you already tried",
              practitioner_type: "vestibular_physio",
              rationale: "Take that list to the visit.",
            },
          ],
        },
      ],
    },
    "18+",
  );

  expect(pathways[0].steps.map((step) => step.step_id)).toEqual([
    "VES-01",
    "VES-02",
    null,
  ]);
  expect(pathways[0].steps[1].title).toBe(
    "Clinician-directed vestibular rehabilitation",
  );
  expect(pathways[0].steps[2].title).toBe("Write down what you already tried");
});

it("leaves out an adult-only library step for a teen", () => {
  const pathways = sanitizeProvisional(
    {
      pathways: [
        {
          category_id: "vestibular",
          why_it_may_apply: "You noted dizziness.",
          steps: [
            {
              order: 1,
              step_id: "VES-03",
              title: "Adult step",
              practitioner_type: "vestibular_physio",
              rationale: "Not for a teen.",
            },
          ],
        },
      ],
    },
    "13-17",
  );

  expect(pathways[0].steps.map((step) => step.step_id)).not.toContain("VES-03");
  expect(pathways[0].steps.every((step) => step.from_library)).toBe(true);
});

it("reorders explanations without taking numbers from the model", () => {
  const scored = scoreSurvey([
    { question_id: "Q5", option_ids: ["A", "B"] },
    { question_id: "Q7", option_ids: ["A"] },
    { question_id: "Q8", option_ids: ["A"] },
  ]);
  const displayed = mergeNarratives(
    scored,
    {
      pathways: [
        {
          category_id: "sensory_peripheral",
          why_it_may_apply: "A possible neck and light pattern.",
          percentage: 99,
          steps: [
            {
              order: 9,
              title: "Describe neck tenderness",
              practitioner_type: "physiotherapist",
              rationale: "A physiotherapist can help list those symptoms for a GP.",
            },
          ],
        },
        {
          category_id: "vestibular",
          why_it_may_apply: "A possible motion pattern.",
          percentage: 1,
          steps: [
            {
              order: 4,
              title: "Describe dizziness",
              practitioner_type: "neurosurgeon",
              rationale: "This type is not allowed.",
            },
          ],
        },
      ],
    },
    "18+",
  );

  expect(displayed.map((pathway) => pathway.category_id)).toEqual([
    "sensory_peripheral",
    "vestibular",
  ]);
  expect(displayed[0].percentage_label).not.toBe("99%");
  expect(displayed[0].points).toBe(6);
  expect(displayed[0].max_points).toBe(9);
  expect(displayed[1].steps[0].practitioner_type).toBe("vestibular_physio");
  expect(displayed[1].percentage).toBe(100);
});

it("hides adult-only sources and the adult evidence label for teens", () => {
  for (const id of [
    "fatigue_activity",
    "exertional_symptoms",
    "neuroendocrine",
    "vestibular",
    "oculomotor",
    "sensory_peripheral",
  ]) {
    const category = categoryById(id);
    expect(category).toBeTruthy();
    if (!category) {
      continue;
    }
    expect(evidenceBadge(category, "13-17")).toBe("Pending clinician review");
    expect(
      sourcesFor(category, "13-17").some((source) =>
        source.name.startsWith("Ontario Living Concussion Guidelines"),
      ),
    ).toBe(false);
  }

  const vestibular = categoryById("vestibular");
  expect(
    vestibular &&
      sourcesFor(vestibular, "18+").some((source) =>
        source.name.startsWith("Ontario Living Concussion Guidelines"),
      ),
  ).toBe(true);
  expect(vestibular && evidenceBadge(vestibular, "18+")).toBe("Guideline");
});

it("builds demo paths from checked symptoms when the model returns none", () => {
  const pathways = demoPathways(["Dizziness", "Light sensitivity"], "18+");

  expect(pathways.map((pathway) => pathway.category_id)).toEqual([
    "vestibular",
    "sensory_peripheral",
  ]);
  expect(pathways[0].why_it_may_apply).toContain("Dizziness");
  expect(pathways[1].why_it_may_apply).toContain("Light sensitivity");
  expect(pathways[0].steps[0].practitioner_type).toBe("vestibular_physio");
});
