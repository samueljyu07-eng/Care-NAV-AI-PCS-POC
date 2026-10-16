import type { Metadata } from "next";
import Link from "next/link";
import practitioners from "../../data/practitioners.json";
import samplePathways from "../../data/sample-pathways.json";
import SavedIntake from "./saved-intake";

export const metadata: Metadata = {
  title: "Care roadmap | Post-concussion care navigation",
  description:
    "Sample care pathways to take to a GP. This tool does not give medical advice.",
};

export default function ResultsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Care pathways</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {samplePathways.disclaimer}
        </p>
      </div>
      <SavedIntake
        pathways={samplePathways.pathways}
        practitioners={practitioners}
      >
        <p className="text-sm text-slate-600">
          Use the + and − buttons to zoom. On a phone, drag to move the
          diagram. On a larger screen, drag the background and scroll to
          zoom. Click a step to open practitioners under that step, and
          click it again to close them.
        </p>
        <p>
          <Link href="/" className="text-sm font-medium text-teal-800 underline">
            Back
          </Link>
        </p>
      </SavedIntake>
      <aside
        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4"
        role="note"
      >
        <p className="text-sm font-semibold text-amber-950">Not medical advice</p>
        <p className="mt-1 text-sm leading-6 text-amber-950">
          {samplePathways.disclaimer}
        </p>
      </aside>
    </main>
  );
}
