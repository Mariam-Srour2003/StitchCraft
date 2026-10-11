import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'sc-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="sc-page sc-page--narrow">
      <h1>We dropped a stitch</h1>
      <p class="sc-page__lede">That page doesn't exist, or has moved.</p>
      <div class="sc-actions">
        <a routerLink="/">Go home</a>
        <a routerLink="/projects">Your projects</a>
        <a routerLink="/help">Help</a>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}
