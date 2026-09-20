import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isEnvTruthy } from "./lib/env-flags.js";

const here = dirname(fileURLToPath(import.meta.url));

/** Repo root `.env` (apps/api/src -> ../../../) */
config({ path: resolve(here, "../../../.env") });

const unsafeJwtSecrets = new Set([
  "dev-secret",
  "dev-secret-change-me",
  "change-me",
  "changeme",
  "secret",
  "jwt-secret",
  "local-secret",
  "your-jwt-secret"
]);

function listEnv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateRuntimeEnv(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required when NODE_ENV=production.");
  }
  if (unsafeJwtSecrets.has(jwtSecret.toLowerCase())) {
    throw new Error("JWT_SECRET uses an unsafe development value.");
  }

  if (listEnv("CORS_ALLOWED_ORIGINS").length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS is required when NODE_ENV=production.");
  }

  if (isEnvTruthy("ALLOW_DEV_EMERGENCY_LOGIN")) {
    throw new Error("ALLOW_DEV_EMERGENCY_LOGIN cannot be enabled when NODE_ENV=production.");
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required when NODE_ENV=production.");
  }
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    throw new Error("DATABASE_URL must use PostgreSQL when NODE_ENV=production.");
  }
}

validateRuntimeEnv();

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
