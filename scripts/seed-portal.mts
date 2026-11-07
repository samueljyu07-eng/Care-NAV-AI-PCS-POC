import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STATUSES = new Set(["new", "viewed", "contacted", "booked", "closed"]);
const ACTIONS = new Set(["viewed_list", "opened_referral", "status_changed", "printed"]);

function bookingFilePath(): string {
  const override = process.env.BOOKING_STORE_PATH?.trim();
  if (override) {
    return override;
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  return path.join(root, "data", "runtime", "bookings.json");
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function upgradeReferral(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const referral = value as Record<string, unknown>;
  if (typeof referral.id !== "string" || typeof referral.createdAt !== "string") {
    return null;
  }
  const patient =
    referral.patient && typeof referral.patient === "object"
      ? (referral.patient as Record<string, unknown>)
      : {};
  const status = STATUSES.has(String(referral.status)) ? referral.status : "new";
  return {
    ...referral,
    status,
    statusUpdatedAt: text(referral.statusUpdatedAt) || referral.createdAt,
    firstViewedAt: text(referral.firstViewedAt) || null,
    patient: {
      name: text(patient.name),
      phone: text(patient.phone),
      email: text(patient.email),
    },
  };
}

function upgradeLog(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const entry = value as Record<string, unknown>;
  const details = text(entry.details);
  if (!ACTIONS.has(String(entry.action)) || entry.actor !== "shared-portal") {
    return null;
  }
  if (details.length > 200 || details.includes("@")) {
    return null;
  }
  return {
    ...entry,
    referralId: typeof entry.referralId === "string" ? entry.referralId : null,
    details,
  };
}

type BookingFile = {
  attempts: Record<string, unknown>[];
  referrals: Record<string, unknown>[];
  accessLogs: Record<string, unknown>[];
};

function readBookingFile(): BookingFile {
  try {
    const parsed = JSON.parse(readFileSync(bookingFilePath(), "utf8")) as Partial<BookingFile>;
    return {
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      referrals: Array.isArray(parsed.referrals)
        ? parsed.referrals.flatMap((item) => {
            const referral = upgradeReferral(item);
            return referral ? [referral] : [];
          })
        : [],
      accessLogs: Array.isArray(parsed.accessLogs)
        ? parsed.accessLogs.flatMap((item) => {
            const entry = upgradeLog(item);
            return entry ? [entry] : [];
          })
        : [],
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { attempts: [], referrals: [], accessLogs: [] };
    }
    throw error;
  }
}

function writeBookingFile(store: BookingFile): void {
  const filePath = bookingFilePath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(store, null, 2));
  renameSync(tempPath, filePath);
}

type Step = {
  order: number;
  stepId: string;
  title: string;
  shortLabel: string;
  practitionerTypeId: string;
  practitionerTypeLabel: string;
};

type Seed = {
  n: number;
  createdAt: string;
  practitionerId: string;
  clinicId: string;
  pathwayId: string;
  attemptStatus: "clicked" | "booked" | "remind_later" | "dismissed" | "expired";
  referralStatus: "new" | "viewed" | "contacted" | "booked" | "closed";
  name: string;
  phone: string;
  email: string;
  ageBand: "13-17" | "18+";
  ageLabel: string;
  city: string;
  concerns: string;
  symptoms: string[];
  categoryId: string;
  pathwayName: string;
  color: { background: string; border: string };
  steps: Step[];
};

const ADULT_DISCLAIMER =
  "These pathways are a navigation roadmap to take to a GP. They are not a diagnosis, a prescription, or medical advice, and they do not promise any outcome.";
const TEEN_DISCLAIMER =
  "These pathways are a navigation roadmap for a parent or guardian to take to a pediatric clinician. They are not a diagnosis, a prescription, or medical advice, and they do not promise any outcome.";
const TEEN_NOTE =
  "These answers are about a teen. A parent or guardian should review them with a pediatric clinician. Teen-specific content is pending clinician review.";
const FOOTER =
  "Sources are under clinician review. Demo only. This is not a diagnosis or a probability; it shows how closely your answers match common patterns.";

const VESTIBULAR: Pick<Seed, "categoryId" | "pathwayName" | "color" | "steps"> = {
  categoryId: "vestibular",
  pathwayName: "Balance, dizziness and visual motion",
  color: { background: "#efe8f7", border: "#7d6d9a" },
  steps: [
    {
      order: 1,
      stepId: "VES-01",
      title: "Get a balance and dizziness assessment",
      shortLabel: "Assess balance and dizziness",
      practitionerTypeId: "vestibular_physio",
      practitionerTypeLabel: "Vestibular physiotherapist",
    },
    {
      order: 2,
      stepId: "VES-02",
      title: "Clinician-directed vestibular rehabilitation",
      shortLabel: "Get guided balance care",
      practitionerTypeId: "vestibular_physio",
      practitionerTypeLabel: "Vestibular physiotherapist",
    },
  ],
};

const VISION: Pick<Seed, "categoryId" | "pathwayName" | "color" | "steps"> = {
  categoryId: "oculomotor",
  pathwayName: "Eye tracking, focusing and screen strain",
  color: { background: "#f8e8ec", border: "#a15d6e" },
  steps: [
    {
      order: 1,
      stepId: "OCU-01",
      title: "Get a vision and eye-movement assessment",
      shortLabel: "Get an eye assessment",
      practitionerTypeId: "optometrist",
      practitionerTypeLabel: "Optometrist",
    },
  ],
};

const NECK: Pick<Seed, "categoryId" | "pathwayName" | "color" | "steps"> = {
  categoryId: "sensory_peripheral",
  pathwayName: "Neck tension and sensory sensitivity",
  color: { background: "#e5f3f2", border: "#4f8a86" },
  steps: [
    {
      order: 1,
      stepId: "SEN-01",
      title: "Assess persistent neck pain, dizziness, or headache",
      shortLabel: "Assess neck pain",
      practitionerTypeId: "physiotherapist",
      practitionerTypeLabel: "Physiotherapist",
    },
  ],
};

const FATIGUE: Pick<Seed, "categoryId" | "pathwayName" | "color" | "steps"> = {
  categoryId: "fatigue_activity",
  pathwayName: "Energy and recovery after effort",
  color: { background: "#e5f2eb", border: "#5f8f78" },
  steps: [
    {
      order: 1,
      stepId: "MET-01",
      title: "Discuss fatigue and symptoms with your GP",
      shortLabel: "Discuss fatigue with GP",
      practitionerTypeId: "gp_family_physician",
      practitionerTypeLabel: "Family physician",
    },
  ],
};

const SEEDS: Seed[] = [
  {
    n: 1,
    createdAt: "2026-11-06T18:05:00.000Z",
    practitionerId: "p001",
    clinicId: "lantern-bend-vestibular-studio",
    pathwayId: "vestibular",
    attemptStatus: "remind_later",
    referralStatus: "new",
    name: "Alder Quinn",
    phone: "250-555-0191",
    email: "alder.quinn.demo@example.com",
    ageBand: "18+",
    ageLabel: "18 or older",
    city: "Kelowna",
    concerns: "Synthetic demo: rooms feel like they spin when I turn my head.",
    symptoms: ["Dizziness"],
    ...VESTIBULAR,
  },
  {
    n: 2,
    createdAt: "2026-11-05T17:10:00.000Z",
    practitionerId: "p001",
    clinicId: "lantern-bend-vestibular-studio",
    pathwayId: "vestibular",
    attemptStatus: "booked",
    referralStatus: "viewed",
    name: "Birch Ellison",
    phone: "250-555-0192",
    email: "birch.ellison.demo@example.com",
    ageBand: "18+",
    ageLabel: "18 or older",
    city: "Kelowna",
    concerns: "Synthetic demo: busy grocery stores make the dizziness worse.",
    symptoms: ["Dizziness", "Headache"],
    ...VESTIBULAR,
  },
  {
    n: 3,
    createdAt: "2026-11-04T20:15:00.000Z",
    practitionerId: "p003",
    clinicId: "glasspine-vision-workshop",
    pathwayId: "oculomotor",
    attemptStatus: "clicked",
    referralStatus: "contacted",
    name: "Cedar Holm",
    phone: "250-555-0193",
    email: "cedar.holm.demo@example.com",
    ageBand: "18+",
    ageLabel: "18 or older",
    city: "Kelowna",
    concerns: "Synthetic demo: reading on a screen brings on eye strain.",
    symptoms: ["Light sensitivity"],
    ...VISION,
  },
  {
    n: 4,
    createdAt: "2026-11-03T16:40:00.000Z",
    practitionerId: "p015",
    clinicId: "cinder-street-family-practice",
    pathwayId: "fatigue_activity",
    attemptStatus: "booked",
    referralStatus: "booked",
    name: "Dove Pellham",
    phone: "403-555-0194",
    email: "dove.pellham.demo@example.com",
    ageBand: "18+",
    ageLabel: "18 or older",
    city: "Calgary",
    concerns: "Synthetic demo: a short walk leaves me exhausted for the rest of the day.",
    symptoms: ["Headache"],
    ...FATIGUE,
  },
  {
    n: 5,
    createdAt: "2026-11-02T19:20:00.000Z",
    practitionerId: "p009",
    clinicId: "ridgepath-movement-clinic",
    pathwayId: "sensory_peripheral",
    attemptStatus: "dismissed",
    referralStatus: "closed",
    name: "Ember Solano",
    phone: "250-555-0195",
    email: "ember.solano.demo@example.com",
    ageBand: "18+",
    ageLabel: "18 or older",
    city: "Kelowna",
    concerns: "Synthetic demo: neck tightness and noise sensitivity started after the injury.",
    symptoms: ["Neck pain", "Noise sensitivity"],
    ...NECK,
  },
  {
    n: 6,
    createdAt: "2026-11-01T18:00:00.000Z",
    practitionerId: "p014",
    clinicId: "orchard-lamp-family-practice",
    pathwayId: "fatigue_activity",
    attemptStatus: "clicked",
    referralStatus: "new",
    name: "Fern Wicklow",
    phone: "250-555-0196",
    email: "fern.wicklow.demo@example.com",
    ageBand: "13-17",
    ageLabel: "13 to 17",
    city: "Kelowna",
    concerns: "Synthetic demo: a teen who tires out after schoolwork.",
    symptoms: ["Headache"],
    ...FATIGUE,
  },
  {
    n: 7,
    createdAt: "2026-10-28T18:30:00.000Z",
    practitionerId: "p007",
    clinicId: "meadow-circuit-psychology",
    pathwayId: "fatigue_activity",
    attemptStatus: "remind_later",
    referralStatus: "viewed",
    name: "Glen Harrow",
    phone: "250-555-0197",
    email: "glen.harrow.demo@example.com",
    ageBand: "18+",
    ageLabel: "18 or older",
    city: "Kelowna",
    concerns: "Synthetic demo: worry and fatigue have both been hard to describe.",
    symptoms: ["Headache"],
    ...FATIGUE,
  },
  {
    n: 8,
    createdAt: "2026-11-06T15:25:00.000Z",
    practitionerId: "p002",
    clinicId: "copper-finch-balance-room",
    pathwayId: "vestibular",
    attemptStatus: "expired",
    referralStatus: "contacted",
    name: "Harbor Linnet",
    phone: "403-555-0198",
    email: "harbor.linnet.demo@example.com",
    ageBand: "18+",
    ageLabel: "18 or older",
    city: "Calgary",
    concerns: "Synthetic demo: motion on the train sets off dizziness.",
    symptoms: ["Dizziness"],
    ...VESTIBULAR,
  },
];

function id(kind: "1" | "2" | "3", n: number): string {
  const heads = {
    "1": "11111111-1111-4111-8111",
    "2": "22222222-2222-4222-8222",
    "3": "33333333-3333-4333-8333",
  };
  return `${heads[kind]}-${String(n).padStart(12, "0")}`;
}

function snapshot(seed: Seed) {
  const teen = seed.ageBand === "13-17";
  return {
    kind: "results-file",
    capturedAt: seed.createdAt,
    view: { showAllPatterns: false, treeDetail: "simple" },
    intake: {
      ageBand: seed.ageBand,
      ageLabel: seed.ageLabel,
      city: seed.city,
      timeline: "1 month",
      symptoms: seed.symptoms,
      symptomText: seed.symptoms.join(", "),
      concerns: seed.concerns,
      pastAttempts: "Rest and a visit with a family doctor. This is synthetic demo text.",
    },
    survey: [
      {
        questionId: "Q1",
        summary: "Exhaustion after minor mental/physical effort",
        questionText: "Exhaustion after minor mental/physical effort",
        selection: "single",
        selected: [
          {
            optionId: "A",
            text: "Constant brain fog and deep physical exhaustion lasting days",
          },
        ],
      },
    ],
    scores: null,
    journal: { note: null, entries: [] },
    notices: {
      draftBanner: "Draft: pending clinician review",
      teenNote: teen ? TEEN_NOTE : null,
      disclaimer: teen ? TEEN_DISCLAIMER : ADULT_DISCLAIMER,
      footer: FOOTER,
      refineNote: null,
    },
    pathways: [
      {
        categoryId: seed.categoryId,
        name: seed.pathwayName,
        evidenceBadge: "Guideline",
        whyItMayApply: "Synthetic demo: the intake answers overlap this pattern.",
        scoreText: "Strong · 9 of 9 · 100%",
        percentage: 100,
        points: 9,
        maxPoints: 9,
        strengthLabel: "Strong",
        role: "primary",
        note: null,
        sources: [],
        color: seed.color,
        shownOnPage: true,
        steps: seed.steps.map((step) => ({
          order: step.order,
          stepId: step.stepId,
          title: step.title,
          shortLabel: step.shortLabel,
          practitionerTypeId: step.practitionerTypeId,
          practitionerTypeLabel: step.practitionerTypeLabel,
          rationale: "Synthetic demo: a clinician can talk through this step. This is not medical advice.",
          safetyNote: "",
          draftLabel: null,
          sources: [],
        })),
      },
    ],
  };
}

function addSeed(store: BookingFile, seed: Seed): boolean {
  const referralId = id("1", seed.n);
  if (store.referrals.some((item) => item.id === referralId)) {
    return false;
  }
  const viewed = seed.referralStatus === "new" ? null : seed.createdAt;
  store.attempts.push({
    id: id("2", seed.n),
    createdAt: seed.createdAt,
    practitionerId: seed.practitionerId,
    clinicId: seed.clinicId,
    pathwayId: seed.pathwayId,
    sessionId: id("3", seed.n),
    sharedWithClinic: true,
    parentalConsent: seed.ageBand === "13-17",
    consentTextVersion: "2026-11-06.2",
    status: seed.attemptStatus,
    statusUpdatedAt: seed.createdAt,
  });
  store.referrals.push({
    id: referralId,
    attemptId: id("2", seed.n),
    clinicId: seed.clinicId,
    createdAt: seed.createdAt,
    snapshot: snapshot(seed),
    status: seed.referralStatus,
    statusUpdatedAt: seed.createdAt,
    firstViewedAt: viewed,
    patient: { name: seed.name, phone: seed.phone, email: seed.email },
  });
  return true;
}

const store = readBookingFile();
let added = 0;
for (const seed of SEEDS) {
  if (addSeed(store, seed)) {
    added += 1;
  }
}
writeBookingFile(store);
console.log(`Added ${added} synthetic referrals. The file now has ${store.referrals.length} referrals.`);
