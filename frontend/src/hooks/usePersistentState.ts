import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export function usePersistentState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [hydrated, setHydrated] = useState(false);
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
    }

    const stored = window.localStorage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored) as T;
      } catch {
        window.localStorage.removeItem(key);
      }
    }

    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  });

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [hydrated, key, value]);

  return [value, setValue, hydrated];
}
