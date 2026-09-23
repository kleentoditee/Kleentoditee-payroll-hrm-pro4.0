import assert from "node:assert/strict";
import test from "node:test";
import { validateRuntimeEnv } from "./env.js";

function withEnv(
  values: Record<string, string | undefined>,
  fn: () => void
): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("production rejects missing JWT_SECRET", () => {
  withEnv(
    {
      NODE_ENV: "production",
      JWT_SECRET: undefined,
      CORS_ALLOWED_ORIGINS: "https://admin.example.com",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/kleentoditee"
    },
    () => {
      assert.throws(() => validateRuntimeEnv(), /JWT_SECRET is required/);
    }
  );
});

test("production rejects known development JWT_SECRET values", () => {
  withEnv(
    {
      NODE_ENV: "production",
      JWT_SECRET: "dev-secret-change-me",
      CORS_ALLOWED_ORIGINS: "https://admin.example.com",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/kleentoditee"
    },
    () => {
      assert.throws(() => validateRuntimeEnv(), /JWT_SECRET uses an unsafe development value/);
    }
  );
});

test("production rejects missing CORS_ALLOWED_ORIGINS", () => {
  withEnv(
    {
      NODE_ENV: "production",
      JWT_SECRET: "prod-secret-with-enough-length",
      CORS_ALLOWED_ORIGINS: undefined,
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/kleentoditee"
    },
    () => {
      assert.throws(() => validateRuntimeEnv(), /CORS_ALLOWED_ORIGINS is required/);
    }
  );
});

test("production rejects enabled dev emergency login", () => {
  withEnv(
    {
      NODE_ENV: "production",
      JWT_SECRET: "prod-secret-with-enough-length",
      CORS_ALLOWED_ORIGINS: "https://admin.example.com",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/kleentoditee",
      ALLOW_DEV_EMERGENCY_LOGIN: "1"
    },
    () => {
      assert.throws(() => validateRuntimeEnv(), /ALLOW_DEV_EMERGENCY_LOGIN cannot be enabled/);
    }
  );
});

test("production rejects local SQLite DATABASE_URL", () => {
  withEnv(
    {
      NODE_ENV: "production",
      JWT_SECRET: "prod-secret-with-enough-length",
      CORS_ALLOWED_ORIGINS: "https://admin.example.com",
      DATABASE_URL: "file:./dev.db"
    },
    () => {
      assert.throws(() => validateRuntimeEnv(), /DATABASE_URL must use PostgreSQL/);
    }
  );
});

test("production accepts safe required settings", () => {
  withEnv(
    {
      NODE_ENV: "production",
      JWT_SECRET: "prod-secret-with-enough-length",
      CORS_ALLOWED_ORIGINS: "https://admin.example.com,https://tracker.example.com",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/kleentoditee",
      ALLOW_DEV_EMERGENCY_LOGIN: undefined
    },
    () => {
      assert.doesNotThrow(() => validateRuntimeEnv());
    }
  );
});
