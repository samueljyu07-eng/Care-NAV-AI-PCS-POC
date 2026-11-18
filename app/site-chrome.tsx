"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import BookingFollowUp from "./booking-follow-up";

// The logo and the booking follow-up appear on every page except the /embed demos,
// which are shown inside other sites and must never start or check a booking.
function isEmbed(pathname: string) {
  return pathname.startsWith("/embed");
}

export function SiteLogo() {
  const pathname = usePathname();
  if (isEmbed(pathname)) {
    return null;
  }
  return (
    <div className="flex justify-center px-4 pt-8 print:hidden">
      <Image
        src="/carenav-logo.jpg"
        alt="CareNav"
        width={1024}
        height={1024}
        preload
        className="h-auto w-14 sm:w-18"
      />
    </div>
  );
}

export function SiteFollowUp() {
  const pathname = usePathname();
  if (isEmbed(pathname)) {
    return null;
  }
  return <BookingFollowUp />;
}
