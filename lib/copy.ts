import type { AgeBand } from "./catalog";

export const PROVISIONAL_LABEL = "Based on your intake only.";

export const RESULTS_FOOTER =
  "Sources are under clinician review. Demo only. This is not a diagnosis or a probability; it shows how closely your answers match common patterns.";

export const UNDER_13_MESSAGE =
  "This demo is for teens 13 to 17 and adults 18 and older. For a child 12 or younger, please talk with their pediatric clinician or family doctor. If something feels urgent, call 911 or go to the nearest emergency department.";

export const TEEN_FRAMING =
  "These answers are about a teen. A parent or guardian should review them with a pediatric clinician. Teen-specific content is pending clinician review.";

export const TEEN_RED_FLAG_NOTE =
  "The urgent-warning list for teens is pending clinician review and may differ from the list used here.";

export const ADULT_DISCLAIMER =
  "These pathways are a navigation roadmap to take to a GP. They are not a diagnosis, a prescription, or medical advice, and they do not promise any outcome.";

export const TEEN_DISCLAIMER =
  "These pathways are a navigation roadmap for a parent or guardian to take to a pediatric clinician. They are not a diagnosis, a prescription, or medical advice, and they do not promise any outcome.";

export function pathwayDisclaimer(ageBand: AgeBand) {
  return ageBand === "13-17" ? TEEN_DISCLAIMER : ADULT_DISCLAIMER;
}
