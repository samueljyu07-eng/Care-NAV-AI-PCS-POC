import { expect, it } from "vitest";
import { cliniciansForStep, matchPractitioners } from "./matchPractitioners";

it("matches practitioner type and city without caring about letter case", () => {
  const matches = matchPractitioners("vestibular_physio", "kelowna");

  expect(matches.map((person) => person.id)).toEqual(["p001"]);
});

it("matches the city in a city-and-province answer", () => {
  const matches = matchPractitioners(
    "vision_therapist",
    "Kelowna, British Columbia",
  );

  expect(matches.map((person) => person.name)).toEqual(["Ellis Northvale"]);
});

it("hides an adult-only practitioner from a teen and still shows them to an adult", () => {
  expect(
    matchPractitioners("sports_medicine_physician", "Vancouver", "13-17"),
  ).toEqual([]);
  expect(
    matchPractitioners("sports_medicine_physician", "Vancouver", "18+").map(
      (person) => person.id,
    ),
  ).toEqual(["p012"]);
  expect(
    matchPractitioners("sports_medicine_physician", "Kelowna", "13-17").map(
      (person) => person.id,
    ),
  ).toEqual(["p011"]);
});

it("matches optometrists in Kelowna and Calgary for teens and adults", () => {
  expect(
    matchPractitioners("optometrist", "Kelowna", "13-17").map((person) => person.id),
  ).toEqual(["p016"]);
  expect(
    matchPractitioners("optometrist", "Calgary", "18+").map((person) => person.id),
  ).toEqual(["p017"]);
});

it("shows only practitioners who match the step type, city, and age band", () => {
  const kelownaPhysios = cliniciansForStep("physiotherapist", "Kelowna, BC", "18+");

  expect(kelownaPhysios.map((person) => person.name)).toEqual(["Theo Marlowe"]);
  expect(kelownaPhysios.every((person) => person.practitioner_type === "physiotherapist")).toBe(
    true,
  );
  expect(kelownaPhysios.every((person) => person.city === "Kelowna")).toBe(true);
  expect(kelownaPhysios.every((person) => person.sees_ages.includes("adult"))).toBe(true);

  expect(cliniciansForStep("sports_medicine_physician", "Vancouver", "13-17")).toEqual([]);
  expect(
    cliniciansForStep("sports_medicine_physician", "Vancouver", "18+").map(
      (person) => person.name,
    ),
  ).toEqual(["Owen Hartwell"]);
});

it("does not match a different city or practitioner type", () => {
  expect(matchPractitioners("vestibular_physio", "Calgary").map((person) => person.id)).toEqual([
    "p002",
  ]);
  expect(matchPractitioners("psychologist", "Kelowna").map((person) => person.city)).toEqual([
    "Kelowna",
  ]);
  expect(matchPractitioners("sleep_specialist", "Vancouver")).toEqual([]);
});
