import practitioners from "../data/practitioners.json";

export type Practitioner = (typeof practitioners)[number];

function sameCity(givenCity: string, practitionerCity: string) {
  const location = givenCity.trim().toLowerCase();
  const city = practitionerCity.trim().toLowerCase();
  if (!location || !city) {
    return false;
  }

  const beforeComma = location.split(",")[0]?.trim();
  if (beforeComma === city) {
    return true;
  }

  const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(givenCity);
}

export function matchPractitioners(
  practitionerType: string,
  city: string,
): Practitioner[] {
  return practitioners.filter(
    (person) =>
      person.practitioner_type === practitionerType &&
      sameCity(city, person.city),
  );
}
