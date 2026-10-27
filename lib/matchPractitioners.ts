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
  ageBand?: "13-17" | "18+",
): Practitioner[] {
  const needed =
    ageBand === "13-17" ? "teen" : ageBand === "18+" ? "adult" : null;
  return practitioners.filter((person) => {
    if (
      person.practitioner_type !== practitionerType ||
      !sameCity(city, person.city)
    ) {
      return false;
    }
    if (!needed) {
      return true;
    }
    return person.sees_ages.includes(needed);
  });
}

export function cliniciansForStep(
  practitionerType: string,
  city: string,
  ageBand?: "13-17" | "18+",
): Practitioner[] {
  return matchPractitioners(practitionerType, city, ageBand)
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name));
}
