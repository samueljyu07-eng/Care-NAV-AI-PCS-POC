import { z } from "zod";
import { categoryIds, practitionerTypeIds, practitionerTypesFor } from "./catalog";

const pathwayStepSchema = z.object({
  order: z.int(),
  title: z.string().min(1),
  practitioner_type: z.enum(practitionerTypeIds()),
  rationale: z.string().min(1),
});

const draftPathwaySchema = z
  .object({
    category_id: z.enum(categoryIds()),
    why_it_may_apply: z.string().min(1),
    steps: z.array(pathwayStepSchema).min(1),
  })
  .superRefine((pathway, ctx) => {
    const allowed = new Set(practitionerTypesFor(pathway.category_id));
    pathway.steps.forEach((step, index) => {
      if (!allowed.has(step.practitioner_type)) {
        ctx.addIssue({
          code: "custom",
          message: "Practitioner type is not listed for this category.",
          path: ["steps", index, "practitioner_type"],
        });
      }
    });
  });

export const modelPathwaySchema = z.object({
  pathways: z.array(draftPathwaySchema).max(4),
});

export type ModelPathwayResponse = z.infer<typeof modelPathwaySchema>;

export async function validatedOutput<T>(
  schema: z.ZodType<T>,
  readOutput: () => Promise<unknown>,
): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parsed = schema.safeParse(await readOutput());
    if (parsed.success) {
      return parsed.data;
    }
  }
  return null;
}
