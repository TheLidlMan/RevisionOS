import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChartLineDown,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  X,
} from '@phosphor-icons/react';
import { deleteFlashcard, getFlashcards, getModule, updateFlashcard } from '../api/client';
import ShowMoreText from '../components/ShowMoreText';
import Skeleton from '../components/Skeleton';
import { useToast } from '../components/ToastProvider';
import { useAutosaveDraft } from '../hooks/useAutosaveDraft';
import { usePersistentState } from '../hooks/usePersistentState';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import type { Flashcard } from '../types';
import { formatAutosaveStatus, formatDateTime, formatDays, formatRelativeTime, titleCase } from '../utils/formatters';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

type SortOption = 'UPDATED' | 'NEWEST' | 'OLDEST' | 'A_Z';

export default function ModuleFlashcards() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const deleteTimeoutsRef = useRef<Map<string, number>>(new Map());
  const { showToast } = useToast();
  useScrollRestoration(`module-flashcards:${id}`);

  const [search, setSearch] = usePersistentState(`module-flashcards:${id}:search`, '');
  const [sourceFilter, setSourceFilter] = usePersistentState<'ALL' | 'AUTO' | 'MANUAL'>(`module-flashcards:${id}:source`, 'ALL');
  const [stateFilter, setStateFilter] = usePersistentState<'ALL' | 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING'>(`module-flashcards:${id}:state`, 'ALL');
  const [sortBy, setSortBy] = usePersistentState<SortOption>(`module-flashcards:${id}:sort`, 'UPDATED');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Flashcard | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  const {
    draft: editDraft,
    setDraft: setEditDraft,
    status: editDraftStatus,
    restored: editDraftRestored,
    clearDraft: clearEditDraft,
  } = useAutosaveDraft(
    `module-flashcards:${id}:edit-draft`,
    () => ({ cardId: '', front: '', back: '' }),
    Boolean(editing),
  );

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
      queryClient.invalidateQueries({ queryKey: ['module', id] });
      clearEditDraft();
      setEditing(null);
      showToast({ title: 'Flashcard updated', tone: 'success' });
    },
    onError: () => {
      showToast({ title: 'Could not save flashcard', description: 'Your draft is still here.', tone: 'error' });
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
    const visible = (cardsQuery.data || []).filter((card) => {
      if (pendingDeleteIds.includes(card.id)) {
        return false;
      }
      if (!term) {
        return true;
      }
      return card.front.toLowerCase().includes(term) || card.back.toLowerCase().includes(term);
    });

    if (sortBy === 'A_Z') {
      return visible.sort((a, b) => a.front.localeCompare(b.front));
    }
    if (sortBy === 'NEWEST') {
      return visible.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    if (sortBy === 'OLDEST') {
      return visible.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return visible.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [cardsQuery.data, pendingDeleteIds, search, sortBy]);

  useEffect(() => {
    if (!filteredCards.length) {
      setSelectedCardId(null);
      return;
    }
    if (!selectedCardId || !filteredCards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(filteredCards[0].id);
    }
  }, [filteredCards, selectedCardId]);

  useEffect(() => {
    if (!editing) {
      return;
    }
    if (editDraft.cardId !== editing.id) {
      setEditDraft({ cardId: editing.id, front: editing.front, back: editing.back });
    }
  }, [editDraft.cardId, editing, setEditDraft]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

      if (event.key === '/' && !isInput) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (event.key === 'Escape' && editing) {
        setEditing(null);
        clearEditDraft();
        return;
      }

      if (isInput || filteredCards.length === 0) {
        return;
      }

      const currentIndex = filteredCards.findIndex((card) => card.id === selectedCardId);
      if (['ArrowRight', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % filteredCards.length : 0;
        setSelectedCardId(filteredCards[nextIndex].id);
      }
      if (['ArrowLeft', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        const nextIndex = currentIndex > 0 ? currentIndex - 1 : filteredCards.length - 1;
        setSelectedCardId(filteredCards[nextIndex].id);
      }
      if (event.key === 'Enter' && selectedCardId) {
        event.preventDefault();
        const selected = filteredCards.find((card) => card.id === selectedCardId);
        if (selected) {
          setEditing(selected);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [clearEditDraft, editing, filteredCards, selectedCardId]);

  const queueDelete = (card: Flashcard) => {
    setPendingDeleteIds((current) => [...current, card.id]);
    const timeout = window.setTimeout(() => {
      deleteMutation.mutate(card.id);
      deleteTimeoutsRef.current.delete(card.id);
      setPendingDeleteIds((current) => current.filter((idValue) => idValue !== card.id));
    }, 5000);
    deleteTimeoutsRef.current.set(card.id, timeout);
    showToast({
      title: `Deleted "${card.front.slice(0, 36)}${card.front.length > 36 ? '…' : ''}"`,
      description: 'Undo within 5 seconds if you still need it.',
      tone: 'info',
      durationMs: 5200,
      action: {
        label: 'Undo',
        onClick: () => {
          const pending = deleteTimeoutsRef.current.get(card.id);
          if (pending) {
            window.clearTimeout(pending);
            deleteTimeoutsRef.current.delete(card.id);
            setPendingDeleteIds((current) => current.filter((idValue) => idValue !== card.id));
          }
        },
      },
    });
  };

  const editCanSave = editDraft.front.trim().length > 0 && editDraft.back.trim().length > 0 && !updateMutation.isPending;

  if (moduleQuery.isLoading || cardsQuery.isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full">
        <Skeleton className="h-5 w-40 mb-6" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <Skeleton className="h-8 w-72 mb-3" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <Skeleton className="h-12 md:col-span-2" />
          <Skeleton className="h-12" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="p-5" style={glass}>
              <Skeleton className="h-4 w-28 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-5/6 mb-5" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
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
        <div className="flex flex-wrap items-center gap-3" style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
          <span>{filteredCards.length} visible</span>
          <span>{cardsQuery.data?.length || 0} total</span>
          <span>Use `/` to search and arrow keys to move</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1.5fr_220px_190px] gap-3 mb-6">
        <div className="relative">
          <MagnifyingGlass size={18} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-secondary)' }} />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search front or back"
            className="w-full pl-10 pr-3 py-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
            aria-label="Search flashcards"
          />
        </div>
        <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)} className="px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
          <option value="ALL">All sources</option>
          <option value="AUTO">Auto</option>
          <option value="MANUAL">Manual</option>
        </select>
        <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)} className="px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
          <option value="UPDATED">Recently updated</option>
          <option value="NEWEST">Newest</option>
          <option value="OLDEST">Oldest</option>
          <option value="A_Z">A-Z</option>
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
          {filteredCards.map((card) => {
            const isSelected = selectedCardId === card.id;
            return (
              <div
                key={card.id}
                className="p-5 h-full min-h-[280px] flex flex-col"
                style={{
                  ...glass,
                  borderColor: isSelected ? 'rgba(196,149,106,0.45)' : 'var(--border)',
                  boxShadow: isSelected ? '0 0 0 2px rgba(196,149,106,0.18)' : 'none',
                }}
                onClick={() => setSelectedCardId(card.id)}
              >
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
                      onClick={() => setEditing(card)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', minWidth: 36, minHeight: 36 }}
                      aria-label="Edit card"
                    >
                      <PencilSimple size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => queueDelete(card)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', minWidth: 36, minHeight: 36 }}
                      aria-label="Delete card"
                    >
                      <Trash size={18} />
                    </button>
                  </div>
                </div>
                <p style={{ color: 'var(--text)', fontSize: '0.98rem', marginBottom: 10 }}>{card.front}</p>
                <div className="flex-1">
                  <ShowMoreText text={card.back} collapsedLines={4} color="var(--text-secondary)" fontSize="0.92rem" />
                </div>
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                    <span>Stability: {formatDays(card.stability)}</span>
                    <button type="button" className="inline-flex items-center gap-1" style={{ color: 'var(--accent)' }} onClick={() => navigate(`/forgetting-curve/${card.id}`)}>
                      <ChartLineDown size={16} />
                      Curve
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <span title={formatDateTime(card.updated_at)}>Updated {formatRelativeTime(card.updated_at)}</span>
                    <span>{card.reps} reviews</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-10 text-center" style={glass}>
          <p style={{ color: 'var(--text)', marginBottom: 8 }}>No flashcards match this view.</p>
          <p style={{ color: 'var(--text-secondary)' }}>
            {cardsQuery.data?.length
              ? 'Try clearing one of the filters or search terms.'
              : 'Upload more material and let the backend finish processing this module.'}
          </p>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,15,15,0.8)' }}>
          <div className="w-full max-w-2xl p-6" style={glass}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.2rem' }}>Edit Flashcard</h2>
                <p style={{ color: editDraftStatus === 'error' ? 'var(--danger)' : 'var(--text-tertiary)', fontSize: '0.78rem', marginTop: 4 }}>
                  {formatAutosaveStatus(editDraftStatus, editDraftRestored)}
                </p>
              </div>
              <button type="button" onClick={() => {
                setEditing(null);
                clearEditDraft();
              }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>Front</label>
                <textarea
                  value={editDraft.front}
                  onChange={(event) => setEditDraft((current) => ({ ...current, front: event.target.value }))}
                  rows={4}
                  className="w-full px-3 py-3"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', resize: 'vertical' }}
                />
              </div>
              <div>
                <label className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>Back</label>
                <textarea
                  value={editDraft.back}
                  onChange={(event) => setEditDraft((current) => ({ ...current, back: event.target.value }))}
                  rows={4}
                  className="w-full px-3 py-3"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', resize: 'vertical' }}
                />
              </div>
            </div>
            {!editCanSave ? (
              <p style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 10 }}>Both sides need content before you can save.</p>
            ) : null}
            <div className="flex justify-end gap-3 mt-5">
              <button type="button" onClick={() => {
                setEditing(null);
                clearEditDraft();
              }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                type="button"
                className="scholar-btn"
                disabled={!editCanSave}
                onClick={() => updateMutation.mutate({ cardId: editing.id, front: editDraft.front.trim(), back: editDraft.back.trim() })}
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
