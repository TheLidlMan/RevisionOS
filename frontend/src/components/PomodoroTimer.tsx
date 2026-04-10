import { useState, useEffect, useCallback } from 'react';
import { Timer, Play, Pause, RotateCcw, X } from 'lucide-react';

const glass = { background: 'rgba(255,248,240,0.06)', border: '1px solid rgba(139,115,85,0.2)', borderRadius: '16px', backdropFilter: 'blur(24px)' } as const;

export default function PomodoroTimer() {
  const [open, setOpen] = useState(false);
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [sessions, setSessions] = useState(0);

  const total = isBreak ? 5 * 60 : 25 * 60;
  const pct = ((total - seconds) / total) * 100;
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds(s => { if (s <= 1) { setRunning(false); if (!isBreak) setSessions(p => p + 1); setIsBreak(b => !b); return isBreak ? 25 * 60 : 5 * 60; } return s - 1; }), 1000);
    return () => clearInterval(id);
  }, [running, isBreak]);

  const reset = useCallback(() => { setRunning(false); setSeconds(isBreak ? 5 * 60 : 25 * 60); }, [isBreak]);

  const r = 40, c = 2 * Math.PI * r;

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 40, width: 52, height: 52, borderRadius: '50%', background: '#c4956a', color: '#1a1714', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(196,149,106,0.3)' }}>
      <Timer className="w-5 h-5" />
    </button>
  );

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 40, width: 240, padding: '1.25rem', ...glass, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "Georgia, serif", color: '#f5f0e8', fontWeight: 600, fontSize: '0.85rem' }}>{isBreak ? '☕ Break' : '📖 Focus'}</span>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.4)', cursor: 'pointer' }}><X className="w-4 h-4" /></button>
      </div>
      <div style={{ textAlign: 'center', margin: '0.5rem 0' }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(139,115,85,0.15)" strokeWidth="4" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="#c4956a" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * pct / 100)} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 0.5s' }} />
          <text x="50" y="54" textAnchor="middle" style={{ fill: '#f5f0e8', fontSize: '1.3rem', fontWeight: 200, fontFamily: 'Inter, sans-serif' }}>{mm}:{ss}</text>
        </svg>
      </div>
      <div className="flex items-center justify-center gap-2 mt-2">
        <button onClick={() => setRunning(!running)} style={{ background: running ? 'rgba(220,120,100,0.2)' : 'rgba(196,149,106,0.15)', border: '1px solid rgba(139,115,85,0.2)', borderRadius: '8px', color: '#f5f0e8', cursor: 'pointer', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
          {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}{running ? 'Pause' : 'Start'}
        </button>
        <button onClick={reset} style={{ background: 'rgba(255,248,240,0.04)', border: '1px solid rgba(139,115,85,0.15)', borderRadius: '8px', color: 'rgba(245,240,232,0.5)', cursor: 'pointer', padding: '0.4rem', display: 'flex' }}>
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: '0.7rem', color: 'rgba(245,240,232,0.3)' }}>🍅 {sessions} pomodoros today</div>
    </div>
  );
}
