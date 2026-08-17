import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthStore } from './core/auth/auth.store';
import { Button } from './shared/ui/button/button';
import { Toolbar } from './shared/ui/toolbar/toolbar';

@Component({
  selector: 'sc-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, Toolbar, Button],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  async signOut(): Promise<void> {
    this.authStore.logout();
    await this.router.navigate(['/sign-in']);
  }
}
