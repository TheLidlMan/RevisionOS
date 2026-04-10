import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Flame, Loader2 } from 'lucide-react';
import { getLeaderboard } from '../api/client';
import { useAuthStore } from '../store/auth';

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

const tokens = {
  text: '#f5f0e8',
  secondary: 'rgba(245,240,232,0.5)',
  tertiary: 'rgba(245,240,232,0.25)',
  accent: '#c4956a',
  accentSoft: 'rgba(196,149,106,0.15)',
  serif: "'Clash Display', sans-serif",
  danger: 'rgba(220,120,100,0.8)',
  success: 'rgba(120,180,120,0.8)',
  hover: 'rgba(255,248,240,0.08)',
} as const;

export default function LeaderboardPage() {
  const [timeframe, setTimeframe] = useState('all');
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', timeframe],
    queryFn: () => getLeaderboard(timeframe),
  });

  const rankColor = (rank: number) => {
    if (rank === 1) return tokens.accent;
    if (rank === 2) return 'rgba(196,149,106,0.7)';
    return 'rgba(196,149,106,0.5)';
  };

  const masteryColor = (pct: number) => {
    if (pct >= 80) return tokens.success;
    if (pct >= 50) return tokens.accent;
    return tokens.danger;
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto w-full" style={{ color: tokens.text, fontWeight: 300 }}>
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="w-6 h-6" style={{ color: tokens.accent }} />
        <h1 className="text-2xl" style={{ fontFamily: tokens.serif, fontWeight: 600, color: tokens.text }}>
          Leaderboard
        </h1>
      </div>

      <div className="flex gap-2 mb-6">
        {[
          { key: 'all', label: 'All Time' },
          { key: 'month', label: 'This Month' },
          { key: 'week', label: 'This Week' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTimeframe(key)}
            className="px-4 py-2 text-sm transition-colors"
            style={
              timeframe === key
                ? { background: tokens.accent, color: '#1a1714', borderRadius: '8px', fontWeight: 500 }
                : { ...glass, borderRadius: '8px', color: tokens.secondary }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {data?.your_rank && (
        <div className="p-4 mb-6" style={{ background: tokens.accentSoft, border: `1px solid rgba(196,149,106,0.25)`, borderRadius: '12px' }}>
          <p className="text-sm" style={{ color: tokens.accent, fontWeight: 500 }}>Your Rank: #{data.your_rank}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: tokens.accent }} />
        </div>
      ) : data?.entries?.length ? (
        <div className="overflow-hidden" style={{ ...glass }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(139,115,85,0.15)' }}>
                <th className="text-left px-4 py-3 w-16" style={{ fontWeight: 500, color: tokens.secondary }}>Rank</th>
                <th className="text-left px-4 py-3" style={{ fontWeight: 500, color: tokens.secondary }}>Student</th>
                <th className="text-center px-4 py-3" style={{ fontWeight: 500, color: tokens.secondary }}>Streak</th>
                <th className="text-center px-4 py-3" style={{ fontWeight: 500, color: tokens.secondary }}>Mastery</th>
                <th className="text-center px-4 py-3" style={{ fontWeight: 500, color: tokens.secondary }}>Reviews</th>
                <th className="text-center px-4 py-3" style={{ fontWeight: 500, color: tokens.secondary }}>Sessions</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry: { rank: number; user_id: string; display_name: string; streak: number; mastery_pct: number; total_reviews: number; total_sessions: number }) => {
                const isYou = user?.id === entry.user_id;
                return (
                  <tr
                    key={entry.user_id}
                    style={{
                      borderBottom: '1px solid rgba(139,115,85,0.08)',
                      background: isYou ? tokens.accentSoft : 'transparent',
                    }}
                  >
                    <td className="px-4 py-3">
                      {entry.rank <= 3 ? (
                        <span style={{ fontFamily: tokens.serif, fontSize: '1.25rem', fontWeight: 700, color: rankColor(entry.rank) }}>
                          {entry.rank}
                        </span>
                      ) : (
                        <span style={{ color: tokens.secondary }}>{entry.rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ fontWeight: 400, color: tokens.text }}>
                      {entry.display_name} {isYou && <span className="text-xs ml-1" style={{ color: tokens.accent }}>(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1" style={{ color: tokens.text }}>
                        <Flame className="w-3.5 h-3.5" style={{ color: tokens.accent }} />
                        {entry.streak}d
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span style={{ color: masteryColor(entry.mastery_pct), fontWeight: 500 }}>
                        {Math.round(entry.mastery_pct)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: tokens.secondary }}>{entry.total_reviews.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center" style={{ color: tokens.secondary }}>{entry.total_sessions}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12" style={{ ...glass }}>
          <p style={{ color: tokens.secondary }}>No activity yet. Start studying to appear on the leaderboard!</p>
        </div>
      )}
    </div>
  );
}
