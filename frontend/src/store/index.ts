import { create } from 'zustand';
import type { Module } from '../types';

interface AppState {
  sidebarOpen: boolean;
  currentModule: Module | null;
  setCurrentModule: (module: Module | null) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  currentModule: null,
  setCurrentModule: (module) => set({ currentModule: module }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
