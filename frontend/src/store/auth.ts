import { create } from 'zustand';
import { authLogin, authRegister, authSession, authLogout } from '../api/client';
import type { AuthUser } from '../types';

const AUTH_TOKEN_KEY = 'reviseos_token';
const LEGACY_AUTH_TOKEN_KEY = 'revisionos_token';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  /** @deprecated kept for backward compat — prefer checkSession */
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  loading: true,

  login: async (email, password) => {
    const data = await authLogin(email, password);
    // Server sets session cookie; store token as backward-compat fallback
    if (data.access_token) {
      localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
    }
    set({ token: data.access_token ?? null, user: data.user, isAuthenticated: true });
  },

  register: async (email, password, displayName) => {
    const data = await authRegister(email, password, displayName);
    if (data.access_token) {
      localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
    }
    set({ token: data.access_token ?? null, user: data.user, isAuthenticated: true });
  },

  logout: async () => {
    try { await authLogout(); } catch { /* best-effort */ }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },

  checkSession: async () => {
    set({ loading: true });
    try {
      const data = await authSession();
      if (data.authenticated && data.user) {
        set({ user: data.user, isAuthenticated: true, loading: false });
      } else {
        // Clear any stale localStorage tokens
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
        set({ token: null, user: null, isAuthenticated: false, loading: false });
      }
    } catch {
      set({ token: null, user: null, isAuthenticated: false, loading: false });
    }
  },

  loadFromStorage: () => {
    // Legacy: try localStorage token, then verify via session endpoint
    const token = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      set({ token, isAuthenticated: true });
    }
    // Always verify via session endpoint (covers cookie auth too)
    authSession()
      .then((data: { authenticated: boolean; user?: AuthUser }) => {
        if (data.authenticated && data.user) {
          set({ user: data.user, isAuthenticated: true, loading: false });
        } else {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
          set({ token: null, user: null, isAuthenticated: false, loading: false });
        }
      })
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
        set({ token: null, user: null, isAuthenticated: false, loading: false });
      });
  },
}));
