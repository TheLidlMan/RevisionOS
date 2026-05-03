import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookmarkSimple,
  ChartLineDown,
  DownloadSimple,
  Funnel,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  UploadSimple,
  X,
} from '@phosphor-icons/react';
import { deleteFlashcard, deleteFlashcardImage, exportCardsCsv, exportCardsJson, getFlashcardTags, getFlashcards, getModule, setFlashcardBookmark, updateFlashcard, uploadFlashcardImage } from '../api/client';
import Skeleton from '../components/Skeleton';
import { useToast } from '../hooks/useToast';
import { useAutosaveDraft } from '../hooks/useAutosaveDraft';
import { usePersistentState } from '../hooks/usePersistentState';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import type { Flashcard } from '../types';
import { formatAutosaveStatus, formatDateTime, formatDays, formatRelativeTime, titleCase } from '../utils/formatters';
import RichTextEditor from '../components/RichTextEditor';
import RichTextPreview from '../components/RichTextPreview';
import TagEditor from '../components/TagEditor';
import CardImageUploader from '../components/CardImageUploader';
import ImportCardsModal from '../components/ImportCardsModal';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

const PAGE_SIZES = [10, 20, 50, 100] as const;

type SortOption = 'updated_desc' | 'created_desc' | 'created_asc' | 'front_asc';
type PageSize = (typeof PAGE_SIZES)[number];

