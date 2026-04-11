import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, Trophy, Activity, Loader2 } from 'lucide-react';
import { getStreaks, getPerformanceOverTime, getSessions, getMasteryHeatmap, getCalibration } from '../api/client';

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

  const { data: heatmapData } = useQuery({
    queryKey: ['mastery-heatmap'],
    queryFn: () => getMasteryHeatmap(90),
  });

  const { data: calibrationData } = useQuery({
    queryKey: ['calibration'],
    queryFn: getCalibration,
  });

  const isLoading = streaksLoading || perfLoading;

  // Build 90-day heatmap grid (7 rows × ~13 cols, GitHub-style)
  const heatmapGrid = useMemo(() => {
    if (!heatmapData?.days) return [];
    const dayMap = new Map(heatmapData.days.map((d) => [d.date, d]));
    const today = new Date();
    const totalDays = 91;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - totalDays + 1);
    // Adjust start to the previous Monday
    while (startDate.getDay() !== 1) {
      startDate.setDate(startDate.getDate() - 1);
    }
    const weeks: { date: string; gain: number; sessions: number; items: number }[][] = [];
    const current = new Date(startDate);
    let week: { date: string; gain: number; sessions: number; items: number }[] = [];
    while (current <= today) {
      const iso = current.toISOString().slice(0, 10);
      const entry = dayMap.get(iso);
      week.push({
        date: iso,
        gain: entry?.mastery_gain ?? 0,
        sessions: entry?.sessions_count ?? 0,
        items: entry?.items_reviewed ?? 0,
      });
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
      current.setDate(current.getDate() + 1);
    }
    if (week.length > 0) weeks.push(week);
    return weeks;
  }, [heatmapData]);

  const maxGain = useMemo(() => {
    if (!heatmapData?.days) return 1;
    return Math.max(1, ...heatmapData.days.map((d) => d.mastery_gain));
  }, [heatmapData]);

  function heatmapColor(gain: number): string {
    if (gain === 0) return 'rgba(255,248,240,0.04)';
    const ratio = gain / maxGain;
    if (ratio <= 0.25) return 'rgba(196,149,106,0.2)';
    if (ratio <= 0.5) return 'rgba(196,149,106,0.5)';
    if (ratio <= 0.75) return 'rgba(196,149,106,0.8)';
    return '#c4956a';
  }

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

          {/* Mastery Heatmap */}
          <div className="mb-8">
            <h2
              style={{ fontFamily: "'Clash Display', sans-serif", color: '#f5f0e8' }}
              className="text-lg mb-4"
            >
              Mastery Heatmap
            </h2>
            <div style={glass} className="p-5">
              {heatmapGrid.length > 0 ? (
                <>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {/* Day labels */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingRight: 6 }}>
                      {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((label, i) => (
                        <div
                          key={i}
                          style={{
                            width: 24,
                            height: 14,
                            fontSize: '9px',
                            color: 'rgba(245,240,232,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                          }}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                    {/* Heatmap grid: each column is a week */}
                    {heatmapGrid.map((week, wi) => (
                      <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {week.map((day) => (
                          <div
                            key={day.date}
                            title={`${day.date}: +${day.gain.toFixed(1)} mastery, ${day.sessions} sessions, ${day.items} items`}
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '3px',
                              background: heatmapColor(day.gain),
                              transition: 'background 0.2s',
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-3" style={{ fontSize: '0.75rem', color: 'rgba(245,240,232,0.25)' }}>
                    <span>Less</span>
                    <div style={{ width: 12, height: 12, borderRadius: '3px', background: 'rgba(255,248,240,0.04)' }} />
                    <div style={{ width: 12, height: 12, borderRadius: '3px', background: 'rgba(196,149,106,0.2)' }} />
                    <div style={{ width: 12, height: 12, borderRadius: '3px', background: 'rgba(196,149,106,0.5)' }} />
                    <div style={{ width: 12, height: 12, borderRadius: '3px', background: 'rgba(196,149,106,0.8)' }} />
                    <div style={{ width: 12, height: 12, borderRadius: '3px', background: '#c4956a' }} />
                    <span>More</span>
                  </div>
                </>
              ) : (
                <p style={{ color: 'rgba(245,240,232,0.35)', fontWeight: 300, fontSize: '0.85rem' }}>No heatmap data available.</p>
              )}
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

          {/* Confidence Calibration */}
          {calibrationData && calibrationData.calibration.length > 0 && (
            <div className="mb-8">
              <h2
                style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8' }}
                className="text-lg mb-4"
              >
                Confidence Calibration
              </h2>
              <div style={glass} className="p-5">
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 300, color: 'rgba(245,240,232,0.5)' }}>Overall Accuracy:</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#f5f0e8' }}>{Math.round(calibrationData.overall_accuracy)}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 300, color: 'rgba(245,240,232,0.5)' }}>Overconfidence Score:</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, color: calibrationData.overconfidence_score > 10 ? 'rgba(220,120,100,0.8)' : '#c4956a' }}>
                      {calibrationData.overconfidence_score.toFixed(1)}
                    </span>
                  </div>
                </div>
                {/* Bar chart: predicted vs actual for each confidence level */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, height: 160, paddingBottom: 24, borderBottom: '1px solid rgba(139,115,85,0.1)' }}>
                  {calibrationData.calibration.map((point) => {
                    const barHeight = 120;
                    const predictedH = (point.predicted_pct / 100) * barHeight;
                    const actualH = (point.actual_pct / 100) * barHeight;
                    return (
                      <div key={point.confidence_level} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: barHeight }}>
                          <div
                            title={`Predicted: ${Math.round(point.predicted_pct)}%`}
                            style={{
                              width: 18,
                              height: predictedH,
                              background: 'rgba(196,149,106,0.35)',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.3s',
                            }}
                          />
                          <div
                            title={`Actual: ${Math.round(point.actual_pct)}%`}
                            style={{
                              width: 18,
                              height: actualH,
                              background: '#c4956a',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.3s',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'rgba(245,240,232,0.4)', fontWeight: 300 }}>
                          Lvl {point.confidence_level}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'rgba(245,240,232,0.25)', fontWeight: 300 }}>
                          n={point.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3" style={{ fontSize: '0.75rem', color: 'rgba(245,240,232,0.35)' }}>
                  <div className="flex items-center gap-1.5">
                    <div style={{ width: 12, height: 12, borderRadius: '3px', background: 'rgba(196,149,106,0.35)' }} />
                    <span>Predicted</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div style={{ width: 12, height: 12, borderRadius: '3px', background: '#c4956a' }} />
                    <span>Actual</span>
                  </div>
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
