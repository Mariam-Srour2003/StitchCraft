import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { ApplicationConfig } from '@angular/core';
import { APP_INITIALIZER, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { AuthStore } from './core/auth/auth.store';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/error/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    // Resolves stored-token auth state before the router's initial navigation
    // runs its guards - otherwise authGuard sees isAuthenticated() === false
    // (loadCurrentUser() hasn't resolved yet) and bounces a valid session to
    // /sign-in on any deep link or hard refresh of a protected route.
    {
      provide: APP_INITIALIZER,
      useFactory: (authStore: AuthStore) => () => authStore.loadCurrentUser(),
      deps: [AuthStore],
      multi: true,
    },
  ],
};
