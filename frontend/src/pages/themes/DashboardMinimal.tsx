import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Flame, TrendingUp, Loader2, AlertTriangle } from 'lucide-react';
import { getModules, getAnalyticsOverview, getWeaknessMap } from '../../api/client';
import CreateModuleModal from '../../components/CreateModuleModal';

const bgColor = '#09090b';
const cardBg = 'rgba(255,255,255,0.03)';
const cardBorder = '1px solid rgba(255,255,255,0.08)';
const accent = '#94c4ff';
const textPrimary = '#fafafa';
const textSecondary = 'rgba(255,255,255,0.4)';
const textTertiary = 'rgba(255,255,255,0.2)';

export default function DashboardMinimal() {
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const { data: analytics, isLoading: analyticsLoading } = useQuery({ queryKey: ['analytics'], queryFn: getAnalyticsOverview });
  const { data: modules, isLoading: modulesLoading } = useQuery({ queryKey: ['modules'], queryFn: getModules });
  const { data: weaknessData } = useQuery({ queryKey: ['weakness-map-spotlight'], queryFn: () => getWeaknessMap() });

  return (
    <div style={{ background: bgColor, minHeight: '100vh', padding: '2.5rem 3rem', color: textPrimary }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 200, margin: 0, letterSpacing: '-0.02em', color: textPrimary }}>Dashboard</h1>
          <p style={{ color: textTertiary, marginTop: 4, fontSize: '0.85rem', fontWeight: 300 }}>Glass Minimal</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ background: 'transparent', color: accent, border: cardBorder, borderRadius: 10, padding: '0.6rem 1.25rem', fontWeight: 300, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', transition: 'all 0.3s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(148,196,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(148,196,255,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
          <Plus size={16} /> Create
        </button>
      </div>

      {/* KPI Section */}
      {analyticsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: accent }} />
        </div>
      ) : analytics ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginBottom: '3rem' }}>
          <div style={{ background: cardBg, border: cardBorder, borderRadius: 16, padding: '2.5rem 2rem', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            <Clock size={16} style={{ color: textTertiary, marginBottom: 16 }} />
            <p style={{ fontSize: '3.5rem', fontWeight: 200, margin: 0, lineHeight: 1, color: accent, letterSpacing: '-0.03em' }}>{analytics.due_today}</p>
            <span style={{ fontSize: '0.7rem', color: textTertiary, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 300 }}>due today</span>
          </div>

          <div style={{ background: cardBg, border: cardBorder, borderRadius: 16, padding: '2.5rem 2rem', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            <Flame size={16} style={{ color: textTertiary, marginBottom: 16 }} />
            <p style={{ fontSize: '3.5rem', fontWeight: 200, margin: 0, lineHeight: 1, color: textPrimary, letterSpacing: '-0.03em' }}>{analytics.streak}</p>
            <span style={{ fontSize: '0.7rem', color: textTertiary, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 300 }}>day streak</span>
          </div>

          <div style={{ background: cardBg, border: cardBorder, borderRadius: 16, padding: '2.5rem 2rem', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            <TrendingUp size={16} style={{ color: textTertiary, marginBottom: 16 }} />
            <p style={{ fontSize: '3.5rem', fontWeight: 200, margin: 0, lineHeight: 1, color: textPrimary, letterSpacing: '-0.03em' }}>
              {Math.round(analytics.overall_mastery)}<span style={{ fontSize: '1.5rem', color: textSecondary }}>%</span>
            </p>
            <span style={{ fontSize: '0.7rem', color: textTertiary, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 300 }}>mastery</span>
          </div>
        </div>
      ) : null}

      {/* Module List (single column) */}
      <h2 style={{ fontSize: '0.75rem', fontWeight: 300, color: textTertiary, textTransform: 'uppercase', letterSpacing: 3, marginBottom: '1.5rem' }}>Modules</h2>
      {modulesLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: accent }} />
        </div>
      ) : modules && modules.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: '3rem' }}>
          {modules.map((mod) => (
            <div key={mod.id} onClick={() => navigate(`/modules/${mod.id}`)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderRadius: 10, cursor: 'pointer', transition: 'all 0.3s', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.background = cardBg; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: mod.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 300, fontSize: '0.95rem', color: textPrimary }}>{mod.name}</span>
                {mod.due_cards > 0 && (
                  <span style={{ fontSize: '0.7rem', color: accent, fontWeight: 400 }}>{mod.due_cards} due</span>
                )}
              </div>
              <span style={{ fontWeight: 200, fontSize: '0.9rem', color: textSecondary }}>{Math.round(mod.mastery_pct)}%</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: cardBg, border: cardBorder, borderRadius: 16, marginBottom: '3rem' }}>
          <p style={{ color: textSecondary, marginBottom: 20, fontWeight: 200 }}>No modules yet</p>
          <button onClick={() => setShowCreate(true)}
            style={{ background: 'transparent', color: accent, border: `1px solid ${accent}30`, borderRadius: 10, padding: '0.5rem 1.25rem', fontWeight: 300, cursor: 'pointer' }}>
            Create First Module
          </button>
        </div>
      )}

      {/* Weakness Spotlight */}
      {weaknessData && weaknessData.concepts.length > 0 && (() => {
        const weakest = [...weaknessData.concepts].sort((a, b) => a.confidence_score - b.confidence_score).slice(0, 3);
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '0.75rem', fontWeight: 300, color: textTertiary, textTransform: 'uppercase', letterSpacing: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={14} /> Weak Areas
              </h2>
              <button onClick={() => navigate('/weakness-map')}
                style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', fontWeight: 300, fontSize: '0.8rem' }}>
                View all →
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {weakest.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.5rem', borderRadius: 8 }}>
                  <span style={{ fontWeight: 300, fontSize: '0.9rem', color: textPrimary }}>{c.name}</span>
                  <span style={{ fontWeight: 200, fontSize: '0.85rem', color: 'rgba(248,113,113,0.7)' }}>{Math.round(c.confidence_score)}%</span>
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
