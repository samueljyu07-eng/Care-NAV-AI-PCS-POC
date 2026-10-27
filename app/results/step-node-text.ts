export type StepNodeMode = "simple" | "detailed";

export function visibleStepNodeLines(input: {
  mode: StepNodeMode;
  title: string;
  shortLabel?: string | null;
  stepTypeLabel: string | null;
  practitionerType: string;
  draftLabel?: string | null;
  rationale?: string;
  safetyNote?: string;
  sourceTitles?: string[];
}): string[] {
  if (input.mode === "simple") {
    const shortLabel = input.shortLabel?.trim() ?? "";
    return [shortLabel || input.title];
  }
  const lines = [input.title];
  if (input.practitionerType) {
    lines.push(input.practitionerType);
  }
  return lines;
}
