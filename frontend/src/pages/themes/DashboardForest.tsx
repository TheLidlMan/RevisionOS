import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Flame, TrendingUp, Loader2, AlertTriangle } from 'lucide-react';
import { getModules, getAnalyticsOverview, getWeaknessMap } from '../../api/client';
import CreateModuleModal from '../../components/CreateModuleModal';

const deepGreen = '#0d2818';
const cardGreen = '#1a4d2e';
const leafGreen = '#22c55e';
const earthBrown = '#8b6914';
const skyBlue = '#5ba3c7';
const textLight = '#d4e7d0';
const textMuted = '#7da68a';

function growthIcon(mastery: number): string {
  if (mastery >= 80) return '🌳';
  if (mastery >= 60) return '🌿';
  if (mastery >= 40) return '🌱';
  if (mastery >= 20) return '🌾';
  return '🫘';
}

export default function DashboardForest() {
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const { data: analytics, isLoading: analyticsLoading } = useQuery({ queryKey: ['analytics'], queryFn: getAnalyticsOverview });
  const { data: modules, isLoading: modulesLoading } = useQuery({ queryKey: ['modules'], queryFn: getModules });
  const { data: weaknessData } = useQuery({ queryKey: ['weakness-map-spotlight'], queryFn: () => getWeaknessMap() });

  return (
    <div style={{ background: deepGreen, minHeight: '100vh', padding: '2.5rem', color: textLight }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: leafGreen }}>
            🌿 Forest Retreat
          </h1>
          <p style={{ color: textMuted, marginTop: 4, fontSize: '0.95rem' }}>Grow your knowledge, one leaf at a time 🍃</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ background: leafGreen, color: deepGreen, border: 'none', borderRadius: 24, padding: '0.7rem 1.5rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
          <Plus size={16} /> Plant Module
        </button>
      </div>

      {/* KPI Cards */}
      {analyticsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: leafGreen }} />
        </div>
      ) : analytics ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
          <div style={{ background: cardGreen, borderRadius: 24, padding: '1.5rem', border: '1px solid #2a5e3e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Clock size={18} style={{ color: skyBlue }} />
              <span style={{ color: textMuted, fontSize: '0.85rem' }}>Due Today</span>
            </div>
            <p style={{ fontSize: '2.25rem', fontWeight: 800, color: skyBlue, margin: 0 }}>{analytics.due_today}</p>
            <span style={{ color: textMuted, fontSize: '0.75rem' }}>cards to water 💧</span>
          </div>

          <div style={{ background: cardGreen, borderRadius: 24, padding: '1.5rem', border: '1px solid #2a5e3e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Flame size={18} style={{ color: earthBrown }} />
              <span style={{ color: textMuted, fontSize: '0.85rem' }}>Active Streak</span>
            </div>
            <p style={{ fontSize: '2.25rem', fontWeight: 800, color: earthBrown, margin: 0 }}>
              {analytics.streak} <span style={{ fontSize: '1rem', fontWeight: 400, color: textMuted }}>days</span>
            </p>
            <span style={{ color: textMuted, fontSize: '0.75rem' }}>keep the flame alive 🔥</span>
          </div>

          <div style={{ background: cardGreen, borderRadius: 24, padding: '1.5rem', border: '1px solid #2a5e3e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <TrendingUp size={18} style={{ color: leafGreen }} />
              <span style={{ color: textMuted, fontSize: '0.85rem' }}>Overall Mastery</span>
            </div>
            <p style={{ fontSize: '2.25rem', fontWeight: 800, color: leafGreen, margin: 0 }}>
              {Math.round(analytics.overall_mastery)}%
            </p>
            {/* Growth bar */}
            <div style={{ marginTop: 8, height: 8, background: '#0d2818', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${analytics.overall_mastery}%`, background: `linear-gradient(90deg, #166534, ${leafGreen})`, borderRadius: 4, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Module Garden Plots */}
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: leafGreen, marginBottom: '1rem' }}>🌱 Your Garden</h2>
      {modulesLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: leafGreen }} />
        </div>
      ) : modules && modules.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {modules.map((mod) => (
            <div key={mod.id} onClick={() => navigate(`/modules/${mod.id}`)}
              style={{ background: cardGreen, borderRadius: 28, padding: '1.5rem', border: '1px solid #2a5e3e', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = leafGreen; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#2a5e3e'; }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: textLight, margin: 0 }}>{mod.name}</h3>
                <span style={{ fontSize: '1.5rem' }}>{growthIcon(mod.mastery_pct)}</span>
              </div>
              <p style={{ color: textMuted, fontSize: '0.8rem', marginBottom: 12 }}>{mod.description || 'A new plot awaits planting...'}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: textMuted, marginBottom: 10 }}>
                <span>{mod.total_cards} cards</span>
                <span>·</span>
                <span>{mod.due_cards} due</span>
              </div>
              {/* Growth bar */}
              <div style={{ height: 6, background: '#0d2818', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${mod.mastery_pct}%`, background: `linear-gradient(90deg, ${mod.color}, ${leafGreen})`, borderRadius: 3, transition: 'width 0.4s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.7rem', color: textMuted }}>
                <span>{growthIcon(mod.mastery_pct)} {mod.mastery_pct >= 80 ? 'Flourishing' : mod.mastery_pct >= 50 ? 'Growing' : 'Sprouting'}</span>
                <span>{Math.round(mod.mastery_pct)}%</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', background: cardGreen, borderRadius: 28, border: '1px solid #2a5e3e', marginBottom: '2rem' }}>
          <p style={{ color: textMuted, marginBottom: 16, fontSize: '1rem' }}>🌱 Your garden is empty. Plant your first module!</p>
          <button onClick={() => setShowCreate(true)}
            style={{ background: leafGreen, color: deepGreen, border: 'none', borderRadius: 24, padding: '0.7rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}>
            Plant First Seed
          </button>
        </div>
      )}

      {/* Weakness Spotlight */}
      {weaknessData && weaknessData.concepts.length > 0 && (() => {
        const weakest = [...weaknessData.concepts].sort((a, b) => a.confidence_score - b.confidence_score).slice(0, 3);
        return (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: earthBrown, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} style={{ color: earthBrown }} /> Wilting Areas 🍂
              </h2>
              <button onClick={() => navigate('/weakness-map')}
                style={{ background: 'none', border: 'none', color: skyBlue, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                View Map →
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {weakest.map(c => (
                <div key={c.id} style={{ background: cardGreen, borderRadius: 20, padding: '0.6rem 1.25rem', border: '1px solid #2a5e3e', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: textLight }}>{c.name}</span>
                  <span style={{ color: earthBrown, fontSize: '0.75rem', fontWeight: 700 }}>{Math.round(c.confidence_score)}%</span>
                  <span>{growthIcon(c.confidence_score)}</span>
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
