import { useQuery } from '@tanstack/react-query';
import { Flame, Trophy, Activity, Loader2 } from 'lucide-react';
import { getStreaks, getPerformanceOverTime, getSessions } from '../api/client';

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

export default function Analytics() {
  const { data: streaks, isLoading: streaksLoading } = useQuery({
    queryKey: ['streaks'],
    queryFn: getStreaks,
  });

  const { data: performance, isLoading: perfLoading } = useQuery({
    queryKey: ['performance'],
    queryFn: () => getPerformanceOverTime(undefined, 30),
  });

  const { data: sessions } = useQuery({
    queryKey: ['sessions-recent'],
    queryFn: () => getSessions({ limit: 20 }),
  });

  const isLoading = streaksLoading || perfLoading;

  const last30Days = streaks?.daily_activity?.slice(-30) ?? [];
  const sessionsLast30 = last30Days.reduce((sum, d) => sum + d.sessions, 0);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <Activity className="w-6 h-6" style={{ color: '#c4956a' }} />
        <h1
          style={{ fontFamily: "'Clash Display', sans-serif", color: '#f5f0e8', fontWeight: 600 }}
          className="text-2xl"
        >
          Analytics
        </h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#c4956a' }} />
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div style={glass} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(196,149,106,0.15)' }}
                >
                  <Flame className="w-5 h-5" style={{ color: '#c4956a' }} />
                </div>
                <span style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }}>Current Streak</span>
              </div>
              <p style={{ color: '#f5f0e8', fontWeight: 200, fontSize: '3rem', lineHeight: 1 }}>
                {streaks?.current_streak ?? 0}{' '}
                <span style={{ fontSize: '1rem', color: 'rgba(245,240,232,0.25)', fontWeight: 300 }}>days</span>
              </p>
            </div>

            <div style={glass} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(196,149,106,0.15)' }}
                >
                  <Trophy className="w-5 h-5" style={{ color: '#c4956a' }} />
                </div>
                <span style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }}>Longest Streak</span>
              </div>
              <p style={{ color: '#f5f0e8', fontWeight: 200, fontSize: '3rem', lineHeight: 1 }}>
                {streaks?.longest_streak ?? 0}{' '}
                <span style={{ fontSize: '1rem', color: 'rgba(245,240,232,0.25)', fontWeight: 300 }}>days</span>
              </p>
            </div>

            <div style={glass} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(196,149,106,0.15)' }}
                >
                  <Activity className="w-5 h-5" style={{ color: '#c4956a' }} />
                </div>
                <span style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }}>Sessions (30d)</span>
              </div>
              <p style={{ color: '#f5f0e8', fontWeight: 200, fontSize: '3rem', lineHeight: 1 }}>{sessionsLast30}</p>
            </div>
          </div>

          {/* Activity grid */}
          <div className="mb-8">
            <h2
              style={{ fontFamily: "'Clash Display', sans-serif", color: '#f5f0e8' }}
              className="text-lg mb-4"
            >
              Activity (Last 30 Days)
            </h2>
            <div style={glass} className="p-5">
              <div className="flex flex-wrap gap-1.5">
                {last30Days.map((day, i) => {
                  let bg = 'rgba(255,248,240,0.04)';
                  if (day.active) {
                    if (day.sessions >= 3) bg = '#c4956a';
                    else if (day.sessions >= 2) bg = 'rgba(196,149,106,0.6)';
                    else bg = 'rgba(196,149,106,0.3)';
                  }
                  return (
                    <div
                      key={i}
                      title={`${day.date}: ${day.sessions} session${day.sessions !== 1 ? 's' : ''}`}
                      style={{ width: 28, height: 28, borderRadius: '6px', background: bg, transition: 'background 0.2s' }}
                    />
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-3" style={{ fontSize: '0.75rem', color: 'rgba(245,240,232,0.25)' }}>
                <span>Less</span>
                <div style={{ width: 12, height: 12, borderRadius: '3px', background: 'rgba(255,248,240,0.04)' }} />
                <div style={{ width: 12, height: 12, borderRadius: '3px', background: 'rgba(196,149,106,0.3)' }} />
                <div style={{ width: 12, height: 12, borderRadius: '3px', background: 'rgba(196,149,106,0.6)' }} />
                <div style={{ width: 12, height: 12, borderRadius: '3px', background: '#c4956a' }} />
                <span>More</span>
              </div>
            </div>
          </div>

          {/* Performance chart */}
          {performance && performance.length > 0 && (
            <div className="mb-8">
              <h2
                style={{ fontFamily: "'Clash Display', sans-serif", color: '#f5f0e8' }}
                className="text-lg mb-4"
              >
                Performance Over Time
              </h2>
              <div style={glass} className="p-5">
                <svg viewBox={`0 0 ${performance.length * 40} 160`} className="w-full h-40">
                  {/* Y-axis guide lines */}
                  {[0, 25, 50, 75, 100].map((v) => (
                    <line
                      key={v}
                      x1={0}
                      y1={150 - v * 1.4}
                      x2={performance.length * 40}
                      y2={150 - v * 1.4}
                      stroke="rgba(139,115,85,0.1)"
                      strokeWidth={1}
                    />
                  ))}
                  {/* Line chart */}
                  {performance.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#c4956a"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={performance.map((p, i) => `${i * 40 + 20},${150 - (p.avg_score ?? 0) * 1.4}`).join(' ')}
                    />
                  )}
                  {/* Area fill */}
                  {performance.length > 1 && (
                    <polygon
                      fill="rgba(196,149,106,0.1)"
                      points={`${20},${150} ${performance.map((p, i) => `${i * 40 + 20},${150 - (p.avg_score ?? 0) * 1.4}`).join(' ')} ${(performance.length - 1) * 40 + 20},${150}`}
                    />
                  )}
                  {/* Data points */}
                  {performance.map((p, i) => {
                    const score = p.avg_score ?? 0;
                    const y = 150 - score * 1.4;
                    return (
                      <g key={i}>
                        <circle
                          cx={i * 40 + 20}
                          cy={y}
                          r={4}
                          fill="#c4956a"
                          opacity={0.9}
                        />
                        <text
                          x={i * 40 + 20}
                          y={158}
                          textAnchor="middle"
                          fill="rgba(245,240,232,0.25)"
                          style={{ fontSize: '8px' }}
                        >
                          {new Date(p.date).getDate()}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="flex justify-between mt-1 px-2" style={{ fontSize: '0.75rem', color: 'rgba(245,240,232,0.25)' }}>
                  <span>Score (0-100)</span>
                  <span>Day of month</span>
                </div>
              </div>
            </div>
          )}

          {/* Sessions table */}
          {sessions && sessions.length > 0 && (
            <div>
              <h2
                style={{ fontFamily: "'Clash Display', sans-serif", color: '#f5f0e8' }}
                className="text-lg mb-4"
              >
                Recent Sessions
              </h2>
              <div style={{ ...glass, overflow: 'hidden' }}>
                <table className="w-full" style={{ fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(139,115,85,0.15)' }}>
                      <th style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }} className="text-left px-4 py-3">Date</th>
                      <th style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }} className="text-left px-4 py-3">Module</th>
                      <th style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }} className="text-left px-4 py-3">Type</th>
                      <th style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }} className="text-right px-4 py-3">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid rgba(139,115,85,0.08)' }}>
                        <td className="px-4 py-3" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>
                          {new Date(s.started_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3" style={{ color: '#f5f0e8', fontWeight: 300 }}>{s.module_name ?? '—'}</td>
                        <td className="px-4 py-3" style={{ color: 'rgba(245,240,232,0.5)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 300 }}>{s.session_type}</td>
                        <td className="px-4 py-3 text-right" style={{ fontWeight: 500 }}>
                          <span style={{ color: s.score_pct >= 70 ? 'rgba(120,180,120,0.9)' : s.score_pct >= 50 ? '#c4956a' : 'rgba(220,120,100,0.8)' }}>
                            {Math.round(s.score_pct)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
