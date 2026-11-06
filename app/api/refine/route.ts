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
import {
  adjustScores,
  journalChangeText,
  journalModelBrief,
} from "../../../lib/journalAdjustment";
import { parseJournalEntries } from "../../../lib/journal";
import { refineSystemPrompt, refineUserPayload } from "../../../lib/prompts";
import { checkRedFlags } from "../../../lib/redFlags";
import { modelJournalPathwaySchema, modelPathwaySchema } from "../../../lib/schema";
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

  const journalToday =
    isRecord(body) && typeof body.journal_today === "string"
      ? body.journal_today
      : undefined;
  const journalEntries = parseJournalEntries(
    isRecord(body) ? body.journal_entries : undefined,
  );
  const adjustment = adjustScores(scored, journalEntries, journalToday);
  const used = adjustment.applied ? adjustment.adjusted : scored;
  const intakeForModel = {
    address: intake.address,
    concerns: intake.concerns,
    primary_symptoms: intake.primary_symptoms,
    past_attempts: intake.past_attempts,
    timeline: intake.timeline,
  };
  const provisionalForModel = provisional.map((pathway) => ({
    category_id: pathway.category_id,
    why_it_may_apply: pathway.why_it_may_apply,
  }));

  let narrative: unknown = { pathways: [] };
  let journalNote: string | null = null;
  try {
    if (adjustment.applied) {
      journalNote = journalChangeText(adjustment.reasons);
      const drafted = await askModel(
        refineSystemPrompt(ageBand, true),
        JSON.stringify(
          refineUserPayload({
            ageBand,
            intake: intakeForModel,
            provisional: provisionalForModel,
            result: used,
            journal: journalModelBrief(adjustment),
          }),
        ),
        modelJournalPathwaySchema,
      );
      if (drafted) {
        narrative = drafted;
        const note = drafted.journal_note.trim();
        if (note) {
          journalNote = note;
        }
      }
    } else {
      const drafted = await askModel(
        refineSystemPrompt(ageBand),
        JSON.stringify(
          refineUserPayload({
            ageBand,
            intake: intakeForModel,
            provisional: provisionalForModel,
            result: scored,
          }),
        ),
        modelPathwaySchema,
      );
      if (drafted) {
        narrative = drafted;
      }
    }
  } catch {
    narrative = { pathways: [] };
  }

  return Response.json({
    age_band: ageBand,
    disclaimer: pathwayDisclaimer(ageBand),
    tie: used.tie,
    follow_ups: followUpQuestions(used.follow_up_question_ids),
    pathways: mergeNarratives(used, narrative, ageBand),
    message: null,
    ...(journalNote ? { journal_note: journalNote } : {}),
  });
}
