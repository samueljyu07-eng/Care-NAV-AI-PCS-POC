export const CLINIC_REFERRAL_EMAIL = "New CareNav referral — view it in your portal";

export type ClinicReferralNotice = {
  to: string | null;
  body: string;
};

export function clinicPortalUrl(): string {
  const base = (process.env.CARENAV_APP_URL ?? "http://localhost:3000").trim().replace(/\/+$/, "");
  return `${base}/portal`;
}

export function clinicReferralNotice(): ClinicReferralNotice {
  const to = process.env.CARENAV_CLINIC_NOTIFY_EMAIL?.trim() || null;
  return {
    to,
    body: `${CLINIC_REFERRAL_EMAIL} ${clinicPortalUrl()}`,
  };
}

export function logClinicReferral(clinicId: string): void {
  const notice = clinicReferralNotice();
  const destination = notice.to ?? "unset";
  // TODO: connect an email provider. Do not add patient details to this message.
  console.info(
    `[booking] TODO email provider is not connected. ${notice.body} clinicId=${clinicId} to=${destination}`,
  );
}
