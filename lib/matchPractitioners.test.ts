import { expect, it } from "vitest";
import { matchPractitioners } from "./matchPractitioners";

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

it("does not match a different city or practitioner type", () => {
  expect(matchPractitioners("vestibular_physio", "Calgary").map((person) => person.id)).toEqual([
    "p002",
  ]);
  expect(matchPractitioners("psychologist", "Kelowna").map((person) => person.city)).toEqual([
    "Kelowna",
  ]);
  expect(matchPractitioners("sleep_specialist", "Vancouver")).toEqual([]);
});
