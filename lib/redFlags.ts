export interface IntakeData {
  checkboxes: {
    chestPain?: boolean;
    suddenNumbnessOrWeakness?: boolean;
    severeUncontrolledPain?: boolean;
    unexplainedRapidWeightLoss?: boolean;
    severeShortnessOfBreath?: boolean;
    lossOfBowelOrBladderControl?: boolean;
    [key: string]: boolean | undefined;
  };
  freeText: {
    symptomsDescription?: string;
    medicalHistory?: string;
    additionalNotes?: string;
    [key: string]: string | undefined;
  };
}

export interface RedFlagResult {
  triggered: boolean;
  reasons: string[];
}

const CRITICAL_KEYWORDS = [
  "chest pain",
  "suicide",
  "suicidal",
  "numbness",
  "paralysis",
  "loss of control",
  "severe shortness of breath",
  "unconscious",
  "fainting",
  "blackout",
  "uncontrolled bleeding",
  "sudden severe headache",
  "stroke",
];

const STANDARD_CHECKBOXES = [
  "chestPain",
  "suddenNumbnessOrWeakness",
  "severeUncontrolledPain",
  "unexplainedRapidWeightLoss",
  "severeShortnessOfBreath",
  "lossOfBowelOrBladderControl",
];

export function checkRedFlags(intake: IntakeData): RedFlagResult {
  const reasons: string[] = [];
  const checkboxes = intake.checkboxes ?? {};

  if (checkboxes.chestPain) {
    reasons.push("Checkbox triggered: Chest pain reported.");
  }
  if (checkboxes.suddenNumbnessOrWeakness) {
    reasons.push(
      "Checkbox triggered: Sudden numbness or weakness reported.",
    );
  }
  if (checkboxes.severeUncontrolledPain) {
    reasons.push("Checkbox triggered: Severe uncontrolled pain reported.");
  }
  if (checkboxes.unexplainedRapidWeightLoss) {
    reasons.push(
      "Checkbox triggered: Unexplained rapid weight loss reported.",
    );
  }
  if (checkboxes.severeShortnessOfBreath) {
    reasons.push(
      "Checkbox triggered: Severe shortness of breath reported.",
    );
  }
  if (checkboxes.lossOfBowelOrBladderControl) {
    reasons.push(
      "Checkbox triggered: Loss of bowel or bladder control reported (urgent neurological screen).",
    );
  }

  for (const [key, value] of Object.entries(checkboxes)) {
    if (value !== true || STANDARD_CHECKBOXES.includes(key)) {
      continue;
    }
    if (!reasons.some((reason) => reason.includes(key))) {
      reasons.push(`Checkbox triggered: ${key}`);
    }
  }

  const freeText = intake.freeText ?? {};
  const combinedText = Object.values(freeText)
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  for (const keyword of CRITICAL_KEYWORDS) {
    if (combinedText.includes(keyword)) {
      reasons.push(`Free-text keyword match detected: "${keyword}"`);
    }
  }

  const uniqueReasons = Array.from(new Set(reasons));

  return {
    triggered: uniqueReasons.length > 0,
    reasons: uniqueReasons,
  };
}
