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

test("S3-compatible provider is an explicit future integration", () => {
  assert.throws(
    () => createDocumentStorage({ provider: "s3", bucket: "hr-documents" }),
    /not implemented/
  );
});
