import { create } from 'zustand';
import { authSession, authLogout } from '../api/client';
import type { AuthUser } from '../types';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  /** @deprecated kept for backward compat — prefer checkSession */
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  logout: async () => {
    try { await authLogout(); } catch { /* best-effort */ }
    set({ user: null, isAuthenticated: false });
  },

  checkSession: async () => {
    set({ loading: true });
    try {
      const data = await authSession();
      if (data.authenticated && data.user) {
        set({ user: data.user, isAuthenticated: true, loading: false });
      } else {
        set({ user: null, isAuthenticated: false, loading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, loading: false });
    }
  },

  loadFromStorage: () => {
    // Verify session via cookie — localStorage token storage has been removed
    authSession()
      .then((data: { authenticated: boolean; user?: AuthUser }) => {
        if (data.authenticated && data.user) {
          set({ user: data.user, isAuthenticated: true, loading: false });
        } else {
          set({ user: null, isAuthenticated: false, loading: false });
        }
      })
      .catch(() => {
        set({ user: null, isAuthenticated: false, loading: false });
      });
  },
}));
