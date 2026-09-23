// Prisma 7 CLI configuration. The v7 CLI no longer auto-loads .env files and
// ignores the legacy package.json "prisma" key, so datasource, migrations,
// and the seed command live here. npm workspace scripts run with cwd =
// packages/db, so the root .env is two levels up.
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

loadEnv({ path: "../../.env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  },
  datasource: {
    url: env("DATABASE_URL")
  }
});
