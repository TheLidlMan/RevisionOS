import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CardsThree, ClockCountdown, FolderSimplePlus, Sparkle } from '@phosphor-icons/react';
import { getAnalyticsOverview, getModules } from '../api/client';
import CreateModuleModal from '../components/CreateModuleModal';
import ModuleCard from '../components/ModuleCard';
import Skeleton from '../components/Skeleton';
import { usePersistentState } from '../hooks/usePersistentState';
import { formatRelativeTime } from '../utils/formatters';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

export default function Dashboard() {
  const [showCreate, setShowCreate] = useState(false);
  const [sortBy, setSortBy] = usePersistentState<'UPDATED' | 'NEWEST' | 'OLDEST' | 'NAME'>('dashboard:module-sort', 'UPDATED');

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: getAnalyticsOverview,
  });

  const { data: modules, isLoading: modulesLoading } = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.some((module) => module.pipeline_status === 'running' || module.pipeline_status === 'queued') ? 2000 : false;
    },
  });

  const sortedModules = useMemo(() => {
    const list = [...(modules || [])];
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
  }, [modules, sortBy]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.9rem' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Create modules, upload documents, and let the backend build the study flow automatically.
          </p>
        </div>
        <button type="button" className="scholar-btn" onClick={() => setShowCreate(true)}>
          <FolderSimplePlus size={18} />
          Create Module
        </button>
      </div>

      {analyticsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="p-5" style={glass}>
              <Skeleton className="h-4 w-28 mb-4" />
              <Skeleton className="h-11 w-20" />
            </div>
          ))}
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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

      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.2rem' }}>Your Modules</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Uploads and card generation now happen inside each module.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {sortedModules.length > 0 ? `Updated ${formatRelativeTime(sortedModules[0].updated_at)}` : 'Ready when you are'}
          </span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            className="px-3 py-2.5"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedModules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      ) : (
        <div className="p-10 text-center" style={glass}>
          <p style={{ color: 'var(--text)', fontSize: '1rem', marginBottom: 8 }}>No modules yet.</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
            Start with one module, add the source material, and Revise OS will build the study flow from there.
          </p>
          <button type="button" className="scholar-btn" onClick={() => setShowCreate(true)}>
            <FolderSimplePlus size={18} />
            Create Your First Module
          </button>
        </div>
      )}

      <CreateModuleModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
