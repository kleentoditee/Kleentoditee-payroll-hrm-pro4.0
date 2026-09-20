import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  hashPasswordResetToken,
  isValidResetPassword,
  passwordResetExpiresAt
} from "./password-reset.js";

test("reset password rule requires length, letter, and number", () => {
  assert.equal(isValidResetPassword("short1"), false);
  assert.equal(isValidResetPassword("abcdefghijklmno"), false);
  assert.equal(isValidResetPassword("123456789012345"), false);
  assert.equal(isValidResetPassword("clean-password-123"), true);
});

test("reset tokens are random and stored as deterministic hashes", () => {
  const a = createPasswordResetToken();
  const b = createPasswordResetToken();
  assert.notEqual(a, b);
  assert.equal(hashPasswordResetToken(a), hashPasswordResetToken(a));
  assert.notEqual(hashPasswordResetToken(a), a);
});

test("reset link uses configured tracker base URL", () => {
  const previous = process.env.EMPLOYEE_TRACKER_PUBLIC_URL;
  process.env.EMPLOYEE_TRACKER_PUBLIC_URL = "http://localhost:3001/";
  try {
    assert.equal(buildPasswordResetUrl("abc 123"), "http://localhost:3001/reset-password?token=abc%20123");
  } finally {
    if (previous === undefined) {
      delete process.env.EMPLOYEE_TRACKER_PUBLIC_URL;
    } else {
      process.env.EMPLOYEE_TRACKER_PUBLIC_URL = previous;
    }
  }
});

test("reset expiration defaults to roughly one hour", () => {
  const now = new Date("2026-04-28T10:00:00.000Z");
  assert.equal(passwordResetExpiresAt(now).toISOString(), "2026-04-28T11:00:00.000Z");
});
