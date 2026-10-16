import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import practitioners from "../../data/practitioners.json";
import samplePathways from "../../data/sample-pathways.json";
import CareTree from "./care-tree";

export const metadata: Metadata = {
  title: "Care roadmap | Post-concussion care navigation",
  description:
    "Sample care pathways to take to a GP. This tool does not give medical advice.",
};

export default function ResultsPage({
  searchParams,
}: PageProps<"/results">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Care pathways</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {samplePathways.disclaimer}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Drag the background to move the diagram. Scroll to zoom. Click a
          step to open sample practitioners underneath, and click it again to
          close the panel.
        </p>
        <p className="mt-3">
          <Link href="/" className="text-sm font-medium text-teal-800 underline">
            Back
          </Link>
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-600">Loading care pathways…</p>}>
        <ResultsDiagram searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ResultsDiagram({
  searchParams,
}: {
  searchParams: PageProps<"/results">["searchParams"];
}) {
  const { city } = await searchParams;
  const patientCity = typeof city === "string" ? city : "";

  return (
    <CareTree
      pathways={samplePathways.pathways}
      practitioners={practitioners}
      patientCity={patientCity}
    />
  );
}
