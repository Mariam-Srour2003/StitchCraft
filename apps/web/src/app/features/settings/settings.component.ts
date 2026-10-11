import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  CanvasThemePreference,
  SettingsStore,
  UserSettings,
} from '@app/core/settings/settings.store';
import { stitchesPerSkein } from '@stitchcraft/color';
import { Button } from '@app/shared/ui/button/button';

@Component({
  selector: 'sc-settings',
  standalone: true,
  imports: [Button],
  templateUrl: './settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  protected readonly store = inject(SettingsStore);
  protected readonly saved = signal(false);

  protected readonly themes: { value: CanvasThemePreference; label: string }[] = [
    { value: 'auto', label: 'Match my device' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  protected stitchesPerSkeinPreview(): number {
    return stitchesPerSkein(this.store.fabricCount(), this.store.strands());
  }

  set<K extends keyof UserSettings>(key: K, raw: string): void {
    const numeric = key !== 'canvasTheme' && !(key === 'strands' && raw === 'auto');
    this.store.update({ [key]: numeric ? Number(raw) : raw } as Partial<UserSettings>);
    this.saved.set(true);
  }

  reset(): void {
    if (confirm('Reset all settings to their defaults?')) this.store.reset();
  }
}
