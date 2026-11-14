/**
 * The app was called StitchCraft before it was Hobbygrid, and everything it
 * keeps in the browser (sign-in tokens, settings, the thread stash) was saved
 * under `stitchcraft.*` keys. This moves those entries to `hobbygrid.*` once,
 * so nobody is signed out or loses their stash by the rename. An entry that
 * already exists under the new name wins and the old one is just removed.
 */
const LEGACY_PREFIX = 'stitchcraft.';
const PREFIX = 'hobbygrid.';

export function migrateLegacyStorage(storage: Storage | undefined = safeLocalStorage()): number {
  if (!storage) return 0;
  let moved = 0;
  try {
    const legacyKeys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(LEGACY_PREFIX)) legacyKeys.push(key);
    }
    for (const key of legacyKeys) {
      const next = PREFIX + key.slice(LEGACY_PREFIX.length);
      const value = storage.getItem(key);
      if (value !== null && storage.getItem(next) === null) {
        storage.setItem(next, value);
        moved++;
      }
      storage.removeItem(key);
    }
  } catch {
    // Storage can be blocked or full; the app works without the old entries.
  }
  return moved;
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
