import { expect, it } from "vitest";
import { categoryIds } from "./catalog";
import {
  categoryMaxPoints,
  followUpQuestionIds,
  formatPercentage,
  scoreSurvey,
} from "./scoring";
import { surveyRules } from "./surveyMatrix";

it("reads the six category ids from the category file", () => {
  expect(categoryIds()).toEqual([
    "metabolic_cellular",
    "cerebrovascular",
    "neuroendocrine",
    "vestibular",
    "oculomotor",
    "sensory_peripheral",
  ]);
});

it("computes each category max from the survey file", () => {
  expect(categoryMaxPoints("metabolic_cellular")).toBe(5);
  expect(categoryMaxPoints("cerebrovascular")).toBe(7);
  expect(categoryMaxPoints("neuroendocrine")).toBe(7);
  expect(categoryMaxPoints("vestibular")).toBe(6);
  expect(categoryMaxPoints("oculomotor")).toBe(5);
  expect(categoryMaxPoints("sensory_peripheral")).toBe(9);
});

it("gives None / not sure and other exclusive answers zero points", () => {
  const scored = scoreSurvey([
    { question_id: "Q1", option_ids: ["none"] },
    { question_id: "Q3", option_ids: ["C"] },
    { question_id: "Q4", option_ids: ["D"] },
    { question_id: "Q9", option_ids: ["B"] },
  ]);

  expect(scored.primary_ids).toEqual([]);
  expect(scored.categories.every((category) => category.points === 0)).toBe(true);
});

it("does not add both single-select options for the same category", () => {
  const scored = scoreSurvey([{ question_id: "Q1", option_ids: ["A", "B"] }]);
  const metabolic = scored.categories.find(
    (category) => category.category_id === "metabolic_cellular",
  );

  expect(metabolic?.points).toBe(3);
});

it("scores an exclusive option as zero even when another option is sent with it", () => {
  const scored = scoreSurvey([{ question_id: "Q4", option_ids: ["A", "D"] }]);
  const neuroendocrine = scored.categories.find(
    (category) => category.category_id === "neuroendocrine",
  );

  expect(neuroendocrine?.points).toBe(0);
});

it("labels a full metabolic match as strong and primary", () => {
  const scored = scoreSurvey([
    { question_id: "Q1", option_ids: ["A"] },
    { question_id: "Q2", option_ids: ["B"] },
  ]);
  const metabolic = scored.displayed[0];

  expect(scored.primary_ids).toEqual(["metabolic_cellular"]);
  expect(metabolic.points).toBe(5);
  expect(metabolic.percentage).toBe(100);
  expect(metabolic.strength_label).toBe("Strong");
  expect(metabolic.role).toBe("primary");
  expect(metabolic.drivers.map((driver) => driver.option_id)).toEqual(["A", "B"]);
});

it("marks a tie as co-primary and keeps the higher secondary rules from the file", () => {
  const scored = scoreSurvey([
    { question_id: "Q5", option_ids: ["A"] },
    { question_id: "Q6", option_ids: ["A"] },
    { question_id: "Q7", option_ids: ["A"] },
  ]);

  expect(scored.tie).toBe(false);
  expect(scored.primary_ids).toEqual(["vestibular"]);
  expect(formatPercentage(scored.displayed[0].percentage)).toBe("50%");
  expect(scored.displayed[0].strength_label).toBe("Moderate");

  const oculomotor = scored.displayed.find(
    (category) => category.category_id === "oculomotor",
  );
  const sensory = scored.displayed.find(
    (category) => category.category_id === "sensory_peripheral",
  );
  expect(oculomotor?.role).toBe("secondary");
  expect(oculomotor?.percentage).toBe(40);
  expect(oculomotor?.strength_label).toBe("Moderate");
  expect(sensory?.role).toBe("secondary");
  expect(sensory?.strength_label).toBe("Possible");
  expect(surveyRules().secondary_min_percentage).toBe(40);
  expect(surveyRules().secondary_within_points_of_primary).toBe(20);
});

it("returns co-primary categories when percentages match", () => {
  const scored = scoreSurvey([
    { question_id: "Q3", option_ids: ["A", "B"] },
    { question_id: "Q4", option_ids: ["A", "C"] },
  ]);

  expect(scored.tie).toBe(true);
  expect(scored.primary_ids.sort()).toEqual(["cerebrovascular", "neuroendocrine"]);
  expect(scored.displayed.map((category) => category.role)).toEqual([
    "co-primary",
    "co-primary",
  ]);
  expect(scored.follow_up_question_ids).toEqual(["Q3", "Q4"]);
});

it("lists Q2 when cerebrovascular and metabolic are the tied pair", () => {
  expect(
    followUpQuestionIds(["cerebrovascular", "metabolic_cellular"]),
  ).toEqual(["Q2"]);
});

it("lists Q5 and Q6 when vestibular and oculomotor are the tied pair", () => {
  expect(followUpQuestionIds(["vestibular", "oculomotor"])).toEqual([
    "Q5",
    "Q6",
  ]);
});

it("scores Q5A alone as vestibular 50%", () => {
  const scored = scoreSurvey([{ question_id: "Q5", option_ids: ["A"] }]);
  const vestibular = scored.categories.find(
    (category) => category.category_id === "vestibular",
  );

  expect(vestibular?.points).toBe(3);
  expect(vestibular?.max_points).toBe(6);
  expect(vestibular?.percentage).toBe(50);
  expect(formatPercentage(vestibular?.percentage ?? 0)).toBe("50%");
  expect(vestibular?.strength_label).toBe("Moderate");
  expect(vestibular?.role).toBe("primary");
  expect(scored.primary_ids).toEqual(["vestibular"]);
  expect(vestibular?.drivers).toEqual([
    expect.objectContaining({
      question_id: "Q5",
      option_id: "A",
      weight: 3,
    }),
  ]);
});

