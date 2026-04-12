import { create } from 'zustand';
import { authSession, authLogout } from '../api/client';
import type { AuthUser } from '../types';
import { browserStorage } from '../utils/browser';

const AUTH_TOKEN_KEY = 'reviseos_token';
const LEGACY_AUTH_TOKEN_KEY = 'revisionos_token';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  /** @deprecated kept for backward compat — prefer checkSession */
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  loading: true,

  logout: async () => {
    try { await authLogout(); } catch { /* best-effort */ }
    browserStorage.removeItem(AUTH_TOKEN_KEY);
    browserStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },

  checkSession: async () => {
    set({ loading: true });
    try {
      const data = await authSession();
      if (data.authenticated && data.user) {
        set({ user: data.user, isAuthenticated: true, loading: false });
      } else {
        browserStorage.removeItem(AUTH_TOKEN_KEY);
        browserStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
        set({ token: null, user: null, isAuthenticated: false, loading: false });
      }
    } catch {
      set({ token: null, user: null, isAuthenticated: false, loading: false });
    }
  },

  loadFromStorage: async () => {
    await authSession()
      .then((data: { authenticated: boolean; user?: AuthUser }) => {
        if (data.authenticated && data.user) {
          set({ token: null, user: data.user, isAuthenticated: true, loading: false });
          return;
        }

        browserStorage.removeItem(AUTH_TOKEN_KEY);
        browserStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
        set({ token: null, user: null, isAuthenticated: false, loading: false });
      })
      .catch(() => {
        browserStorage.removeItem(AUTH_TOKEN_KEY);
        browserStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
        set({ token: null, user: null, isAuthenticated: false, loading: false });
      });
  },
}));
