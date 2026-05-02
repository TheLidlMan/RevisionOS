import { motion } from 'framer-motion'
import { demoModules, demoFlashcards, demoGraphNodes, demoGraphEdges, demoQuizResults } from '../data/demo'

// ─── Shared glass card style ───────────────────────────────────────────────
const glassCard: React.CSSProperties = {
  background: 'rgba(30, 25, 20, 0.85)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '12px',
}

// ─── Module Card ───────────────────────────────────────────────────────────
function ModuleCard({ m }: { m: typeof demoModules[0] }) {
  return (
    <div style={{ ...glassCard, padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color }} />
        <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: '#f0ece4' }}>{m.name}</span>
      </div>
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8125rem', color: 'rgba(240,236,228,0.5)', marginBottom: '0.75rem' }}>
        <span>{m.flashcardCount} cards</span>
        <span>{m.quizCount} questions</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', borderRadius: 2, background: m.color }}
          initial={{ width: 0 }}
          animate={{ width: `${m.masteryPct}%` }}
          transition={{ duration: 1, delay: 0.3 }}
        />
      </div>
      <p style={{ fontSize: '0.75rem', color: 'rgba(240,236,228,0.35)', marginTop: '0.25rem' }}>
        {m.masteryPct}% mastery · {m.lastStudied}
      </p>
    </div>
  )
}

