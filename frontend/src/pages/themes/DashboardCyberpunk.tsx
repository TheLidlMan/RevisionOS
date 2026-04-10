import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Flame, TrendingUp, Loader2, AlertTriangle } from 'lucide-react';
import { getModules, getAnalyticsOverview, getWeaknessMap } from '../../api/client';
import CreateModuleModal from '../../components/CreateModuleModal';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };
const neonCyan = '#0ff';
const neonMagenta = '#f0f';
const neonYellow = '#ff0';
const bg = '#0a0a0f';
const cardBg = '#12121a';

const scanlineOverlay: React.CSSProperties = {
  position: 'absolute', inset: 0, pointerEvents: 'none',
  background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.03) 2px, rgba(0,255,255,0.03) 4px)',
  zIndex: 1,
};

const glowBorder = (color: string): React.CSSProperties => ({
  background: cardBg, border: `1px solid ${color}`, borderRadius: 0,
  boxShadow: `0 0 8px ${color}40, inset 0 0 8px ${color}10`,
});

export default function DashboardCyberpunk() {
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const { data: analytics, isLoading: analyticsLoading } = useQuery({ queryKey: ['analytics'], queryFn: getAnalyticsOverview });
  const { data: modules, isLoading: modulesLoading } = useQuery({ queryKey: ['modules'], queryFn: getModules });
  const { data: weaknessData } = useQuery({ queryKey: ['weakness-map-spotlight'], queryFn: () => getWeaknessMap() });

  return (
    <div style={{ ...mono, background: bg, minHeight: '100vh', padding: '2rem', color: '#e0e0e0', position: 'relative' }}>
      <div style={scanlineOverlay} />

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, color: neonCyan,
            textShadow: `0 0 10px ${neonCyan}, 0 0 20px ${neonCyan}, 2px 2px 0 ${neonMagenta}` }}>
            {'> '}SYSTEM STATUS
          </h1>
          <p style={{ color: '#666', fontSize: '0.8rem', marginTop: 4 }}>CYBERPUNK OS v2.077 // REVISION CORE ONLINE</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ ...mono, ...glowBorder(neonCyan), color: neonCyan, padding: '0.6rem 1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 700 }}>
          <Plus size={16} /> NEW_MODULE
        </button>
      </div>

      {/* KPI HUD */}
      {analyticsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0', position: 'relative', zIndex: 2 }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: neonCyan }} />
        </div>
      ) : analytics ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem', position: 'relative', zIndex: 2 }}>
          <div style={{ ...glowBorder(neonCyan), padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Clock size={16} style={{ color: neonCyan }} />
              <span style={{ color: '#555', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 2 }}>DUE.TODAY</span>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: neonCyan, lineHeight: 1 }}>{analytics.due_today}</div>
            <span style={{ color: '#444', fontSize: '0.65rem' }}>UNITS</span>
          </div>

          <div style={{ ...glowBorder(neonMagenta), padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Flame size={16} style={{ color: neonMagenta }} />
              <span style={{ color: '#555', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 2 }}>STREAK.ACTIVE</span>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: neonMagenta, lineHeight: 1 }}>{analytics.streak}</div>
            <span style={{ color: '#444', fontSize: '0.65rem' }}>DAYS</span>
          </div>

          <div style={{ ...glowBorder(neonYellow), padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <TrendingUp size={16} style={{ color: neonYellow }} />
              <span style={{ color: '#555', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 2 }}>MASTERY.LVL</span>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: neonYellow, lineHeight: 1 }}>{Math.round(analytics.overall_mastery)}</div>
            <span style={{ color: '#444', fontSize: '0.65rem' }}>PERCENT</span>
          </div>
        </div>
      ) : null}

      {/* Module Panels */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <h2 style={{ color: neonCyan, fontSize: '0.85rem', letterSpacing: 3, textTransform: 'uppercase', marginBottom: '1rem', borderBottom: `1px solid ${neonCyan}30`, paddingBottom: 8 }}>
          {'// '}LOADED MODULES
        </h2>
        {modulesLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: neonCyan }} />
          </div>
        ) : modules && modules.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
            {modules.map((mod) => (
              <div key={mod.id} onClick={() => navigate(`/modules/${mod.id}`)}
                style={{ ...glowBorder(mod.color), padding: '1rem 1.25rem', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 20px ${mod.color}60, inset 0 0 12px ${mod.color}15`; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 8px ${mod.color}40, inset 0 0 8px ${mod.color}10`; }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: mod.color, fontWeight: 700, fontSize: '0.9rem' }}>{mod.name}</span>
                  <span style={{ background: `${neonCyan}15`, color: neonCyan, padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1 }}>[ ACTIVE ]</span>
                </div>
                <div style={{ color: '#555', fontSize: '0.75rem', display: 'flex', gap: 16 }}>
                  <span>CARDS: {mod.total_cards}</span>
                  <span>DUE: {mod.due_cards}</span>
                  <span>MASTERY: {Math.round(mod.mastery_pct)}%</span>
                </div>
                <div style={{ marginTop: 8, height: 3, background: '#1a1a2e', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${mod.mastery_pct}%`, background: `linear-gradient(90deg, ${mod.color}, ${neonCyan})`, transition: 'width 0.4s' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...glowBorder(neonCyan), padding: '2rem', textAlign: 'center', marginBottom: '2rem' }}>
            <p style={{ color: '#555', marginBottom: 16 }}>NO MODULES DETECTED. INITIALIZE FIRST MODULE.</p>
            <button onClick={() => setShowCreate(true)}
              style={{ ...mono, ...glowBorder(neonMagenta), color: neonMagenta, padding: '0.5rem 1.2rem', cursor: 'pointer', fontWeight: 700 }}>
              INIT_MODULE
            </button>
          </div>
        )}
      </div>

      {/* Weakness Alert */}
      {weaknessData && weaknessData.concepts.length > 0 && (() => {
        const weakest = [...weaknessData.concepts].sort((a, b) => a.confidence_score - b.confidence_score).slice(0, 3);
        return (
          <div style={{ position: 'relative', zIndex: 2, marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 style={{ color: '#f87171', fontSize: '0.85rem', letterSpacing: 3, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} /> {'⚠ '}THREAT DETECTED
              </h2>
              <button onClick={() => navigate('/weakness-map')}
                style={{ ...mono, background: 'none', border: 'none', color: neonCyan, cursor: 'pointer', fontSize: '0.75rem' }}>
                SCAN_ALL →
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {weakest.map(c => (
                <div key={c.id} style={{ ...glowBorder('#f87171'), padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#fca5a5', fontSize: '0.8rem', fontWeight: 600 }}>{c.name}</span>
                  <span style={{ color: '#f87171', fontSize: '0.7rem', fontWeight: 700 }}>[{Math.round(c.confidence_score)}%]</span>
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
