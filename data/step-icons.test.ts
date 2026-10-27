import { readFileSync } from "node:fs";
import path from "node:path";
import * as lucide from "lucide-react";
import { expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const steps = JSON.parse(readFileSync(path.join(root, "data/care-steps.json"), "utf8")) as {
  step_id: string;
}[];
const icons = JSON.parse(readFileSync(path.join(root, "data/step-icons.json"), "utf8")) as Record<
  string,
  string
>;

const sharedPairs = [
  ["VES-01", "VES-02"],
  ["OCU-01", "OCU-03"],
  ["OCU-04", "SEN-04"],
  ["SEN-01", "SEN-02"],
];

it("gives every care step an icon, shared only for the approved pairs", () => {
  const stepIds = steps.map((step) => step.step_id);
  expect(stepIds).toHaveLength(24);

  for (const stepId of stepIds) {
    const iconName = icons[stepId];
    expect(iconName, stepId).toBeTruthy();
    expect(iconName in lucide, iconName).toBe(true);
  }

  const users = new Map<string, string[]>();
  for (const stepId of stepIds) {
    const iconName = icons[stepId];
    users.set(iconName, [...(users.get(iconName) ?? []), stepId]);
  }

  for (const [iconName, stepIdGroup] of users) {
    if (stepIdGroup.length === 1) {
      continue;
    }
    const allowed = sharedPairs.some(
      (pair) =>
        pair.length === stepIdGroup.length && pair.every((stepId) => stepIdGroup.includes(stepId)),
    );
    expect(allowed, `${iconName} is shared by ${stepIdGroup.join(", ")}`).toBe(true);
  }
});
