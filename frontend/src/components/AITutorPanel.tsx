import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { SpinnerGap, X, Brain, Lightning, BookOpen, Question, ClockCounterClockwise } from '@phosphor-icons/react';
import { tutorExplain } from '../api/client';
import type { TutorExplainResponse } from '../types';
import { usePersistentState } from '../hooks/usePersistentState';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

interface AITutorPanelProps {
  concept: string;
  context?: string;
  cardId?: string;
  cardFront?: string;
  onClose: () => void;
}

interface TutorHistoryEntry {
  id: string;
  mode: 'eli5' | 'deep' | 'example' | 'why_wrong';
  createdAt: string;
  result: TutorExplainResponse;
}

const MODES = [
  { key: 'eli5' as const, label: 'ELI5', icon: Lightning, desc: 'Simple explanation' },
  { key: 'deep' as const, label: 'Deep Dive', icon: Brain, desc: 'Detailed analysis' },
  { key: 'example' as const, label: 'Examples', icon: BookOpen, desc: 'Worked examples' },
  { key: 'why_wrong' as const, label: 'Why Wrong?', icon: Question, desc: 'Explain errors' },
];

export default function AITutorPanel({ concept, context, cardId, cardFront, onClose }: AITutorPanelProps) {
  const [historyMap, setHistoryMap] = usePersistentState<Record<string, TutorHistoryEntry[]>>('ai-tutor:history', {});
  const sessionKey = useMemo(() => {
    const seed = cardId || cardFront || concept || 'general';
    return seed.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 140);
  }, [cardFront, cardId, concept]);
  const history = useMemo(() => historyMap[sessionKey] || [], [historyMap, sessionKey]);
  const initialHistoryEntry = history[0] || null;
  const [selectedMode, setSelectedMode] = useState<'eli5' | 'deep' | 'example' | 'why_wrong'>(
    initialHistoryEntry?.mode ?? 'eli5',
  );
  const [result, setResult] = useState<TutorExplainResponse | null>(initialHistoryEntry?.result ?? null);

  const explainMutation = useMutation({
    mutationFn: (mode: typeof selectedMode) =>
      tutorExplain(
        concept || cardFront || 'this concept',
        context || '',
        mode,
        cardId,
      ),
    onSuccess: (data, mode) => {
      setResult(data);
      setHistoryMap((current) => ({
        ...current,
        [sessionKey]: [
          {
            id: `${mode}-${Date.now()}`,
            mode,
            createdAt: new Date().toISOString(),
            result: data,
          },
          ...(current[sessionKey] || []),
        ].slice(0, 8),
      }));
    },
  });

  const handleExplain = (mode: typeof selectedMode) => {
    setSelectedMode(mode);
    explainMutation.mutate(mode);
  };

  const restoreHistoryEntry = (entry: TutorHistoryEntry) => {
    setSelectedMode(entry.mode);
    setResult(entry.result);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed right-4 top-20 bottom-4 w-[420px] max-w-[calc(100vw-2rem)] z-50 overflow-hidden flex flex-col"
        style={{ ...glass, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Brain size={20} style={{ color: 'var(--accent)' }} />
            <div>
              <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: '0.95rem' }}>AI Tutor</span>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>Multi-modal explanations with session history</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors hover:bg-[rgba(139,115,85,0.1)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {concept && (
          <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Concept
            </p>
            <p style={{ color: 'var(--text)', fontWeight: 400, fontSize: '0.9rem' }}>
              {concept}
            </p>
          </div>
        )}

        <div className="px-4 py-3 flex flex-wrap gap-2" style={{ borderBottom: history.length > 0 ? '1px solid var(--border)' : undefined }}>
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const isActive = selectedMode === mode.key;
            return (
              <button
                key={mode.key}
                onClick={() => handleExplain(mode.key)}
                disabled={explainMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all disabled:opacity-50"
                style={{
                  background: isActive ? 'rgba(196,149,106,0.2)' : 'rgba(139,115,85,0.08)',
                  border: isActive ? '1px solid rgba(196,149,106,0.4)' : '1px solid transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 500 : 400,
                }}
                title={mode.desc}
              >
                <Icon size={14} />
                {mode.label}
              </button>
            );
          })}
        </div>

        {history.length > 0 && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <ClockCounterClockwise size={15} style={{ color: 'var(--text-secondary)' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Conversation History
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => restoreHistoryEntry(entry)}
                  className="px-2.5 py-1.5 rounded-lg text-left"
                  style={{
                    background: result === entry.result ? 'rgba(196,149,106,0.16)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <p style={{ color: 'var(--text)', fontSize: '0.78rem', fontWeight: 500 }}>
                    {MODES.find((mode) => mode.key === entry.mode)?.label}
                  </p>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', marginTop: 2 }}>
                    {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {explainMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <SpinnerGap className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Thinking…</p>
            </div>
          )}

          {explainMutation.isError && (
            <div className="py-4">
              <p style={{ color: 'rgba(220,120,100,0.9)', fontSize: '0.85rem' }}>
                Failed to get explanation. Please try again.
              </p>
            </div>
          )}

          {result && !explainMutation.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 pt-4"
            >
              <div>
                <p style={{ color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {result.explanation}
                </p>
              </div>

              {result.key_takeaways.length > 0 && (
                <div
                  className="p-3 rounded-lg"
                  style={{ background: 'rgba(196,149,106,0.08)', border: '1px solid rgba(196,149,106,0.15)' }}
                >
                  <p style={{ color: 'var(--accent)', fontWeight: 500, fontSize: '0.8rem', marginBottom: 6 }}>
                    💡 Key Takeaways
                  </p>
                  <ul className="space-y-1">
                    {result.key_takeaways.map((point, index) => (
                      <li key={`${point}-${index}`} style={{ color: 'var(--text)', fontSize: '0.85rem', paddingLeft: 8 }}>
                        • {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.memory_hook && (
                <div
                  className="p-3 rounded-lg"
                  style={{ background: 'rgba(120,180,120,0.08)', border: '1px solid rgba(120,180,120,0.15)' }}
                >
                  <p style={{ color: '#78b478', fontWeight: 500, fontSize: '0.8rem', marginBottom: 4 }}>
                    🧠 Memory Hook
                  </p>
                  <p style={{ color: 'var(--text)', fontSize: '0.85rem' }}>
                    {result.memory_hook}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {!result && !explainMutation.isPending && !explainMutation.isError && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Brain size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 4 }}>
                Choose a mode above to get started
              </p>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                Every explanation is saved locally so you can revisit earlier tutor turns.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
