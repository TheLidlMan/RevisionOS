import { create } from 'zustand';
import { authLogin, authRegister, authMe } from '../api/client';
import type { AuthUser } from '../types';

const AUTH_TOKEN_KEY = 'reviseos_token';
const LEGACY_AUTH_TOKEN_KEY = 'revisionos_token';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  login: async (email, password) => {
    const data = await authLogin(email, password);
    localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
    set({ token: data.access_token, user: data.user, isAuthenticated: true });
  },

  register: async (email, password, displayName) => {
    const data = await authRegister(email, password, displayName);
    localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
    set({ token: data.access_token, user: data.user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      set({ token, isAuthenticated: true });
      authMe()
        .then((user) => set({ user }))
        .catch(() => {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
          set({ token: null, user: null, isAuthenticated: false });
        });
    }
  },
}));
