import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { DmcColor } from '@stitchcraft/types';
import { AuthStore } from '../../core/auth/auth.store';
import { downloadText } from '../../shared/pattern/download';
import { Button } from '../../shared/ui/button/button';
import { DmcThreadSearchComponent } from '../editor/dmc-thread-search.component';
import { ImportResult, StashStore } from './stash.store';

@Component({
  selector: 'sc-stash',
  standalone: true,
  imports: [FormsModule, RouterLink, Button, DmcThreadSearchComponent],
  templateUrl: './stash.component.html',
  styleUrl: './stash.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StashComponent {
  protected readonly stash = inject(StashStore);
  protected readonly auth = inject(AuthStore);

  protected readonly filter = signal('');
  protected readonly importText = signal('');
  protected readonly importResult = signal<ImportResult | null>(null);

  protected readonly visible = computed(() => {
    const q = this.filter().trim().toLowerCase();
    if (!q) return this.stash.items();
    return this.stash
      .items()
      .filter(
        (item) =>
          item.color.code.toLowerCase().includes(q) || item.color.name.toLowerCase().includes(q),
      );
  });

  protected readonly lowCount = computed(
    () => this.stash.items().filter((i) => i.skeins < 1).length,
  );

  addThread(color: DmcColor): void {
    this.stash.add(color.code, 1);
  }

  runImport(): void {
    this.importResult.set(this.stash.importText(this.importText()));
    this.importText.set('');
  }

  setSkeins(code: string, value: string | number): void {
    this.stash.set(code, Number(value));
  }

  exportCsv(): void {
    downloadText('my-threads.csv', this.stash.toCsv());
  }

  clearAll(): void {
    if (confirm('Remove every thread from your stash?')) this.stash.clear();
  }
}