it("scores Q6B alone as oculomotor 60%", () => {
  const scored = scoreSurvey([{ question_id: "Q6", option_ids: ["B"] }]);
  const oculomotor = scored.categories.find(
    (category) => category.category_id === "oculomotor",
  );

  expect(oculomotor?.points).toBe(3);
  expect(oculomotor?.max_points).toBe(5);
  expect(oculomotor?.percentage).toBe(60);
  expect(formatPercentage(oculomotor?.percentage ?? 0)).toBe("60%");
  expect(oculomotor?.strength_label).toBe("Moderate");
  expect(scored.primary_ids).toEqual(["oculomotor"]);
  expect(oculomotor?.drivers.map((driver) => driver.option_id)).toEqual(["B"]);
});

it("scores Q1A plus Q2A as metabolic 60% primary and cerebrovascular about 42.9% secondary", () => {
  const scored = scoreSurvey([
    { question_id: "Q1", option_ids: ["A"] },
    { question_id: "Q2", option_ids: ["A"] },
  ]);
  const metabolic = scored.categories.find(
    (category) => category.category_id === "metabolic_cellular",
  );
  const cerebrovascular = scored.categories.find(
    (category) => category.category_id === "cerebrovascular",
  );

  expect(metabolic?.points).toBe(3);
  expect(metabolic?.max_points).toBe(5);
  expect(metabolic?.percentage).toBe(60);
  expect(metabolic?.strength_label).toBe("Moderate");
  expect(metabolic?.role).toBe("primary");
  expect(metabolic?.drivers.map((driver) => driver.option_id)).toEqual(["A"]);
  expect(scored.primary_ids).toEqual(["metabolic_cellular"]);

  expect(cerebrovascular?.points).toBe(3);
  expect(cerebrovascular?.max_points).toBe(7);
  expect(cerebrovascular?.percentage).toBeCloseTo(42.857, 2);
  expect(formatPercentage(cerebrovascular?.percentage ?? 0)).toBe("42.9%");
  expect(cerebrovascular?.strength_label).toBe("Moderate");
  expect(cerebrovascular?.role).toBe("secondary");
  expect(scored.secondary_ids).toEqual(["cerebrovascular"]);
  expect(cerebrovascular?.drivers.map((driver) => driver.option_id)).toEqual([
    "A",
  ]);
});

it("gives an exclusive option such as Q3C no points, even with other choices", () => {
  const alone = scoreSurvey([{ question_id: "Q3", option_ids: ["C"] }]);
  const mixed = scoreSurvey([
    { question_id: "Q3", option_ids: ["A", "B", "C"] },
  ]);
  const aloneCerebro = alone.categories.find(
    (category) => category.category_id === "cerebrovascular",
  );
  const mixedCerebro = mixed.categories.find(
    (category) => category.category_id === "cerebrovascular",
  );

  expect(aloneCerebro?.points).toBe(0);
  expect(aloneCerebro?.drivers).toEqual([]);
  expect(alone.primary_ids).toEqual([]);
  expect(mixedCerebro?.points).toBe(0);
  expect(mixedCerebro?.drivers).toEqual([]);
  expect(mixed.primary_ids).toEqual([]);
});

it("has no primary when every answer is a none option", () => {
  const scored = scoreSurvey([
    { question_id: "Q1", option_ids: ["none"] },
    { question_id: "Q2", option_ids: ["none"] },
    { question_id: "Q3", option_ids: ["C"] },
    { question_id: "Q4", option_ids: ["D"] },
    { question_id: "Q5", option_ids: ["none"] },
    { question_id: "Q6", option_ids: ["C"] },
    { question_id: "Q7", option_ids: ["none"] },
    { question_id: "Q8", option_ids: ["none"] },
    { question_id: "Q9", option_ids: ["B"] },
  ]);

  expect(scored.primary_ids).toEqual([]);
  expect(scored.secondary_ids).toEqual([]);
  expect(scored.tie).toBe(false);
  expect(scored.displayed).toEqual([]);
  expect(scored.categories.every((category) => category.points === 0)).toBe(
    true,
  );
  expect(
    scored.categories.every((category) => category.strength_label === null),
  ).toBe(true);
});

it("marks a vestibular and oculomotor tie as co-primary with Q5 and Q6", () => {
  const scored = scoreSurvey([
    { question_id: "Q5", option_ids: ["A", "B"] },
    { question_id: "Q6", option_ids: ["A", "B"] },
  ]);

  expect(scored.tie).toBe(true);
  expect(scored.primary_ids).toEqual(["vestibular", "oculomotor"]);
  expect(scored.secondary_ids).toEqual([]);
  expect(scored.follow_up_question_ids).toEqual(["Q5", "Q6"]);
  expect(scored.displayed.map((category) => category.role)).toEqual([
    "co-primary",
    "co-primary",
  ]);
  expect(scored.displayed.map((category) => category.percentage)).toEqual([
    100, 100,
  ]);
  expect(
    scored.displayed.every((category) => category.strength_label === "Strong"),
  ).toBe(true);
});
