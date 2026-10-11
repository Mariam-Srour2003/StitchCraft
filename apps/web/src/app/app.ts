import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthStore } from '@app/core/auth/auth.store';
import { Button } from '@app/shared/ui/button/button';

export const NAV_LINKS: readonly { path: string; label: string }[] = [
  { path: '/', label: 'Home' },
  { path: '/projects', label: 'Projects' },
  { path: '/templates', label: 'Templates' },
  { path: '/threads', label: 'My threads' },
  { path: '/shopping', label: 'Shopping list' },
  { path: '/tools', label: 'Calculators' },
  { path: '/palettes', label: 'DMC colors' },
  { path: '/my-palettes', label: 'My palettes' },
  { path: '/help', label: 'Help' },
];

@Component({
  selector: 'sc-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Button],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly navLinks = NAV_LINKS;

  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  async signOut(): Promise<void> {
    this.authStore.logout();
    await this.router.navigate(['/sign-in']);
  }
}
