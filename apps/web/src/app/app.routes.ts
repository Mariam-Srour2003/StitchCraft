import type { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  {
    path: 'sign-in',
    loadComponent: () => import('./features/auth/sign-in.component').then((m) => m.SignInComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/projects-list.component').then((m) => m.ProjectsListComponent),
  },
  {
    path: 'palettes',
    loadComponent: () =>
      import('./features/palettes/dmc-browse.component').then((m) => m.DmcBrowseComponent),
  },
  {
    path: 'my-palettes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/palettes/my-palettes.component').then((m) => m.MyPalettesComponent),
  },
  {
    path: 'editor/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/editor/editor.component').then((m) => m.EditorComponent),
  },
  {
    path: 'converter/:projectId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/converter/converter.component').then((m) => m.ConverterComponent),
  },
  {
    path: 'patterns/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pattern-view/pattern-view-placeholder.component').then(
        (m) => m.PatternViewPlaceholderComponent,
      ),
  },
  { path: '**', redirectTo: 'projects' },
];
