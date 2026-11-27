import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Every page depends on the session cookie, so nothing is statically prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Registry · Student Management System", template: "%s · Registry" },
  description: "Student enrolment, fees, submissions and results for the Registry team.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes sets the theme class on <html> before hydration, and browser
    // extensions (e.g. Grammarly) inject attributes into <html>/<body>. Only these two elements' attributes are exempt.
    <html lang="en-GB" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
