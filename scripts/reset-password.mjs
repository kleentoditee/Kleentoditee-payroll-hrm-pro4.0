import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_ROOT = "C:\\Kleentoditee Payroll HRM";
const APP_DIR = resolve(EXPECTED_ROOT, "Kleentoditee-payroll-hrm-pro4.0");

function loadEnvFile() {
  const envPath = resolve(APP_DIR, ".env");
  if (!existsSync(envPath)) {
    return;
  }
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq < 1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value =
      (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))
        ? raw.slice(1, -1)
        : raw;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function validatePassword(password) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function assertSafeWorkspace() {
  if (process.cwd().toLowerCase() !== EXPECTED_ROOT.toLowerCase()) {
    console.error("Wrong folder open. Please open C:\\Kleentoditee Payroll HRM before continuing.");
    process.exit(1);
  }
}

async function main() {
  assertSafeWorkspace();
  loadEnvFile();

  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to reset passwords when NODE_ENV=production.");
    process.exit(1);
  }

  const rl = createInterface({ input, output });
  try {
    const email = normalizeEmail(process.argv[2] ?? (await rl.question("User email: ")));
    const password = process.env.RESET_PASSWORD_NEW_PASSWORD ?? (await rl.question("New password: "));
    const confirm =
      process.env.RESET_PASSWORD_NEW_PASSWORD !== undefined ? password : await rl.question("Confirm new password: ");

    if (!email) {
      console.error("Email is required.");
      process.exit(1);
    }
    if (password !== confirm) {
      console.error("Passwords do not match.");
      process.exit(1);
    }
    if (!validatePassword(password)) {
      console.error("Password must be at least 8 characters and include at least one letter and one number.");
      process.exit(1);
    }

    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
    try {
      const user = await prisma.user.findFirst({
        where: { OR: [{ emailCanonical: email }, { email, emailCanonical: null }] },
        select: { id: true, email: true }
      });
      if (!user) {
        console.error("No existing user found for that email. No user was created.");
        process.exit(1);
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { passwordHash, tokenVersion: { increment: 1 } }
        });
        await tx.$executeRaw`
          UPDATE "PasswordResetToken"
          SET "usedAt" = CURRENT_TIMESTAMP
          WHERE "userId" = ${user.id} AND "usedAt" IS NULL
        `;
      });

      console.log(`Password reset succeeded for ${user.email}.`);
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
