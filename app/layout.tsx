import type { Metadata } from "next";
import Image from "next/image";
import { Inter } from "next/font/google";
import "./globals.css";

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
        <div className="flex justify-center px-4 pt-8">
          <Image
            src="/carenav-logo.jpg"
            alt="CareNav"
            width={1024}
            height={1024}
            preload
            className="h-auto w-14 sm:w-18"
          />
        </div>
        {children}
      </body>
    </html>
  );
}
