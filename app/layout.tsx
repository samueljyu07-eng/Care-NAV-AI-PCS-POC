import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteFollowUp, SiteLogo } from "./site-chrome";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Patient intake | Post-concussion care navigation",
  description:
    "Share your location, concerns, and symptoms so a care navigator can help with next steps. This tool does not give medical advice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteLogo />
        {children}
        <SiteFollowUp />
      </body>
    </html>
  );
}
