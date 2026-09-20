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

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const transport = smtpTransport();
  const from = process.env.SMTP_FROM?.trim();
  if (!transport || !from) {
    return false;
  }

  await transport.sendMail({
    from,
    to,
    subject: "Reset your KleenToDiTee password",
    text: [
      "A password reset was requested for your KleenToDiTee account.",
      "",
      `Open this secure link within 60 minutes: ${resetUrl}`,
      "",
      "If you did not request this, you can ignore this email."
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#14313a;max-width:560px">
        <h1 style="font-size:22px">Reset your KleenToDiTee password</h1>
        <p>A password reset was requested for your account.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#0f5965;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px;font-weight:700">Reset password</a></p>
        <p style="font-size:13px;color:#52646b">This link expires in 60 minutes. If you did not request it, you can ignore this email.</p>
      </div>
    `
  });
  return true;
}

export async function sendUserInvitationEmail(to: string, acceptUrl: string): Promise<boolean> {
  const transport = smtpTransport();
  const from = process.env.SMTP_FROM?.trim();
  if (!transport || !from) {
    return false;
  }

  await transport.sendMail({
    from,
    to,
    subject: "Set up your KleenToDiTee account",
    text: [
      "You have been invited to KleenToDiTee Payroll HRM.",
      "",
      `Create your password within 7 days: ${acceptUrl}`,
      "",
      "If you were not expecting this invitation, contact your administrator."
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#14313a;max-width:560px">
        <h1 style="font-size:22px">Set up your KleenToDiTee account</h1>
        <p>You have been invited to KleenToDiTee Payroll HRM.</p>
        <p><a href="${acceptUrl}" style="display:inline-block;background:#0f5965;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px;font-weight:700">Create password</a></p>
        <p style="font-size:13px;color:#52646b">This link expires in 7 days. If you were not expecting it, contact your administrator.</p>
      </div>
    `
  });
  return true;
}
