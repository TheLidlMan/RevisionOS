import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FileText,
  Layers,
  HelpCircle,
  BookOpen,
  X,
} from 'lucide-react';
import { searchAll, getModules } from '../api/client';
import type { SearchResult } from '../types';

const sg = {
  glass: {
    background: 'rgba(255,248,240,0.04)',
    border: '1px solid rgba(139,115,85,0.15)',
    borderRadius: '12px',
    backdropFilter: 'blur(20px)',
  } as React.CSSProperties,
  input: {
    background: 'rgba(255,248,240,0.04)',
    border: '1px solid rgba(139,115,85,0.15)',
    borderRadius: '8px',
    color: '#f5f0e8',
    outline: 'none',
  } as React.CSSProperties,
  text: '#f5f0e8',
  secondary: 'rgba(245,240,232,0.5)',
  tertiary: 'rgba(245,240,232,0.25)',
  accent: '#c4956a',
  accentSoft: 'rgba(196,149,106,0.15)',
  hover: 'rgba(255,248,240,0.08)',
  warmBorder: 'rgba(139,115,85,0.15)',
  serif: "Georgia, 'Times New Roman', serif",
  overlay: 'rgba(26,23,20,0.8)',
};

function resultIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'document': return <FileText className="w-4 h-4" style={{ color: sg.accent }} />;
    case 'flashcard': return <Layers className="w-4 h-4" style={{ color: sg.accent }} />;
    case 'question': return <HelpCircle className="w-4 h-4" style={{ color: sg.accent }} />;
    case 'concept': return <BookOpen className="w-4 h-4" style={{ color: sg.accent }} />;
    default: return <Search className="w-4 h-4" style={{ color: sg.secondary }} />;
  }
}

function resultRoute(result: SearchResult): string {
  switch (result.type.toLowerCase()) {
    case 'document':
    case 'flashcard':
    case 'concept':
      return result.module_id ? `/modules/${result.module_id}` : '/';
    case 'question':
      return result.module_id ? `/quiz?module=${result.module_id}` : '/quiz';
    default:
      return '/';
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SearchModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const { data: modules } = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
    enabled: open,
  });

  const { data: searchData } = useQuery({
    queryKey: ['search', debouncedQuery, moduleFilter],
    queryFn: () => searchAll(debouncedQuery, moduleFilter || undefined, 20),
    enabled: open && debouncedQuery.length >= 2,
  });

  const results = searchData?.results ?? [];

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setDebouncedQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [results.length]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onClose();
      navigate(resultRoute(result));
    },
    [navigate, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIdx]) {
        handleSelect(results[selectedIdx]);
      }
    },
    [results, selectedIdx, onClose, handleSelect],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
          style={{ background: sg.overlay }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="w-full max-w-xl shadow-2xl overflow-hidden"
            style={sg.glass}
            onKeyDown={handleKeyDown}
          >
            <div
              className="flex items-center gap-3 px-4"
              style={{ borderBottom: `1px solid ${sg.warmBorder}` }}
            >
              <Search className="w-5 h-5 shrink-0" style={{ color: sg.accent }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search concepts, flashcards, questions…"
                className="flex-1 py-4"
                style={{
                  background: 'transparent',
                  color: sg.text,
                  outline: 'none',
                  border: 'none',
                  fontFamily: sg.serif,
                  fontWeight: 300,
                }}
              />
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="px-2 py-1 text-xs"
                style={sg.input}
              >
                <option value="">All modules</option>
                {modules?.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <button
                onClick={onClose}
                className="transition-colors"
                style={{ color: sg.secondary }}
                onMouseEnter={(e) => { e.currentTarget.style.color = sg.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = sg.secondary; }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {debouncedQuery.length >= 2 && (
              <div className="max-h-80 overflow-y-auto">
                {results.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm" style={{ color: sg.secondary }}>
                    No results found.
                  </div>
                ) : (
                  <ul>
                    {results.map((result, idx) => (
                      <li key={`${result.type}-${result.id}`}>
                        <button
                          onClick={() => handleSelect(result)}
                          className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors"
                          style={{
                            background: idx === selectedIdx ? sg.accentSoft : 'transparent',
                            color: sg.text,
                          }}
                          onMouseEnter={(e) => {
                            if (idx !== selectedIdx) e.currentTarget.style.background = sg.hover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = idx === selectedIdx ? sg.accentSoft : 'transparent';
                          }}
                        >
                          <div className="mt-0.5 shrink-0">{resultIcon(result.type)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate" style={{ color: sg.text, fontWeight: 500 }}>{result.title}</p>
                            <p className="text-xs truncate" style={{ color: sg.secondary }}>{result.snippet}</p>
                            {result.module_name && (
                              <p className="text-xs mt-0.5" style={{ color: sg.tertiary }}>{result.module_name}</p>
                            )}
                          </div>
                          <span className="text-xs shrink-0 uppercase" style={{ color: sg.tertiary }}>{result.type}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div
              className="px-4 py-2 text-xs flex items-center gap-4"
              style={{ borderTop: `1px solid ${sg.warmBorder}`, color: sg.tertiary }}
            >
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
              <span>Esc Close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
