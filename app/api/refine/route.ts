import type { AgeBand } from "../../../lib/catalog";
import {
  TEEN_RED_FLAG_NOTE,
  UNDER_13_MESSAGE,
  pathwayDisclaimer,
} from "../../../lib/copy";
import { readIntakeRequest, toRedFlagIntake } from "../../../lib/intakeBody";
import { askModel } from "../../../lib/askModel";
import {
  followUpQuestions,
  mergeNarratives,
  sanitizeProvisional,
} from "../../../lib/pathwayDraft";
import { refineSystemPrompt, refineUserPayload } from "../../../lib/prompts";
import { checkRedFlags } from "../../../lib/redFlags";
import { modelPathwaySchema } from "../../../lib/schema";
import { scoreSurvey } from "../../../lib/scoring";

const URGENT_CARE_MESSAGE =
  "Get urgent care now. Call 911 or go to the nearest emergency department. This tool will not create a pathway for this answer, and it does not give medical advice.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

  const intake = readIntakeRequest(body);
  if (!intake) {
    return Response.json(
      {
        error:
          "Intake JSON needs address, concerns, primary_symptoms, past_attempts, timeline, age_band, and survey_answers.",
      },
      { status: 400 },
    );
  }

  const redFlags = checkRedFlags(toRedFlagIntake(intake));
  if (redFlags.triggered) {
    const teenNote = intake.age_band === "13-17" ? ` ${TEEN_RED_FLAG_NOTE}` : "";
    return Response.json({
      urgent: true,
      message: `${URGENT_CARE_MESSAGE}${teenNote}`,
      reasons: redFlags.reasons,
    });
  }

  if (intake.age_band === "under-13") {
    return Response.json({
      unsupported_age: true,
      message: UNDER_13_MESSAGE,
    });
  }

  const ageBand = intake.age_band as AgeBand;
  const scored = scoreSurvey(intake.survey_answers);
  const provisional = sanitizeProvisional(
    {
      pathways: isRecord(body) && Array.isArray(body.provisional_paths)
        ? body.provisional_paths
        : [],
    },
    ageBand,
  );

  if (scored.displayed.length === 0) {
    return Response.json({
      age_band: ageBand,
      disclaimer: pathwayDisclaimer(ageBand),
      tie: false,
      follow_ups: [],
      pathways: [],
      message:
        "Those answers did not match a pattern closely enough to build a path. That is not a clearance or a diagnosis. You can change an answer and score again, or take the intake to a clinician.",
    });
  }

  let narrative: unknown = { pathways: [] };
  try {
    const drafted = await askModel(
      refineSystemPrompt(ageBand),
      JSON.stringify(
        refineUserPayload({
          ageBand,
          intake: {
            address: intake.address,
            concerns: intake.concerns,
            primary_symptoms: intake.primary_symptoms,
            past_attempts: intake.past_attempts,
            timeline: intake.timeline,
          },
          provisional: provisional.map((pathway) => ({
            category_id: pathway.category_id,
            why_it_may_apply: pathway.why_it_may_apply,
          })),
          result: scored,
        }),
      ),
      modelPathwaySchema,
    );
    if (drafted) {
      narrative = drafted;
    }
  } catch {
    narrative = { pathways: [] };
  }

  return Response.json({
    age_band: ageBand,
    disclaimer: pathwayDisclaimer(ageBand),
    tie: scored.tie,
    follow_ups: followUpQuestions(scored.follow_up_question_ids),
    pathways: mergeNarratives(scored, narrative, ageBand),
    message: null,
  });
}
