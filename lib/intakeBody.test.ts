import { expect, it } from "vitest";
import { intakeTextIsUrgent } from "./intakeBody";

it("treats chest pain in the concerns as urgent", () => {
  expect(
    intakeTextIsUrgent({
      concerns: "I have chest pain when I stand up",
      pastAttempts: "",
      symptoms: ["Headache"],
      ageBand: "18+",
    }),
  ).toBe(true);
});

it("does not treat a routine headache as urgent", () => {
  expect(
    intakeTextIsUrgent({
      concerns: "Headaches most days since the concussion",
      pastAttempts: "Rest and water",
      symptoms: ["Headache"],
      ageBand: "13-17",
    }),
  ).toBe(false);
});
