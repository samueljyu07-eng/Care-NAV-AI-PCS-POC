import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  importCareSteps,
  practitionerTypesFromCategories,
  reportLines,
  type SourceRecord,
} from "../lib/importCareSteps.mts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(root, "data/care-steps.csv");
const sourcesPath = path.join(root, "data/sources.json");
const categoriesPath = path.join(root, "data/categories.json");
const outPath = path.join(root, "data/care-steps.json");

const sourcesFile = JSON.parse(readFileSync(sourcesPath, "utf8")) as {
  sources: SourceRecord[];
};
const categoriesFile = JSON.parse(readFileSync(categoriesPath, "utf8")) as {
  categories?: { practitioner_types?: string[] }[];
};

const result = importCareSteps(readFileSync(csvPath, "utf8"), {
  sources: sourcesFile.sources,
  practitionerTypes: practitionerTypesFromCategories(categoriesFile),
});

for (const line of reportLines(result)) {
  console.log(line);
}

if (result.errors.length > 0) {
  console.log("Did not write data/care-steps.json.");
  process.exitCode = 1;
} else {
  writeFileSync(outPath, `${JSON.stringify(result.steps, null, 2)}\n`);
  console.log("Wrote data/care-steps.json.");
}
