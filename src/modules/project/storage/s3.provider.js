import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
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

/**
 * S3-compatible storage: MinIO (dev), Hetzner Object Storage, AWS S3, R2.
 *
 * Env:
 *   AWS_S3_BUCKET              required
 *   AWS_ACCESS_KEY_ID          required
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
    this._bucket = requiredEnv("AWS_S3_BUCKET");
    this._internalEndpoint = process.env.AWS_S3_ENDPOINT || "";
    this._publicEndpoint =
      process.env.AWS_S3_PUBLIC_ENDPOINT || this._internalEndpoint;

    this._client = createClient(this._internalEndpoint);
    this._presignClient =
      this._publicEndpoint && this._publicEndpoint !== this._internalEndpoint
        ? createClient(this._publicEndpoint)
        : this._client;
  }

  get bucket() {
    return this._bucket;
  }

  async init() {
    try {
      await this._client.send(new HeadBucketCommand({ Bucket: this._bucket }));
    } catch (error) {
      const status = error?.$metadata?.httpStatusCode;
      if (status === 404 || error.name === "NotFound" || error.Code === "NoSuchBucket") {
        await this._client.send(new CreateBucketCommand({ Bucket: this._bucket }));
        console.log(`📦 Created storage bucket "${this._bucket}"`);
      } else if (status === 403) {
        throw new Error(
          `Storage credentials cannot access bucket "${this._bucket}". Check AWS_ACCESS_KEY_ID / AWS_S3_BUCKET.`
        );
      } else {
        throw new Error(
          `Cannot reach object storage (${error.message}). ` +
            `Is MinIO running? Try: npm run minio:up`
        );
      }
    }

    await this._applyCors();
    console.log(`📦 Storage ready (bucket: ${this._bucket})`);
  }

  async _applyCors() {
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
          ];

    try {
      await this._client.send(
        new PutBucketCorsCommand({
          Bucket: this._bucket,
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
      console.warn(`⚠️  Could not set bucket CORS: ${error.message}`);
    }
  }

  async getPresignedPutUrl({ key, mimeType, expiresIn = DEFAULT_EXPIRES }) {
    const command = new PutObjectCommand({
      Bucket: this._bucket,
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

  async getPresignedGetUrl({ key, filename, expiresIn = DEFAULT_EXPIRES }) {
    const command = new GetObjectCommand({
      Bucket: this._bucket,
      Key: key,
      ResponseContentDisposition: filename
        ? `inline; filename="${filename.replace(/"/g, "")}"`
        : undefined,
    });
    const url = await getSignedUrl(this._presignClient, command, { expiresIn });
    return { url, method: "GET", expiresIn };
  }

  async headObject(key) {
    try {
      const result = await this._client.send(
        new HeadObjectCommand({ Bucket: this._bucket, Key: key })
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

  async getObjectBuffer(key) {
    const result = await this._client.send(
      new GetObjectCommand({ Bucket: this._bucket, Key: key })
    );
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async deleteObject(key) {
    await this._client.send(
      new DeleteObjectCommand({ Bucket: this._bucket, Key: key })
    );
  }
}
