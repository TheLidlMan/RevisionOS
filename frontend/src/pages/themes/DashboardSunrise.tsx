import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Flame, TrendingUp, Loader2, AlertTriangle } from 'lucide-react';
import { getModules, getAnalyticsOverview, getWeaknessMap } from '../../api/client';
import CreateModuleModal from '../../components/CreateModuleModal';

function CircularRing({ value, size = 64, stroke = 6, color = '#f59e0b' }: { value: number; size?: number; stroke?: number; color?: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontSize: size * 0.24, fontWeight: 700, fill: '#78350f' }}>
        {Math.round(value)}%
      </text>
    </svg>
  );
}

export default function DashboardSunrise() {
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const { data: analytics, isLoading: analyticsLoading } = useQuery({ queryKey: ['analytics'], queryFn: getAnalyticsOverview });
  const { data: modules, isLoading: modulesLoading } = useQuery({ queryKey: ['modules'], queryFn: getModules });
  const { data: weaknessData } = useQuery({ queryKey: ['weakness-map-spotlight'], queryFn: () => getWeaknessMap() });

  return (
    <div style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)', minHeight: '100vh', padding: '2.5rem', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #f97316, #f59e0b)', borderRadius: 20, padding: '2rem 2.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 32px rgba(245,158,11,0.3)' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', margin: 0 }}>☀️ Good Morning!</h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', marginTop: 4, fontSize: '1.1rem' }}>Welcome back to Sunrise Studio</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ background: '#fff', color: '#b45309', border: 'none', borderRadius: 14, padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <Plus size={18} /> Create Module
        </button>
      </div>

      {/* KPI Cards */}
      {analyticsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#f59e0b' }} />
        </div>
      ) : analytics ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '1.75rem', boxShadow: '0 4px 20px rgba(180,120,40,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: '2rem' }}>📚</span>
              <span style={{ color: '#92400e', fontSize: '0.95rem', fontWeight: 500 }}>Due Today</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Clock size={20} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#78350f' }}>{analytics.due_today}</span>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: '1.75rem', boxShadow: '0 4px 20px rgba(180,120,40,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: '2rem' }}>🔥</span>
              <span style={{ color: '#92400e', fontSize: '0.95rem', fontWeight: 500 }}>Active Streak</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Flame size={20} style={{ color: '#ea580c' }} />
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#78350f' }}>{analytics.streak}</span>
              <span style={{ color: '#a16207', fontSize: '1rem' }}>days</span>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: '1.75rem', boxShadow: '0 4px 20px rgba(180,120,40,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: '2rem' }}>📈</span>
              <span style={{ color: '#92400e', fontSize: '0.95rem', fontWeight: 500 }}>Overall Mastery</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <TrendingUp size={20} style={{ color: '#16a34a' }} />
              <CircularRing value={analytics.overall_mastery} size={72} color="#16a34a" />
            </div>
          </div>
        </div>
      ) : null}

      {/* Module Grid */}
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#78350f', marginBottom: '1rem' }}>Your Modules</h2>
      {modulesLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#f59e0b' }} />
        </div>
      ) : modules && modules.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {modules.map((mod) => (
            <div key={mod.id} onClick={() => navigate(`/modules/${mod.id}`)}
              style={{ background: '#fff', borderRadius: 18, padding: '1.5rem', borderLeft: `6px solid ${mod.color}`, boxShadow: '0 4px 16px rgba(180,120,40,0.08)', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(180,120,40,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(180,120,40,0.08)'; }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#78350f', marginBottom: 8 }}>{mod.name}</h3>
              <p style={{ color: '#a16207', fontSize: '0.85rem', marginBottom: 12 }}>{mod.description || 'No description'}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: '#92400e' }}>{mod.total_cards} cards · {mod.due_cards} due</span>
                <CircularRing value={mod.mastery_pct} size={48} stroke={4} color={mod.color} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: 20, boxShadow: '0 4px 20px rgba(180,120,40,0.1)', marginBottom: '2rem' }}>
          <p style={{ color: '#a16207', marginBottom: 16, fontSize: '1.1rem' }}>No modules yet. Create one to get started!</p>
          <button onClick={() => setShowCreate(true)}
            style={{ background: 'linear-gradient(135deg, #f97316, #f59e0b)', color: '#fff', border: 'none', borderRadius: 12, padding: '0.75rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}>
            Create Your First Module
          </button>
        </div>
      )}

      {/* Weakness Spotlight */}
      {weaknessData && weaknessData.concepts.length > 0 && (() => {
        const weakest = [...weaknessData.concepts].sort((a, b) => a.confidence_score - b.confidence_score).slice(0, 3);
        return (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#78350f', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={20} style={{ color: '#ea580c' }} /> Weakness Spotlight
              </h2>
              <button onClick={() => navigate('/weakness-map')}
                style={{ background: 'none', border: 'none', color: '#b45309', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                View All →
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {weakest.map(c => (
                <div key={c.id} style={{ background: '#fff', borderRadius: 14, padding: '0.75rem 1.25rem', boxShadow: '0 2px 12px rgba(180,120,40,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 600, color: '#78350f', fontSize: '0.9rem' }}>{c.name}</span>
                  <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }}>
                    {Math.round(c.confidence_score)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <CreateModuleModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
