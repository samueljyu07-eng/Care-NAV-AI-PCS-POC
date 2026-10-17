import { z } from "zod";
import { ALLOWED_PRACTITIONER_TYPES } from "./systemPrompt";

const ruleOutItemSchema = z.object({
  item: z.string(),
  why_it_matters: z.string(),
  raise_with: z.literal("GP"),
});

const pathwayStepSchema = z.object({
  order: z.int(),
  title: z.string(),
  practitioner_type: z.enum(ALLOWED_PRACTITIONER_TYPES),
  rationale: z.string(),
});

const pathwaySchema = z.object({
  name: z.string(),
  summary: z.string(),
  supported_by: z.array(z.string()),
  steps: z.array(pathwayStepSchema).min(1),
});

export const pathwayResponseSchema = z.object({
  red_flag: z.literal(false),
  symptom_domains: z.array(z.string()),
  rule_out_checklist: z.array(ruleOutItemSchema),
  pathways: z.array(pathwaySchema).min(1),
  disclaimer: z.string(),
});

export type PathwayResponse = z.infer<typeof pathwayResponseSchema>;

export async function validatedPathway(
  readOutput: () => Promise<unknown>,
): Promise<PathwayResponse | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parsed = pathwayResponseSchema.safeParse(await readOutput());
    if (parsed.success) {
      return parsed.data;
    }
  }

  return null;
}
