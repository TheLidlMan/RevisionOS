import { useState, useEffect } from 'react';
import { Target, Pencil, Check } from 'lucide-react';

const glass = { background: 'rgba(255,248,240,0.04)', border: '1px solid rgba(139,115,85,0.15)', borderRadius: '12px', backdropFilter: 'blur(20px)' } as const;

interface GoalData { target: number; completed: number; }

export default function StudyGoals() {
  const [goal, setGoal] = useState<GoalData>(() => {
    try { const s = localStorage.getItem('revisionos_goals'); return s ? JSON.parse(s) : { target: 20, completed: 0 }; } catch { return { target: 20, completed: 0 }; }
  });
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(goal.target);

  useEffect(() => { localStorage.setItem('revisionos_goals', JSON.stringify(goal)); }, [goal]);

  const pct = Math.min(100, Math.round((goal.completed / goal.target) * 100));
  const r = 28, c = 2 * Math.PI * r;

  return (
    <div style={{ ...glass, padding: '1.25rem' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4" style={{ color: '#c4956a' }} />
          <span style={{ fontFamily: "'Clash Display', sans-serif", color: '#f5f0e8', fontWeight: 600, fontSize: '0.9rem' }}>Daily Goal</span>
        </div>
        <button onClick={() => { if (editing) { setGoal({ ...goal, target: editVal }); } setEditing(!editing); }} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.4)', cursor: 'pointer' }}>
          {editing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="flex items-center gap-4">
        <svg width="68" height="68" viewBox="0 0 68 68">
          <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(139,115,85,0.1)" strokeWidth="4" />
          <circle cx="34" cy="34" r={r} fill="none" stroke="#c4956a" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * pct / 100)} transform="rotate(-90 34 34)" />
          <text x="34" y="38" textAnchor="middle" style={{ fill: '#f5f0e8', fontSize: '0.85rem', fontWeight: 200 }}>{pct}%</text>
        </svg>
        <div>
          {editing ? (
            <input type="number" value={editVal} onChange={(e) => setEditVal(parseInt(e.target.value) || 1)} min={1} max={100} style={{ background: 'rgba(255,248,240,0.04)', border: '1px solid rgba(139,115,85,0.15)', borderRadius: '6px', color: '#f5f0e8', width: 60, padding: '0.25rem 0.5rem', outline: 'none', fontSize: '0.85rem' }} />
          ) : (
            <p style={{ color: '#f5f0e8', fontSize: '0.85rem', fontWeight: 300 }}>{goal.completed} / {goal.target} cards</p>
          )}
          <p style={{ color: 'rgba(245,240,232,0.3)', fontSize: '0.7rem', marginTop: 2 }}>reviewed today</p>
        </div>
      </div>
    </div>
  );
}
