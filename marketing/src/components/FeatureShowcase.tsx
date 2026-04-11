import { motion } from 'framer-motion'
import { demoModules } from '../data/demo'
import {
  Cards, Exam, Graph, CalendarDots, GearSix, TrendUp,
} from '@phosphor-icons/react'
import type { CSSProperties, ReactNode } from 'react'

const features = [
  { icon: Cards, title: 'Smart Modules', desc: 'Organise content into modules with auto-generated flashcards and quizzes.' },
  { icon: Exam, title: 'Quiz Mode', desc: 'AI-generated multiple choice, fill-in, and conceptual questions with explanations.' },
  { icon: Graph, title: 'Knowledge Graph', desc: 'Visualise how concepts connect. Identify gaps in your understanding.' },
  { icon: TrendUp, title: 'Forgetting Curve', desc: 'See how memory decays and how spaced repetition defeats it.' },
  { icon: CalendarDots, title: 'Study Planner', desc: 'Personalised daily schedules that balance new learning and review.' },
  { icon: GearSix, title: 'Bring Your API Key', desc: 'Use your own Groq API key. Full control, no hidden costs.' },
]

interface Props {
  style?: CSSProperties
  cardStyle?: CSSProperties
  children?: ReactNode
}

export default function FeatureShowcase({ style, cardStyle }: Props) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: '1.25rem', ...style,
    }}>
      {features.map((f, i) => (
        <motion.div
          key={i}
          className="glass-card"
          style={{ padding: '1.5rem', ...cardStyle }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08, duration: 0.45 }}
        >
          <f.icon size={28} color="var(--accent)" weight="regular" style={{ marginBottom: '0.75rem' }} />
          <h3 style={{ fontSize: '1rem', marginBottom: '0.375rem' }}>{f.title}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>
            {f.desc}
          </p>
        </motion.div>
      ))}
    </div>
  )
}

export function ModulePreview() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
      {demoModules.slice(0, 3).map((m) => (
        <div key={m.id} className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color }} />
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{m.name}</h4>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            <span>{m.flashcardCount} cards</span>
            <span>{m.quizCount} questions</span>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{
              height: 4, borderRadius: 2, background: 'var(--surface)',
              overflow: 'hidden',
            }}>
              <motion.div
                style={{ height: '100%', borderRadius: 2, background: m.color }}
                initial={{ width: 0 }}
                whileInView={{ width: `${m.masteryPct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
              {m.masteryPct}% mastery · {m.lastStudied}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
