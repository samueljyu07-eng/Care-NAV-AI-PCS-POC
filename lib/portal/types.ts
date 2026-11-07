import type {
  PatientContact,
  PatientSays,
  ReferralStatus,
} from "../booking/model";
import type { ResultsFile } from "../booking/snapshot";

export type ReferralQuery = {
  clinicId?: string;
  clinicianId?: string;
  status?: ReferralStatus;
};

export type ReferralListItem = {
  id: string;
  createdAt: string;
  receivedLabel: string;
  patientName: string;
  ageLabel: string;
  clinicianId: string;
  clinicianName: string;
  clinicId: string;
  clinicName: string;
  status: ReferralStatus;
  statusLabel: string;
  patientSays: PatientSays;
  patientSaysLabel: string;
};

export type ReferralSummary = {
  thisMonth: number;
  selfReportedBooked: number;
  clinicConfirmedBooked: number;
};

export type PortalOption = {
  id: string;
  name: string;
  clinicId?: string;
};

export type ReferralListResult = {
  referrals: ReferralListItem[];
  summary: ReferralSummary;
  clinics: PortalOption[];
  clinicians: PortalOption[];
};

export type ReferralDetail = {
  id: string;
  createdAt: string;
  receivedLabel: string;
  clinicId: string;
  clinicName: string;
  clinicianId: string;
  clinicianName: string;
  status: ReferralStatus;
  statusLabel: string;
  statusUpdatedAt: string;
  firstViewedAt: string | null;
  patient: PatientContact;
  patientSays: PatientSays;
  patientSaysLabel: string;
  ageLabel: string;
  snapshot: ResultsFile;
};
