import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X, PencilSimple, ArrowCounterClockwise } from '@phosphor-icons/react';
import { usePersistentState } from '../hooks/usePersistentState';

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

interface ShortcutCommand {
  id: string;
  description: string;
  category: string;
  defaultKeys: string[];
  route?: string;
}

const COMMANDS: ShortcutCommand[] = [
  { id: 'dashboard', description: 'Go to Dashboard', category: 'Navigation', defaultKeys: ['G', 'D'], route: '/' },
  { id: 'quiz', description: 'Go to Quiz Mode', category: 'Navigation', defaultKeys: ['G', 'Q'], route: '/quiz' },
  { id: 'knowledge', description: 'Go to Knowledge Graph', category: 'Navigation', defaultKeys: ['G', 'K'], route: '/knowledge-graph' },
  { id: 'curriculum', description: 'Go to Study Plan', category: 'Navigation', defaultKeys: ['G', 'P'], route: '/curriculum' },
  { id: 'forgetting', description: 'Go to Forgetting Curve', category: 'Navigation', defaultKeys: ['G', 'F'], route: '/forgetting-curve' },
  { id: 'settings', description: 'Go to Settings', category: 'Navigation', defaultKeys: ['G', 'S'], route: '/settings' },
  { id: 'shortcuts', description: 'Show keyboard shortcuts', category: 'Navigation', defaultKeys: ['?'] },
  { id: 'page-search', description: 'Focus current page search', category: 'Navigation', defaultKeys: ['/'] },
  { id: 'flip', description: 'Flip card', category: 'Flashcard Review', defaultKeys: ['Space'] },
  { id: 'again', description: 'Rate: Again', category: 'Flashcard Review', defaultKeys: ['1'] },
  { id: 'hard', description: 'Rate: Hard', category: 'Flashcard Review', defaultKeys: ['2'] },
  { id: 'good', description: 'Rate: Good', category: 'Flashcard Review', defaultKeys: ['3'] },
  { id: 'easy', description: 'Rate: Easy', category: 'Flashcard Review', defaultKeys: ['4'] },
  { id: 'deeper', description: 'Go Deeper (elaboration)', category: 'Flashcard Review', defaultKeys: ['D'] },
  { id: 'grid-nav', description: 'Move between cards in management grids', category: 'Flashcard Review', defaultKeys: ['←/→'] },
  { id: 'submit', description: 'Submit answer / Next question', category: 'Quiz', defaultKeys: ['Enter'] },
  { id: 'next-question', description: 'Next question', category: 'Quiz', defaultKeys: ['N'] },
  { id: 'form-submit', description: 'Submit form', category: 'General', defaultKeys: ['⌘/Ctrl', 'Enter'] },
];

const DEFAULT_BINDINGS = Object.fromEntries(COMMANDS.map((command) => [command.id, command.defaultKeys]));

function normaliseKey(value: string) {
  const key = value.trim().toLowerCase();
  if (key === ' ') return 'space';
  return key;
}

