import type { Routes } from '@angular/router';

import { authGuard } from '@app/core/auth/auth.guard';
import { unsavedChangesGuard } from '@app/features/editor/unsaved-changes.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'StitchCraft',
    loadComponent: () => import('@app/features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'sign-in',
    title: 'Sign in · StitchCraft',
    loadComponent: () =>
      import('@app/features/auth/sign-in.component').then((m) => m.SignInComponent),
  },
  {
    path: 'register',
    title: 'Create account · StitchCraft',
    loadComponent: () =>
      import('@app/features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'projects',
    title: 'Projects · StitchCraft',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@app/features/projects/projects-list.component').then((m) => m.ProjectsListComponent),
  },
  {
    path: 'templates',
    title: 'Templates · StitchCraft',
    loadComponent: () =>
      import('@app/features/templates/templates.component').then((m) => m.TemplatesComponent),
  },
  {
    path: 'tools',
    title: 'Calculators · StitchCraft',
    loadComponent: () =>
      import('@app/features/tools/tools.component').then((m) => m.ToolsComponent),
  },
  {
    path: 'threads',
    title: 'My threads · StitchCraft',
    loadComponent: () =>
      import('@app/features/stash/stash.component').then((m) => m.StashComponent),
  },
  {
    path: 'shopping',
    title: 'Shopping list · StitchCraft',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@app/features/shopping/shopping.component').then((m) => m.ShoppingComponent),
  },
  {
    path: 'palettes',
    title: 'DMC colors · StitchCraft',
    loadComponent: () =>
      import('@app/features/palettes/dmc-browse.component').then((m) => m.DmcBrowseComponent),
  },
  {
    path: 'my-palettes',
    title: 'My palettes · StitchCraft',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@app/features/palettes/my-palettes.component').then((m) => m.MyPalettesComponent),
  },
  {
    path: 'editor/:id',
    title: 'Editor · StitchCraft',
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('@app/features/editor/editor.component').then((m) => m.EditorComponent),
  },
  {
    path: 'converter/:projectId',
    title: 'Convert an image · StitchCraft',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@app/features/converter/converter.component').then((m) => m.ConverterComponent),
  },
  {
    path: 'patterns/:id',
    title: 'Pattern · StitchCraft',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@app/features/pattern-view/pattern-view.component').then(
        (m) => m.PatternViewComponent,
      ),
  },
  {
    path: 'help',
    title: 'Help · StitchCraft',
    loadComponent: () => import('@app/features/help/help.component').then((m) => m.HelpComponent),
  },
  {
    path: 'settings',
    title: 'Settings · StitchCraft',
    loadComponent: () =>
      import('@app/features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: '**',
    title: 'Not found · StitchCraft',
    loadComponent: () =>
      import('@app/features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
