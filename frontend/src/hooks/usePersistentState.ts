import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { browserStorage, isBrowser } from '../utils/browser';

export function usePersistentState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(() => {
    if (!isBrowser()) {
      return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
    }

    const stored = browserStorage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored) as T;
      } catch {
        browserStorage.removeItem(key);
      }
    }

    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  });

  const hydrated = isBrowser();

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    browserStorage.setItem(key, JSON.stringify(value));
  }, [hydrated, key, value]);

  return [value, setValue, hydrated];
}
