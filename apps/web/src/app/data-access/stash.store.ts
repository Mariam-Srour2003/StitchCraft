import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DMC_COLORS, findDmcByCode } from '@stitchcraft/color';
import type { DmcColor } from '@stitchcraft/types';
import { AuthStore } from '@app/core/auth/auth.store';
import { readJson, writeJson } from '@app/core/browser/browser-storage';

export interface StashItem {
  color: DmcColor;
  skeins: number;
}

const KEY_PREFIX = 'stitchcraft.stash.v1.';

/** "310", "B5200" and "white" all match regardless of case. */
function normalizeCode(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  if (findDmcByCode(trimmed)) return trimmed;
  const match = DMC_COLORS.find((c) => c.code.toLowerCase() === trimmed.toLowerCase());
  return match?.code ?? null;
}

/** Numeric DMC codes in numeric order, then named ones (White, B5200, Ecru...). */
export function compareDmcCodes(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  if (Number.isFinite(na)) return -1;
  if (Number.isFinite(nb)) return 1;
  return a.localeCompare(b);
}

export interface ImportResult {
  added: number;
  unknown: string[];
}

/**
 * Parses a pasted thread list: codes separated by commas, spaces or new
 * lines, each optionally followed by a quantity ("310 x2", "321:3",
 * "666 1.5"). Quantity defaults to 1.
 */
export function parseThreadList(text: string): { code: string; skeins: number }[] {
  const items: { code: string; skeins: number }[] = [];
  for (const raw of text.split(/[\n,;]+/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^([A-Za-z]*\d*[A-Za-z]*)\s*(?:[x×:*]\s*|\s+)?(\d+(?:\.\d+)?)?$/.exec(line);
    if (match && match[1]) {
      items.push({ code: match[1], skeins: match[2] ? Number(match[2]) : 1 });
    } else {
      for (const token of line.split(/\s+/)) items.push({ code: token, skeins: 1 });
    }
  }
  return items;
}

/**
 * The threads you already own, per user, saved in this browser. The public
 * surface (items, quantity(), set/add/remove) is all a page needs, so moving
 * storage to the API later only touches this class.
 */
@Injectable({ providedIn: 'root' })
export class StashStore {
  private readonly auth = inject(AuthStore);
  private readonly quantities = signal<Record<string, number>>({});
  private storageKey = '';

  readonly items = computed<StashItem[]>(() =>
    Object.entries(this.quantities())
      .map(([code, skeins]) => ({ color: findDmcByCode(code), skeins }))
      .filter((item): item is StashItem => !!item.color)
      .sort((a, b) => compareDmcCodes(a.color.code, b.color.code)),
  );
  readonly codes = computed(() => this.items().map((item) => item.color.code));
  readonly totalSkeins = computed(() => this.items().reduce((sum, item) => sum + item.skeins, 0));

  constructor() {
    effect(
      () => {
        const userId = this.auth.currentUser()?.id ?? 'guest';
        this.storageKey = KEY_PREFIX + userId;
        this.quantities.set(readJson<Record<string, number>>(this.storageKey, {}));
      },
      { allowSignalWrites: true },
    );
  }

  quantity(code: string): number {
    return this.quantities()[code] ?? 0;
  }

  set(code: string, skeins: number): void {
    const normalized = normalizeCode(code);
    if (!normalized) return;
    const value = Math.max(0, Math.round(Number(skeins) * 2) / 2 || 0);
    this.quantities.update((q) => ({ ...q, [normalized]: value }));
    this.persist();
  }

  /** Adds skeins to a thread (adding it if new). Returns false for an unknown code. */
  add(code: string, skeins = 1): boolean {
    const normalized = normalizeCode(code);
    if (!normalized) return false;
    this.set(normalized, this.quantity(normalized) + skeins);
    return true;
  }

  remove(code: string): void {
    this.quantities.update((q) => {
      const next = { ...q };
      delete next[code];
      return next;
    });
    this.persist();
  }

  clear(): void {
    this.quantities.set({});
    this.persist();
  }

  importText(text: string): ImportResult {
    const unknown: string[] = [];
    let added = 0;
    for (const item of parseThreadList(text)) {
      if (this.add(item.code, item.skeins)) added++;
      else unknown.push(item.code);
    }
    return { added, unknown };
  }

  toCsv(): string {
    const rows = this.items().map(
      (item) =>
        `${item.color.code},"${item.color.name.replace(/"/g, '""')}",${item.color.hex},${item.skeins}`,
    );
    return ['DMC Code,Name,Hex,Skeins', ...rows].join('\r\n') + '\r\n';
  }

  private persist(): void {
    writeJson(this.storageKey, this.quantities());
  }
}
