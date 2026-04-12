import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { usePersistentState } from './usePersistentState';
import { browserStorage, isBrowser } from '../utils/browser';

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAutosaveDraft<T>(
  storageKey: string,
  initialValue: T | (() => T),
  enabled = true,
  delayMs = 500,
) {
  const [draft, setDraft, hydrated] = usePersistentState<T>(storageKey, initialValue);
  const [initialStored] = useState(() => {
    if (!isBrowser() || !enabled) {
      return false;
    }
    return browserStorage.getItem(storageKey) !== null;
  });
  const [status, setStatus] = useState<AutosaveStatus>(initialStored ? 'saved' : 'idle');
  const [restored, setRestored] = useState(initialStored);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!hydrated || !enabled) {
      return;
    }

    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    const timeout = window.setTimeout(() => {
      try {
        browserStorage.setItem(storageKey, JSON.stringify(draft));
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [delayMs, draft, enabled, hydrated, storageKey]);

  const clearDraft = () => {
    if (isBrowser()) {
      browserStorage.removeItem(storageKey);
    }
    setRestored(false);
    setStatus('idle');
    const next = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
    setDraft(next);
  };

  return {
    draft,
    setDraft: ((value) => {
      if (enabled && hydrated) {
        setStatus('saving');
      }
      setDraft(value);
    }) as Dispatch<SetStateAction<T>>,
    status,
    restored,
    clearDraft,
  };
}
