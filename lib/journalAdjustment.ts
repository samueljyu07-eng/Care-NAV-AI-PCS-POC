import { categoryById } from "./catalog";
import {
  addIsoDays,
  categoryLabel,
  isIsoDate,
  parseJournalEntries,
  type JournalEntry,
} from "./journal";
import {
  assignScoreRoles,
  strengthLabel,
  type ScoreResult,
} from "./scoring";

export const JOURNAL_ADJUSTMENT = {
  minEntries: 3,
  windowDays: 14,
  maxRelativeShift: 0.2,
  neutralSeverity: 5,
  trendFullScale: 5,
  steadyPercentage: 0.05,
} as const;

export type JournalDirection = "up" | "down" | "steady";

export type JournalReason = {
  category_id: string;
  direction: JournalDirection;
  average: number;
  trend: number;
  days: number;
};

export type JournalAdjustment = {
  applied: boolean;
  base: ScoreResult;
  adjusted: ScoreResult;
  reasons: JournalReason[];
};

export type JournalModelCategory = {
  category_id: string;
  patient_label: string;
  direction: JournalDirection;
  average: number;
  trend: number;
  days: number;
  base_percentage: number;
  adjusted_percentage: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function entriesInWindow(
  entries: JournalEntry[],
  today?: string,
): JournalEntry[] {
  const collapsed = parseJournalEntries(entries);
  const end =
    today && isIsoDate(today) ? today : collapsed[collapsed.length - 1]?.date;
  if (!end) {
    return [];
  }
  const start = addIsoDays(end, -(JOURNAL_ADJUSTMENT.windowDays - 1));
  return collapsed.filter((entry) => entry.date >= start && entry.date <= end);
}

function signalFor(entries: JournalEntry[], categoryId: string) {
  const values = entries.flatMap((entry) => {
    const value = entry.severities[categoryId];
    return typeof value === "number" && Number.isFinite(value) ? [value] : [];
  });
  if (values.length === 0) {
    return null;
  }
  const mid = Math.floor(values.length / 2);
  const earlier = values.slice(0, mid);
  const recent = values.slice(mid);
  const average = mean(values);
  const trend = values.length < 2 ? 0 : mean(recent) - mean(earlier);
  const level = clamp(
    (average - JOURNAL_ADJUSTMENT.neutralSeverity) /
      JOURNAL_ADJUSTMENT.neutralSeverity,
    -1,
    1,
  );
  const trendSignal = clamp(trend / JOURNAL_ADJUSTMENT.trendFullScale, -1, 1);
  const combined = clamp(level + trendSignal, -1, 1);
  return {
    average,
    trend,
    days: values.length,
    multiplier: 1 + combined * JOURNAL_ADJUSTMENT.maxRelativeShift,
  };
}

export function adjustScores(
  base: ScoreResult,
  entries: JournalEntry[],
  today?: string,
): JournalAdjustment {
  const windowed = entriesInWindow(entries, today);
  if (windowed.length < JOURNAL_ADJUSTMENT.minEntries) {
    return { applied: false, base, adjusted: base, reasons: [] };
  }

  const reasons: JournalReason[] = [];
  const categories = base.categories.map((category) => {
    const signal = signalFor(windowed, category.category_id);
    let percentage = category.percentage;
    if (category.points > 0 && signal) {
      percentage = clamp(category.percentage * signal.multiplier, 0, 100);
    }
    if (Math.abs(percentage - category.percentage) <= JOURNAL_ADJUSTMENT.steadyPercentage) {
      percentage = category.percentage;
    }
    const direction: JournalDirection =
      percentage > category.percentage
        ? "up"
        : percentage < category.percentage
          ? "down"
          : "steady";
    if (signal && signal.days > 0) {
      reasons.push({
        category_id: category.category_id,
        direction,
        average: round1(signal.average),
        trend: round1(signal.trend),
        days: signal.days,
      });
    }
    return {
      ...category,
      percentage,
      strength_label: strengthLabel(percentage),
      role: "unmatched" as const,
    };
  });

  return {
    applied: true,
    base,
    adjusted: assignScoreRoles(categories),
    reasons,
  };
}

export function journalModelBrief(adjustment: JournalAdjustment): {
  categories: JournalModelCategory[];
} {
  return {
    categories: adjustment.reasons.map((reason) => {
      const base = adjustment.base.categories.find(
        (category) => category.category_id === reason.category_id,
      );
      const adjusted = adjustment.adjusted.categories.find(
        (category) => category.category_id === reason.category_id,
      );
      return {
        category_id: reason.category_id,
        patient_label: categoryLabel(reason.category_id),
        direction: reason.direction,
        average: reason.average,
        trend: reason.trend,
        days: reason.days,
        base_percentage: round1(base?.percentage ?? 0),
        adjusted_percentage: round1(adjusted?.percentage ?? 0),
      };
    }),
  };
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) {
    return labels[0] ?? "";
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function journalChangeText(reasons: JournalReason[]): string {
  const higher = reasons
    .filter((reason) => reason.direction === "up")
    .map((reason) => categoryById(reason.category_id)?.patient_label ?? reason.category_id);
  const lower = reasons
    .filter((reason) => reason.direction === "down")
    .map((reason) => categoryById(reason.category_id)?.patient_label ?? reason.category_id);
  const sentences = [
    "Recent check-ins are supporting information for your visit. They are not a diagnosis.",
  ];
  if (higher.length > 0) {
    sentences.push(
      `${joinLabels(higher)} ${higher.length === 1 ? "has" : "have"} been higher lately.`,
    );
  }
  if (lower.length > 0) {
    sentences.push(
      `${joinLabels(lower)} ${lower.length === 1 ? "has" : "have"} been easing.`,
    );
  }
  if (higher.length === 0 && lower.length === 0) {
    sentences.push("The recent check-ins were steady, so the survey scores stayed in place.");
  }
  return sentences.join(" ");
}
