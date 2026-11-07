import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PORTAL_COOKIE, portalConfigured, sessionMatches } from "../../lib/portal/auth";
import { PasscodeForm } from "./passcode-form";
import { PortalHome } from "./portal-home";

export const metadata: Metadata = {
  title: "Clinic portal | CareNav",
  robots: { index: false, follow: false },
};

export default function PortalPage() {
  return (
    <>
      <style>{`
        @media print {
          .portal-chrome,
          .react-flow__controls,
          .react-flow__attribution,
          .react-flow__panel {
            display: none !important;
          }
        }
      `}</style>
      <Suspense
        fallback={
          <p className="px-4 py-10 text-base leading-7 text-[#545454]">Loading the clinic portal…</p>
        }
      >
        <PortalGate />
      </Suspense>
    </>
  );
}

async function PortalGate() {
  const jar = await cookies();
  if (!sessionMatches(jar.get(PORTAL_COOKIE)?.value)) {
    return <PasscodeForm configured={portalConfigured()} />;
  }
  return <PortalHome />;
}
