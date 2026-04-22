import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isEnvTruthy } from "./lib/env-flags.js";

const here = dirname(fileURLToPath(import.meta.url));

/** Repo root `.env` (apps/api/src -> ../../../) */
config({ path: resolve(here, "../../../.env") });
if (process.env.NODE_ENV !== "production" && isEnvTruthy("ALLOW_DEV_EMERGENCY_LOGIN")) {
  console.log("[api] Emergency passwordless login is ON (remove ALLOW_DEV_EMERGENCY_LOGIN before deploy).");
} else if (process.env.NODE_ENV !== "production") {
  const raw = process.env.ALLOW_DEV_EMERGENCY_LOGIN;
  if (raw != null && String(raw).trim() !== "" && !isEnvTruthy("ALLOW_DEV_EMERGENCY_LOGIN")) {
    console.log(
      '[api] ALLOW_DEV_EMERGENCY_LOGIN is set but not read as "on": use 1, true, yes, or on — no extra quotes. Restart the API after saving .env.'
    );
  }
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}
