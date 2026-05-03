import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CardsThree, ClockCountdown, FolderSimplePlus, Sparkle } from '@phosphor-icons/react';
import { getAnalyticsOverview, getModules, reorderModules } from '../api/client';
import CreateModuleModal from '../components/CreateModuleModal';
import ModuleCard from '../components/ModuleCard';
import Skeleton from '../components/Skeleton';
import GamificationBar from '../components/GamificationBar';
import { usePersistentState } from '../hooks/usePersistentState';
import { formatRelativeTime } from '../utils/formatters';
import type { Module } from '../types';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

function getPipelineRefetchInterval(
  items: Array<{ pipeline_status?: string; pipeline_updated_at?: string | null }> | undefined,
) {
  const activeItem = items?.find((item) => item.pipeline_status === 'running' || item.pipeline_status === 'queued');
  if (!activeItem) {
    return false;
  }

  const lastUpdate = activeItem.pipeline_updated_at ? new Date(activeItem.pipeline_updated_at).getTime() : 0;
  const ageMs = lastUpdate > 0 ? Date.now() - lastUpdate : Number.POSITIVE_INFINITY;
  if (ageMs < 15_000) {
    return 2_000;
  }
  if (ageMs < 60_000) {
    return 5_000;
  }
  return 10_000;
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [sortBy, setSortBy] = usePersistentState<'UPDATED' | 'NEWEST' | 'OLDEST' | 'NAME'>('dashboard:module-sort', 'UPDATED');
  const [orderedModules, setOrderedModules] = useState<Module[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: getAnalyticsOverview,
  });

  const { data: modules, isLoading: modulesLoading } = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
    refetchInterval: (query) => getPipelineRefetchInterval(query.state.data),
  });

  useEffect(() => {
    if (modules) {
      setOrderedModules(modules);
    }
  }, [modules]);

  const reorderMutation = useMutation({
    mutationFn: reorderModules,
    onSuccess: (nextModules) => {
      queryClient.setQueryData(['modules'], nextModules);
    },
  });

  const sortedModules = useMemo(() => {
    const list = [...(orderedModules || [])];
    if (sortBy === 'NAME') {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === 'NEWEST') {
      return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    if (sortBy === 'OLDEST') {
      return list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [orderedModules, sortBy]);

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const current = [...sortedModules];
    const fromIndex = current.findIndex((module) => module.id === draggedId);
    const toIndex = current.findIndex((module) => module.id === targetId);
    if (fromIndex < 0 || toIndex < 0) {
      setDraggedId(null);
      return;
    }
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    const nextModules = current.map((module, index) => ({ ...module, sort_order: index }));
    setOrderedModules(nextModules);
    setDraggedId(null);
    reorderMutation.mutate(nextModules.map((module) => module.id));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-[1.55rem] sm:text-[1.9rem]" style={{ fontFamily: 'var(--heading)', color: 'var(--text)' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Create modules, upload documents, and let the backend build the study flow automatically.
          </p>
        </div>
        <button type="button" className="scholar-btn w-full sm:w-auto" onClick={() => setShowCreate(true)}>
          <FolderSimplePlus size={18} />
          Create Module
        </button>
      </div>

      {/* Gamification Bar: streak, XP, daily goal, hearts */}
      <GamificationBar />

      {analyticsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-8">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="p-5" style={glass}>
              <Skeleton className="h-4 w-28 mb-4" />
              <Skeleton className="h-11 w-20" />
            </div>
          ))}
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-8">
          <div className="p-5" style={glass}>
            <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--accent)' }}>
              <ClockCountdown size={20} />
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Due today</span>
            </div>
            <p style={{ color: 'var(--text)', fontSize: '2.2rem', fontWeight: 300 }}>{analytics.due_today}</p>
          </div>
          <div className="p-5" style={glass}>
            <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--accent)' }}>
              <CardsThree size={20} />
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total cards</span>
            </div>
            <p style={{ color: 'var(--text)', fontSize: '2.2rem', fontWeight: 300 }}>{analytics.total_cards}</p>
          </div>
          <div className="p-5" style={glass}>
            <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--accent)' }}>
              <Sparkle size={20} />
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Overall mastery</span>
            </div>
            <p style={{ color: 'var(--text)', fontSize: '2.2rem', fontWeight: 300 }}>{Math.round(analytics.overall_mastery)}%</p>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.2rem' }}>Your Modules</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Uploads and card generation now happen inside each module.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {sortedModules.length > 0 ? `Updated ${formatRelativeTime(sortedModules[0].updated_at)}` : 'Ready when you are'}
          </span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            className="w-full sm:w-auto px-3 py-2.5"
            aria-label="Sort modules"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
          >
            <option value="UPDATED">Recently updated</option>
            <option value="NEWEST">Newest</option>
            <option value="OLDEST">Oldest</option>
            <option value="NAME">A-Z</option>
          </select>
        </div>
      </div>

      {modulesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="p-5" style={glass}>
              <Skeleton className="h-5 w-40 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-5" />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedModules.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {sortedModules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              draggable
              isDragging={draggedId === module.id}
              onDragStart={() => setDraggedId(module.id)}
              onDragOver={() => undefined}
              onDrop={() => handleDrop(module.id)}
            />
          ))}
        </div>
      ) : (
        <div className="p-10 text-center" style={glass}>
          <p style={{ color: 'var(--text)', fontSize: '1rem', marginBottom: 8 }}>No modules yet.</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
            Start with one module, add the source material, and Revise OS will build the study flow from there.
          </p>
          <button type="button" className="scholar-btn w-full sm:w-auto" onClick={() => setShowCreate(true)}>
            <FolderSimplePlus size={18} />
            Create Your First Module
          </button>
        </div>
      )}

      <CreateModuleModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
