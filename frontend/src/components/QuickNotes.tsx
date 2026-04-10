import { useState, useEffect } from 'react';
import { X, StickyNote } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface Props { open: boolean; onClose: () => void; }

const glass = { background: 'rgba(255,248,240,0.06)', border: '1px solid rgba(139,115,85,0.2)', borderRadius: '16px', backdropFilter: 'blur(24px)' } as const;

export default function QuickNotes({ open, onClose }: Props) {
  const [text, setText] = useState(() => localStorage.getItem('revisionos_notes') || '');

  useEffect(() => { localStorage.setItem('revisionos_notes', text); }, [text]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ x: 320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 320, opacity: 0 }} transition={{ type: 'spring', damping: 25 }}
          style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 320, zIndex: 45, padding: '1.5rem', ...glass, borderRadius: '16px 0 0 16px', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.3)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <StickyNote className="w-5 h-5" style={{ color: '#c4956a' }} />
              <span style={{ fontFamily: "Georgia, serif", color: '#f5f0e8', fontWeight: 600 }}>Quick Notes</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.4)', cursor: 'pointer' }}><X className="w-4 h-4" /></button>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Jot down thoughts, formulas, reminders…" style={{ flex: 1, background: 'rgba(255,248,240,0.04)', border: '1px solid rgba(139,115,85,0.15)', borderRadius: '8px', color: '#f5f0e8', outline: 'none', fontWeight: 300, fontSize: '0.875rem', padding: '0.75rem', resize: 'none', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }} />
          <div className="flex items-center justify-between mt-2" style={{ fontSize: '0.7rem', color: 'rgba(245,240,232,0.25)' }}>
            <span>{text.length} characters</span>
            <button onClick={() => setText('')} style={{ background: 'none', border: 'none', color: 'rgba(220,120,100,0.6)', cursor: 'pointer', fontSize: '0.7rem' }}>Clear</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
