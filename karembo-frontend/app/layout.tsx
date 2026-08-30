import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The display face. Loaded as a variable font — no `weight` list — so headings
// can use any weight in the range from one file. `weight` and `axes` are
// mutually exclusive for variable fonts, and neither is needed here.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Karembo — Salon booking, Mombasa",
    template: "%s — Karembo",
  },
  description:
    "Book protective styling, nails and beauty treatments at Karembo on Nyali Road, Mombasa. Pick your stylist and a time that's genuinely free.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
