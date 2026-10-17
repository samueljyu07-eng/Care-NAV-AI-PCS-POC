import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { pathwayResponseSchema, validatedPathway } from "./schema";

function samplePathway() {
  return JSON.parse(readFileSync("data/sample-pathways.json", "utf8"));
}

it("accepts the sample pathway data shape", () => {
  expect(pathwayResponseSchema.safeParse(samplePathway()).success).toBe(true);
});

it("allows more than three pathways", () => {
  const sample = samplePathway();
  sample.pathways.push(sample.pathways[0]);

  expect(pathwayResponseSchema.safeParse(sample).success).toBe(true);
});

it("rejects a practitioner type outside the allowed list", () => {
  const sample = samplePathway();
  sample.pathways[0].steps[0].practitioner_type = "neurosurgeon";

  const parsed = pathwayResponseSchema.safeParse(sample);

  expect(parsed.success).toBe(false);
});

it("returns the first valid pathway without a retry", async () => {
  const readOutput = vi.fn(async () => samplePathway());

  const pathway = await validatedPathway(readOutput);

  expect(pathway?.pathways).toHaveLength(3);
  expect(readOutput).toHaveBeenCalledTimes(1);
});

it("retries once when the first output fails validation", async () => {
  const readOutput = vi
    .fn<() => Promise<unknown>>()
    .mockResolvedValueOnce({ red_flag: false })
    .mockResolvedValueOnce(samplePathway());

  const pathway = await validatedPathway(readOutput);

  expect(pathway?.red_flag).toBe(false);
  expect(readOutput).toHaveBeenCalledTimes(2);
});

it("returns null after the retry still fails validation", async () => {
  const readOutput = vi.fn(async () => ({ disclaimer: "not a pathway" }));

  const pathway = await validatedPathway(readOutput);

  expect(pathway).toBeNull();
  expect(readOutput).toHaveBeenCalledTimes(2);
});
