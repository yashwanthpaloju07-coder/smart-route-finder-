import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Smart Route Finder — Intelligent Path Optimization",
  description:
    "Futuristic route optimization platform with real Dijkstra, A* and Floyd–Warshall execution, live map routing, algorithm visualization, race mode and what-if analysis.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`}>
      <body className="bg-[#05070f] text-slate-200 antialiased">{children}</body>
    </html>
  );
}
