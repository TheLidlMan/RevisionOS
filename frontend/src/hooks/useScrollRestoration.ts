import { useEffect } from 'react';
import { browserStorage, isBrowser } from '../utils/browser';

export function useScrollRestoration(key: string) {
  useEffect(() => {
    if (!isBrowser()) {
      return;
    }

    const storageKey = `scroll:${key}`;
    const stored = browserStorage.getItem(storageKey, 'session');
    if (stored) {
      const y = Number(stored);
      if (!Number.isNaN(y)) {
        window.requestAnimationFrame(() => window.scrollTo({ top: y }));
      }
    }

    const save = () => {
      browserStorage.setItem(storageKey, String(window.scrollY), 'session');
    };

    window.addEventListener('scroll', save, { passive: true });
    window.addEventListener('beforeunload', save);

    return () => {
      save();
      window.removeEventListener('scroll', save);
      window.removeEventListener('beforeunload', save);
    };
  }, [key]);
}
