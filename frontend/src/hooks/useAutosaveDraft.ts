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
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [restored, setRestored] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!hydrated || !enabled) {
      return;
    }

    if (!mountedRef.current) {
      mountedRef.current = true;
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
      if (stored) {
        setRestored(true);
        setStatus('saved');
      }
      return;
    }

    setStatus('saving');
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
    setDraft: setDraft as Dispatch<SetStateAction<T>>,
    status,
    restored,
    clearDraft,
  };
}
