import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutPublicAccessBlockCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { StorageProvider } from "./provider.js";

const DEFAULT_REGION = "us-east-1";
const DEFAULT_EXPIRES = 900;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. For local MinIO see docker-compose.minio.yml and .env.sample.`
    );
  }
  return value;
}

function createClient(endpoint) {
  const forcePathStyle = process.env.AWS_S3_FORCE_PATH_STYLE
    ? process.env.AWS_S3_FORCE_PATH_STYLE === "true"
    : Boolean(endpoint);

  return new S3Client({
    region: process.env.AWS_REGION || DEFAULT_REGION,
    endpoint: endpoint || undefined,
    forcePathStyle,
    credentials: {
      accessKeyId: requiredEnv("AWS_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("AWS_SECRET_ACCESS_KEY"),
    },
  });
}

function isNotFound(error) {
  const status = error?.$metadata?.httpStatusCode;
  return status === 404 || error?.name === "NotFound" || error?.Code === "NoSuchBucket";
}

/**
 * S3-compatible storage: MinIO (dev), Hetzner Object Storage, AWS S3, R2.
 * One private bucket per client; the bucket is an argument of every call.
 *
 * Env:
 *   AWS_ACCESS_KEY_ID          required (needs permission to create buckets)
 *   AWS_SECRET_ACCESS_KEY      required
 *   AWS_REGION                 default us-east-1 (MinIO accepts any)
 *   AWS_S3_ENDPOINT            set for MinIO / Hetzner / R2; omit for native AWS
 *   AWS_S3_PUBLIC_ENDPOINT     optional; used to sign browser URLs when it
 *                              differs from AWS_S3_ENDPOINT (Docker internal vs localhost)
 *   AWS_S3_FORCE_PATH_STYLE    default true when an endpoint is set
 */
export class S3StorageProvider extends StorageProvider {
  constructor() {
    super();
    this._internalEndpoint = process.env.AWS_S3_ENDPOINT || "";
    this._publicEndpoint =
      process.env.AWS_S3_PUBLIC_ENDPOINT || this._internalEndpoint;

    this._client = createClient(this._internalEndpoint);
    this._presignClient =
      this._publicEndpoint && this._publicEndpoint !== this._internalEndpoint
        ? createClient(this._publicEndpoint)
        : this._client;
  }

  async init() {
    try {
      await this._client.send(new ListBucketsCommand({}));
    } catch (error) {
      throw new Error(
        `Cannot reach object storage (${error.message}). ` +
          `Is MinIO running? Try: npm run minio:up`
      );
    }
    console.log("📦 Storage ready");
  }

  async bucketExists(bucket) {
    try {
      await this._client.send(new HeadBucketCommand({ Bucket: bucket }));
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      // 403: the name exists but belongs to someone else — treat as taken.
      if (error?.$metadata?.httpStatusCode === 403) return true;
      throw error;
    }
  }

  async createBucket(bucket) {
    if (await this.bucketExists(bucket)) {
      throw new Error(`Bucket "${bucket}" already exists.`);
    }
    await this._client.send(new CreateBucketCommand({ Bucket: bucket }));

    // Buckets are private by default. Block public access where the gateway
    // supports it (AWS S3); MinIO and some gateways do not implement this call.
    try {
      await this._client.send(
        new PutPublicAccessBlockCommand({
          Bucket: bucket,
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            IgnorePublicAcls: true,
            BlockPublicPolicy: true,
            RestrictPublicBuckets: true,
          },
        })
      );
    } catch {
      // Not supported by this gateway; the bucket has no public policy anyway.
    }

    await this._applyCors(bucket);
  }

  async deleteBucketIfEmpty(bucket) {
    const listed = await this._client.send(
      new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 })
    );
    if ((listed.KeyCount ?? listed.Contents?.length ?? 0) > 0) return false;
    await this._client.send(new DeleteBucketCommand({ Bucket: bucket }));
    return true;
  }

  async _applyCors(bucket) {
    const origins = (process.env.NUBRED_STORAGE_CORS_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const allowedOrigins =
      origins.length > 0
        ? origins
        : [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://preview.nubred.com",
            "https://governance.nubred.com",
            `https://*.${process.env.NUBRED_TENANT_HOST_SUFFIX || "gov.nubred.com"}`,
          ];

    try {
      await this._client.send(
        new PutBucketCorsCommand({
          Bucket: bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ["*"],
                AllowedMethods: ["GET", "PUT", "HEAD"],
                AllowedOrigins: allowedOrigins,
                ExposeHeaders: ["ETag", "Content-Length", "Content-Type"],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        })
      );
    } catch (error) {
      // Native S3 always supports this; some gateways may not. Uploads still work
      // if the bucket already has CORS configured in the console.
      console.warn(`⚠️  Could not set CORS on bucket "${bucket}": ${error.message}`);
    }
  }

  async getPresignedPutUrl({ bucket, key, mimeType, expiresIn = DEFAULT_EXPIRES }) {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mimeType,
    });
    const url = await getSignedUrl(this._presignClient, command, { expiresIn });
    return {
      url,
      method: "PUT",
      headers: { "Content-Type": mimeType },
      expiresIn,
    };
  }

  async getPresignedGetUrl({ bucket, key, filename, expiresIn = DEFAULT_EXPIRES }) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: filename
        ? `inline; filename="${filename.replace(/"/g, "")}"`
        : undefined,
    });
    const url = await getSignedUrl(this._presignClient, command, { expiresIn });
    return { url, method: "GET", expiresIn };
  }

  async headObject(bucket, key) {
    try {
      const result = await this._client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key })
      );
      return {
        exists: true,
        sizeBytes: result.ContentLength ?? null,
        etag: result.ETag ?? null,
      };
    } catch (error) {
      const status = error?.$metadata?.httpStatusCode;
      if (status === 404 || error.name === "NotFound") {
        return { exists: false, sizeBytes: null, etag: null };
      }
      throw error;
    }
  }

  async getObjectBuffer(bucket, key) {
    const result = await this._client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async deleteObject(bucket, key) {
    await this._client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key })
    );
  }
}
