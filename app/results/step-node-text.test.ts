import { expect, it } from "vitest";
import { visibleStepNodeLines } from "./step-node-text";

it("hides the extra step text in Simple mode", () => {
  const lines = visibleStepNodeLines({
    mode: "simple",
    title: "Assess persistent neck pain, dizziness, or headache",
    shortLabel: "Assess neck pain",
    stepTypeLabel: "Assessment",
    practitionerType: "Physiotherapist",
    draftLabel: "Draft: pending clinician review",
    rationale: "It may help identify whether neck or vestibular assessment is relevant.",
    safetyNote: "Stop the activity and contact your clinician if symptoms worsen.",
    sourceTitles: ["Ontario Living Concussion Guidelines"],
  });

  expect(lines).toEqual(["Assess neck pain"]);
  const shown = lines.join(" ");
  expect(shown).not.toContain("Assess persistent neck pain");
  expect(shown).not.toContain("Assessment");
  expect(shown).not.toContain("Physiotherapist");
  expect(shown).not.toContain("Draft: pending clinician review");
  expect(shown).not.toContain("It may help identify");
  expect(shown).not.toContain("Stop the activity");
  expect(shown).not.toContain("Ontario Living Concussion Guidelines");
});

it("uses the step title in Simple mode when there is no short label", () => {
  const lines = visibleStepNodeLines({
    mode: "simple",
    title: "Talk with a clinician",
    shortLabel: "  ",
    stepTypeLabel: "Care",
    practitionerType: "Physiotherapist",
  });

  expect(lines).toEqual(["Talk with a clinician"]);
});
