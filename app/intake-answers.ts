export const INTAKE_STORAGE_KEY = "care-nav-intake";

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

export type IntakeAnswers = {
  city: string;
  concerns: string;
  symptoms: string[];
  timeline: string;
  pastAttempts: string;
};

export function saveIntakeAnswers(answers: IntakeAnswers) {
  sessionStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(answers));
}

export function readIntakeAnswers(raw: string): IntakeAnswers | null {
  if (!raw || isIntakePending(raw)) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<IntakeAnswers>;
    return {
      city: typeof parsed.city === "string" ? parsed.city : "",
      concerns: typeof parsed.concerns === "string" ? parsed.concerns : "",
      symptoms: Array.isArray(parsed.symptoms)
        ? parsed.symptoms.filter((item): item is string => typeof item === "string")
        : [],
      timeline: typeof parsed.timeline === "string" ? parsed.timeline : "",
      pastAttempts:
        typeof parsed.pastAttempts === "string" ? parsed.pastAttempts : "",
    };
  } catch {
    return null;
  }
}
