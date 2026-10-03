import type { Metadata } from "next";
import { Newsreader, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";

// Body and UI text.
const body = Schibsted_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

// Page titles and the dates on cards only.
const display = Newsreader({
  variable: "--font-display-face",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Cherry Pick",
  description: "Plan an event and find partner companies to host it with.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
