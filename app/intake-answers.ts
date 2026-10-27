export const INTAKE_STORAGE_KEY = "care-nav-intake";
export const SURVEY_STORAGE_KEY = "care-nav-survey";
export const SURVEY_SUBMITTED_KEY = "care-nav-survey-submitted";

const PENDING_INTAKE = "__pending__";

export function subscribeToIntake() {
  return () => {};
}

export function getIntakeSnapshot() {
  return sessionStorage.getItem(INTAKE_STORAGE_KEY) ?? "";
}

export function getIntakeServerSnapshot() {
  return PENDING_INTAKE;
}

export function isIntakePending(raw: string) {
  return raw === PENDING_INTAKE;
}

export type AgeBand = "13-17" | "18+";

export type IntakeAnswers = {
  city: string;
  concerns: string;
  symptoms: string[];
  timeline: string;
  pastAttempts: string;
  ageBand: AgeBand | null;
};

export function saveIntakeAnswers(answers: IntakeAnswers) {
  const next = JSON.stringify(answers);
  const previous = sessionStorage.getItem(INTAKE_STORAGE_KEY);
  if (previous !== next) {
    sessionStorage.removeItem(SURVEY_STORAGE_KEY);
    sessionStorage.removeItem(SURVEY_SUBMITTED_KEY);
  }
  sessionStorage.setItem(INTAKE_STORAGE_KEY, next);
}

export function subscribeToSurveySubmitted() {
  return () => {};
}

export function getSurveySubmittedSnapshot() {
  return sessionStorage.getItem(SURVEY_SUBMITTED_KEY) ?? "";
}

export function getSurveySubmittedServerSnapshot() {
  return "";
}

export function markSurveySubmitted() {
  sessionStorage.setItem(SURVEY_SUBMITTED_KEY, "yes");
}

export function isSurveySubmitted() {
  return getSurveySubmittedSnapshot() === "yes";
}

export function subscribeToSurvey() {
  return () => {};
}

export function getSurveySnapshot() {
  return sessionStorage.getItem(SURVEY_STORAGE_KEY) ?? "";
}

export function getSurveyServerSnapshot() {
  return "";
}

export function saveSurveySelection(selected: Record<string, string[]>) {
  sessionStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(selected));
}

export function readSurveySelection(raw: string): Record<string, string[]> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const selected: Record<string, string[]> = {};
    for (const [questionId, optionIds] of Object.entries(parsed)) {
      if (
        Array.isArray(optionIds) &&
        optionIds.every((optionId) => typeof optionId === "string")
      ) {
        selected[questionId] = optionIds;
      }
    }
    return selected;
  } catch {
    return {};
  }
}

export function readIntakeAnswers(raw: string): IntakeAnswers | null {
  if (!raw || isIntakePending(raw)) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<IntakeAnswers>;
    const ageBand =
      parsed.ageBand === "13-17" || parsed.ageBand === "18+"
        ? parsed.ageBand
        : null;
    return {
      city: typeof parsed.city === "string" ? parsed.city : "",
      concerns: typeof parsed.concerns === "string" ? parsed.concerns : "",
      symptoms: Array.isArray(parsed.symptoms)
        ? parsed.symptoms.filter((item): item is string => typeof item === "string")
        : [],
      timeline: typeof parsed.timeline === "string" ? parsed.timeline : "",
      pastAttempts:
        typeof parsed.pastAttempts === "string" ? parsed.pastAttempts : "",
      ageBand,
    };
  } catch {
    return null;
  }
}
