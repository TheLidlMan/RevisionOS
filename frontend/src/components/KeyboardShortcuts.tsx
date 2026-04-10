import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  // Navigation
  { keys: ['⌘/Ctrl', 'K'], description: 'Open search', category: 'Navigation' },
  { keys: ['G', 'D'], description: 'Go to Dashboard', category: 'Navigation' },
  { keys: ['G', 'Q'], description: 'Go to Quiz Mode', category: 'Navigation' },
  { keys: ['G', 'A'], description: 'Go to Analytics', category: 'Navigation' },
  { keys: ['G', 'U'], description: 'Go to Upload', category: 'Navigation' },
  { keys: ['G', 'S'], description: 'Go to Settings', category: 'Navigation' },
  { keys: ['G', 'W'], description: 'Go to Weakness Map', category: 'Navigation' },
  { keys: ['G', 'F'], description: 'Go to Free Recall', category: 'Navigation' },
  { keys: ['G', 'E'], description: 'Go to Timed Exam', category: 'Navigation' },
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'Navigation' },
  { keys: ['Esc'], description: 'Close modal / go back', category: 'Navigation' },
  // Flashcard Review
  { keys: ['Space'], description: 'Flip card', category: 'Flashcard Review' },
  { keys: ['1'], description: 'Rate: Again', category: 'Flashcard Review' },
  { keys: ['2'], description: 'Rate: Hard', category: 'Flashcard Review' },
  { keys: ['3'], description: 'Rate: Good', category: 'Flashcard Review' },
  { keys: ['4'], description: 'Rate: Easy', category: 'Flashcard Review' },
  { keys: ['D'], description: 'Go Deeper (elaboration)', category: 'Flashcard Review' },
  // Quiz
  { keys: ['Enter'], description: 'Submit answer / Next question', category: 'Quiz' },
  { keys: ['N'], description: 'Next question', category: 'Quiz' },
  // General
  { keys: ['⌘/Ctrl', 'Enter'], description: 'Submit form', category: 'General' },
];

export default function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const [gPressed, setGPressed] = useState(false);
  const gTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null };

  const handleClose = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

      // ? key opens shortcut cheatsheet
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // Escape closes modal
      if (e.key === 'Escape' && isOpen) {
        handleClose();
        return;
      }

      // Don't handle navigation shortcuts when in input fields
      if (isInput) return;

      // G + letter navigation
      if (e.key === 'g' || e.key === 'G') {
        if (!gPressed) {
          setGPressed(true);
          if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
          gTimeoutRef.current = setTimeout(() => setGPressed(false), 1000);
          return;
        }
      }

      if (gPressed) {
        setGPressed(false);
        if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
        const key = e.key.toLowerCase();
        const routes: Record<string, string> = {
          d: '/',
          q: '/quiz',
          a: '/analytics',
          u: '/upload',
          s: '/settings',
          w: '/weakness-map',
          f: '/free-recall',
          e: '/timed-exam',
        };
        if (routes[key]) {
          e.preventDefault();
          navigate(routes[key]);
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
    };
  }, [isOpen, gPressed, navigate, handleClose]);

  const categories = [...new Set(SHORTCUTS.map((s) => s.category))];

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
            style={{ ...glass, background: 'rgba(26,23,20,0.95)', borderRadius: '16px', maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto' }}
            className="p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5" style={{ color: '#c4956a' }} />
                <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 600 }} className="text-xl">
                  Keyboard Shortcuts
                </h2>
              </div>
              <button onClick={handleClose} style={{ color: 'rgba(245,240,232,0.4)' }} className="hover:opacity-80 transition-opacity">
                <X className="w-5 h-5" />
              </button>
            </div>

            {categories.map((cat) => (
              <div key={cat} className="mb-5">
                <h3 style={{ color: '#c4956a', fontWeight: 400, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em' }} className="mb-2">
                  {cat}
                </h3>
                <div className="space-y-1.5">
                  {SHORTCUTS.filter((s) => s.category === cat).map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid rgba(139,115,85,0.08)' }}>
                      <span style={{ color: 'rgba(245,240,232,0.6)', fontWeight: 300, fontSize: '0.9rem' }}>{s.description}</span>
                      <div className="flex gap-1">
                        {s.keys.map((k, j) => (
                          <span key={j}>
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
                              {k}
                            </kbd>
                            {j < s.keys.length - 1 && <span style={{ color: 'rgba(245,240,232,0.25)', margin: '0 2px', fontSize: '0.75rem' }}>+</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <p style={{ color: 'rgba(245,240,232,0.25)', fontWeight: 300, fontSize: '0.75rem', textAlign: 'center' }} className="mt-4">
              Press <kbd style={{ background: 'rgba(255,248,240,0.08)', border: '1px solid rgba(139,115,85,0.25)', borderRadius: '3px', padding: '1px 4px', fontFamily: 'monospace', fontSize: '0.7rem' }}>?</kbd> to toggle this cheatsheet
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
