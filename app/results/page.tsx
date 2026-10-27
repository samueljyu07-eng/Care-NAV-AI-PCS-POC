import type { Metadata } from "next";
import Link from "next/link";
import { PATHWAY_DISCLAIMER } from "../../lib/systemPrompt";
import SavedIntake from "./saved-intake";

export const metadata: Metadata = {
  title: "Care roadmap | Post-concussion care navigation",
  description:
    "Sample care pathways to take to a GP. This tool does not give medical advice.",
};

export default function ResultsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-black">Care pathways</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#545454]">
          {PATHWAY_DISCLAIMER}
        </p>
      </div>
      <SavedIntake>
        <p className="text-base leading-7 text-[#545454]">
          Use the + and − buttons to zoom. On a phone, drag to move the
          diagram. On a larger screen, drag the background and scroll to
          zoom. Click a step to open practitioners under that step, and
          click it again to close them.
        </p>
        <p>
          <Link href="/" className="text-base font-medium text-black underline decoration-black underline-offset-4 transition-colors duration-200 hover:text-[#545454] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
            Back
          </Link>
        </p>
      </SavedIntake>
      <aside
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4"
        role="note"
      >
        <p className="text-base font-semibold text-amber-950">Not medical advice</p>
        <p className="mt-1 text-base leading-7 text-amber-950">
          {PATHWAY_DISCLAIMER}
        </p>
      </aside>
    </main>
  );
}
