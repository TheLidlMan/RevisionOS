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

function resultIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'document': return <FileText className="w-4 h-4 text-blue-400" />;
    case 'flashcard': return <Layers className="w-4 h-4 text-purple-400" />;
    case 'question': return <HelpCircle className="w-4 h-4 text-yellow-400" />;
    case 'concept': return <BookOpen className="w-4 h-4 text-teal" />;
    default: return <Search className="w-4 h-4 text-gray-400" />;
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

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setDebouncedQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection when results change
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
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="w-full max-w-xl bg-navy-light border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 border-b border-gray-800">
              <Search className="w-5 h-5 text-gray-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search concepts, flashcards, questions…"
                className="flex-1 bg-transparent py-4 text-white placeholder:text-gray-500 focus:outline-none"
              />
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="bg-navy-lighter border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none"
              >
                <option value="">All modules</option>
                {modules?.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results */}
            {debouncedQuery.length >= 2 && (
              <div className="max-h-80 overflow-y-auto">
                {results.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500 text-sm">
                    No results found.
                  </div>
                ) : (
                  <ul>
                    {results.map((result, idx) => (
                      <li key={`${result.type}-${result.id}`}>
                        <button
                          onClick={() => handleSelect(result)}
                          className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                            idx === selectedIdx
                              ? 'bg-teal/10 text-white'
                              : 'text-gray-300 hover:bg-navy-lighter'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">{resultIcon(result.type)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.title}</p>
                            <p className="text-xs text-gray-500 truncate">{result.snippet}</p>
                            {result.module_name && (
                              <p className="text-xs text-gray-600 mt-0.5">{result.module_name}</p>
                            )}
                          </div>
                          <span className="text-xs text-gray-600 shrink-0 uppercase">{result.type}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Hint */}
            <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-600 flex items-center gap-4">
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
