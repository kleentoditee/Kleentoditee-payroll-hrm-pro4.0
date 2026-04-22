import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KleenToDiTee — Tracker",
  description: "Employee time tracking (Phase 1 stub)",
  themeColor: "#0f3a46"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
