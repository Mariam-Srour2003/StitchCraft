import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { downloadText } from '@app/core/browser/download';
import { SettingsStore } from '@app/core/settings/settings.store';
import { LibraryPattern, PatternLibraryService } from '@app/data-access/pattern-library.service';
import { StashStore } from '@app/data-access/stash.store';
import { PATTERN_TYPE_LABELS } from '@app/domain/pattern/pattern-rules';
import { patternStats } from '@app/domain/pattern/pattern-stats';
import { Button } from '@app/shared/ui/button/button';

import { buildShoppingList, ShoppingLine, shoppingListText } from './shopping-list';

@Component({
  selector: 'sc-shopping',
  standalone: true,
  imports: [RouterLink, Button],
  templateUrl: './shopping.component.html',
  styleUrl: './shopping.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingComponent {
  private readonly library = inject(PatternLibraryService);
  private readonly settings = inject(SettingsStore);
  protected readonly stash = inject(StashStore);

  protected readonly typeLabels = PATTERN_TYPE_LABELS;
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly patterns = signal<LibraryPattern[]>([]);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly hideOwned = signal(true);
  protected readonly bought = signal<ReadonlySet<string>>(new Set());
  protected readonly copied = signal(false);

  protected readonly list = computed(() =>
    buildShoppingList(
      this.patterns()
        .filter((p) => this.selected().has(p.pattern.id))
        .map((p) => p.pattern),
      (code) => this.stash.quantity(code),
      { strands: this.settings.strands(), defaultFabricCount: this.settings.fabricCount() },
    ),
  );

  protected readonly threadLines = computed(() =>
    this.hideOwned() ? this.list().threads.filter((l) => l.toBuy > 0) : this.list().threads,
  );

  protected readonly totals = computed(() => ({
    skeinsToBuy: this.list().threads.reduce((sum, l) => sum + l.toBuy, 0),
    covered: this.list().threads.filter((l) => l.toBuy === 0).length,
    bags: this.list().drills.reduce((sum, l) => sum + l.needed, 0),
  }));

  constructor() {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const { patterns } = await this.library.loadAll();
      this.patterns.set(patterns);
      // Default: everything not finished yet.
      this.selected.set(
        new Set(
          patterns
            .filter((p) => {
              const stats = patternStats(p.pattern);
              return stats.total > 0 && stats.done < stats.total;
            })
            .map((p) => p.pattern.id),
        ),
      );
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  toggle(id: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  selectAll(all: boolean): void {
    this.selected.set(new Set(all ? this.patterns().map((p) => p.pattern.id) : []));
  }

  toggleBought(key: string): void {
    this.bought.update((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** Closes the loop: what you just bought goes into your stash. */
  moveBoughtToStash(): void {
    for (const line of this.list().threads) {
      if (this.bought().has(line.key) && line.dmc && line.toBuy > 0) {
        this.stash.add(line.dmc.code, line.toBuy);
      }
    }
    this.bought.set(new Set());
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(shoppingListText(this.list()));
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  download(): void {
    downloadText('shopping-list.txt', shoppingListText(this.list()), 'text/plain');
  }

  print(): void {
    globalThis.print?.();
  }

  protected lineLabel(line: ShoppingLine): string {
    return line.dmc ? `DMC ${line.key}` : line.hex;
  }
}
