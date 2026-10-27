import type { AgeBand } from "./catalog";
import { checkRedFlags, type IntakeData } from "./redFlags";
import type { SurveyAnswer } from "./scoring";

export type AgeInput = AgeBand | "under-13";

export type IntakeRequest = {
  address: string;
  concerns: string;
  primary_symptoms: string[];
  past_attempts: string;
  timeline: string;
  age_band: AgeInput;
  survey_answers: SurveyAnswer[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readAge(value: unknown): AgeInput | null {
  if (value === "13-17" || value === "18+" || value === "under-13") {
    return value;
  }
  return null;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return null;
  }
  return value;
}

function readSurveyAnswers(value: unknown): SurveyAnswer[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const answers: SurveyAnswer[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.question_id !== "string") {
      return null;
    }
    const optionIds = readStringArray(item.option_ids);
    if (!optionIds) {
      return null;
    }
    answers.push({ question_id: item.question_id, option_ids: optionIds });
  }
  return answers;
}

export function readIntakeRequest(value: unknown): IntakeRequest | null {
  if (!isRecord(value)) {
    return null;
  }
  const ageBand = readAge(value.age_band);
  const symptoms = readStringArray(value.primary_symptoms);
  const surveyAnswers = readSurveyAnswers(value.survey_answers);
  if (
    !ageBand ||
    !symptoms ||
    !surveyAnswers ||
    typeof value.address !== "string" ||
    typeof value.concerns !== "string" ||
    typeof value.past_attempts !== "string" ||
    typeof value.timeline !== "string"
  ) {
    return null;
  }
  return {
    address: value.address,
    concerns: value.concerns,
    primary_symptoms: symptoms,
    past_attempts: value.past_attempts,
    timeline: value.timeline,
    age_band: ageBand,
    survey_answers: surveyAnswers,
  };
}

export function toRedFlagIntake(intake: IntakeRequest): IntakeData {
  return {
    checkboxes: {},
    freeText: {
      concerns: intake.concerns,
      pastAttempts: intake.past_attempts,
      symptoms: intake.primary_symptoms.join(" "),
    },
  };
}

export function intakeTextIsUrgent(input: {
  concerns: string;
  pastAttempts: string;
  symptoms: string[];
  ageBand: AgeInput;
}): boolean {
  return checkRedFlags(
    toRedFlagIntake({
      address: "",
      concerns: input.concerns,
      primary_symptoms: input.symptoms,
      past_attempts: input.pastAttempts,
      timeline: "",
      age_band: input.ageBand,
      survey_answers: [],
    }),
  ).triggered;
}
