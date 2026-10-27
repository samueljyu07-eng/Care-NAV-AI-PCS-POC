import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { structuredOutputFormat } from "./pathwaySchema";
import { validatedOutput } from "./schema";

const MODEL = "claude-sonnet-5-5";

export async function askModel<T>(
  system: string,
  user: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }
  const client = new Anthropic();
  return validatedOutput(schema, async () => {
    const message = await client.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
      output_config: {
        format: structuredOutputFormat(schema),
      },
    });
    return message.parsed_output;
  });
}
