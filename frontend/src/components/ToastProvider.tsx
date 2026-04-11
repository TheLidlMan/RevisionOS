import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle, WarningCircle, X } from '@phosphor-icons/react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
  action?: ToastAction;
}

interface Toast extends ToastInput {
  id: string;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

function toneColor(tone: ToastTone) {
  if (tone === 'success') {
    return 'var(--success)';
  }
  if (tone === 'error') {
    return 'var(--danger)';
  }
  return 'var(--accent)';
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      window.clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ durationMs = 5000, tone = 'info', ...toast }: ToastInput) => {
      const id = crypto.randomUUID();
      const nextToast: Toast = { id, tone, durationMs, ...toast };
      setToasts((current) => [...current, nextToast]);
      const timeout = window.setTimeout(() => dismiss(id), durationMs);
      timeoutsRef.current.set(id, timeout);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 bottom-4 z-[100] flex flex-col gap-3 w-[min(420px,calc(100vw-2rem))]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="p-4 shadow-lg"
            style={{ ...glass, borderColor: `${toneColor(toast.tone || 'info')}55` }}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              {(toast.tone || 'info') === 'error' ? (
                <WarningCircle size={20} weight="fill" style={{ color: toneColor(toast.tone || 'info'), flexShrink: 0, marginTop: 2 }} />
              ) : (
                <CheckCircle size={20} weight="fill" style={{ color: toneColor(toast.tone || 'info'), flexShrink: 0, marginTop: 2 }} />
              )}
              <div className="flex-1 min-w-0">
                <p style={{ color: 'var(--text)', fontSize: '0.92rem' }}>{toast.title}</p>
                {toast.description ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: 4 }}>{toast.description}</p>
                ) : null}
                {toast.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      dismiss(toast.id);
                    }}
                    className="mt-3"
                    style={{ color: 'var(--accent)', fontSize: '0.85rem' }}
                  >
                    {toast.action.label}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                aria-label="Dismiss notification"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
