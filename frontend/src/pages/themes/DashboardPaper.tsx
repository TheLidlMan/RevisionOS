import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Flame, TrendingUp, Loader2, AlertTriangle } from 'lucide-react';
import { getModules, getAnalyticsOverview, getWeaknessMap } from '../../api/client';
import CreateModuleModal from '../../components/CreateModuleModal';

const bg = '#faf8f5';
const text = '#3c2415';
const muted = '#8b7355';
const serif: React.CSSProperties = { fontFamily: 'Georgia, "Times New Roman", serif' };

function gradeFromMastery(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C+';
  if (pct >= 40) return 'C';
  if (pct >= 30) return 'D';
  return 'F';
}

function GradeStamp({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', border: `3px dashed ${text}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', ...serif }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: text }}>{value}</span>
      </div>
      <span style={{ fontSize: '0.75rem', color: muted }}>{label}</span>
    </div>
  );
}

export default function DashboardPaper() {
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const { data: analytics, isLoading: analyticsLoading } = useQuery({ queryKey: ['analytics'], queryFn: getAnalyticsOverview });
  const { data: modules, isLoading: modulesLoading } = useQuery({ queryKey: ['modules'], queryFn: getModules });
  const { data: weaknessData } = useQuery({ queryKey: ['weakness-map-spotlight'], queryFn: () => getWeaknessMap() });

  const cardRotation = (i: number) => `${(i % 2 === 0 ? -0.5 : 0.5)}deg`;

  return (
    <div style={{ background: bg, minHeight: '100vh', padding: '2.5rem', color: text }}>
      {/* Header */}
      <div style={{ borderBottom: '2px dashed #ccc', paddingBottom: '1.25rem', marginBottom: '2rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ ...serif, fontSize: '2.2rem', fontWeight: 700, margin: 0, color: text }}>📓 Study Notebook</h1>
          <p style={{ color: muted, fontStyle: 'italic', marginTop: 4, fontSize: '0.95rem' }}>Paper &amp; Ink — your academic dashboard</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ ...serif, background: text, color: bg, border: 'none', borderRadius: 4, padding: '0.6rem 1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          <Plus size={16} /> New Module
        </button>
      </div>

      {/* KPI as Grade Stamps */}
      {analyticsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: muted }} />
        </div>
      ) : analytics ? (
        <div style={{ display: 'flex', gap: '3rem', justifyContent: 'center', marginBottom: '2.5rem', padding: '1.5rem 0', borderBottom: '1px dashed #ccc' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
              <Clock size={16} style={{ color: muted }} />
              <span style={{ fontSize: '0.8rem', color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Due Today</span>
            </div>
            <GradeStamp value={String(analytics.due_today)} label="cards awaiting" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
              <Flame size={16} style={{ color: muted }} />
              <span style={{ fontSize: '0.8rem', color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Streak</span>
            </div>
            <GradeStamp value={`${analytics.streak}d`} label="consecutive days" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
              <TrendingUp size={16} style={{ color: muted }} />
              <span style={{ fontSize: '0.8rem', color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>Mastery</span>
            </div>
            <GradeStamp value={gradeFromMastery(analytics.overall_mastery)} label={`${Math.round(analytics.overall_mastery)}% overall`} />
          </div>
        </div>
      ) : null}

      {/* Module Book Spines */}
      <div style={{ borderBottom: '1px dashed #ccc', paddingBottom: 8, marginBottom: '1.25rem' }}>
        <h2 style={{ ...serif, fontSize: '1.4rem', fontWeight: 700, color: text }}>Your Modules</h2>
      </div>
      {modulesLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: muted }} />
        </div>
      ) : modules && modules.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {modules.map((mod, i) => (
            <div key={mod.id} onClick={() => navigate(`/modules/${mod.id}`)}
              style={{ background: '#fff', borderRadius: 4, padding: '1.25rem 1.5rem', borderLeft: `5px solid ${mod.color}`, boxShadow: '2px 3px 8px rgba(60,36,21,0.08)', cursor: 'pointer', transform: `rotate(${cardRotation(i)})`, transition: 'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'rotate(0deg) translateY(-2px)'; e.currentTarget.style.boxShadow = '2px 6px 16px rgba(60,36,21,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = `rotate(${cardRotation(i)})`; e.currentTarget.style.boxShadow = '2px 3px 8px rgba(60,36,21,0.08)'; }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <h3 style={{ ...serif, fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{mod.name}</h3>
                <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2px dashed ${mod.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', ...serif, fontSize: '0.7rem', fontWeight: 700, color: mod.color }}>
                  {gradeFromMastery(mod.mastery_pct)}
                </div>
              </div>
              <p style={{ color: muted, fontSize: '0.8rem', borderBottom: '1px dashed #ddd', paddingBottom: 8, marginBottom: 8 }}>
                {mod.description || 'No description yet'}
              </p>
              <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: muted }}>
                <span>{mod.total_cards} cards</span>
                <span>{mod.due_cards} due</span>
                <span>{Math.round(mod.mastery_pct)}% mastery</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: 4, border: '2px dashed #ccc', marginBottom: '2rem' }}>
          <p style={{ ...serif, color: muted, marginBottom: 16, fontStyle: 'italic' }}>Your notebook is empty. Start a new chapter!</p>
          <button onClick={() => setShowCreate(true)}
            style={{ ...serif, background: text, color: bg, border: 'none', borderRadius: 4, padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 600 }}>
            Create First Module
          </button>
        </div>
      )}

      {/* Weakness Spotlight */}
      {weaknessData && weaknessData.concepts.length > 0 && (() => {
        const weakest = [...weaknessData.concepts].sort((a, b) => a.confidence_score - b.confidence_score).slice(0, 3);
        return (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dashed #ccc', paddingBottom: 8, marginBottom: '1rem' }}>
              <h2 style={{ ...serif, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} style={{ color: '#c2410c' }} /> Areas to Review
              </h2>
              <button onClick={() => navigate('/weakness-map')}
                style={{ ...serif, background: 'none', border: 'none', color: text, cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', fontSize: '0.85rem' }}>
                See All →
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {weakest.map(c => (
                <div key={c.id} style={{ background: '#fff', border: '1px dashed #ccc', borderRadius: 4, padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...serif, fontWeight: 600, fontSize: '0.85rem' }}>{c.name}</span>
                  <span style={{ color: '#c2410c', fontSize: '0.75rem', fontWeight: 700 }}>{gradeFromMastery(c.confidence_score)}</span>
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
