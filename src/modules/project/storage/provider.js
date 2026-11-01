/**
 * StorageProvider — the single interface all document blob operations go through.
 *
 * Concrete implementation: S3StorageProvider (MinIO, Hetzner Object Storage, AWS S3).
 * Switch providers by changing AWS_S3_ENDPOINT / credentials — not by changing callers.
 *
 * Every client has its own private bucket (nubred-{slug}). Methods take the bucket
 * name explicitly; callers always pass the caller's tenant bucket (req.bucket /
 * tenant.bucketName), never a value supplied by the browser.
 *
 * All storage calls MUST use getStorage() after initStorage() at app startup.
 */

/**
 * @typedef {Object} PresignedUpload
 * @property {string} url
 * @property {'PUT'} method
 * @property {Record<string, string>} headers  - Must be sent exactly by the client
 * @property {number} expiresIn                - Seconds until the URL expires
 */

/**
 * @typedef {Object} PresignedDownload
 * @property {string} url
 * @property {'GET'} method
 * @property {number} expiresIn
 */

export class StorageProvider {
  /**
   * Verify the storage endpoint is reachable with the configured credentials.
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error(`${this.constructor.name} must implement init()`);
  }

  /**
   * @param {string} bucket
   * @returns {Promise<boolean>}
   */
  // eslint-disable-next-line no-unused-vars
  async bucketExists(bucket) {
    throw new Error(`${this.constructor.name} must implement bucketExists()`);
  }

  /**
   * Create a private bucket with browser CORS. Throws if it already exists.
   * @param {string} bucket
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async createBucket(bucket) {
    throw new Error(`${this.constructor.name} must implement createBucket()`);
  }

  /**
   * Delete a bucket only if it holds no objects.
   * @param {string} bucket
   * @returns {Promise<boolean>} true when deleted
   */
  // eslint-disable-next-line no-unused-vars
  async deleteBucketIfEmpty(bucket) {
    throw new Error(`${this.constructor.name} must implement deleteBucketIfEmpty()`);
  }

  /**
   * @param {{ bucket: string, key: string, mimeType: string, expiresIn?: number }} params
   * @returns {Promise<PresignedUpload>}
   */
  // eslint-disable-next-line no-unused-vars
  async getPresignedPutUrl({ bucket, key, mimeType, expiresIn }) {
    throw new Error(`${this.constructor.name} must implement getPresignedPutUrl()`);
  }

  /**
   * @param {{ bucket: string, key: string, filename?: string, expiresIn?: number }} params
   * @returns {Promise<PresignedDownload>}
   */
  // eslint-disable-next-line no-unused-vars
  async getPresignedGetUrl({ bucket, key, filename, expiresIn }) {
    throw new Error(`${this.constructor.name} must implement getPresignedGetUrl()`);
  }

  /**
   * @param {string} bucket
   * @param {string} key
   * @returns {Promise<{ exists: boolean, sizeBytes: number | null, etag: string | null }>}
   */
  // eslint-disable-next-line no-unused-vars
  async headObject(bucket, key) {
    throw new Error(`${this.constructor.name} must implement headObject()`);
  }

  /**
   * @param {string} bucket
   * @param {string} key
   * @returns {Promise<Buffer>}
   */
  // eslint-disable-next-line no-unused-vars
  async getObjectBuffer(bucket, key) {
    throw new Error(`${this.constructor.name} must implement getObjectBuffer()`);
  }

  /**
   * @param {string} bucket
   * @param {string} key
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async deleteObject(bucket, key) {
    throw new Error(`${this.constructor.name} must implement deleteObject()`);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/** @type {StorageProvider | null} */
let _storage = null;

/** @type {Promise<StorageProvider> | null} */
let _initPromise = null;

/** @type {Error | null} */
let _initError = null;

/**
 * Call at application startup (after env is loaded). Idempotent.
 * @returns {Promise<StorageProvider>}
 */
export async function initStorage() {
  if (_storage) return _storage;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const name = (process.env.NUBRED_STORAGE_PROVIDER ?? "s3")
      .trim()
      .toLowerCase();

    switch (name) {
      case "s3": {
        const { S3StorageProvider } = await import("./s3.provider.js");
        const provider = new S3StorageProvider();
        await provider.init();
        _storage = provider;
        _initError = null;
        return _storage;
      }
      default:
        throw new Error(
          `Unknown NUBRED_STORAGE_PROVIDER value: "${name}". ` +
            `Supported values: 's3' (MinIO, Hetzner Object Storage, AWS S3).`
        );
    }
  })();

  try {
    return await _initPromise;
  } catch (error) {
    _initError = error;
    _initPromise = null;
    throw error;
  }
}

/**
 * Returns the storage singleton, initialising on first use if startup init failed
 * or the server started before MinIO was reachable.
 * @returns {Promise<StorageProvider>}
 */
export async function ensureStorage() {
  if (_storage) return _storage;
  try {
    return await initStorage();
  } catch (error) {
    throw Object.assign(
      new Error(
        `Object storage unavailable: ${error.message}. ` +
          `Ensure MinIO is running (npm run minio:up) and AWS_S3_* vars are set in .env, then retry.`
      ),
      { code: 503 }
    );
  }
}

/**
 * @returns {StorageProvider}
 */
export function getStorage() {
  if (!_storage) {
    const detail = _initError?.message
      ? ` Last error: ${_initError.message}`
      : " Call initStorage() at application startup or ensure MinIO is running (npm run minio:up).";
    throw new Error(`Storage is not initialised.${detail}`);
  }
  return _storage;
}

/**
 * Override for tests.
 * @param {StorageProvider | null} provider
 */
export function setStorage(provider) {
  _storage = provider;
}
