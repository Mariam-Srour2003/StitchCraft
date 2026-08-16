import { Injectable } from '@angular/core';
import { AuthTokens } from '@stitchcraft/types';

const ACCESS_TOKEN_KEY = 'stitchcraft.accessToken';
const REFRESH_TOKEN_KEY = 'stitchcraft.refreshToken';

/** Isolates localStorage access so the rest of the app never touches it directly. */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  save(tokens: AuthTokens): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}
