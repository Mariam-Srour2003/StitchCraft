import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  {
    path: 'sign-in',
    loadComponent: () => import('./features/auth/sign-in.component').then((m) => m.SignInComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/projects-list.component').then((m) => m.ProjectsListComponent),
  },
  {
    path: 'palettes',
    loadComponent: () => import('./features/palettes/dmc-browse.component').then((m) => m.DmcBrowseComponent),
  },
  {
    path: 'editor/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/editor/editor.component').then((m) => m.EditorComponent),
  },
  {
    path: 'converter',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/converter/converter-placeholder.component').then(
        (m) => m.ConverterPlaceholderComponent,
      ),
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
