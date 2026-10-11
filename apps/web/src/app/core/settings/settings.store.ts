import { Injectable, computed, signal } from '@angular/core';
import { readJson, writeJson } from '@app/core/browser/browser-storage';

export type CanvasThemePreference = 'auto' | 'light' | 'dark';

export interface UserSettings {
  /** Default Aida count for new cross-stitch patterns and calculators. */
  fabricCount: number;
  /** Default drill size for new diamond patterns. */
  drillSizeMm: number;
  /** Strands used for skein estimates; 'auto' picks the usual number for the fabric. */
  strands: 'auto' | 1 | 2 | 3;
  /** Personal stitching speed, for time estimates. */
  stitchesPerHour: number;
  canvasTheme: CanvasThemePreference;
}

export const DEFAULT_SETTINGS: UserSettings = {
  fabricCount: 14,
  drillSizeMm: 2.8,
  strands: 'auto',
  stitchesPerHour: 80,
  canvasTheme: 'auto',
};

const STORAGE_KEY = 'stitchcraft.settings.v1';

/**
 * Per-browser preferences. Kept client-side on purpose: they're display and
 * estimating defaults, not pattern data, so they don't need the API.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly state = signal<UserSettings>({
    ...DEFAULT_SETTINGS,
    ...readJson<Partial<UserSettings>>(STORAGE_KEY, {}),
  });

  readonly settings = this.state.asReadonly();
  readonly fabricCount = computed(() => this.state().fabricCount);
  readonly drillSizeMm = computed(() => this.state().drillSizeMm);
  readonly stitchesPerHour = computed(() => this.state().stitchesPerHour);
  readonly canvasTheme = computed(() => this.state().canvasTheme);
  /** Strands to pass to estimators: undefined means "use the fabric's usual default". */
  readonly strands = computed(() => {
    const strands = this.state().strands;
    return strands === 'auto' ? undefined : strands;
  });

  update(patch: Partial<UserSettings>): void {
    this.state.update((current) => sanitize({ ...current, ...patch }));
    writeJson(STORAGE_KEY, this.state());
  }

  reset(): void {
    this.state.set({ ...DEFAULT_SETTINGS });
    writeJson(STORAGE_KEY, this.state());
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function sanitize(settings: UserSettings): UserSettings {
  const strandsOk = settings.strands === 'auto' || [1, 2, 3].includes(Number(settings.strands));
  return {
    fabricCount: clampNumber(settings.fabricCount, 6, 40, DEFAULT_SETTINGS.fabricCount),
    drillSizeMm: clampNumber(settings.drillSizeMm, 1, 6, DEFAULT_SETTINGS.drillSizeMm),
    strands: strandsOk
      ? settings.strands === 'auto'
        ? 'auto'
        : (Number(settings.strands) as 1 | 2 | 3)
      : 'auto',
    stitchesPerHour: clampNumber(
      settings.stitchesPerHour,
      1,
      1000,
      DEFAULT_SETTINGS.stitchesPerHour,
    ),
    canvasTheme: ['auto', 'light', 'dark'].includes(settings.canvasTheme)
      ? settings.canvasTheme
      : 'auto',
  };
}
