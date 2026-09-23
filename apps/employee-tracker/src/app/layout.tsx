import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CsrfGuard } from "@/components/csrf-guard";

export const metadata: Metadata = {
  title: "KleenToDiTee - Tracker",
  description: "Employee time entry and submit for approval"
};

export const viewport: Viewport = {
  themeColor: "#0f3a46"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <CsrfGuard />
        {children}
      </body>
    </html>
  );
}
