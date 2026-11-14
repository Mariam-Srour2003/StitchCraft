import { Injectable } from '@angular/core';

/**
 * Yes/no confirmations for destructive actions. Components ask this service
 * rather than calling `window.confirm` themselves, so tests can stub one
 * provider, and a styled in-app dialog can replace the browser prompt later
 * without touching every caller.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  confirm(message: string): boolean {
    return typeof globalThis.confirm === 'function' ? globalThis.confirm(message) : false;
  }
}
