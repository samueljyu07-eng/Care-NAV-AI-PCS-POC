import Anthropic from "@anthropic-ai/sdk";
import { checkRedFlags, type IntakeData } from "../../../lib/redFlags";

const MODEL = "claude-sonnet-5-5";

const URGENT_CARE_MESSAGE =
  "Get urgent care now. Call 911 or go to the nearest emergency department. This tool will not create a pathway for this answer, and it does not give medical advice.";

type IntakeBody = {
  address: string;
  concerns: string;
  primary_symptoms: string[];
  past_attempts: string;
};

function readBooleans(
  value: unknown,
): IntakeData["checkboxes"] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const checkboxes: IntakeData["checkboxes"] = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined && typeof item !== "boolean") {
      return null;
    }
    checkboxes[key] = item;
  }
  return checkboxes;
}

function readStrings(value: unknown): IntakeData["freeText"] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const freeText: IntakeData["freeText"] = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined && typeof item !== "string") {
      return null;
    }
    freeText[key] = item;
  }
  return freeText;
}

function toIntakeData(value: unknown): IntakeData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<string, unknown>;
  const hasScreen =
    body.checkboxes !== undefined || body.freeText !== undefined;
  const form = formFields(body);

  if (!hasScreen && !form) {
    return null;
  }

  const checkboxes =
    body.checkboxes === undefined ? {} : readBooleans(body.checkboxes);
  const freeText = body.freeText === undefined ? {} : readStrings(body.freeText);
  if (!checkboxes || !freeText) {
    return null;
  }

  if (form) {
    freeText.concerns = form.concerns;
    freeText.pastAttempts = form.past_attempts;
    freeText.symptoms = form.primary_symptoms.join(" ");
  }

  return { checkboxes, freeText };
}

function formFields(body: Record<string, unknown>): IntakeBody | null {
  if (
    typeof body.address !== "string" ||
    typeof body.concerns !== "string" ||
    !Array.isArray(body.primary_symptoms) ||
    !body.primary_symptoms.every((item) => typeof item === "string") ||
    typeof body.past_attempts !== "string"
  ) {
    return null;
  }

  return {
    address: body.address,
    concerns: body.concerns,
    primary_symptoms: body.primary_symptoms,
    past_attempts: body.past_attempts,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Send the intake details as JSON." },
      { status: 400 },
    );
  }

  const intake = toIntakeData(body);
  if (!intake) {
    return Response.json(
      {
        error:
          "Intake JSON needs address, concerns, primary_symptoms, and past_attempts, or checkboxes and freeText.",
      },
      { status: 400 },
    );
  }

  const redFlags = checkRedFlags(intake);
  if (redFlags.triggered) {
    return Response.json({
      urgent: true,
      message: URGENT_CARE_MESSAGE,
      reasons: redFlags.reasons,
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "The Anthropic API key is missing on the server." },
      { status: 500 },
    );
  }

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: "Reply with exactly this word and nothing else: connected",
        },
      ],
    });
    const reply = message.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();

    return Response.json({ reply });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: "Claude did not respond.", detail },
      { status: 502 },
    );
  }
}
