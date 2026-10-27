import type { Metadata } from "next";
import SavedIntake from "./saved-intake";

export const metadata: Metadata = {
  title: "Care roadmap | Post-concussion care navigation",
  description:
    "Care pathways to take to a clinician. This tool does not give medical advice.",
};

export default function ResultsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-black">Care pathways</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#545454]">
          Paths are grouped by possible contributing patterns. A short survey
          scores how closely the answers match. This is not a diagnosis.
        </p>
      </div>
      <SavedIntake />
    </main>
  );
}
