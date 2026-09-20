import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prismaClient: PrismaClient | undefined };

function createClient(): PrismaClient {
  // Prisma 7: the client is Rust-free and requires a driver adapter; the
  // connection string moved out of the schema (datasource.url removed).
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set; cannot create Prisma client.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function getClient(): PrismaClient {
  // Cache on globalThis so tsx watch / hot reloads reuse one pg pool.
  if (!globalForPrisma.prismaClient) {
    globalForPrisma.prismaClient = createClient();
  }
  return globalForPrisma.prismaClient;
}

// Lazy singleton: constructing the client requires DATABASE_URL, and many
// consumers import this module only for types/enums. Defer construction (and
// the missing-env error) to first actual use. The proxy itself must never be
// cached on globalThis — only the real client is.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client as object, prop);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  }
});

export * from "@prisma/client";
