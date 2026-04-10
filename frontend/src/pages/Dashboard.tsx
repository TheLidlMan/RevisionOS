import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Flame, TrendingUp, Loader2, AlertTriangle, Timer } from 'lucide-react';
import { getModules, getAnalyticsOverview, getWeaknessMap, getSessionEstimate, getRetentionForecast } from '../api/client';
import CreateModuleModal from '../components/CreateModuleModal';

function MasteryRing({ pct, size = 36 }: { pct: number; size?: number }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color =
    pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--accent)' : 'var(--danger)';
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth={2}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: size * 0.28,
          fontWeight: 300,
          fill: 'var(--text-secondary)',
          fontFamily: 'var(--sans)',
        }}
      >
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

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

  const { data: sessionEstimate } = useQuery({
    queryKey: ['session-estimate'],
    queryFn: () => getSessionEstimate(),
  });

  const { data: retentionForecast } = useQuery({
    queryKey: ['retention-forecast'],
    queryFn: getRetentionForecast,
  });

  const kpiCardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    backdropFilter: 'var(--blur)',
    WebkitBackdropFilter: 'var(--blur)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '28px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  };

  const kpiNumberStyle: React.CSSProperties = {
    fontSize: 48,
    fontWeight: 200,
    fontFamily: 'var(--sans)',
    color: 'var(--text)',
    lineHeight: 1,
    letterSpacing: '-0.03em',
  };

  const kpiLabelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
    color: 'var(--text-tertiary)',
    fontFamily: 'var(--sans)',
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 40,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 28,
              fontWeight: 400,
              color: 'var(--text)',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Dashboard
          </h1>
          <p
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 14,
              fontWeight: 300,
              color: 'var(--text-tertiary)',
              marginTop: 6,
            }}
          >
            Welcome back to RevisionOS
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="scholar-btn"
          style={{ gap: 8 }}
        >
          <Plus style={{ width: 16, height: 16 }} />
          Create Module
        </button>
      </div>

      {/* KPI Cards */}
      {analyticsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Loader2
            style={{
              width: 24,
              height: 24,
              color: 'var(--accent)',
              animation: 'spin 1s linear infinite',
            }}
          />
        </div>
      ) : analytics ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-5"
          style={{ marginBottom: 40 }}
        >
          <div style={kpiCardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Clock style={{ width: 16, height: 16, color: 'var(--accent)' }} />
              <span style={kpiLabelStyle}>Due Today</span>
            </div>
            <span style={kpiNumberStyle}>{analytics.due_today}</span>
          </div>

          <div style={kpiCardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Flame style={{ width: 16, height: 16, color: 'var(--accent)' }} />
              <span style={kpiLabelStyle}>Active Streak</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={kpiNumberStyle}>{analytics.streak}</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 300,
                  color: 'var(--text-tertiary)',
                }}
              >
                days
              </span>
            </div>
          </div>

          <div style={kpiCardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <TrendingUp style={{ width: 16, height: 16, color: 'var(--accent)' }} />
              <span style={kpiLabelStyle}>Overall Mastery</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={kpiNumberStyle}>
                {Math.round(analytics.overall_mastery)}
              </span>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 200,
                  color: 'var(--text-tertiary)',
                }}
              >
                %
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Session Estimator */}
      {sessionEstimate && (
        <div
          style={{
            background: 'rgba(255,248,240,0.04)',
            border: '1px solid rgba(139,115,85,0.15)',
            borderRadius: '12px',
            backdropFilter: 'blur(20px)',
            padding: '20px 24px',
            marginBottom: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: 'rgba(196,149,106,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Timer style={{ width: 20, height: 20, color: '#c4956a' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontFamily: 'var(--sans)',
                fontSize: 14,
                fontWeight: 300,
                color: 'var(--text)',
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              You have <strong style={{ fontWeight: 500 }}>{sessionEstimate.due_cards} due cards</strong>, estimated{' '}
              <strong style={{ fontWeight: 500 }}>{sessionEstimate.estimated_minutes} minutes</strong> at your average pace of{' '}
              {sessionEstimate.avg_seconds_per_card}s/card
            </p>
            <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  color: 'var(--accent)',
                  fontFamily: 'var(--sans)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {sessionEstimate.new_cards} new
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 300,
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--sans)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {sessionEstimate.review_cards} review
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Module Grid heading */}
      <div style={{ marginBottom: 16 }}>
        <h2
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 20,
            fontWeight: 400,
            color: 'var(--text)',
            margin: 0,
          }}
        >
          Your Modules
        </h2>
      </div>

      {modulesLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Loader2
            style={{
              width: 24,
              height: 24,
              color: 'var(--accent)',
              animation: 'spin 1s linear infinite',
            }}
          />
        </div>
      ) : modules && modules.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => navigate(`/modules/${mod.id}`)}
              style={{
                background: 'var(--surface)',
                backdropFilter: 'var(--blur)',
                WebkitBackdropFilter: 'var(--blur)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                borderLeft: `4px solid ${mod.color}`,
                padding: '20px 22px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background 0.2s, border-color 0.2s',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-hover)';
                e.currentTarget.style.borderColor = 'var(--border-focus)';
                e.currentTarget.style.borderLeftColor = mod.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--surface)';
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.borderLeftColor = mod.color;
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      fontFamily: 'var(--serif)',
                      fontSize: 16,
                      fontWeight: 400,
                      color: 'var(--text)',
                      margin: 0,
                    }}
                  >
                    {mod.name}
                  </h3>
                  {mod.description && (
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 300,
                        color: 'var(--text-tertiary)',
                        marginTop: 4,
                        lineHeight: 1.5,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {mod.description}
                    </p>
                  )}
                </div>
                <MasteryRing pct={mod.mastery_pct} />
              </div>

              {/* Stats row */}
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: '1px dashed var(--border)',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 300,
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--sans)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {mod.total_cards} cards
                </span>
                {mod.due_cards > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 400,
                      color: 'var(--accent)',
                      fontFamily: 'var(--sans)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {mod.due_cards} due
                  </span>
                )}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 300,
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--sans)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {Math.round(mod.mastery_pct)}% mastery
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div
          style={{
            background: 'var(--surface)',
            backdropFilter: 'var(--blur)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '64px 24px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 15,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              marginBottom: 20,
            }}
          >
            No modules yet. Create one to get started.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="scholar-btn"
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
          <div style={{ marginTop: 40 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--serif)',
                  fontSize: 20,
                  fontWeight: 400,
                  color: 'var(--text)',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <AlertTriangle
                  style={{ width: 18, height: 18, color: 'var(--accent)' }}
                />
                Weakness Spotlight
              </h2>
              <button
                onClick={() => navigate('/weakness-map')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 300,
                  color: 'var(--accent)',
                  fontFamily: 'var(--sans)',
                }}
              >
                View All →
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {weakest.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background: 'var(--surface)',
                    backdropFilter: 'var(--blur)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 400,
                      color: 'var(--text)',
                      fontFamily: 'var(--sans)',
                    }}
                  >
                    {c.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      background: 'rgba(220, 120, 100, 0.12)',
                      color: 'var(--danger)',
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontWeight: 400,
                      fontFamily: 'var(--sans)',
                    }}
                  >
                    {Math.round(c.confidence_score)}%
                  </span>
                </div>
              ))}
              <button
                onClick={() => navigate('/weakness-map')}
                className="scholar-btn"
              >
                Drill Weakest
              </button>
            </div>
          </div>
        );
      })()}

      {/* Retention Forecast */}
      {retentionForecast && retentionForecast.modules.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 20,
              fontWeight: 400,
              color: 'var(--text)',
              margin: 0,
              marginBottom: 16,
            }}
          >
            Retention Forecast
          </h2>
          <div
            style={{
              background: 'rgba(255,248,240,0.04)',
              border: '1px solid rgba(139,115,85,0.15)',
              borderRadius: '12px',
              backdropFilter: 'blur(20px)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(139,115,85,0.15)' }}>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      fontWeight: 300,
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--sans)',
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Module
                  </th>
                  {[1, 3, 7, 14].map((d) => (
                    <th
                      key={d}
                      style={{
                        textAlign: 'center',
                        padding: '12px 16px',
                        fontWeight: 300,
                        color: 'var(--text-tertiary)',
                        fontFamily: 'var(--sans)',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {d}d
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retentionForecast.modules.map((mod) => (
                  <tr key={mod.module_id} style={{ borderBottom: '1px solid rgba(139,115,85,0.08)' }}>
                    <td
                      style={{
                        padding: '10px 16px',
                        fontWeight: 400,
                        color: 'var(--text)',
                        fontFamily: 'var(--sans)',
                      }}
                    >
                      {mod.module_name}
                    </td>
                    {[1, 3, 7, 14].map((d) => {
                      const forecast = mod.forecasts.find((f) => f.days === d);
                      const pct = forecast?.retention_pct ?? 0;
                      const cellColor =
                        pct >= 80
                          ? 'rgba(120,180,120,0.85)'
                          : pct >= 50
                            ? '#c4956a'
                            : 'rgba(220,120,100,0.8)';
                      const cellBg =
                        pct >= 80
                          ? 'rgba(120,180,120,0.08)'
                          : pct >= 50
                            ? 'rgba(196,149,106,0.08)'
                            : 'rgba(220,120,100,0.08)';
                      return (
                        <td
                          key={d}
                          style={{
                            textAlign: 'center',
                            padding: '10px 16px',
                            fontWeight: 500,
                            color: cellColor,
                            background: cellBg,
                            fontFamily: 'var(--sans)',
                          }}
                        >
                          {Math.round(pct)}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateModuleModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}