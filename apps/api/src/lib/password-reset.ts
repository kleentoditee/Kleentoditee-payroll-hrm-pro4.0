import { createHash, randomBytes } from "node:crypto";

export const PASSWORD_RESET_SAFE_MESSAGE =
  "If an account exists for that email, password reset instructions have been sent.";

export const PASSWORD_RESET_MINUTES = 60;
export const ACCOUNT_PASSWORD_MIN_LENGTH = 15;

export type PasswordResetTokenRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  userEmail: string;
  userStatus: string;
};

export function isValidResetPassword(password: string): boolean {
  return password.length >= ACCOUNT_PASSWORD_MIN_LENGTH && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function resetPasswordRuleMessage(): string {
  return `Password must be at least ${ACCOUNT_PASSWORD_MIN_LENGTH} characters and include at least one letter and one number.`;
}

export function createPasswordResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function passwordResetExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + PASSWORD_RESET_MINUTES * 60 * 1000);
}

export type PasswordResetApp = "admin" | "tracker";

export function passwordResetBaseUrl(app: PasswordResetApp = "tracker"): string {
  const configured =
    app === "admin"
      ? process.env.ADMIN_WEB_PUBLIC_URL ?? process.env.APP_URL ?? "http://localhost:3000"
      : process.env.EMPLOYEE_TRACKER_PUBLIC_URL ??
        process.env.NEXT_PUBLIC_EMPLOYEE_TRACKER_URL ??
        process.env.APP_URL ??
        "http://localhost:3001";
  return configured.replace(/\/$/, "");
}

export function buildPasswordResetUrl(token: string, app: PasswordResetApp = "tracker"): string {
  return `${passwordResetBaseUrl(app)}/reset-password?token=${encodeURIComponent(token)}`;
}
