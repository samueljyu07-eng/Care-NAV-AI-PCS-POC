import { expect, it } from "vitest";
import { categoryIds } from "./catalog";
import { addIsoDays, type JournalEntry } from "./journal";
import { adjustScores } from "./journalAdjustment";
import { assignScoreRoles, strengthLabel, type CategoryScore, type ScoreResult } from "./scoring";

const TODAY = "2026-11-04";
const RISING = [2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8];
const FALLING = [8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2];

function scored(
  partial: Record<string, { points: number; percentage: number }>,
): ScoreResult {
  const categories: CategoryScore[] = categoryIds().map((id) => {
    const item = partial[id] ?? { points: 0, percentage: 0 };
    return {
      category_id: id,
      points: item.points,
      max_points: 10,
      percentage: item.percentage,
      strength_label: strengthLabel(item.percentage),
      role: "unmatched",
      drivers: [],
    };
  });
  return assignScoreRoles(categories);
}

function entriesFor(series: Record<string, number[]>): JournalEntry[] {
  const length = Math.max(...Object.values(series).map((values) => values.length));
  return Array.from({ length }, (_, index) => {
    const severities: Record<string, number> = {};
    for (const [id, values] of Object.entries(series)) {
      if (index < values.length) {
        severities[id] = values[index];
      }
    }
    return {
      date: addIsoDays(TODAY, index - (length - 1)),
      severities,
      updatedAt: "2026-11-04T00:00:00.000Z",
    };
  });
}

function percent(result: ScoreResult, categoryId: string): number {
  return (
    result.categories.find((category) => category.category_id === categoryId)?.percentage ??
    -1
  );
}

it("leaves the survey scores unchanged when there is no journal", () => {
  const base = scored({ vestibular: { points: 3, percentage: 50 } });
  const adjustment = adjustScores(base, [], TODAY);

  expect(adjustment.applied).toBe(false);
  expect(adjustment.adjusted).toBe(base);
  expect(adjustment.reasons).toEqual([]);
  expect(percent(adjustment.adjusted, "vestibular")).toBe(50);
});

it("leaves the survey scores unchanged when fewer than three days are logged", () => {
  const base = scored({ vestibular: { points: 3, percentage: 50 } });
  const adjustment = adjustScores(
    base,
    entriesFor({ vestibular: [10, 10] }),
    TODAY,
  );

  expect(adjustment.applied).toBe(false);
  expect(adjustment.adjusted).toBe(base);
  expect(percent(adjustment.adjusted, "vestibular")).toBe(50);
});

it("raises a category on a rising trend and can move it onto the pathway list", () => {
  const base = scored({
    fatigue_activity: { points: 4, percentage: 80 },
    vestibular: { points: 2, percentage: 36 },
  });
  const adjustment = adjustScores(base, entriesFor({ vestibular: RISING }), TODAY);
  const vestibular = percent(adjustment.adjusted, "vestibular");

  expect(adjustment.applied).toBe(true);
  expect(vestibular).toBeGreaterThan(36);
  expect(vestibular).toBeCloseTo(36 * (1 + (24 / 35) * 0.2), 5);
  expect(vestibular).toBeLessThanOrEqual(36 * 1.2);
  expect(adjustment.adjusted.primary_ids).toEqual(["fatigue_activity"]);
  expect(adjustment.adjusted.secondary_ids).toContain("vestibular");
  expect(base.displayed.map((category) => category.category_id)).not.toContain("vestibular");
  expect(percent(base, "vestibular")).toBe(36);
  expect(
    adjustment.reasons.find((reason) => reason.category_id === "vestibular")?.direction,
  ).toBe("up");
});

it("lowers a category on a falling trend and can move it off the pathway list", () => {
  const base = scored({
    vestibular: { points: 5, percentage: 80 },
    fatigue_activity: { points: 3, percentage: 42 },
  });
  const adjustment = adjustScores(
    base,
    entriesFor({ fatigue_activity: FALLING }),
    TODAY,
  );
  const fatigue = percent(adjustment.adjusted, "fatigue_activity");

  expect(adjustment.applied).toBe(true);
  expect(fatigue).toBeLessThan(42);
  expect(fatigue).toBeCloseTo(42 * (1 - (24 / 35) * 0.2), 5);
  expect(fatigue).toBeGreaterThanOrEqual(42 * 0.8);
  expect(adjustment.adjusted.primary_ids).toEqual(["vestibular"]);
  expect(adjustment.adjusted.secondary_ids).not.toContain("fatigue_activity");
  expect(base.secondary_ids).toContain("fatigue_activity");
  expect(
    adjustment.reasons.find((reason) => reason.category_id === "fatigue_activity")
      ?.direction,
  ).toBe("down");
});

it("caps the nudge at 20 percent of the survey score", () => {
  const base = scored({
    vestibular: { points: 3, percentage: 50 },
    fatigue_activity: { points: 5, percentage: 90 },
    exertional_symptoms: { points: 3, percentage: 50 },
    sensory_peripheral: { points: 0, percentage: 0 },
  });
  const adjustment = adjustScores(
    base,
    entriesFor({
      vestibular: [10, 10, 10],
      fatigue_activity: [10, 10, 10],
      exertional_symptoms: [0, 0, 0],
      sensory_peripheral: [10, 10, 10],
    }),
    TODAY,
  );

  expect(percent(adjustment.adjusted, "vestibular")).toBeCloseTo(60, 5);
  expect(percent(adjustment.adjusted, "fatigue_activity")).toBeCloseTo(100, 5);
  expect(percent(adjustment.adjusted, "exertional_symptoms")).toBeCloseTo(40, 5);
  expect(percent(adjustment.adjusted, "sensory_peripheral")).toBe(0);
  expect(adjustment.adjusted.displayed.map((category) => category.category_id)).not.toContain(
    "sensory_peripheral",
  );
  expect(percent(base, "vestibular")).toBe(50);
});
