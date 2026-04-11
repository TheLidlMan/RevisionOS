import { useEffect } from 'react';

export function useScrollRestoration(key: string) {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const stored = window.sessionStorage.getItem(`scroll:${key}`);
    if (stored) {
      const y = Number(stored);
      if (!Number.isNaN(y)) {
        window.requestAnimationFrame(() => window.scrollTo({ top: y }));
      }
    }

    const save = () => {
      window.sessionStorage.setItem(`scroll:${key}`, String(window.scrollY));
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
