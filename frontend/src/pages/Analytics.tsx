import { useQuery } from '@tanstack/react-query';
import { Flame, Trophy, Activity, Loader2 } from 'lucide-react';
import { getStreaks, getPerformanceOverTime, getSessions } from '../api/client';

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
        <Activity className="w-6 h-6 text-teal" />
        <h1 className="text-2xl font-bold">Analytics</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-teal" />
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-navy-light rounded-xl border border-gray-800 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <span className="text-sm text-gray-400">Current Streak</span>
              </div>
              <p className="text-3xl font-bold">
                {streaks?.current_streak ?? 0}{' '}
                <span className="text-base text-gray-500 font-normal">days</span>
              </p>
            </div>

            <div className="bg-navy-light rounded-xl border border-gray-800 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                </div>
                <span className="text-sm text-gray-400">Longest Streak</span>
              </div>
              <p className="text-3xl font-bold">
                {streaks?.longest_streak ?? 0}{' '}
                <span className="text-base text-gray-500 font-normal">days</span>
              </p>
            </div>

            <div className="bg-navy-light rounded-xl border border-gray-800 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-teal" />
                </div>
                <span className="text-sm text-gray-400">Sessions (30d)</span>
              </div>
              <p className="text-3xl font-bold">{sessionsLast30}</p>
            </div>
          </div>

          {/* Activity grid */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Activity (Last 30 Days)</h2>
            <div className="bg-navy-light rounded-xl border border-gray-800 p-5">
              <div className="flex flex-wrap gap-1.5">
                {last30Days.map((day, i) => (
                  <div
                    key={i}
                    title={`${day.date}: ${day.sessions} session${day.sessions !== 1 ? 's' : ''}`}
                    className={`w-7 h-7 rounded-md transition-colors ${
                      day.active
                        ? day.sessions >= 3
                          ? 'bg-green-500'
                          : day.sessions >= 2
                            ? 'bg-green-500/70'
                            : 'bg-green-500/40'
                        : 'bg-navy-lighter'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-navy-lighter" />
                <div className="w-3 h-3 rounded-sm bg-green-500/40" />
                <div className="w-3 h-3 rounded-sm bg-green-500/70" />
                <div className="w-3 h-3 rounded-sm bg-green-500" />
                <span>More</span>
              </div>
            </div>
          </div>

          {/* Performance chart */}
          {performance && performance.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Performance Over Time</h2>
              <div className="bg-navy-light rounded-xl border border-gray-800 p-5">
                <svg viewBox={`0 0 ${performance.length * 40} 160`} className="w-full h-40">
                  {/* Y-axis guide lines */}
                  {[0, 25, 50, 75, 100].map((v) => (
                    <line
                      key={v}
                      x1={0}
                      y1={150 - v * 1.4}
                      x2={performance.length * 40}
                      y2={150 - v * 1.4}
                      stroke="#21262d"
                      strokeWidth={1}
                    />
                  ))}
                  {/* Bars */}
                  {performance.map((p, i) => {
                    const score = p.avg_score ?? 0;
                    const barHeight = score * 1.4;
                    return (
                      <g key={i}>
                        <rect
                          x={i * 40 + 8}
                          y={150 - barHeight}
                          width={24}
                          height={barHeight}
                          rx={4}
                          fill="#00b4d8"
                          opacity={0.8}
                        />
                        <text
                          x={i * 40 + 20}
                          y={158}
                          textAnchor="middle"
                          className="text-[8px] fill-gray-500"
                        >
                          {new Date(p.date).getDate()}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="flex justify-between text-xs text-gray-500 mt-1 px-2">
                  <span>Score (0-100)</span>
                  <span>Day of month</span>
                </div>
              </div>
            </div>
          )}

          {/* Sessions table */}
          {sessions && sessions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Recent Sessions</h2>
              <div className="bg-navy-light rounded-xl border border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="text-left px-4 py-3 font-medium">Date</th>
                      <th className="text-left px-4 py-3 font-medium">Module</th>
                      <th className="text-left px-4 py-3 font-medium">Type</th>
                      <th className="text-right px-4 py-3 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b border-gray-800/50 last:border-b-0">
                        <td className="px-4 py-3 text-gray-400">
                          {new Date(s.started_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-white">{s.module_name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-400 uppercase text-xs">{s.session_type}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          <span className={s.score_pct >= 70 ? 'text-green-400' : s.score_pct >= 50 ? 'text-yellow-400' : 'text-red-400'}>
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
