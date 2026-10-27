import type { Metadata } from "next";
import QuestionFlow from "./question-flow";

export const metadata: Metadata = {
  title: "Narrow this down | Post-concussion care navigation",
  description:
    "Nine questions to help sort which patterns fit. This tool does not give medical advice.",
};

export default function QuestionsPage() {
  return (
    <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <QuestionFlow />
    </main>
  );
}
