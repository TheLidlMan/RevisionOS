import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Flame, TrendingUp, Loader2, AlertTriangle } from 'lucide-react';
import { getModules, getAnalyticsOverview, getWeaknessMap } from '../api/client';
import ModuleCard from '../components/ModuleCard';
import CreateModuleModal from '../components/CreateModuleModal';

export default function Dashboard() {
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: getAnalyticsOverview,
  });

  const { data: modules, isLoading: modulesLoading } = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const { data: weaknessData } = useQuery({
    queryKey: ['weakness-map-spotlight'],
    queryFn: () => getWeaknessMap(),
  });

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 mt-1">Welcome back to RevisionOS</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-teal hover:bg-teal-dark text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Module
        </button>
      </div>

      {/* KPI Cards */}
      {analyticsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-teal" />
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-navy-light rounded-xl border border-gray-800 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-teal" />
              </div>
              <span className="text-sm text-gray-400">Due Today</span>
            </div>
            <p className="text-3xl font-bold">{analytics.due_today}</p>
          </div>

          <div className="bg-navy-light rounded-xl border border-gray-800 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <span className="text-sm text-gray-400">Active Streak</span>
            </div>
            <p className="text-3xl font-bold">
              {analytics.streak}{' '}
              <span className="text-base text-gray-500 font-normal">days</span>
            </p>
          </div>

          <div className="bg-navy-light rounded-xl border border-gray-800 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <span className="text-sm text-gray-400">Overall Mastery</span>
            </div>
            <p className="text-3xl font-bold">
              {Math.round(analytics.overall_mastery)}
              <span className="text-base text-gray-500 font-normal">%</span>
            </p>
          </div>
        </div>
      ) : null}

      {/* Module Grid */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Your Modules</h2>
      </div>

      {modulesLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-teal" />
        </div>
      ) : modules && modules.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((mod) => (
            <ModuleCard key={mod.id} module={mod} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-navy-light rounded-xl border border-gray-800">
          <p className="text-gray-400 mb-4">No modules yet. Create one to get started!</p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-teal hover:bg-teal-dark text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Create Your First Module
          </button>
        </div>
      )}

      {/* Weakness Spotlight */}
      {weaknessData && weaknessData.concepts.length > 0 && (() => {
        const weakest = [...weaknessData.concepts]
          .sort((a, b) => a.confidence_score - b.confidence_score)
          .slice(0, 3);
        return (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                Weakness Spotlight
              </h2>
              <button
                onClick={() => navigate('/weakness-map')}
                className="text-sm text-teal hover:underline"
              >
                View All →
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {weakest.map((c) => (
                <div key={c.id} className="bg-navy-light rounded-xl border border-gray-800 px-4 py-3 flex items-center gap-3">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">
                    {Math.round(c.confidence_score)}%
                  </span>
                </div>
              ))}
              <button
                onClick={() => navigate('/weakness-map')}
                className="bg-teal hover:bg-teal-dark text-white rounded-xl px-4 py-3 text-sm font-medium transition-colors"
              >
                Drill Weakest
              </button>
            </div>
          </div>
        );
      })()}

      <CreateModuleModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}