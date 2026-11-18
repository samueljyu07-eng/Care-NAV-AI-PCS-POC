import type { Metadata } from "next";
import PathwayDemo from "./pathway-demo";

export const metadata: Metadata = {
  title: "Care pathway tree demo | CareNav",
  description: "Prototype demo with a mock patient. Not medical advice.",
  robots: { index: false },
};

// Embeddable demo. The root layout hides the logo and booking follow-up on /embed pages.
export default function PathwayEmbedPage() {
  return <PathwayDemo />;
}
