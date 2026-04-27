import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const DEFAULT_UPLOADS_ROOT = path.join(process.cwd(), "uploads", "hr");

export function getUploadsRoot(): string {
  return (process.env.UPLOADS_DIR ?? DEFAULT_UPLOADS_ROOT).replace(/\/$/, "");
}

export function safeRelativeForEmployee(employeeId: string, filename: string): string {
  const base = `employees/${employeeId}`;
  const clean = path.basename(filename).replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `${base}/${Date.now()}-${clean}`;
}

export function ensureParentDir(absoluteFilePath: string): void {
  const dir = path.dirname(absoluteFilePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function absPathForRelative(relative: string, uploads = getUploadsRoot()): string {
  const root = path.resolve(uploads);
  const resolved = path.resolve(root, relative);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path escapes uploads root");
  }
  return resolved;
}

export function writeBufferToRelative(relative: string, data: Buffer): { absolute: string; relative: string } {
  const uploads = getUploadsRoot();
  const abs = absPathForRelative(relative, uploads);
  ensureParentDir(abs);
  writeFileSync(abs, data);
  return { absolute: abs, relative };
}

export function readBufferFromRelative(relative: string): Buffer {
  const abs = absPathForRelative(relative);
  if (!existsSync(abs)) {
    throw new Error("File not found");
  }
  return readFileSync(abs);
}

export function fileStreamFromRelative(relative: string) {
  const abs = absPathForRelative(relative);
  if (!existsSync(abs)) {
    throw new Error("File not found");
  }
  return createReadStream(abs);
}

export function fileExtensionFromName(name: string): string {
  const m = /\.[a-zA-Z0-9]{1,8}$/.exec(name);
  return m ? m[0] : "";
}
