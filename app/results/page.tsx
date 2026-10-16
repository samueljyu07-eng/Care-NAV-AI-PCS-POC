import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Care roadmap | Post-concussion care navigation",
  description:
    "Your care roadmap will appear here. This tool does not give medical advice.",
};

export default function ResultsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-800">
          Post-concussion care
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-800">
          Your care roadmap will appear here
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          This is a placeholder for the next step. Nothing from the intake form
          has been saved or sent.
        </p>
        <a
          href="/"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-base font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Back
        </a>
      </div>
    </main>
  );
}
