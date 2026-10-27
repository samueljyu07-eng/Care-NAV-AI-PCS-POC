import { expect, it } from "vitest";
import { pathwayOutputFormat } from "./pathwaySchema";

it("keeps the structured-output constraints Claude can enforce", () => {
  const schema = JSON.stringify(pathwayOutputFormat().schema);

  expect(schema).toContain('"const":false');
  expect(schema).toContain('"const":"GP"');
  expect(schema).toContain('"vestibular_physio"');
  expect(schema).not.toContain("minimum");
  expect(schema).not.toContain("maxItems");
});
