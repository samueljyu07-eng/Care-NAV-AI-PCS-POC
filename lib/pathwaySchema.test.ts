import { expect, it } from "vitest";
import { structuredOutputFormat } from "./pathwaySchema";
import { modelPathwaySchema } from "./schema";

it("keeps the structured-output constraints Claude can enforce", () => {
  const schema = JSON.stringify(structuredOutputFormat(modelPathwaySchema).schema);

  expect(schema).toContain("fatigue_activity");
  expect(schema).toContain("oculomotor");
  expect(schema).toContain("vestibular_physio");
  expect(schema).toContain("why_it_may_apply");
  expect(schema).not.toContain("minimum");
  expect(schema).not.toContain("maxItems");
});
