/**
 * Transactional email outbox (Batch 16).
 *
 * Nothing sends synchronously from request handlers anymore: callers queue a
 * row, the background worker (or a manual flush) delivers with retry/backoff,
 * and the EmailMessage table is the delivery log. When SMTP is not configured
 * the queue stays QUEUED and the worker no-ops — no silent drops.
 */
import { prisma } from "@kleentoditee/db";
import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function smtpTransport() {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) {
    return null;
  }

  const secure = /^(1|true|yes|on)$/i.test(process.env.SMTP_SECURE?.trim() ?? "");
  const port = Number(process.env.SMTP_PORT) || (secure ? 465 : 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined
  });
  return transporter;
}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
}

/** Verify SMTP credentials at startup / from the admin UI (monitoring). */
export async function verifyEmailTransport(): Promise<{ ok: boolean; error?: string }> {
  const transport = smtpTransport();
  if (!transport) {
    return { ok: false, error: "SMTP is not configured (SMTP_HOST / SMTP_FROM missing)." };
  }
  try {
    await transport.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type RenderedEmail = { subject: string; text: string; html: string };

const SHELL = (inner: string) =>
  `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#14313a;max-width:560px">${inner}</div>`;

const BUTTON = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#0f5965;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px;font-weight:700">${label}</a>`;

export function renderPasswordResetEmail(resetUrl: string): RenderedEmail {
  return {
    subject: "Reset your KleenToDiTee password",
    text: [
      "A password reset was requested for your KleenToDiTee account.",
      "",
      `Open this secure link within 60 minutes: ${resetUrl}`,
      "",
      "If you did not request this, you can ignore this email."
    ].join("\n"),
    html: SHELL(`
      <h1 style="font-size:22px">Reset your KleenToDiTee password</h1>
      <p>A password reset was requested for your account.</p>
      <p>${BUTTON(resetUrl, "Reset password")}</p>
      <p style="font-size:13px;color:#52646b">This link expires in 60 minutes. If you did not request it, you can ignore this email.</p>
    `)
  };
}

export function renderUserInvitationEmail(acceptUrl: string): RenderedEmail {
  return {
    subject: "Set up your KleenToDiTee account",
    text: [
      "You have been invited to KleenToDiTee Payroll HRM.",
      "",
      `Create your password within 7 days: ${acceptUrl}`,
      "",
      "If you were not expecting this invitation, contact your administrator."
    ].join("\n"),
    html: SHELL(`
      <h1 style="font-size:22px">Set up your KleenToDiTee account</h1>
      <p>You have been invited to KleenToDiTee Payroll HRM.</p>
      <p>${BUTTON(acceptUrl, "Create password")}</p>
      <p style="font-size:13px;color:#52646b">This link expires in 7 days. If you were not expecting it, contact your administrator.</p>
    `)
  };
}

export const EMAIL_TEMPLATES = {
  password_reset: renderPasswordResetEmail,
  user_invitation: renderUserInvitationEmail
} as const;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function queueEmail(input: {
  to: string;
  template: EmailTemplateKey | string;
  /** Template render argument (e.g. the action URL). */
  url?: string;
  /** Pre-rendered bodies for one-off messages (template "generic"). */
  subject?: string;
  text?: string;
  html?: string;
  orgId?: string | null;
}): Promise<{ id: string }> {
  const to = input.to.trim();
  if (!EMAIL_RE.test(to)) {
    throw new Error(`Invalid recipient address: ${input.to}`);
  }
  let rendered: RenderedEmail;
  if (input.template in EMAIL_TEMPLATES) {
    rendered = EMAIL_TEMPLATES[input.template as EmailTemplateKey](String(input.url ?? ""));
  } else {
    if (!input.subject || !input.text) {
      throw new Error("Generic email requires subject and text.");
    }
    rendered = { subject: input.subject, text: input.text, html: input.html ?? "" };
  }
  const row = await prisma.emailMessage.create({
    data: {
      orgId: input.orgId ?? null,
      toEmail: to,
      subject: rendered.subject,
      textBody: rendered.text,
      htmlBody: rendered.html || null,
      template: input.template
    }
  });
  return { id: row.id };
}

/** Exponential backoff: 2^attempts minutes, capped at 6 hours. */
export function nextRetryAt(attempts: number, now = new Date()): Date {
  const minutes = Math.min(2 ** attempts, 360);
  return new Date(now.getTime() + minutes * 60_000);
}

export type QueueProcessResult = { sent: number; failed: number; retried: number; skipped: boolean };

export async function processEmailQueue(limit = 10): Promise<QueueProcessResult> {
  if (!isEmailDeliveryConfigured()) {
    return { sent: 0, failed: 0, retried: 0, skipped: true };
  }
  const transport = smtpTransport()!;
  const from = process.env.SMTP_FROM!.trim();
  const now = new Date();
  const due = await prisma.emailMessage.findMany({
    where: { status: "QUEUED", nextAttemptAt: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: limit
  });
  const result: QueueProcessResult = { sent: 0, failed: 0, retried: 0, skipped: false };
  for (const msg of due) {
    // Claim the row by pushing nextAttemptAt forward (keeps status QUEUED so a
    // crash mid-send is retried — at-least-once, never silently "sent").
    const attempts = msg.attempts + 1;
    const claimed = await prisma.emailMessage.updateMany({
      where: { id: msg.id, status: "QUEUED", nextAttemptAt: msg.nextAttemptAt },
      data: { attempts, nextAttemptAt: new Date(now.getTime() + 5 * 60_000) }
    });
    if (claimed.count === 0) continue;
    try {
      await transport.sendMail({
        from,
        to: msg.toEmail,
        subject: msg.subject,
        text: msg.textBody,
        html: msg.htmlBody ?? undefined
      });
      await prisma.emailMessage.update({
        where: { id: msg.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null }
      });
      result.sent += 1;
    } catch (error) {
      const lastError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      if (attempts >= msg.maxAttempts) {
        await prisma.emailMessage.update({
          where: { id: msg.id },
          data: { status: "FAILED", lastError }
        });
        result.failed += 1;
      } else {
        await prisma.emailMessage.update({
          where: { id: msg.id },
          data: { status: "QUEUED", lastError, nextAttemptAt: nextRetryAt(attempts, now) }
        });
        result.retried += 1;
      }
    }
  }
  return result;
}

export async function retryEmailMessage(id: string): Promise<boolean> {
  const updated = await prisma.emailMessage.updateMany({
    where: { id, status: "FAILED" },
    data: { status: "QUEUED", attempts: 0, lastError: null, nextAttemptAt: new Date(), sentAt: null }
  });
  return updated.count === 1;
}

// ---------------------------------------------------------------------------
// Background worker (started from index.ts; EMAIL_WORKER=off disables it)
// ---------------------------------------------------------------------------

let workerTimer: NodeJS.Timeout | null = null;

export function startEmailWorker(intervalMs = 60_000): void {
  if (workerTimer) return;
  if ((process.env.EMAIL_WORKER ?? "").trim().toLowerCase() === "off") {
    return;
  }
  workerTimer = setInterval(() => {
    processEmailQueue().catch((error) => console.error("[email] queue processing failed.", error));
  }, intervalMs);
  workerTimer.unref?.();
}

export function stopEmailWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
