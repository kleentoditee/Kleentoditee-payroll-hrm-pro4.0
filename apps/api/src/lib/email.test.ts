import assert from "node:assert/strict";
import test from "node:test";
import {
  nextRetryAt,
  queueEmail,
  renderPasswordResetEmail,
  renderUserInvitationEmail
} from "./email.js";

test("password reset template renders subject, URL, and expiry notice", () => {
  const r = renderPasswordResetEmail("https://app.example/reset-password?token=abc");
  assert.equal(r.subject, "Reset your KleenToDiTee password");
  assert.ok(r.text.includes("https://app.example/reset-password?token=abc"));
  assert.ok(r.text.includes("60 minutes"));
  assert.ok(r.html.includes("Reset password"));
  assert.ok(r.html.includes("token=abc"));
});

test("user invitation template renders accept URL and 7-day expiry", () => {
  const r = renderUserInvitationEmail("https://app.example/accept-invite?token=xyz");
  assert.equal(r.subject, "Set up your KleenToDiTee account");
  assert.ok(r.text.includes("7 days"));
  assert.ok(r.html.includes("Create password"));
  assert.ok(r.html.includes("token=xyz"));
});

test("retry backoff doubles per attempt and caps at 6 hours", () => {
  const now = new Date("2026-09-20T12:00:00Z");
  assert.equal(nextRetryAt(1, now).getTime() - now.getTime(), 2 * 60_000);
  assert.equal(nextRetryAt(2, now).getTime() - now.getTime(), 4 * 60_000);
  assert.equal(nextRetryAt(5, now).getTime() - now.getTime(), 32 * 60_000);
  assert.equal(nextRetryAt(20, now).getTime() - now.getTime(), 360 * 60_000);
});

test("queueEmail rejects malformed recipients before touching the database", async () => {
  await assert.rejects(() => queueEmail({ to: "not-an-email", template: "password_reset", url: "u" }), /Invalid recipient/);
  await assert.rejects(() => queueEmail({ to: "  ", template: "password_reset", url: "u" }), /Invalid recipient/);
});

test("queueEmail requires subject+text for non-template messages", async () => {
  await assert.rejects(() => queueEmail({ to: "a@b.co", template: "generic" }), /requires subject and text/);
});