function parseShortcut(value: string) {
  return value
    .split(/\s*\+\s*|\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function displayShortcut(keys: string[]) {
  return keys.join(' + ');
}

export default function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingCommandId, setEditingCommandId] = useState<string | null>(null);
  const [draftShortcut, setDraftShortcut] = useState('');
  const navigate = useNavigate();
  const [bindings, setBindings] = usePersistentState<Record<string, string[]>>('keyboard-shortcuts:bindings', DEFAULT_BINDINGS);
  const pendingPrefixRef = useRef<string | null>(null);
  const prefixTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setEditingCommandId(null);
    setDraftShortcut('');
  }, []);

  const commands = useMemo(
    () => COMMANDS.map((command) => ({ ...command, keys: bindings[command.id] || command.defaultKeys })),
    [bindings],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
      const key = normaliseKey(event.key);

      const shortcutsCommand = commands.find((command) => command.id === 'shortcuts');
      if (shortcutsCommand && shortcutsCommand.keys.length === 1 && key === normaliseKey(shortcutsCommand.keys[0]) && !isInput) {
        event.preventDefault();
        setIsOpen((current) => !current);
        return;
      }

      if (event.key === 'Escape' && isOpen) {
        handleClose();
        return;
      }

      if (isInput) {
        return;
      }

      const sequenceMatch = commands.find((command) => {
        const shortcut = command.keys.map(normaliseKey);
        return shortcut.length === 2 && pendingPrefixRef.current === shortcut[0] && key === shortcut[1] && command.route;
      });

      if (sequenceMatch?.route) {
        event.preventDefault();
        pendingPrefixRef.current = null;
        if (prefixTimeoutRef.current) {
          clearTimeout(prefixTimeoutRef.current);
        }
        navigate(sequenceMatch.route);
        return;
      }

      const sequenceStart = commands.find((command) => {
        const shortcut = command.keys.map(normaliseKey);
        return shortcut.length === 2 && shortcut[0] === key;
      });

      if (sequenceStart) {
        pendingPrefixRef.current = key;
        if (prefixTimeoutRef.current) {
          clearTimeout(prefixTimeoutRef.current);
        }
        prefixTimeoutRef.current = setTimeout(() => {
          pendingPrefixRef.current = null;
        }, 1000);
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (prefixTimeoutRef.current) {
        clearTimeout(prefixTimeoutRef.current);
      }
    };
  }, [commands, handleClose, isOpen, navigate]);

  const categories = [...new Set(commands.map((command) => command.category))];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            style={{ ...glass, background: 'rgba(26,23,20,0.95)', borderRadius: '16px', maxWidth: 720, width: '92%', maxHeight: '82vh', overflow: 'auto' }}
            className="p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Keyboard size={20} style={{ color: '#c4956a' }} />
                <div>
                  <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 600 }} className="text-xl">
                    Keyboard Shortcuts
                  </h2>
                  <p style={{ color: 'rgba(245,240,232,0.4)', fontSize: '0.78rem', marginTop: 2 }}>
                    Edit route bindings below. Global search stays on ⌘/Ctrl + K.
                  </p>
                </div>
              </div>
              <button onClick={handleClose} style={{ color: 'rgba(245,240,232,0.4)' }} className="hover:opacity-80 transition-opacity">
                <X size={20} />
              </button>
            </div>

            {categories.map((category) => (
              <div key={category} className="mb-5">
                <h3 style={{ color: '#c4956a', fontWeight: 400, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em' }} className="mb-2">
                  {category}
                </h3>
                <div className="space-y-2">
                  {commands.filter((command) => command.category === category).map((command) => {
                    const isEditing = editingCommandId === command.id;
                    return (
                      <div key={command.id} className="py-2 px-3 rounded-xl" style={{ border: '1px solid rgba(139,115,85,0.08)', background: 'rgba(255,248,240,0.02)' }}>
                        <div className="flex items-center justify-between gap-3">
                          <span style={{ color: 'rgba(245,240,232,0.7)', fontWeight: 300, fontSize: '0.9rem' }}>{command.description}</span>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {command.keys.map((keyName, index) => (
                              <span key={`${command.id}-${keyName}`}>
                                <kbd style={{
                                  background: 'rgba(255,248,240,0.08)',
                                  border: '1px solid rgba(139,115,85,0.25)',
                                  borderRadius: '4px',
                                  padding: '2px 6px',
                                  fontSize: '0.75rem',
                                  fontFamily: 'monospace',
                                  color: '#f5f0e8',
                                  fontWeight: 400,
                                }}>
                                  {keyName}
                                </kbd>
                                {index < command.keys.length - 1 && <span style={{ color: 'rgba(245,240,232,0.25)', margin: '0 2px', fontSize: '0.75rem' }}>+</span>}
                              </span>
                            ))}
                            {command.route && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCommandId(command.id);
                                    setDraftShortcut(displayShortcut(command.keys));
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg"
                                  style={{ color: '#c4956a', background: 'rgba(196,149,106,0.1)' }}
                                >
                                  <PencilSimple size={14} /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setBindings((current) => ({ ...current, [command.id]: command.defaultKeys }))}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg"
                                  style={{ color: 'rgba(245,240,232,0.5)', background: 'rgba(255,255,255,0.04)' }}
                                >
                                  <ArrowCounterClockwise size={14} /> Reset
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {isEditing && (
                          <div className="mt-3 flex flex-col sm:flex-row gap-2">
                            <input
                              value={draftShortcut}
                              onChange={(event) => setDraftShortcut(event.target.value)}
                              placeholder="Example: g + d"
                              className="flex-1 px-3 py-2 rounded-lg"
                              style={{ background: 'rgba(255,248,240,0.05)', border: '1px solid rgba(139,115,85,0.2)', color: '#f5f0e8' }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const parsed = parseShortcut(draftShortcut);
                                if (parsed.length === 0) {
                                  return;
                                }
                                setBindings((current) => ({ ...current, [command.id]: parsed }));
                                setEditingCommandId(null);
                                setDraftShortcut('');
                              }}
                              className="px-3 py-2 rounded-lg"
                              style={{ background: 'rgba(196,149,106,0.16)', color: '#c4956a' }}
                            >
                              Save binding
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <p style={{ color: 'rgba(245,240,232,0.25)', fontWeight: 300, fontSize: '0.75rem', textAlign: 'center' }} className="mt-4">
              Press <kbd style={{ background: 'rgba(255,248,240,0.08)', border: '1px solid rgba(139,115,85,0.25)', borderRadius: '3px', padding: '1px 4px', fontFamily: 'monospace', fontSize: '0.7rem' }}>?</kbd> to toggle this cheatsheet.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