export default function ModuleFlashcards() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const deleteTimeoutsRef = useRef<Map<string, number>>(new Map());
  const filteredCardsRef = useRef<Flashcard[]>([]);
  const activeSelectedCardIdRef = useRef<string | null>(null);
  const editingRef = useRef<Flashcard | null>(null);
  const { showToast } = useToast();
  useScrollRestoration(`module-flashcards:${id}`);

  const [search, setSearch] = usePersistentState(`module-flashcards:${id}:search`, '');
  const [sourceFilter, setSourceFilter] = usePersistentState<'ALL' | 'AUTO' | 'MANUAL'>(`module-flashcards:${id}:source`, 'ALL');
  const [stateFilter, setStateFilter] = usePersistentState<'ALL' | 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING'>(`module-flashcards:${id}:state`, 'ALL');
  const [sortBy, setSortBy] = usePersistentState<SortOption>(`module-flashcards:${id}:sort`, 'updated_desc');
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Flashcard | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = usePersistentState<string>(`module-flashcards:${id}:tag`, '');
  const [difficultyFilter, setDifficultyFilter] = usePersistentState<'ALL' | 'EASY' | 'MEDIUM' | 'HARD'>(`module-flashcards:${id}:difficulty`, 'ALL');
  const [bookmarkedOnly, setBookmarkedOnly] = usePersistentState<boolean>(`module-flashcards:${id}:bookmarked`, false);
  const [importOpen, setImportOpen] = useState(false);

  const {
    draft: editDraft,
    setDraft: setEditDraft,
    status: editDraftStatus,
    restored: editDraftRestored,
    clearDraft: clearEditDraft,
  } = useAutosaveDraft(
    `module-flashcards:${id}:edit-draft`,
    () => ({ cardId: '', front: '', back: '', tags: [] as string[], study_difficulty: 'MEDIUM' as 'EASY' | 'MEDIUM' | 'HARD', is_bookmarked: false }),
    Boolean(editing),
  );

  const trimmedSearch = search.trim();

  const moduleQuery = useQuery({
    queryKey: ['module', id],
    queryFn: () => getModule(id!),
    enabled: !!id,
  });

  const tagsQuery = useQuery({
    queryKey: ['flashcard-tags', id],
    queryFn: () => getFlashcardTags(id),
    enabled: !!id,
  });

  const cardsQuery = useInfiniteQuery({
    queryKey: ['flashcards', id, sourceFilter, stateFilter, difficultyFilter, bookmarkedOnly, selectedTag, sortBy, pageSize, trimmedSearch],
    queryFn: ({ pageParam }) =>
      getFlashcards({
        module_id: id!,
        generation_source: sourceFilter === 'ALL' ? undefined : sourceFilter,
        state: stateFilter === 'ALL' ? undefined : stateFilter,
        study_difficulty: difficultyFilter === 'ALL' ? undefined : difficultyFilter,
        bookmarked_only: bookmarkedOnly || undefined,
        tags: selectedTag ? [selectedTag] : undefined,
        search: trimmedSearch || undefined,
        sort: sortBy,
        limit: pageSize,
        offset: pageParam,
      }),
    enabled: !!id,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.offset + lastPage.limit : undefined),
  });

  const updateMutation = useMutation({
    mutationFn: ({ cardId, front, back, tags, study_difficulty, is_bookmarked }: { cardId: string; front: string; back: string; tags: string[]; study_difficulty: 'EASY' | 'MEDIUM' | 'HARD'; is_bookmarked: boolean }) =>
      updateFlashcard(cardId, { front, back, tags, study_difficulty, is_bookmarked }),
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

  const bookmarkMutation = useMutation({
    mutationFn: ({ cardId, next }: { cardId: string; next: boolean }) => setFlashcardBookmark(cardId, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards', id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFlashcard,
    onSuccess: (_, cardId) => {
      setPendingDeleteIds((current) => current.filter((value) => value !== cardId));
      if (selectedCardId === cardId) {
        setSelectedCardId(null);
      }
      queryClient.invalidateQueries({ queryKey: ['flashcards', id] });
      queryClient.invalidateQueries({ queryKey: ['module', id] });
      queryClient.invalidateQueries({ queryKey: ['modules'] });
    },
    onError: (_, cardId) => {
      setPendingDeleteIds((current) => current.filter((value) => value !== cardId));
      showToast({ title: 'Could not delete flashcard', tone: 'error' });
    },
  });

  const loadedCards = useMemo(() => {
    const pages = cardsQuery.data?.pages ?? [];
    const merged: Flashcard[] = [];
    const seen = new Set<string>();

    pages.forEach((page) => {
      page.items.forEach((card) => {
        if (seen.has(card.id)) {
          return;
        }
        seen.add(card.id);
        merged.push(card);
      });
    });

    return merged;
  }, [cardsQuery.data]);

  const pendingDeleteIdSet = useMemo(() => new Set(pendingDeleteIds), [pendingDeleteIds]);

  const filteredCards = useMemo(
    () => loadedCards.filter((card) => !pendingDeleteIdSet.has(card.id)),
    [loadedCards, pendingDeleteIdSet],
  );

  const activeSelectedCardId = useMemo(() => {
    if (!filteredCards.length) {
      return null;
    }
    if (selectedCardId && filteredCards.some((card) => card.id === selectedCardId)) {
      return selectedCardId;
    }
    return filteredCards[0].id;
  }, [filteredCards, selectedCardId]);

  useEffect(() => {
    filteredCardsRef.current = filteredCards;
    activeSelectedCardIdRef.current = activeSelectedCardId;
    editingRef.current = editing;
  }, [activeSelectedCardId, editing, filteredCards]);

  useEffect(() => {
    if (!editing) {
      return;
    }
    if (editDraft.cardId !== editing.id) {
      setEditDraft({
        cardId: editing.id,
        front: editing.front,
        back: editing.back,
        tags: editing.tags,
        study_difficulty: editing.study_difficulty,
        is_bookmarked: editing.is_bookmarked,
      });
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

      if (event.key === 'Escape' && editingRef.current) {
        setEditing(null);
        clearEditDraft();
        return;
      }

      const currentCards = filteredCardsRef.current;
      if (isInput || currentCards.length === 0) {
        return;
      }

      const currentIndex = currentCards.findIndex((card) => card.id === activeSelectedCardIdRef.current);
      if (['ArrowRight', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % currentCards.length : 0;
        setSelectedCardId(currentCards[nextIndex].id);
      }
      if (['ArrowLeft', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        const nextIndex = currentIndex > 0 ? currentIndex - 1 : currentCards.length - 1;
        setSelectedCardId(currentCards[nextIndex].id);
      }
      if (event.key === 'Enter' && activeSelectedCardIdRef.current) {
        event.preventDefault();
        const selected = currentCards.find((card) => card.id === activeSelectedCardIdRef.current);
        if (selected) {
          setEditing(selected);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [clearEditDraft]);

  const queueDelete = (card: Flashcard) => {
    setPendingDeleteIds((current) => [...current, card.id]);
    const timeout = window.setTimeout(() => {
      deleteMutation.mutate(card.id);
      deleteTimeoutsRef.current.delete(card.id);
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
  const pendingLoadedCount = loadedCards.filter((card) => pendingDeleteIds.includes(card.id)).length;
  const firstPage = cardsQuery.data?.pages[0];
  const totalCards = (firstPage?.total ?? 0) - pendingLoadedCount;
  const hasMore = cardsQuery.hasNextPage;
  const initialLoading = (moduleQuery.isLoading || cardsQuery.isLoading) && loadedCards.length === 0;

  if (initialLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full">
        <Skeleton className="h-5 w-40 mb-6" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <Skeleton className="h-8 w-72 mb-3" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <Skeleton className="h-12 md:col-span-2" />
          <Skeleton className="h-12" />
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <button type="button" onClick={() => navigate(`/modules/${id}`)} className="hidden md:inline-flex items-center gap-2 mb-6" style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft size={18} />
        Back to Module
      </button>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.8rem' }}>
            {moduleQuery.data?.name || 'Module'} Flashcards
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Edit, delete, and browse cards in fixed chunks without leaving the module flow.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3" style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
          <span>{filteredCards.length} loaded</span>
          <span>{totalCards} total</span>
          <span className="hidden md:inline">Use `/` to search and arrow keys to move</span>
          <button type="button" className="inline-flex items-center gap-1" onClick={() => setImportOpen(true)}>
            <UploadSimple size={14} />
            Import
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1"
            onClick={async () => {
              const blob = await exportCardsJson(id!);
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = `${moduleQuery.data?.name || 'module'}_cards.json`;
              anchor.click();
              URL.revokeObjectURL(url);
            }}
          >
            <DownloadSimple size={14} />
            JSON
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1"
            onClick={async () => {
              const blob = await exportCardsCsv(id!);
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = `${moduleQuery.data?.name || 'module'}_cards.csv`;
              anchor.click();
              URL.revokeObjectURL(url);
            }}
          >
            <DownloadSimple size={14} />
            CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_220px_190px_130px] gap-3 mb-6">
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
          <option value="updated_desc">Recently updated</option>
          <option value="created_desc">Newest</option>
          <option value="created_asc">Oldest</option>
          <option value="front_asc">A-Z</option>
        </select>
        <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as PageSize)} className="px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
          {PAGE_SIZES.map((value) => (
            <option key={value} value={value}>
              {value} / page
            </option>
          ))}
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
        <button
          type="button"
          onClick={() => setBookmarkedOnly((current) => !current)}
          className="px-3 py-2 rounded-xl inline-flex items-center gap-2"
          style={{
            background: bookmarkedOnly ? 'var(--accent-soft)' : 'var(--surface)',
            color: bookmarkedOnly ? 'var(--accent)' : 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
        >
          <BookmarkSimple size={16} />
          Bookmarked
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Funnel size={16} style={{ color: 'var(--text-secondary)' }} />
          <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value as typeof difficultyFilter)} style={{ background: 'transparent', color: 'var(--text)', border: 'none' }}>
            <option value="ALL">All difficulties</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedTag('')}
            className="px-2 py-1 rounded-full text-xs"
            style={{ background: !selectedTag ? 'var(--accent-soft)' : 'var(--surface)', color: !selectedTag ? 'var(--accent)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            All tags
          </button>
          {tagsQuery.data?.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(tag)}
              className="px-2 py-1 rounded-full text-xs"
              style={{ background: selectedTag === tag ? 'var(--accent-soft)' : 'var(--surface)', color: selectedTag === tag ? 'var(--accent)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {filteredCards.length > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredCards.map((card) => {
              const isSelected = activeSelectedCardId === card.id;
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
                      <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(120,180,120,0.12)', color: 'var(--text-secondary)' }}>
                        {card.study_difficulty}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => bookmarkMutation.mutate({ cardId: card.id, next: !card.is_bookmarked })}
                        style={{ background: 'transparent', border: 'none', color: card.is_bookmarked ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', minWidth: 36, minHeight: 36 }}
                        aria-label="Toggle bookmark"
                      >
                        <BookmarkSimple size={18} weight={card.is_bookmarked ? 'fill' : 'regular'} />
                      </button>
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
                  <RichTextPreview text={card.front} className="mb-3" />
                  <div className="flex-1">
                    <RichTextPreview text={card.back} />
                    {card.assets.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        {card.assets.slice(0, 2).map((asset) => (
                          <img key={asset.id} src={asset.content_url} alt={asset.original_filename || 'Flashcard asset'} className="w-full h-24 object-cover rounded-lg" />
                        ))}
                      </div>
                    )}
                  </div>
                  {card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {card.tags.map((tag) => (
                        <span key={tag} className="px-2 py-1 rounded-full text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
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

          {hasMore ? (
            <div className="flex justify-center mt-6">
              <button
                type="button"
                className="scholar-btn"
                disabled={cardsQuery.isFetchingNextPage}
                onClick={() => cardsQuery.fetchNextPage()}
              >
                {cardsQuery.isFetchingNextPage ? 'Loading…' : 'Show more'}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="p-10 text-center" style={glass}>
          <p style={{ color: 'var(--text)', marginBottom: 8 }}>No flashcards match this view.</p>
          <p style={{ color: 'var(--text-secondary)' }}>
            {totalCards
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
              <RichTextEditor label="Front" value={editDraft.front} onChange={(front) => setEditDraft((current) => ({ ...current, front }))} rows={5} />
              <RichTextEditor label="Back" value={editDraft.back} onChange={(back) => setEditDraft((current) => ({ ...current, back }))} rows={7} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TagEditor
                  value={editDraft.tags}
                  suggestions={tagsQuery.data?.tags || []}
                  onChange={(tags) => setEditDraft((current) => ({ ...current, tags }))}
                />
                <div className="space-y-4">
                  <label>
                    <span className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>Study difficulty</span>
                    <select
                      value={editDraft.study_difficulty}
                      onChange={(event) => setEditDraft((current) => ({ ...current, study_difficulty: event.target.value as 'EASY' | 'MEDIUM' | 'HARD' }))}
                      className="w-full px-3 py-3"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
                    >
                      <option value="EASY">Easy</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HARD">Hard</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={editDraft.is_bookmarked}
                      onChange={(event) => setEditDraft((current) => ({ ...current, is_bookmarked: event.target.checked }))}
                    />
                    Bookmarked
                  </label>
                </div>
              </div>
              <CardImageUploader
                assets={editing.assets}
                onUpload={(file) => uploadFlashcardImage(editing.id, file).then(() => queryClient.invalidateQueries({ queryKey: ['flashcards', id] }))}
                onDelete={(assetId) => deleteFlashcardImage(assetId).then(() => queryClient.invalidateQueries({ queryKey: ['flashcards', id] }))}
              />
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
                  onClick={() => updateMutation.mutate({
                    cardId: editing.id,
                    front: editDraft.front.trim(),
                    back: editDraft.back.trim(),
                    tags: editDraft.tags,
                    study_difficulty: editDraft.study_difficulty,
                    is_bookmarked: editDraft.is_bookmarked,
                  })}
                >
                  Save Changes
                </button>
            </div>
          </div>
        </div>
      )}
      <ImportCardsModal
        moduleId={id!}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ['flashcards', id] });
          queryClient.invalidateQueries({ queryKey: ['flashcard-tags', id] });
          queryClient.invalidateQueries({ queryKey: ['module', id] });
        }}
      />
    </div>
  );
}
