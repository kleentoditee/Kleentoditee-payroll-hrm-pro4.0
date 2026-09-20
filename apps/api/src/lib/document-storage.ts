import { createReadStream, type ReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_UPLOADS_ROOT = path.join(process.cwd(), "uploads", "hr");

export type StorageProvider = "local" | "s3" | "r2";

export type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType?: string;
};

export type StoredObject = {
  body: ReadStream;
  contentLength: number;
};

export type SignedUrlOptions = {
  expiresInSeconds?: number;
};

export interface DocumentStorage {
  readonly provider: StorageProvider;
  putObject(input: PutObjectInput): Promise<{ key: string }>;
  getObject(key: string): Promise<StoredObject>;
  deleteObject(key: string): Promise<void>;
  getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string | null>;
}

export type DocumentStorageConfig = {
  provider?: string;
  uploadsRoot?: string;
  endpoint?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
};

export function getUploadsRoot(): string {
  return (process.env.UPLOADS_DIR ?? DEFAULT_UPLOADS_ROOT).replace(/[\\/]+$/, "");
}

export function safeDocumentKeyForEmployee(employeeId: string, filename: string): string {
  const clean = path.basename(filename).replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `employees/${employeeId}/${Date.now()}-${clean}`;
}

export class LocalDocumentStorage implements DocumentStorage {
  readonly provider = "local" as const;

  constructor(private readonly root = getUploadsRoot()) {}

  async putObject(input: PutObjectInput): Promise<{ key: string }> {
    const absolute = this.absolutePathForKey(input.key);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, input.body);
    return { key: input.key };
  }

  async getObject(key: string): Promise<StoredObject> {
    const absolute = this.absolutePathForKey(key);
    const info = await stat(absolute);
    return {
      body: createReadStream(absolute),
      contentLength: info.size
    };
  }

  async deleteObject(key: string): Promise<void> {
    const absolute = this.absolutePathForKey(key);
    await rm(absolute, { force: true });
  }

  async getSignedUrl(_key: string, _options?: SignedUrlOptions): Promise<string | null> {
    return null;
  }

  private absolutePathForKey(key: string): string {
    const root = path.resolve(this.root);
    const resolved = path.resolve(root, key);
    const relative = path.relative(root, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Object key escapes document storage root");
    }
    return resolved;
  }
}

class S3CompatibleDocumentStorage implements DocumentStorage {
  readonly provider: StorageProvider;

  constructor(provider: "s3" | "r2", _config: DocumentStorageConfig) {
    this.provider = provider;
    throw new Error(
      `${provider.toUpperCase()} document storage is not implemented yet. Add an S3-compatible client before enabling OBJECT_STORAGE_PROVIDER=${provider}.`
    );
  }

  async putObject(_input: PutObjectInput): Promise<{ key: string }> {
    throw new Error("not implemented");
  }

  async getObject(_key: string): Promise<StoredObject> {
    throw new Error("not implemented");
  }

  async deleteObject(_key: string): Promise<void> {
    throw new Error("not implemented");
  }

  async getSignedUrl(_key: string, _options?: SignedUrlOptions): Promise<string | null> {
    throw new Error("not implemented");
  }
}

export function createDocumentStorage(config: DocumentStorageConfig = envDocumentStorageConfig()): DocumentStorage {
  const provider = normalizeProvider(config.provider);
  if (provider === "local") {
    return new LocalDocumentStorage(config.uploadsRoot);
  }
  return new S3CompatibleDocumentStorage(provider, config);
}

export function envDocumentStorageConfig(): DocumentStorageConfig {
  return {
    provider: process.env.OBJECT_STORAGE_PROVIDER,
    uploadsRoot: process.env.UPLOADS_DIR,
    endpoint: process.env.S3_ENDPOINT,
    bucket: process.env.S3_BUCKET,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    region: process.env.S3_REGION
  };
}

function normalizeProvider(value: string | undefined): StorageProvider {
  const provider = (value ?? "local").trim().toLowerCase();
  if (provider === "" || provider === "local" || provider === "filesystem" || provider === "fs") {
    return "local";
  }
  if (provider === "s3" || provider === "r2") {
    return provider;
  }
  throw new Error(`Unsupported OBJECT_STORAGE_PROVIDER: ${value}`);
}

export const documentStorage = createDocumentStorage();
