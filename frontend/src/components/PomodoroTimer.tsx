import { useEffect, useMemo, useState } from 'react';
import { Timer, Play, Pause, RotateCcw, X, SlidersHorizontal } from 'lucide-react';
import { usePersistentState } from '../hooks/usePersistentState';

const glass = {
  background: 'rgba(255,248,240,0.06)',
  border: '1px solid rgba(139,115,85,0.2)',
  borderRadius: '16px',
  backdropFilter: 'blur(24px)',
} as const;

interface PomodoroPreferences {
  focusMinutes: number;
  breakMinutes: number;
}

interface PomodoroAnalytics {
  dayKey: string;
  sessions: number;
  focusSeconds: number;
  longestFocusSeconds: number;
  lastFocusSeconds: number;
  lastCompletedAt?: string;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function PomodoroTimer() {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [running, setRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [preferences, setPreferences] = usePersistentState<PomodoroPreferences>('pomodoro:preferences', {
    focusMinutes: 25,
    breakMinutes: 5,
  });
  const [analytics, setAnalytics] = usePersistentState<PomodoroAnalytics>('pomodoro:analytics', {
    dayKey: todayKey(),
    sessions: 0,
    focusSeconds: 0,
    longestFocusSeconds: 0,
    lastFocusSeconds: 0,
  });

  const focusSeconds = Math.max(1, Math.round(preferences.focusMinutes * 60));
  const breakSeconds = Math.max(1, Math.round(preferences.breakMinutes * 60));
  const total = isBreak ? breakSeconds : focusSeconds;
  const [seconds, setSeconds] = useState(total);
  const normalizedAnalytics = analytics.dayKey === todayKey()
    ? analytics
    : {
        dayKey: todayKey(),
        sessions: 0,
        focusSeconds: 0,
        longestFocusSeconds: 0,
        lastFocusSeconds: 0,
      };

  useEffect(() => {
    if (!running) {
      return;
    }
    const id = window.setInterval(() => {
      setSeconds((current) => {
        if (current > 1) {
          return current - 1;
        }

        setRunning(false);
        if (!isBreak) {
          setAnalytics((existing) => ({
            ...(existing.dayKey === todayKey()
              ? existing
              : {
                  dayKey: todayKey(),
                  sessions: 0,
                  focusSeconds: 0,
                  longestFocusSeconds: 0,
                  lastFocusSeconds: 0,
                }),
            sessions: (existing.dayKey === todayKey() ? existing.sessions : 0) + 1,
            focusSeconds: (existing.dayKey === todayKey() ? existing.focusSeconds : 0) + focusSeconds,
            longestFocusSeconds: Math.max(existing.dayKey === todayKey() ? existing.longestFocusSeconds : 0, focusSeconds),
            lastFocusSeconds: focusSeconds,
            lastCompletedAt: new Date().toISOString(),
          }));
        }
        setIsBreak((currentMode) => !currentMode);
        return isBreak ? focusSeconds : breakSeconds;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [breakSeconds, focusSeconds, isBreak, running, setAnalytics]);

  const displaySeconds = running ? seconds : total;
  const pct = ((total - displaySeconds) / total) * 100;
  const mm = String(Math.floor(displaySeconds / 60)).padStart(2, '0');
  const ss = String(displaySeconds % 60).padStart(2, '0');
  const lastCompletedLabel = normalizedAnalytics.lastCompletedAt
    ? new Date(normalizedAnalytics.lastCompletedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'No sessions yet';
  const summary = useMemo(
    () => [
      { label: 'Today', value: `${normalizedAnalytics.sessions} sessions` },
      { label: 'Focus', value: `${Math.round(normalizedAnalytics.focusSeconds / 60)} min` },
      { label: 'Best', value: `${Math.round(normalizedAnalytics.longestFocusSeconds / 60)} min` },
    ],
    [normalizedAnalytics.focusSeconds, normalizedAnalytics.longestFocusSeconds, normalizedAnalytics.sessions],
  );

  const r = 40;
  const c = 2 * Math.PI * r;

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open Pomodoro timer"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 40,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: '#c4956a',
          color: '#1a1714',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(196,149,106,0.3)',
        }}
      >
        <Timer className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 40,
        width: 292,
        padding: '1.25rem',
        ...glass,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <span style={{ fontFamily: "'Clash Display', sans-serif", color: '#f5f0e8', fontWeight: 600, fontSize: '0.9rem' }}>
            {isBreak ? 'Break window' : 'Focus sprint'}
          </span>
          <p style={{ color: 'rgba(245,240,232,0.45)', fontSize: '0.72rem', marginTop: 2 }}>
            {preferences.focusMinutes}/{preferences.breakMinutes} min cadence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Toggle Pomodoro settings"
            onClick={() => setShowSettings((current) => !current)}
            style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.55)', cursor: 'pointer' }}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button type="button" aria-label="Close Pomodoro timer" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.4)', cursor: 'pointer' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <label>
            <span style={{ color: 'rgba(245,240,232,0.45)', fontSize: '0.72rem', display: 'block', marginBottom: 6 }}>Focus</span>
            <input
              type="number"
              min={5}
              max={90}
              value={preferences.focusMinutes}
              onChange={(event) => setPreferences((current) => ({ ...current, focusMinutes: Math.min(90, Math.max(5, Number(event.target.value) || 25)) }))}
              className="w-full px-3 py-2 rounded-lg"
              style={{ background: 'rgba(255,248,240,0.05)', border: '1px solid rgba(139,115,85,0.2)', color: '#f5f0e8' }}
            />
          </label>
          <label>
            <span style={{ color: 'rgba(245,240,232,0.45)', fontSize: '0.72rem', display: 'block', marginBottom: 6 }}>Break</span>
            <input
              type="number"
              min={1}
              max={30}
              value={preferences.breakMinutes}
              onChange={(event) => setPreferences((current) => ({ ...current, breakMinutes: Math.min(30, Math.max(1, Number(event.target.value) || 5)) }))}
              className="w-full px-3 py-2 rounded-lg"
              style={{ background: 'rgba(255,248,240,0.05)', border: '1px solid rgba(139,115,85,0.2)', color: '#f5f0e8' }}
            />
          </label>
        </div>
      )}

      <div style={{ textAlign: 'center', margin: '0.5rem 0' }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(139,115,85,0.15)" strokeWidth="4" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={isBreak ? '#78b478' : '#c4956a'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (c * pct / 100)}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 0.5s' }}
          />
          <text x="50" y="54" textAnchor="middle" style={{ fill: '#f5f0e8', fontSize: '1.3rem', fontWeight: 200, fontFamily: 'Inter, sans-serif' }}>
            {mm}:{ss}
          </text>
        </svg>
      </div>

      <div className="flex items-center justify-center gap-2 mt-2">
        <button
          onClick={() => {
            if (!running) {
              setSeconds(total);
            }
            setRunning((current) => !current);
          }}
          style={{
            background: running ? 'rgba(220,120,100,0.2)' : 'rgba(196,149,106,0.15)',
            border: '1px solid rgba(139,115,85,0.2)',
            borderRadius: '8px',
            color: '#f5f0e8',
            cursor: 'pointer',
            padding: '0.4rem 0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.8rem',
          }}
        >
          {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={() => {
            setRunning(false);
            setSeconds(isBreak ? breakSeconds : focusSeconds);
          }}
          style={{
            background: 'rgba(255,248,240,0.04)',
            border: '1px solid rgba(139,115,85,0.15)',
            borderRadius: '8px',
            color: 'rgba(245,240,232,0.5)',
            cursor: 'pointer',
            padding: '0.4rem',
            display: 'flex',
          }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {summary.map((item) => (
          <div key={item.label} className="rounded-xl px-2 py-2" style={{ background: 'rgba(255,248,240,0.04)', border: '1px solid rgba(139,115,85,0.12)' }}>
            <p style={{ color: 'rgba(245,240,232,0.35)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</p>
            <p style={{ color: '#f5f0e8', fontSize: '0.8rem', marginTop: 4 }}>{item.value}</p>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: 10, fontSize: '0.72rem', color: 'rgba(245,240,232,0.36)' }}>
        Last completion: {lastCompletedLabel} · most recent focus block {Math.round(normalizedAnalytics.lastFocusSeconds / 60)} min
      </div>
    </div>
  );
}
