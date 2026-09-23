import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  csrfCookieValue,
  csrfTokensMatch,
  expiredCookieValue,
  isMutatingMethod,
  newCsrfToken,
  parseCookies,
  sessionCookieValue
} from "./auth-cookies.js";

describe("parseCookies", () => {
  it("parses multi-cookie headers and decodes values", () => {
    const cookies = parseCookies(`${SESSION_COOKIE}=abc%20123; other=xyz; flag`);
    assert.equal(cookies[SESSION_COOKIE], "abc 123");
    assert.equal(cookies.other, "xyz");
    assert.equal(cookies.flag, undefined);
  });

  it("returns an empty object for missing headers", () => {
    assert.deepEqual(parseCookies(undefined), {});
    assert.deepEqual(parseCookies(""), {});
  });
});

describe("session cookie", () => {
  it("is HttpOnly, SameSite=Lax, and carries the token", () => {
    const value = sessionCookieValue("tok123", false);
    assert.match(value, new RegExp(`^${SESSION_COOKIE}=tok123`));
    assert.ok(value.includes("HttpOnly"));
    assert.ok(value.includes("SameSite=Lax"));
    assert.ok(value.includes("Path=/"));
    assert.ok(!value.includes("Secure"));
  });

  it("adds Secure in production mode", () => {
    assert.ok(sessionCookieValue("tok", true).includes("Secure"));
  });
});

describe("CSRF cookie", () => {
  it("is readable (no HttpOnly) so scripts can echo it in the header", () => {
    const value = csrfCookieValue("csrf123", false);
    assert.match(value, new RegExp(`^${CSRF_COOKIE}=csrf123`));
    assert.ok(!value.includes("HttpOnly"));
    assert.ok(value.includes("SameSite=Lax"));
  });

  it("csrfTokensMatch uses a constant-time comparison", () => {
    assert.ok(csrfTokensMatch("abc", "abc"));
    assert.ok(!csrfTokensMatch("abc", "abd"));
    assert.ok(!csrfTokensMatch("abc", "abcd"));
    assert.ok(!csrfTokensMatch("", ""));
  });
});

describe("expiredCookieValue", () => {
  it("expires the cookie immediately", () => {
    const value = expiredCookieValue(SESSION_COOKIE, true);
    assert.ok(value.includes("Max-Age=0"));
    assert.ok(value.includes("HttpOnly"));
  });
});

describe("isMutatingMethod", () => {
  it("flags mutations and not reads", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.ok(isMutatingMethod(m), m);
    }
    for (const m of ["GET", "HEAD", "OPTIONS"]) {
      assert.ok(!isMutatingMethod(m), m);
    }
  });
});

describe("newCsrfToken", () => {
  it("produces unique 64-char hex tokens", () => {
    const a = newCsrfToken();
    const b = newCsrfToken();
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.notEqual(a, b);
  });
});