// ─── Flashcard Preview ─────────────────────────────────────────────────────
function FlashcardPreview() {
  const card = demoFlashcards[0]
  return (
    <div style={{ ...glassCard, padding: '2rem', minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <p style={{ fontSize: '0.7rem', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#c4956a', marginBottom: '0.75rem', fontWeight: 500 }}>
        Question · review
      </p>
      <p style={{ fontSize: '1.125rem', color: '#f0ece4', lineHeight: 1.5 }}>
        {card.front}
      </p>
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
        {['Again', 'Hard', 'Good', 'Easy'].map((label, i) => (
          <div key={label} style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: i === 2 ? '#1a1714' : 'rgba(240,236,228,0.7)',
            background: i === 2 ? '#a5c47b' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${i === 2 ? '#a5c47b' : 'rgba(255,255,255,0.08)'}`,
          }}>{label}</div>
        ))}
      </div>
    </div>
  )
}

// ─── Quiz Preview ──────────────────────────────────────────────────────────
function QuizPreview() {
  const q = demoQuizResults[0]
  return (
    <div style={{ ...glassCard, padding: '1.5rem' }}>
      <p style={{ fontSize: '0.7rem', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#c4956a', marginBottom: '0.5rem', fontWeight: 500 }}>
        Question 1 of 3
      </p>
      <p style={{ fontSize: '1.05rem', color: '#f0ece4', marginBottom: '1.25rem', lineHeight: 1.5 }}>
        {q.question}
      </p>
      {q.options.map((opt, i) => {
        const isCorrect = i === q.correctIndex
        return (
          <div key={i} style={{
            background: isCorrect ? 'rgba(120,180,120,0.12)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isCorrect ? 'rgba(120,180,120,0.35)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            color: '#f0ece4',
            fontSize: '0.9375rem',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: isCorrect ? '#78b478' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${isCorrect ? '#78b478' : 'rgba(255,255,255,0.15)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.625rem', color: '#1a1714', fontWeight: 700,
            }}>
              {isCorrect ? '✓' : String.fromCharCode(65 + i)}
            </div>
            {opt}
          </div>
        )
      })}
      <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(196,149,106,0.08)', borderRadius: '8px', border: '1px solid rgba(196,149,106,0.2)' }}>
        <p style={{ fontSize: '0.875rem', color: 'rgba(240,236,228,0.7)', lineHeight: 1.5 }}>
          {q.explanation}
        </p>
      </div>
    </div>
  )
}

// ─── Knowledge Graph Preview ──────────────────────────────────────────────
function KnowledgeGraphPreview() {
  return (
    <div style={{ ...glassCard, padding: '1.5rem', position: 'relative', minHeight: 280 }}>
      <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f0ece4', marginBottom: '1rem' }}>Cell Biology · Knowledge Graph</p>
      <svg width="100%" height="220" viewBox="0 0 400 220">
        {/* Edges */}
        {demoGraphEdges.map((e, i) => {
          const src = demoGraphNodes.find(n => n.id === e.source)!
          const tgt = demoGraphNodes.find(n => n.id === e.target)!
          const positions: Record<string, [number, number]> = {
            n1: [200, 30], n2: [100, 80], n3: [200, 90], n4: [300, 130],
            n5: [200, 150], n6: [60, 160], n7: [340, 160], n8: [130, 190],
            n9: [270, 190], n10: [60, 40],
          }
          const [x1, y1] = positions[src.id] ?? [0, 0]
          const [x2, y2] = positions[tgt.id] ?? [0, 0]
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(196,149,106,0.25)" strokeWidth={e.weight * 2} />
          )
        })}
        {/* Nodes */}
        {demoGraphNodes.map((node) => {
          const positions: Record<string, [number, number]> = {
            n1: [200, 30], n2: [100, 80], n3: [200, 90], n4: [300, 130],
            n5: [200, 150], n6: [60, 160], n7: [340, 160], n8: [130, 190],
            n9: [270, 190], n10: [60, 40],
          }
          const [x, y] = positions[node.id] ?? [0, 0]
          const colors: Record<string, string> = { core: '#c4956a', organelle: '#7ba5c4', process: '#a5c47b', concept: '#c47bb3' }
          const r = 8 + node.importance * 8
          return (
            <g key={node.id}>
              <circle cx={x} cy={y} r={r + 4} fill="rgba(0,0,0,0.3)" />
              <circle cx={x} cy={y} r={r} fill={colors[node.group] ?? '#c4956a'} opacity={0.85} />
              <text x={x} y={y + r + 14} textAnchor="middle" fill="rgba(240,236,228,0.55)" fontSize="9">{node.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Stats Bar ─────────────────────────────────────────────────────────────
function StatsBar() {
  const totalCards = demoModules.reduce((s, m) => s + m.flashcardCount, 0)
  const avgMastery = Math.round(demoModules.reduce((s, m) => s + m.masteryPct, 0) / demoModules.length)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
      {[
        { label: 'Cards Due Today', value: '23', color: '#e06050' },
        { label: 'Total Flashcards', value: totalCards.toString(), color: '#c4956a' },
        { label: 'Avg Mastery', value: `${avgMastery}%`, color: '#a5c47b' },
        { label: 'Day Streak', value: '12', color: '#7ba5c4' },
      ].map((stat, i) => (
        <div key={i} style={{ ...glassCard, padding: '1.25rem', textAlign: 'center', borderTop: `3px solid ${stat.color}` }}>
          <p style={{ fontSize: '1.75rem', fontWeight: 700, color: stat.color }}>{stat.value}</p>
          <p style={{ fontSize: '0.75rem', color: 'rgba(240,236,228,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>{stat.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function ScreenshotsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0e0c09', color: '#f0ece4', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#a5c47b', marginBottom: '0.5rem' }}>Revise OS — UI Preview</p>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#f0ece4' }}>Adaptive Study Platform</h1>
        </div>

        {/* Dashboard Stats */}
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgba(240,236,228,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Dashboard</p>
          <StatsBar />
        </div>

        {/* Module Cards */}
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgba(240,236,228,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Module Performance</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            {demoModules.map(m => <ModuleCard key={m.id} m={m} />)}
          </div>
        </div>

        {/* Flashcard + Quiz side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgba(240,236,228,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Flashcard Review</p>
            <FlashcardPreview />
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgba(240,236,228,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Quiz Mode</p>
            <QuizPreview />
          </div>
        </div>

        {/* Knowledge Graph */}
        <div>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgba(240,236,228,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Knowledge Graph</p>
          <KnowledgeGraphPreview />
        </div>

      </div>
    </div>
  )
}
