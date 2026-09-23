import type { Metadata } from "next";
import "./globals.css";
import { CsrfGuard } from "@/components/csrf-guard";

export const metadata: Metadata = {
  title: "KleenToDiTee — Admin",
  description: "Payroll, HR, time, and accounting operations for KleenToDiTee"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <CsrfGuard />
        {children}
      </body>
    </html>
  );
}
