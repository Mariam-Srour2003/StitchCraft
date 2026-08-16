export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');

/**
 * Pluggable file storage. `LocalStorageAdapter` backs local dev (see
 * docker-compose.yml); a production deployment swaps in an S3-compatible
 * adapter implementing the same interface without touching callers.
 */
export interface StorageAdapter {
  /** Persists a file and returns its storage key (not a public URL). */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** A URL the client can use to fetch this object directly. */
  urlFor(key: string): string;
}
