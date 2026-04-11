import { create } from 'zustand';
import type { Module } from '../types';

interface AppState {
  sidebarOpen: boolean;
  mobileNavOpen: boolean;
  currentModule: Module | null;
  setCurrentModule: (module: Module | null) => void;
  toggleSidebar: () => void;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  mobileNavOpen: false,
  currentModule: null,
  setCurrentModule: (module) => set({ currentModule: module }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openMobileNav: () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
}));
