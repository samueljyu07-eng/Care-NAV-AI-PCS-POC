// Patient-facing booking words live here. Bump the version when the consent paragraphs change.
export const CONSENT_TEXT_VERSION = "2026-11-06.2";

export function consentIntro(clinicName: string): string {
  return `${clinicName} can receive your name, phone, email, intake answers, survey results, and the care pathway tree shown on your results page. CareNav sends that file when you press Continue, even if you do not finish booking. The clinic sees it in their CareNav portal.`;
}

export const CONSENT_UNCHECKED =
  "If you leave the box unchecked, nothing is sent to the clinic.";

export function shareLabel(clinicName: string): string {
  return `Send my file to ${clinicName}`;
}

export const PARENT_LABEL =
  "I am the parent/guardian, or I have their permission.";

export const CONTINUE_LABEL = "Continue to booking";
export const CANCEL_LABEL = "Cancel";
export const BOOK_BUTTON = "Book";
export const CALL_BUTTON = "Call";
export const WEBSITE_BUTTON = "Website";

export const PROMPT_WAITING =
  "Finish booking in the other tab, then come back and tell us how it went.";
export const PROMPT_RETURNED = "Did you book?";
export const BOOKED_LABEL = "I booked";
export const LATER_LABEL = "Not yet, remind me later";
export const BADGE_LABEL = "Finish where you left off";
export const SAVE_ERROR = "That could not be saved. Please try again.";

export function callLabel(phone: string): string {
  return `Call ${phone}`;
}
