export const THEME_KEY = 'reviseos_theme';
const LEGACY_THEME_KEY = 'revisionos_theme';
export type ThemeMode = 'dark' | 'light' | 'system';

export function getStoredThemeMode(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY);
  if (saved === 'dark' || saved === 'light' || saved === 'system') {
    return saved;
  }
  return 'system';
}

export function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  const effectiveDark = mode === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches : mode === 'dark';
  return effectiveDark ? 'dark' : 'light';
}
