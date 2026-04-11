import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { usePersistentState } from './usePersistentState';

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAutosaveDraft<T>(
  storageKey: string,
  initialValue: T | (() => T),
  enabled = true,
  delayMs = 500,
) {
  const [draft, setDraft, hydrated] = usePersistentState<T>(storageKey, initialValue);
  const [initialStored] = useState(() => {
    if (typeof window === 'undefined' || !enabled) {
      return false;
    }
    return window.localStorage.getItem(storageKey) !== null;
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
        window.localStorage.setItem(storageKey, JSON.stringify(draft));
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [delayMs, draft, enabled, hydrated, storageKey]);

  const clearDraft = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
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
