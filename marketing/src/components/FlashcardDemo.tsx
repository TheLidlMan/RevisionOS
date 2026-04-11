import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { demoFlashcards } from '../data/demo'

interface Props {
  variant?: 'default' | 'compact'
}

export default function FlashcardDemo({ variant = 'default' }: Props) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const card = demoFlashcards[index]

  const next = () => {
    setFlipped(false)
    setIndex((i) => (i + 1) % demoFlashcards.length)
  }

  const isCompact = variant === 'compact'

  return (
    <div style={{ width: '100%', maxWidth: isCompact ? 340 : 420 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${card.id}-${flipped}`}
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          exit={{ rotateY: -90, opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => setFlipped(!flipped)}
          className="glass-card"
          style={{
            padding: isCompact ? '1.5rem' : '2rem',
            minHeight: isCompact ? 160 : 200,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <p style={{
            fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--accent)', marginBottom: '0.75rem', fontWeight: 500,
          }}>
            {flipped ? 'Answer' : 'Question'} · {card.state}
          </p>
          <p style={{
            fontSize: isCompact ? '1rem' : '1.125rem',
            color: 'var(--text)', lineHeight: 1.5, fontWeight: 400,
          }}>
            {flipped ? card.back : card.front}
          </p>
        </motion.div>
      </AnimatePresence>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: '0.75rem', padding: '0 0.25rem',
      }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          {index + 1}/{demoFlashcards.length} · Click to flip
        </span>
        <button onClick={next} className="btn-secondary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.875rem' }}>
          Next →
        </button>
      </div>
    </div>
  )
}
