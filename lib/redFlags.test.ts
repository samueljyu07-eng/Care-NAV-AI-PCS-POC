import { describe, expect, it } from "vitest";
import { checkRedFlags, type IntakeData } from "./redFlags";

function intakeFromText(text: string): IntakeData {
  return {
    checkboxes: {},
    freeText: {
      symptomsDescription: text,
    },
  };
}

const shouldTrigger = [
  "I have a headache still after four days, I have tried rest, water, and will not return to school becuase it makes symptoms worse",
  "I have dizziness that has lasted for 4 months ; I have been to physio, I feel depressed.",
  "I have vertigo, I am not able to read well anymore, and my memory is off",
  "I have a hard time focusing in class, It has been 2 weeks since my concussion",
  "I am super dizzy and I don't think I can get better eve",
];

const shouldNotTrigger = [
  "I feel like I should die and I don't think I can get better. Im suicidal ",
  "I feel stroke symptoms and have lost movement in my hand",
  "I have lost my ability to walk since the incident is it concussion?",
  "I have fainted many times today, I think I got concusses three hours ago ",
];

describe("checkRedFlags clinician cases that should trigger", () => {
  it.each(shouldTrigger)("triggers for: %s", (text) => {
    const result = checkRedFlags(intakeFromText(text));
    expect(result.triggered, result.reasons.join(" | ") || "no reasons").toBe(
      true,
    );
  });
});

describe("checkRedFlags clinician cases that should not trigger", () => {
  it.each(shouldNotTrigger)("does not trigger for: %s", (text) => {
    const result = checkRedFlags(intakeFromText(text));
    expect(result.triggered, result.reasons.join(" | ") || "no reasons").toBe(
      false,
    );
  });
});
