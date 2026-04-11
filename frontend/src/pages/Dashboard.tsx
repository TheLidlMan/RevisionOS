import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CardsThree, ClockCountdown, FolderSimplePlus, Sparkle, SpinnerGap } from '@phosphor-icons/react';
import { getAnalyticsOverview, getModules } from '../api/client';
import CreateModuleModal from '../components/CreateModuleModal';
import ModuleCard from '../components/ModuleCard';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

export default function Dashboard() {
  const [showCreate, setShowCreate] = useState(false);

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
        <div className="flex justify-center py-16">
          <SpinnerGap size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
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

      <div className="mb-4 flex items-center justify-between">
        <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.2rem' }}>Your Modules</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Uploads and card generation now happen inside each module.
        </p>
      </div>

      {modulesLoading ? (
        <div className="flex justify-center py-16">
          <SpinnerGap size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : modules && modules.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      ) : (
        <div className="p-10 text-center" style={glass}>
          <p style={{ color: 'var(--text)', fontSize: '1rem', marginBottom: 8 }}>No modules yet.</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
            Start with one module, upload the source material, and the rest will build from there.
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
