import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { getGamificationStats } from '../api/client';
import { usePageVisibility } from '../hooks/usePageVisibility';
import type { UserStats } from '../types';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

function XPProgressBar({ stats }: { stats: UserStats }) {
  const xpInLevel = stats.xp_total - stats.xp_for_current_level;
  const xpNeeded = stats.xp_for_next_level - stats.xp_for_current_level;
  const pct = xpNeeded > 0 ? Math.min((xpInLevel / xpNeeded) * 100, 100) : 100;

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <span
        style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem' }}
        title={`Level ${stats.level}`}
      >
        Lv.{stats.level}
      </span>
      <div
        className="flex-1 overflow-hidden"
        style={{ height: '6px', background: 'rgba(196,149,106,0.15)', borderRadius: '4px' }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ height: '100%', background: 'var(--accent)', borderRadius: '4px' }}
        />
      </div>
      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
        {stats.xp_total} XP
      </span>
    </div>
  );
}

function DailyGoalRing({ completed, target }: { completed: number; target: number }) {
  const pct = target > 0 ? Math.min(completed / target, 1) : 0;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  return (
    <div className="flex items-center gap-1.5" title={`Daily goal: ${completed}/${target} cards`}>
      <svg width="38" height="38" viewBox="0 0 38 38" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="19" cy="19" r={radius} fill="none" stroke="rgba(196,149,106,0.15)" strokeWidth="3" />
        <motion.circle
          cx="19"
          cy="19"
          r={radius}
          fill="none"
          stroke={pct >= 1 ? '#78b478' : 'var(--accent)'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div style={{ lineHeight: 1.1 }}>
        <span style={{ color: pct >= 1 ? '#78b478' : 'var(--text)', fontWeight: 500, fontSize: '0.8rem' }}>
          {completed}
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>/{target}</span>
      </div>
    </div>
  );
}

function HeartsDisplay({ hearts, enabled }: { hearts: number; enabled: boolean }) {
  if (!enabled) return null;
  const maxHearts = 15;
  // Show compact: filled count / max
  return (
    <div className="flex items-center gap-1" title={`${hearts}/${maxHearts} hearts remaining`}>
      <span style={{ fontSize: '1rem' }}>❤️</span>
      <span style={{ color: hearts > 3 ? 'var(--text)' : '#dc7864', fontWeight: 500, fontSize: '0.85rem' }}>
        {hearts}
      </span>
    </div>
  );
}

export default function GamificationBar() {
  const isPageVisible = usePageVisibility();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['gamification-stats'],
    queryFn: getGamificationStats,
    refetchInterval: isPageVisible ? 30000 : false,
  });

  if (isLoading || !stats) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div
        className="flex flex-wrap items-center gap-4 sm:gap-6 px-5 py-3.5"
        style={glass}
      >
        {/* Streak */}
        <div className="flex items-center gap-1.5" title={`${stats.streak_current}-day streak (best: ${stats.streak_longest})`}>
          <span style={{ fontSize: '1.1rem' }}>🔥</span>
          <span style={{ color: stats.streak_current > 0 ? 'var(--text)' : 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.95rem' }}>
            {stats.streak_current}
          </span>
        </div>

        {/* XP + Level */}
        <XPProgressBar stats={stats} />

        {/* Daily Goal Ring */}
        <DailyGoalRing completed={stats.daily_goal_completed} target={stats.daily_goal_target} />

        {/* Hearts */}
        <HeartsDisplay hearts={stats.hearts_remaining} enabled={stats.hearts_enabled} />
      </div>
    </motion.div>
  );
}
