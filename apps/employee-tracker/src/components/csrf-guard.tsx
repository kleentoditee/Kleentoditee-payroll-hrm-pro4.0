"use client";

import { installCsrfFetchGuard } from "@/lib/api";
import { useEffect } from "react";

/** Installs the global CSRF fetch guard once per page load. Renders nothing. */
export function CsrfGuard() {
  useEffect(() => {
    installCsrfFetchGuard();
  }, []);
  return null;
}
