import { migrateLegacyStorage } from './migrate-legacy-storage';

describe('migrateLegacyStorage', () => {
  beforeEach(() => localStorage.clear());

  it('moves old entries to the new name and removes the old ones', () => {
    localStorage.setItem('stitchcraft.accessToken', 'abc');
    localStorage.setItem('stitchcraft.stash.v1.user-1', '{"310":2}');
    localStorage.setItem('unrelated', 'keep');

    expect(migrateLegacyStorage()).toBe(2);

    expect(localStorage.getItem('hobbygrid.accessToken')).toBe('abc');
    expect(localStorage.getItem('hobbygrid.stash.v1.user-1')).toBe('{"310":2}');
    expect(localStorage.getItem('stitchcraft.accessToken')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });

  it('keeps an entry already saved under the new name', () => {
    localStorage.setItem('stitchcraft.settings.v1', 'old');
    localStorage.setItem('hobbygrid.settings.v1', 'new');

    expect(migrateLegacyStorage()).toBe(0);

    expect(localStorage.getItem('hobbygrid.settings.v1')).toBe('new');
    expect(localStorage.getItem('stitchcraft.settings.v1')).toBeNull();
  });

  it('does nothing when there is nothing to move, or no storage', () => {
    expect(migrateLegacyStorage()).toBe(0);
    expect(migrateLegacyStorage(undefined)).toBe(0);
  });
});
