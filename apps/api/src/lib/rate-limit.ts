import { prisma } from "@kleentoditee/db";

/**
 * Database-backed rate limiting for auth endpoints.
 * Buckets: "login:<ip>:<email>" (count of failed attempts in a window) and
 * "reset:<email>" (single-interval throttle for reset requests).
 */

export async function isAttemptBlocked(key: string, maxAttempts: number, now = new Date()): Promise<boolean> {
  const row = await prisma.authRateLimit.findUnique({ where: { key } });
  if (!row || row.resetAt.getTime() <= now.getTime()) {
    return false;
  }
  return row.count >= maxAttempts;
}

export async function recordAttempt(key: string, windowMs: number, now = new Date()): Promise<void> {
  // Fixed window: an active bucket keeps its original resetAt (repeated
  // attempts must not extend the window); an expired bucket starts fresh.
  const existing = await prisma.authRateLimit.findUnique({ where: { key } });
  if (existing && existing.resetAt.getTime() > now.getTime()) {
    await prisma.authRateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  } else {
    const resetAt = new Date(now.getTime() + windowMs);
    await prisma.authRateLimit.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: { count: 1, resetAt }
    });
  }
  // Opportunistic prune of expired buckets (older than 1 hour past reset).
  await prisma.authRateLimit.deleteMany({
    where: { resetAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) } }
  });
}

export async function clearAttempts(key: string): Promise<void> {
  await prisma.authRateLimit.deleteMany({ where: { key } });
}

/**
 * Minimum-interval throttle (e.g. one password-reset email per minute).
 * Records the request when it passes and returns true while still inside
 * the interval.
 */
export async function isIntervalThrottled(key: string, intervalMs: number, now = new Date()): Promise<boolean> {
  const row = await prisma.authRateLimit.findUnique({ where: { key } });
  if (row && row.resetAt.getTime() > now.getTime()) {
    return true;
  }
  await prisma.authRateLimit.upsert({
    where: { key },
    create: { key, count: 1, resetAt: new Date(now.getTime() + intervalMs) },
    update: { count: 1, resetAt: new Date(now.getTime() + intervalMs) }
  });
  return false;
}
