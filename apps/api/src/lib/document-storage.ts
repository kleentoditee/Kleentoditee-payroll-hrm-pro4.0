import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig
} from "@aws-sdk/client-s3";
import { getSignedUrl as s3GetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";

export const DEFAULT_UPLOADS_ROOT = path.join(process.cwd(), "uploads", "hr");

export type StorageProvider = "local" | "s3" | "r2";

export type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType?: string;
};

export type StoredObject = {
  body: Readable;
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

export type S3StorageConfig = {
  provider: "s3" | "r2";
  endpoint?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

/**
 * Validate and normalize an S3/R2 config. Throws on anything missing — a
 * misconfigured object store must fail at boot, not at first upload.
 */
export function validateS3Config(provider: "s3" | "r2", config: DocumentStorageConfig): S3StorageConfig {
  const bucket = config.bucket?.trim() ?? "";
  const accessKeyId = config.accessKeyId?.trim() ?? "";
  const secretAccessKey = config.secretAccessKey ?? "";
  const endpoint = config.endpoint?.trim() ?? "";
  const region = config.region?.trim() || (provider === "r2" ? "auto" : "us-east-1");
  const missing: string[] = [];
  if (!bucket) missing.push("S3_BUCKET");
  if (!accessKeyId) missing.push("S3_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("S3_SECRET_ACCESS_KEY");
  if (provider === "r2" && !endpoint) missing.push("S3_ENDPOINT (required for R2)");
  if (missing.length > 0) {
    throw new Error(
      `OBJECT_STORAGE_PROVIDER=${provider} requires ${missing.join(", ")}. Refusing to start with a misconfigured object store.`
    );
  }
  return { provider, endpoint: endpoint || undefined, bucket, accessKeyId, secretAccessKey, region };
}

/**
 * Private S3/R2 bucket access. Nothing here makes an object public: uploads go
 * straight to the bucket, downloads are either streamed through the
 * authenticated API or handed out as short-lived presigned GET URLs.
 */
class S3CompatibleDocumentStorage implements DocumentStorage {
  readonly provider: "s3" | "r2";
  private readonly config: S3StorageConfig;
  private client: S3Client | null = null;

  constructor(provider: "s3" | "r2", config: DocumentStorageConfig) {
    this.provider = provider;
    this.config = validateS3Config(provider, config);
  }

  /** Test hook: inject a fake client without touching the network. */
  static withClient(provider: "s3" | "r2", config: S3StorageConfig, client: S3Client): S3CompatibleDocumentStorage {
    const storage = new S3CompatibleDocumentStorage(provider, config);
    storage.client = client;
    return storage;
  }

  private getClient(): S3Client {
    if (!this.client) {
      const clientConfig: S3ClientConfig = {
        region: this.config.region,
        credentials: { accessKeyId: this.config.accessKeyId, secretAccessKey: this.config.secretAccessKey }
      };
      if (this.config.endpoint) {
        clientConfig.endpoint = this.config.endpoint;
        clientConfig.forcePathStyle = true; // R2 + most S3-compatible stores
      }
      this.client = new S3Client(clientConfig);
    }
    return this.client;
  }

  private assertScopedKey(key: string): void {
    // Keys are org-scoped (`<orgId>/...`); reject absolute/parent-escape keys
    // even though S3 is flat, so a bug never wanders across prefixes.
    if (!key || key.startsWith("/") || key.includes("..") || key.includes("\\")) {
      throw new Error(`Invalid object key: ${key}`);
    }
  }

  async putObject(input: PutObjectInput): Promise<{ key: string }> {
    this.assertScopedKey(input.key);
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType ?? "application/octet-stream"
      })
    );
    return { key: input.key };
  }

  async getObject(key: string): Promise<StoredObject> {
    this.assertScopedKey(key);
    const out = await this.getClient().send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
    if (!out.Body) throw new Error(`Empty object body for ${key}`);
    return {
      body: out.Body as Readable,
      contentLength: Number(out.ContentLength ?? 0)
    };
  }

  async deleteObject(key: string): Promise<void> {
    this.assertScopedKey(key);
    await this.getClient().send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  /** Presigned GET — computed locally, no network call. Default 5 minutes. */
  async getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string | null> {
    this.assertScopedKey(key);
    const expiresIn = Math.min(Math.max(options?.expiresInSeconds ?? 300, 30), 3600);
    return s3GetSignedUrl(this.getClient(), new GetObjectCommand({ Bucket: this.config.bucket, Key: key }), { expiresIn });
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
