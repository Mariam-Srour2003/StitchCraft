/**
 * Safe localStorage access. Storage can be unavailable or throw (private
 * windows, blocked site data, quota), so every read falls back and every
 * write fails quietly - features built on this must still work without it.
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw === null || raw === undefined ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable or full: keep working in memory
  }
}
