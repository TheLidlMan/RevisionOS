import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Target, Heart, Sparkle } from '@phosphor-icons/react';
import confetti from 'canvas-confetti';
import { getGamificationStats, getAchievements, updateDailyGoal, toggleHearts } from '../api/client';
import Skeleton from '../components/Skeleton';
import MasteryRing from '../components/MasteryRing';
import { usePersistentState } from '../hooks/usePersistentState';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

const tierOrder = { bronze: 0, silver: 1, gold: 2, legendary: 3 } as const;
const RECENT_UNLOCK_WINDOW_MS = 36 * 60 * 60 * 1000;

export default function AchievementsPage() {
  const queryClient = useQueryClient();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [sortBy, setSortBy] = useState<'progress' | 'recent' | 'name' | 'tier'>('progress');
  const [celebratedKeys, setCelebratedKeys] = usePersistentState<string[]>('achievements:celebrated', []);
  const [mountedAt] = useState(() => Date.now());

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['gamification-stats'],
    queryFn: getGamificationStats,
  });

  const { data: achievements, isLoading: achievementsLoading } = useQuery({
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

  const unlockedCount = achievements?.filter((achievement) => achievement.unlocked).length || 0;
  const totalCount = achievements?.length || 0;
  const categories = useMemo(
    () => ['all', ...new Set((achievements || []).map((achievement) => achievement.category || 'general'))],
    [achievements],
  );

  const recentlyUnlocked = useMemo(() => {
    return (achievements || []).filter((achievement) => {
      if (!achievement.unlocked || !achievement.unlocked_at || celebratedKeys.includes(achievement.achievement_key)) {
        return false;
      }
      return mountedAt - new Date(achievement.unlocked_at).getTime() <= RECENT_UNLOCK_WINDOW_MS;
    });
  }, [achievements, celebratedKeys, mountedAt]);

  useEffect(() => {
    if (recentlyUnlocked.length === 0) {
      return;
    }
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 }, colors: ['#c4956a', '#f5f0e8', '#78b478'] });
    setCelebratedKeys((current) => [...new Set([...current, ...recentlyUnlocked.map((achievement) => achievement.achievement_key)])]);
  }, [recentlyUnlocked, setCelebratedKeys]);

  const levelProgress = stats
    ? ((stats.xp_total - stats.xp_for_current_level) / Math.max(stats.xp_for_next_level - stats.xp_for_current_level, 1)) * 100
    : 0;
  const heroSegments = stats
    ? [
        { value: (unlockedCount / Math.max(totalCount, 1)) * 100, color: '#c4956a' },
        { value: (stats.daily_goal_completed / Math.max(stats.daily_goal_target, 1)) * 100, color: '#78b478' },
        { value: levelProgress, color: '#8aa4ff' },
        { value: stats.hearts_enabled ? (stats.hearts_remaining / 15) * 100 : 0, color: '#dc7864' },
      ]
    : [];

  const filteredAchievements = useMemo(() => {
    const list = (achievements || []).filter((achievement) => {
      if (categoryFilter !== 'all' && (achievement.category || 'general') !== categoryFilter) {
        return false;
      }
      if (statusFilter === 'unlocked' && !achievement.unlocked) {
        return false;
      }
      if (statusFilter === 'locked' && achievement.unlocked) {
        return false;
      }
      return true;
    });

    return list.sort((left, right) => {
      if (sortBy === 'name') {
        return left.name.localeCompare(right.name);
      }
      if (sortBy === 'recent') {
        return new Date(right.unlocked_at || 0).getTime() - new Date(left.unlocked_at || 0).getTime();
      }
      if (sortBy === 'tier') {
        return (tierOrder[right.tier as keyof typeof tierOrder] ?? -1) - (tierOrder[left.tier as keyof typeof tierOrder] ?? -1);
      }
      return (right.progress_pct || 0) - (left.progress_pct || 0);
    });
  }, [achievements, categoryFilter, sortBy, statusFilter]);

  if (statsLoading || achievementsLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[0, 1, 2].map((skeletonIndex) => (
            <div key={skeletonIndex} className="p-5" style={glass}>
              <Skeleton className="h-6 w-20 mb-3" />
              <Skeleton className="h-10 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      <h1 className="text-[1.55rem] sm:text-[1.9rem] mb-2" style={{ fontFamily: 'var(--heading)', color: 'var(--text)' }}>
        Achievements & Stats
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }} className="mb-6">
        Track your progress, filter trophy lanes, and celebrate new milestones.
      </p>

      {stats && (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_1.85fr] mb-8">
          <div className="p-5 flex flex-col items-center justify-center text-center" style={glass}>
            <MasteryRing segments={heroSegments} size={156} strokeWidth={10} centerLabel={`${unlockedCount}/${totalCount}`} />
            <p className="mt-4" style={{ color: 'var(--text)', fontWeight: 500 }}>Progress constellation</p>
            <div className="grid grid-cols-2 gap-2 mt-4 w-full">
              {[
                { label: 'Achievements', value: `${Math.round((unlockedCount / Math.max(totalCount, 1)) * 100)}%`, color: '#c4956a' },
                { label: 'Daily goal', value: `${stats.daily_goal_completed}/${stats.daily_goal_target}`, color: '#78b478' },
                { label: 'Level', value: `${Math.round(levelProgress)}%`, color: '#8aa4ff' },
                { label: 'Hearts', value: stats.hearts_enabled ? `${stats.hearts_remaining}/15` : 'off', color: '#dc7864' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-3 text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                  <p style={{ color: item.color, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</p>
                  <p style={{ color: 'var(--text)', marginTop: 4, fontSize: '0.92rem' }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'Streak', value: stats.streak_current, subtext: `Best: ${stats.streak_longest}`, icon: '🔥' },
              { label: 'Level', value: stats.level, subtext: `${stats.xp_total} XP total`, icon: '⭐' },
              { label: 'Reviews', value: stats.total_cards_reviewed, subtext: `${stats.total_quizzes_completed} quizzes`, icon: '📚' },
              { label: 'Trophies', value: `${unlockedCount}/${totalCount}`, subtext: `${recentlyUnlocked.length} fresh unlocks`, icon: '🏅' },
            ].map((item, statIndex) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: statIndex * 0.05 }} className="p-5" style={glass}>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {item.label}
                  </span>
                </div>
                <p style={{ color: 'var(--text)', fontSize: '2rem', fontWeight: 300 }}>{item.value}</p>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>{item.subtext}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="p-5" style={glass}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target size={18} style={{ color: 'var(--accent)' }} />
                <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: '0.95rem' }}>Daily Goal</span>
              </div>
              <button
                onClick={() => {
                  setGoalInput(String(stats.daily_goal_target));
                  setEditingGoal((current) => !current);
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
                  onChange={(event) => setGoalInput(event.target.value)}
                  min="1"
                  max="500"
                  className="flex-1 px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(139,115,85,0.1)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
                <button onClick={() => dailyGoalMutation.mutate(parseInt(goalInput, 10) || 20)} className="scholar-btn px-4 py-2">
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <MasteryRing percentage={(stats.daily_goal_completed / Math.max(stats.daily_goal_target, 1)) * 100} size={56} strokeWidth={4} />
                <div>
                  <p style={{ color: 'var(--text)', fontWeight: 500 }}>
                    {stats.daily_goal_completed} / {stats.daily_goal_target} cards
                  </p>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                    {stats.daily_goal_completed >= stats.daily_goal_target ? '🎉 Goal reached!' : 'Keep building momentum.'}
                  </p>
                </div>
              </div>
            )}
          </div>

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
                : 'Hearts are disabled. Enable for a Duolingo-style challenge.'}
            </p>
          </div>
        </div>
      )}

      {recentlyUnlocked.length > 0 && (
        <div className="p-4 flex items-start gap-3 mb-6" style={{ ...glass, borderColor: 'rgba(196,149,106,0.35)' }}>
          <Sparkle size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <div>
            <p style={{ color: 'var(--text)', fontWeight: 500 }}>New unlock celebration</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
              {recentlyUnlocked.map((achievement) => achievement.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between mb-4">
        <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.2rem' }}>
          All Achievements ({filteredAchievements.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="px-3 py-2 rounded-xl" style={{ ...glass, color: 'var(--text)' }}>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === 'all' ? 'All categories' : category}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'unlocked' | 'locked')} className="px-3 py-2 rounded-xl" style={{ ...glass, color: 'var(--text)' }}>
            <option value="all">All states</option>
            <option value="unlocked">Unlocked</option>
            <option value="locked">Locked</option>
          </select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'progress' | 'recent' | 'name' | 'tier')} className="px-3 py-2 rounded-xl" style={{ ...glass, color: 'var(--text)' }}>
            <option value="progress">Sort by progress</option>
            <option value="recent">Sort by newest</option>
            <option value="name">Sort alphabetically</option>
            <option value="tier">Sort by tier</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredAchievements.map((achievement, achievementIndex) => {
          const progressCurrent = achievement.progress_current || 0;
          const progressTarget = achievement.progress_target || 1;
          return (
            <motion.div
              key={achievement.achievement_key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: achievementIndex * 0.02 }}
              className="p-4"
              style={{
                ...glass,
                opacity: achievement.unlocked ? 1 : 0.72,
                borderColor: achievement.unlocked ? 'rgba(196,149,106,0.35)' : 'var(--border)',
              }}
            >
              <div className="flex items-start gap-3">
                <span style={{ fontSize: '1.6rem', filter: achievement.unlocked ? 'none' : 'grayscale(1)' }}>
                  {achievement.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p style={{ color: achievement.unlocked ? 'var(--text)' : 'var(--text-tertiary)', fontWeight: 500, fontSize: '0.92rem' }}>
                      {achievement.name}
                    </p>
                    <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(196,149,106,0.12)', color: 'var(--accent)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {achievement.tier || 'bronze'}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 4 }}>
                    {achievement.description}
                  </p>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', marginTop: 8, textTransform: 'capitalize' }}>
                    {(achievement.category || 'general').replace(/_/g, ' ')}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                  <span>{achievement.unlocked ? 'Unlocked' : 'Progress'}</span>
                  <span>{achievement.unlocked ? '100%' : `${progressCurrent}/${progressTarget}`}</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${achievement.unlocked ? 100 : achievement.progress_pct || 0}%`,
                      background: achievement.unlocked ? '#78b478' : 'linear-gradient(90deg, #c4956a, #8aa4ff)',
                    }}
                  />
                </div>
              </div>

              <p style={{ color: achievement.unlocked ? 'var(--accent)' : 'var(--text-tertiary)', fontSize: '0.74rem', marginTop: 10 }}>
                {achievement.unlocked && achievement.unlocked_at
                  ? `Unlocked ${new Date(achievement.unlocked_at).toLocaleDateString()}`
                  : achievement.celebration_message || 'Keep going — this one is within reach.'}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
