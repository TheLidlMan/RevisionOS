import { motion } from 'framer-motion'
import { Check, X } from '@phosphor-icons/react'

const reviseOSFeatures = [
  { label: 'AI-generated flashcards & quizzes', present: true },
  { label: 'Spaced repetition (FSRS algorithm)', present: true },
  { label: 'Knowledge graph visualisation', present: true },
  { label: 'Adaptive study planner', present: true },
  { label: 'Upload any file type', present: true },
  { label: 'Bring your own API key', present: true },
  { label: 'Mobile app', present: true },
  { label: 'No subscription required', present: true },
]

export default function WhyReviseOS() {
  return (
    <section id="why-reviseos" className="section" style={{ background: 'var(--bg-warm)' }}>
      <div className="container">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          style={{
            textAlign: 'center', color: '#a5c47b', fontSize: '0.8125rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem',
          }}
        >
          Why ReviseOS?
        </motion.p>
        <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '0.5rem' }}>
          Built for how you actually learn
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem', maxWidth: 520, margin: '0 auto' }}>
          Most study tools are glorified flashcard apps. ReviseOS is the only platform that combines AI generation, spaced repetition, knowledge graphs, and an adaptive planner in one place.
        </p>

        {/* Comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card"
          style={{ padding: '2rem', marginBottom: '3rem', overflowX: 'auto' }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0 0.75rem 1rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }} />
                {[{ name: 'ReviseOS', color: 'var(--accent)' }, { name: 'Anki', color: '#2d7dd2' }, { name: 'Quizlet', color: '#f5426c' }, { name: 'Chegg', color: '#f7b731' }].map((c) => (
                  <th key={c.name} style={{ textAlign: 'center', padding: '0 0.75rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, background: c.color,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '0.875rem', color: '#fff', marginBottom: '0.5rem',
                    }}>
                      {c.name[0]}
                    </div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'AI-generated content', revise: true, anki: false, quizlet: 'Limited', chegg: false },
                { label: 'Spaced repetition', revise: true, anki: true, quizlet: false, chegg: false },
                { label: 'Knowledge graph', revise: true, anki: false, quizlet: false, chegg: false },
                { label: 'Adaptive study planner', revise: true, anki: false, quizlet: 'Basic', chegg: false },
                { label: 'Upload any file', revise: true, anki: true, quizlet: false, chegg: 'Textbooks only' },
                { label: 'Free tier', revise: true, anki: true, quizlet: 'Limited', chegg: false },
                { label: 'No subscription required', revise: true, anki: true, quizlet: false, chegg: false },
              ].map((row, i) => (
                <tr key={i}>
                  <td style={{ padding: '0.875rem 0.75rem 0.875rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                    {row.label}
                  </td>
                  {[row.revise, row.anki, row.quizlet, row.chegg].map((val, j) => (
                    <td key={j} style={{ padding: '0.875rem 0.75rem', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                      {typeof val === 'boolean' ? (
                        val ? (
                          <Check size={18} color="#a5c47b" weight="bold" />
                        ) : (
                          <X size={18} color="var(--text-tertiary)" weight="bold" />
                        )
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{val}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Feature bullets for ReviseOS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
        }}>
          {reviseOSFeatures.map((f, i) => (
            <motion.div
              key={i}
              className="glass-card"
              style={{ padding: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: '50%', background: '#a5c47b',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.125rem',
              }}>
                <Check size={14} color="#1a1714" weight="bold" />
              </div>
              <span style={{ fontSize: '0.9375rem' }}>{f.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
