import { useState } from 'react'
import { motion } from 'framer-motion'
import { demoQuizResults } from '../data/demo'
import { CheckCircle, XCircle } from '@phosphor-icons/react'

export default function QuizDemo() {
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const q = demoQuizResults[current]

  const handleSelect = (i: number) => {
    if (answered) return
    setSelected(i)
    setAnswered(true)
  }

  const next = () => {
    setSelected(null)
    setAnswered(false)
    setCurrent((c) => (c + 1) % demoQuizResults.length)
  }

  return (
    <div style={{ width: '100%', maxWidth: 480 }}>
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <p style={{
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em',
          color: 'var(--accent)', marginBottom: '0.5rem', fontWeight: 500,
        }}>
          Question {current + 1} of {demoQuizResults.length}
        </p>
        <p style={{ fontSize: '1.05rem', color: 'var(--text)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          {q.question}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correctIndex
            const isSelected = i === selected
            let bg = 'var(--surface)'
            let border = 'var(--border)'
            if (answered && isCorrect) { bg = 'rgba(120,180,120,0.12)'; border = 'rgba(120,180,120,0.4)' }
            else if (answered && isSelected && !isCorrect) { bg = 'rgba(220,120,100,0.12)'; border = 'rgba(220,120,100,0.4)' }

            return (
              <motion.button
                key={i}
                whileHover={!answered ? { scale: 1.01 } : {}}
                onClick={() => handleSelect(i)}
                style={{
                  background: bg, border: `1px solid ${border}`,
                  borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem',
                  color: 'var(--text)', fontSize: '0.9375rem',
                  cursor: answered ? 'default' : 'pointer',
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                {answered && isCorrect && <CheckCircle size={18} color="var(--success)" weight="fill" />}
                {answered && isSelected && !isCorrect && <XCircle size={18} color="var(--danger)" weight="fill" />}
                {opt}
              </motion.button>
            )
          })}
        </div>

        {answered && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: '1rem', padding: '0.75rem 1rem',
              background: 'var(--accent-soft)', borderRadius: 'var(--radius-sm)',
            }}
          >
            <p style={{ fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.5 }}>
              {q.explanation}
            </p>
          </motion.div>
        )}
      </div>

      {answered && (
        <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
          <button onClick={next} className="btn-primary" style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}>
            Next Question →
          </button>
        </div>
      )}
    </div>
  )
}
