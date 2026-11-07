import practitionersFile from "../../data/practitioners.json";
import { SHARED_BOOKING_URL } from "./link";
import { clinicIdFromName, safeHttpUrl, type BookingDestination } from "./model";

export type Practitioner = {
  id: string;
  name: string;
  practitioner_type: string;
  city: string;
  clinic: string;
  about: string;
  details: {
    availability: string;
    languages: string[];
    accepting_new_patients: boolean;
  };
  sees_ages: ("teen" | "adult")[];
  bookingUrl?: string;
  phone?: string;
  website?: string;
};

type RawPractitioner = {
  id: string;
  name: string;
  practitioner_type: string;
  city: string;
  clinic: string;
  about: string;
  details: {
    availability: string;
    languages: string[];
    accepting_new_patients: boolean;
  };
  sees_ages: string[];
  bookingUrl?: string;
  phone?: string;
  website?: string;
};

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function asPractitioner(person: RawPractitioner): Practitioner {
  const seesAges = person.sees_ages.filter(
    (age): age is "teen" | "adult" => age === "teen" || age === "adult",
  );
  return {
    id: person.id,
    name: person.name,
    practitioner_type: person.practitioner_type,
    city: person.city,
    clinic: person.clinic,
    about: person.about,
    details: {
      availability: person.details.availability,
      languages: person.details.languages,
      accepting_new_patients: person.details.accepting_new_patients,
    },
    sees_ages: seesAges,
    bookingUrl: safeHttpUrl(SHARED_BOOKING_URL) ?? undefined,
    phone: optionalText(person.phone),
    website: optionalText(person.website),
  };
}

const practitioners = (practitionersFile as RawPractitioner[]).map(asPractitioner);

export function listPractitioners(): Practitioner[] {
  return practitioners;
}

export function practitionerById(id: string): Practitioner | undefined {
  return practitioners.find((person) => person.id === id);
}

export function clinicIdFor(person: Practitioner): string {
  return clinicIdFromName(person.clinic);
}

export function destinationUrl(
  person: Practitioner,
  destination: BookingDestination,
): { ok: true; url: string | null } | { ok: false; error: string } {
  if (person.bookingUrl) {
    if (destination !== "booking") {
      return { ok: false, error: "This clinician has a booking page." };
    }
    const url = safeHttpUrl(person.bookingUrl);
    if (!url) {
      return { ok: false, error: "This clinician's booking page is not a valid link." };
    }
    return { ok: true, url };
  }

  if (destination === "website") {
    const url = safeHttpUrl(person.website);
    if (!url) {
      return { ok: false, error: "This clinician has no website listed." };
    }
    return { ok: true, url };
  }

  if (destination === "phone") {
    if (!person.phone) {
      return { ok: false, error: "This clinician has no phone number listed." };
    }
    return { ok: true, url: null };
  }

  return { ok: false, error: "This clinician has no booking page." };
}
