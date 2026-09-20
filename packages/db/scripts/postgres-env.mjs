import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const envPath = path.join(repoRoot, ".env");

export function loadDotEnv() {
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals < 1) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

export function readPostgresDatabaseUrl() {
  loadDotEnv();
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    failInvalidDatabaseUrl("DATABASE_URL is missing in .env.");
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(rawUrl);
  } catch {
    failInvalidDatabaseUrl("DATABASE_URL is not a valid URL.");
  }

  if (databaseUrl.protocol !== "postgresql:" && databaseUrl.protocol !== "postgres:") {
    failInvalidDatabaseUrl(
      `DATABASE_URL must start with postgresql:// for this production-style build. Current protocol: ${databaseUrl.protocol || "(none)"}`
    );
  }

  return databaseUrl;
}

export function printPostgresRecoveryInstructions(host, port) {
  console.error("[db] Choose one path:");
  console.error("");
  console.error("[db] Docker path:");
  console.error("[db]   1. Open Docker Desktop.");
  console.error("[db]   2. Run npm run db:up.");
  console.error("[db]   3. Run npm run db:wait.");
  console.error("[db]   4. Run npm run start:local.");
  console.error("");
  console.error("[db] Native PostgreSQL path:");
  console.error("[db]   1. Open Windows Services.");
  console.error("[db]   2. Start the postgresql-x64 service.");
  console.error("[db]   3. Confirm DATABASE_URL in .env matches your PostgreSQL username, password, port, and database.");
  console.error("[db]   4. Run npm run db:check.");
  console.error("[db]   5. Run npm run start:local.");
  console.error("");
  console.error(`[db] PostgreSQL must be listening at ${host}:${port}.`);
}

export function failInvalidDatabaseUrl(message) {
  console.error(`\n[db] ${message}`);
  console.error("[db] Set DATABASE_URL to the PostgreSQL database for local/prod-style builds.");
  console.error('[db] Expected local default: "postgresql://kleentoditee:kleentoditee@localhost:5432/kleentoditee?schema=public"\n');
  process.exit(1);
}
