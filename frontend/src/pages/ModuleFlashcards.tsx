import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChartLineDown,
  MagnifyingGlass,
  PencilSimple,
  SpinnerGap,
  Trash,
  X,
} from '@phosphor-icons/react';
import { deleteFlashcard, getFlashcards, getModule, updateFlashcard } from '../api/client';
import type { Flashcard } from '../types';
import { formatDays, titleCase } from '../utils/formatters';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

export default function ModuleFlashcards() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'AUTO' | 'MANUAL'>('ALL');
  const [stateFilter, setStateFilter] = useState<'ALL' | 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING'>('ALL');
  const [editing, setEditing] = useState<Flashcard | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');

  const moduleQuery = useQuery({
    queryKey: ['module', id],
    queryFn: () => getModule(id!),
    enabled: !!id,
  });

  const cardsQuery = useQuery({
    queryKey: ['flashcards', id, sourceFilter, stateFilter],
    queryFn: () =>
      getFlashcards({
        module_id: id!,
        generation_source: sourceFilter === 'ALL' ? undefined : sourceFilter,
        state: stateFilter === 'ALL' ? undefined : stateFilter,
      }),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ cardId, front, back }: { cardId: string; front: string; back: string }) =>
      updateFlashcard(cardId, { front, back }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards', id] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFlashcard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards', id] });
      queryClient.invalidateQueries({ queryKey: ['module', id] });
      queryClient.invalidateQueries({ queryKey: ['modules'] });
    },
  });

  const filteredCards = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (cardsQuery.data || []).filter((card) => {
      if (!term) {
        return true;
      }
      return card.front.toLowerCase().includes(term) || card.back.toLowerCase().includes(term);
    });
  }, [cardsQuery.data, search]);

  if (moduleQuery.isLoading || cardsQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <SpinnerGap size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <button type="button" onClick={() => navigate(`/modules/${id}`)} className="inline-flex items-center gap-2 mb-6" style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft size={18} />
        Back to Module
      </button>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.8rem' }}>
            {moduleQuery.data?.name || 'Module'} Flashcards
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Edit, delete, and inspect cards without leaving the module flow.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="md:col-span-2 relative">
          <MagnifyingGlass size={18} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-secondary)' }} />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search front or back"
            className="w-full pl-10 pr-3 py-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
          />
        </div>
        <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)} className="px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
          <option value="ALL">All sources</option>
          <option value="AUTO">Auto</option>
          <option value="MANUAL">Manual</option>
        </select>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(['ALL', 'NEW', 'LEARNING', 'REVIEW', 'RELEARNING'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStateFilter(value)}
            className="px-3 py-2 rounded-xl"
            style={{
              background: stateFilter === value ? 'var(--accent-soft)' : 'var(--surface)',
              color: stateFilter === value ? 'var(--accent)' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {titleCase(value)}
          </button>
        ))}
      </div>

      {filteredCards.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCards.map((card) => (
            <div key={card.id} className="p-5" style={glass}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    {card.generation_source}
                  </span>
                  <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                    {card.state}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(card);
                      setEditFront(card.front);
                      setEditBack(card.back);
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    aria-label="Edit card"
                  >
                    <PencilSimple size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Delete this flashcard?')) {
                        deleteMutation.mutate(card.id);
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                    aria-label="Delete card"
                  >
                    <Trash size={18} />
                  </button>
                </div>
              </div>
              <p style={{ color: 'var(--text)', fontSize: '0.98rem', marginBottom: 14 }}>{card.front}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: 14 }}>{card.back}</p>
              <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span>Stability: {formatDays(card.stability)}</span>
                <button type="button" className="inline-flex items-center gap-1" style={{ color: 'var(--accent)' }} onClick={() => navigate(`/forgetting-curve/${card.id}`)}>
                  <ChartLineDown size={16} />
                  Curve
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-10 text-center" style={glass}>
          <p style={{ color: 'var(--text-secondary)' }}>No flashcards match this view yet.</p>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,15,15,0.8)' }}>
          <div className="w-full max-w-2xl p-6" style={glass}>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.2rem' }}>Edit Flashcard</h2>
              <button type="button" onClick={() => setEditing(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <textarea value={editFront} onChange={(event) => setEditFront(event.target.value)} rows={4} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', resize: 'vertical' }} />
              <textarea value={editBack} onChange={(event) => setEditBack(event.target.value)} rows={4} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', resize: 'vertical' }} />
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button type="button" onClick={() => setEditing(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                type="button"
                className="scholar-btn"
                onClick={() => updateMutation.mutate({ cardId: editing.id, front: editFront, back: editBack })}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
