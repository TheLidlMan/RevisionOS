import { useState, useEffect } from 'react';
import { Moon, Sun } from '@phosphor-icons/react';
import { browserStorage } from '../utils/browser';

const THEME_KEY = 'reviseos_theme';
const LEGACY_THEME_KEY = 'revisionos_theme';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const saved = browserStorage.getItem(THEME_KEY) || browserStorage.getItem(LEGACY_THEME_KEY);
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    document.body.classList.toggle('theme-light', !dark);
    browserStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 8,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
