import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthResponse, LoginDto, RegisterDto, User } from '@stitchcraft/types';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../api/api-client.service';
import { TokenStorageService } from './token-storage.service';

/**
 * Signal-based auth state store (see PLAN.md: feature state lives in a
 * `*Store` service, not NgRx, unless cross-feature replay is needed).
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(ApiClient);
  private readonly tokenStorage = inject(TokenStorageService);

  private readonly currentUserSignal = signal<User | null>(null);

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  async register(dto: RegisterDto): Promise<void> {
    const response = await firstValueFrom(this.api.post<AuthResponse>('/auth/register', dto));
    this.applyAuthResponse(response);
  }

  async login(dto: LoginDto): Promise<void> {
    const response = await firstValueFrom(this.api.post<AuthResponse>('/auth/login', dto));
    this.applyAuthResponse(response);
  }

  async loadCurrentUser(): Promise<void> {
    if (!this.tokenStorage.getAccessToken()) return;
    try {
      const user = await firstValueFrom(this.api.get<User>('/users/me'));
      this.currentUserSignal.set(user);
    } catch {
      this.logout();
    }
  }

  logout(): void {
    this.tokenStorage.clear();
    this.currentUserSignal.set(null);
  }

  private applyAuthResponse(response: AuthResponse): void {
    this.tokenStorage.save({ accessToken: response.accessToken, refreshToken: response.refreshToken });
    this.currentUserSignal.set(response.user);
  }
}
