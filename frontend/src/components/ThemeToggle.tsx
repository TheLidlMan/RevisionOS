import { useEffect, useMemo, useState } from 'react';
import { Desktop, Moon, Sun } from '@phosphor-icons/react';

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

interface Props {
  value?: ThemeMode;
  onChange?: (value: ThemeMode) => void;
}

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Desktop },
];

export default function ThemeToggle({ value, onChange }: Props) {
  const [internalTheme, setInternalTheme] = useState<ThemeMode>(() => getStoredThemeMode());
  const theme = value ?? internalTheme;
  const effectiveTheme = useMemo(() => resolveTheme(theme), [theme]);

  useEffect(() => {
    document.body.classList.toggle('theme-light', effectiveTheme === 'light');
    localStorage.setItem(THEME_KEY, theme);
  }, [effectiveTheme, theme]);

  useEffect(() => {
    if (theme !== 'system') return undefined;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      document.body.classList.toggle('theme-light', resolveTheme('system') === 'light');
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const handleChange = (next: ThemeMode) => {
    if (onChange) {
      onChange(next);
      return;
    }
    setInternalTheme(next);
  };

  return (
    <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {OPTIONS.map(({ value: option, label, icon: Icon }) => (
        <button
          key={option}
          type="button"
          onClick={() => handleChange(option)}
          aria-label={`Switch to ${label.toLowerCase()} mode`}
          title={label}
          className="px-2.5 py-2 flex items-center justify-center"
          style={{
            background: theme === option ? 'var(--accent-soft)' : 'transparent',
            color: theme === option ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}
