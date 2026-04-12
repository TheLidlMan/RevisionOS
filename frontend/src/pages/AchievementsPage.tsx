import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trophy, Target, Heart } from '@phosphor-icons/react';
import { getGamificationStats, getAchievements, updateDailyGoal, toggleHearts } from '../api/client';
import type { UserStats, AchievementDef } from '../types';
import Skeleton from '../components/Skeleton';
import MasteryRing from '../components/MasteryRing';
import { useState } from 'react';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

export default function AchievementsPage() {
  const queryClient = useQueryClient();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['gamification-stats'],
    queryFn: getGamificationStats,
  });

  const { data: achievements, isLoading: achLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: getAchievements,
  });

  const dailyGoalMutation = useMutation({
    mutationFn: (target: number) => updateDailyGoal(target),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification-stats'] });
      setEditingGoal(false);
    },
  });

  const heartToggleMutation = useMutation({
    mutationFn: (enabled: boolean) => toggleHearts(enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gamification-stats'] }),
  });

  const unlockedCount = achievements?.filter((a) => a.unlocked).length || 0;
  const totalCount = achievements?.length || 0;

  if (statsLoading || achLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="p-5" style={glass}>
              <Skeleton className="h-6 w-20 mb-3" />
              <Skeleton className="h-10 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full">
      <h1 className="text-[1.55rem] sm:text-[1.9rem] mb-2" style={{ fontFamily: 'var(--heading)', color: 'var(--text)' }}>
        Achievements & Stats
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }} className="mb-6">
        Track your progress, streaks, and unlocked achievements.
      </p>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {/* Streak */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5" style={glass}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: '1.2rem' }}>🔥</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Streak
              </span>
            </div>
            <p style={{ color: 'var(--text)', fontSize: '2rem', fontWeight: 300 }}>{stats.streak_current}</p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>Best: {stats.streak_longest}</p>
          </motion.div>

          {/* Level & XP */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="p-5" style={glass}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: '1.2rem' }}>⭐</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Level
              </span>
            </div>
            <p style={{ color: 'var(--accent)', fontSize: '2rem', fontWeight: 300 }}>{stats.level}</p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>{stats.xp_total} XP total</p>
          </motion.div>

          {/* Cards Reviewed */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-5" style={glass}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: '1.2rem' }}>📚</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Reviews
              </span>
            </div>
            <p style={{ color: 'var(--text)', fontSize: '2rem', fontWeight: 300 }}>{stats.total_cards_reviewed}</p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>{stats.total_quizzes_completed} quizzes</p>
          </motion.div>

          {/* Achievements Progress */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="p-5" style={glass}>
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={18} style={{ color: 'var(--accent)' }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Trophies
              </span>
            </div>
            <p style={{ color: 'var(--text)', fontSize: '2rem', fontWeight: 300 }}>{unlockedCount}/{totalCount}</p>
          </motion.div>
        </div>
      )}

      {/* Settings: Daily Goal & Hearts */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Daily Goal */}
          <div className="p-5" style={glass}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target size={18} style={{ color: 'var(--accent)' }} />
                <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: '0.95rem' }}>Daily Goal</span>
              </div>
              <button
                onClick={() => {
                  setGoalInput(String(stats.daily_goal_target));
                  setEditingGoal(!editingGoal);
                }}
                style={{ color: 'var(--accent)', fontSize: '0.8rem' }}
              >
                {editingGoal ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {editingGoal ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  min="1"
                  max="500"
                  className="flex-1 px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(139,115,85,0.1)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
                <button
                  onClick={() => dailyGoalMutation.mutate(parseInt(goalInput) || 20)}
                  className="scholar-btn px-4 py-2"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <MasteryRing
                  percentage={(stats.daily_goal_completed / Math.max(stats.daily_goal_target, 1)) * 100}
                  size={56}
                  strokeWidth={4}
                />
                <div>
                  <p style={{ color: 'var(--text)', fontWeight: 500 }}>
                    {stats.daily_goal_completed} / {stats.daily_goal_target} cards
                  </p>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                    {stats.daily_goal_completed >= stats.daily_goal_target ? '🎉 Goal reached!' : 'Keep going!'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Hearts Toggle */}
          <div className="p-5" style={glass}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Heart size={18} weight="fill" style={{ color: '#dc7864' }} />
                <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: '0.95rem' }}>Hearts System</span>
              </div>
              <button
                onClick={() => heartToggleMutation.mutate(!stats.hearts_enabled)}
                className="px-3 py-1 rounded-lg text-sm"
                style={{
                  background: stats.hearts_enabled ? 'rgba(220,120,100,0.15)' : 'rgba(139,115,85,0.1)',
                  color: stats.hearts_enabled ? '#dc7864' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                {stats.hearts_enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {stats.hearts_enabled
                ? `${stats.hearts_remaining}/15 hearts remaining. Wrong answers cost 1 heart.`
                : 'Hearts are disabled. Enable for Duolingo-style challenge.'}
            </p>
          </div>
        </div>
      )}

      {/* Achievements Grid */}
      <h2 className="mb-4" style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.2rem' }}>
        All Achievements ({unlockedCount}/{totalCount})
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {achievements?.map((ach, i) => (
          <motion.div
            key={ach.achievement_key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="p-4"
            style={{
              ...glass,
              opacity: ach.unlocked ? 1 : 0.5,
              borderColor: ach.unlocked ? 'rgba(196,149,106,0.3)' : 'var(--border)',
            }}
          >
            <div className="flex items-center gap-3">
              <span style={{ fontSize: '1.5rem', filter: ach.unlocked ? 'none' : 'grayscale(1)' }}>
                {ach.icon}
              </span>
              <div>
                <p style={{ color: ach.unlocked ? 'var(--text)' : 'var(--text-tertiary)', fontWeight: 500, fontSize: '0.9rem' }}>
                  {ach.name}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                  {ach.description}
                </p>
                {ach.unlocked && ach.unlocked_at && (
                  <p style={{ color: 'var(--accent)', fontSize: '0.7rem', marginTop: 2 }}>
                    ✓ Unlocked
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
