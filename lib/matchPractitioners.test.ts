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

it("does not match a different city or practitioner type", () => {
  expect(matchPractitioners("vestibular_physio", "Calgary").map((person) => person.id)).toEqual([
    "p002",
  ]);
  expect(matchPractitioners("psychologist", "Kelowna").map((person) => person.city)).toEqual([
    "Kelowna",
  ]);
  expect(matchPractitioners("sleep_specialist", "Vancouver")).toEqual([]);
});
