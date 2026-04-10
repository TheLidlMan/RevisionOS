import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, Flame, Loader2 } from 'lucide-react';
import { getLeaderboard } from '../api/client';
import { useAuthStore } from '../store/auth';

export default function LeaderboardPage() {
  const [timeframe, setTimeframe] = useState('all');
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', timeframe],
    queryFn: () => getLeaderboard(timeframe),
  });

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold">Leaderboard</h1>
      </div>

      {/* Timeframe filter */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'all', label: 'All Time' },
          { key: 'month', label: 'This Month' },
          { key: 'week', label: 'This Week' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTimeframe(key)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              timeframe === key
                ? 'bg-teal text-white'
                : 'bg-navy-lighter border border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {data?.your_rank && (
        <div className="bg-teal/10 border border-teal/20 rounded-xl p-4 mb-6">
          <p className="text-teal text-sm font-medium">Your Rank: #{data.your_rank}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-teal" />
        </div>
      ) : data?.entries?.length ? (
        <div className="bg-navy-light rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-4 py-3 font-medium w-16">Rank</th>
                <th className="text-left px-4 py-3 font-medium">Student</th>
                <th className="text-center px-4 py-3 font-medium">Streak</th>
                <th className="text-center px-4 py-3 font-medium">Mastery</th>
                <th className="text-center px-4 py-3 font-medium">Reviews</th>
                <th className="text-center px-4 py-3 font-medium">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry: { rank: number; user_id: string; display_name: string; streak: number; mastery_pct: number; total_reviews: number; total_sessions: number }) => {
                const isYou = user?.id === entry.user_id;
                return (
                  <tr
                    key={entry.user_id}
                    className={`border-b border-gray-800/50 last:border-b-0 ${isYou ? 'bg-teal/5' : ''}`}
                  >
                    <td className="px-4 py-3">
                      {entry.rank <= 3 ? (
                        <Medal className={`w-5 h-5 ${entry.rank === 1 ? 'text-yellow-400' : entry.rank === 2 ? 'text-gray-300' : 'text-amber-600'}`} />
                      ) : (
                        <span className="text-gray-400">{entry.rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {entry.display_name} {isYou && <span className="text-teal text-xs ml-1">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-orange-400" />
                        {entry.streak}d
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={entry.mastery_pct >= 80 ? 'text-green-400' : entry.mastery_pct >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                        {Math.round(entry.mastery_pct)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-300">{entry.total_reviews.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-gray-300">{entry.total_sessions}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-navy-light rounded-xl border border-gray-800">
          <p className="text-gray-400">No activity yet. Start studying to appear on the leaderboard!</p>
        </div>
      )}
    </div>
  );
}
