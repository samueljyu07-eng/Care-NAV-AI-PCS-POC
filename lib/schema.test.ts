import { expect, it, vi } from "vitest";
import { categoryIds } from "./catalog";
import { modelPathwaySchema, validatedOutput } from "./schema";

function sample() {
  return {
    pathways: [
      {
        category_id: "vestibular",
        why_it_may_apply: "You wrote that busy stores bring on dizziness.",
        steps: [
          {
            order: 1,
            title: "Describe dizziness",
            practitioner_type: "vestibular_physio",
            rationale: "A vestibular physiotherapist can help list what brings it on.",
          },
        ],
      },
    ],
  };
}

it("accepts a category path from the allowed ids", () => {
  expect(modelPathwaySchema.safeParse(sample()).success).toBe(true);
  expect(categoryIds()).toContain("vestibular");
});

it("rejects a category id that is not in the category file", () => {
  const draft = sample();
  draft.pathways[0].category_id = "ocular";

  expect(modelPathwaySchema.safeParse(draft).success).toBe(false);
});

it("rejects a practitioner type that the category does not list", () => {
  const draft = sample();
  draft.pathways[0].steps[0].practitioner_type = "vision_therapist";

  expect(modelPathwaySchema.safeParse(draft).success).toBe(false);
});

it("rejects more than four paths", () => {
  const one = sample().pathways[0];
  const draft = {
    pathways: [
      one,
      { ...one, category_id: "oculomotor", steps: [{ ...one.steps[0], practitioner_type: "vision_therapist" }] },
      { ...one, category_id: "sensory_peripheral", steps: [{ ...one.steps[0], practitioner_type: "physiotherapist" }] },
      { ...one, category_id: "neuroendocrine", steps: [{ ...one.steps[0], practitioner_type: "psychologist" }] },
      { ...one, category_id: "metabolic_cellular", steps: [{ ...one.steps[0], practitioner_type: "sports_medicine_physician" }] },
    ],
  };

  expect(modelPathwaySchema.safeParse(draft).success).toBe(false);
});

it("retries once when the first output fails validation", async () => {
  const readOutput = vi
    .fn<() => Promise<unknown>>()
    .mockResolvedValueOnce({ pathways: [{ category_id: "nope" }] })
    .mockResolvedValueOnce(sample());

  const pathway = await validatedOutput(modelPathwaySchema, readOutput);

  expect(pathway?.pathways).toHaveLength(1);
  expect(readOutput).toHaveBeenCalledTimes(2);
});

it("returns null after the retry still fails validation", async () => {
  const readOutput = vi.fn(async () => ({ disclaimer: "not a pathway" }));

  const pathway = await validatedOutput(modelPathwaySchema, readOutput);

  expect(pathway).toBeNull();
  expect(readOutput).toHaveBeenCalledTimes(2);
});
