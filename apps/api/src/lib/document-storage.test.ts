import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import test from "node:test";
import { LocalDocumentStorage, createDocumentStorage } from "./document-storage.js";

test("local document storage writes and reads objects under the configured root", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "ktd-docs-"));
  try {
    const storage = new LocalDocumentStorage(root);
    await storage.putObject({
      key: "employees/emp_1/doc-test.txt",
      body: Buffer.from("employee document")
    });

    const stored = await readFile(path.join(root, "employees", "emp_1", "doc-test.txt"), "utf8");
    assert.equal(stored, "employee document");

    const result = await storage.getObject("employees/emp_1/doc-test.txt");
    assert.equal(result.contentLength, Buffer.byteLength("employee document"));
    result.body.destroy();
    await once(result.body, "close");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("local document storage rejects keys that escape the root", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "ktd-docs-"));
  try {
    const storage = new LocalDocumentStorage(root);
    await assert.rejects(
      () => storage.putObject({ key: "../escape.txt", body: Buffer.from("nope") }),
      /escapes document storage root/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("S3-compatible provider validates config and refuses to start incomplete", () => {
  assert.throws(
    () => createDocumentStorage({ provider: "s3" }),
    /requires S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY/
  );
  assert.throws(
    () => createDocumentStorage({ provider: "r2", bucket: "b", accessKeyId: "k", secretAccessKey: "s" }),
    /S3_ENDPOINT \(required for R2\)/
  );
});

test("S3 provider signs private GET URLs locally and enforces scoped keys", async () => {
  const storage = createDocumentStorage({
    provider: "s3",
    bucket: "hr-documents",
    accessKeyId: "AKIATEST",
    secretAccessKey: "test-secret",
    region: "us-east-1"
  });
  // Presigning is local crypto — no network call happens here.
  const url = await storage.getSignedUrl("org_1/employees/emp_1/doc.pdf");
  assert.ok(url, "signed url expected for s3 provider");
  const parsed = new URL(url);
  assert.equal(parsed.hostname, "hr-documents.s3.us-east-1.amazonaws.com");
  assert.equal(parsed.pathname, "/org_1/employees/emp_1/doc.pdf");
  assert.ok(parsed.searchParams.get("X-Amz-Signature"), "signature param present");
  assert.equal(parsed.searchParams.get("X-Amz-Expires"), "300");

  await assert.rejects(() => storage.getSignedUrl("../escape.pdf"), /Invalid object key/);
  await assert.rejects(() => storage.getSignedUrl("/absolute.pdf"), /Invalid object key/);
});

test("R2 provider uses the configured endpoint with path-style keys", async () => {
  const storage = createDocumentStorage({
    provider: "r2",
    endpoint: "https://example.r2.cloudflarestorage.com",
    bucket: "hr-documents",
    accessKeyId: "R2TEST",
    secretAccessKey: "test-secret"
  });
  const url = await storage.getSignedUrl("org_1/employees/emp_1/photo.png", { expiresInSeconds: 120 });
  assert.ok(url, "signed url expected for r2 provider");
  const parsed = new URL(url);
  assert.equal(parsed.hostname, "example.r2.cloudflarestorage.com");
  assert.equal(parsed.pathname, "/hr-documents/org_1/employees/emp_1/photo.png");
  assert.equal(parsed.searchParams.get("X-Amz-Expires"), "120");
});
