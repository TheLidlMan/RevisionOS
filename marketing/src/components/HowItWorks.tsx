import { motion } from 'framer-motion'
import { UploadSimple, MagicWand, Brain, ChartLineUp } from '@phosphor-icons/react'
import type { CSSProperties } from 'react'

const steps = [
  {
    icon: UploadSimple,
    title: 'Upload your material',
    desc: 'Drop PDFs, slides, or notes. ReviseOS processes everything automatically.',
  },
  {
    icon: MagicWand,
    title: 'Generate revision assets',
    desc: 'AI creates flashcards, quiz questions, concept maps, and study plans from your content.',
  },
  {
    icon: Brain,
    title: 'Review adaptively',
    desc: 'Spaced repetition powered by FSRS schedules reviews at the optimal moment.',
  },
  {
    icon: ChartLineUp,
    title: 'Measure mastery',
    desc: 'Track retention, identify weaknesses, and watch your knowledge grow.',
  },
]

interface Props {
  style?: CSSProperties
  cardStyle?: CSSProperties
}

export default function HowItWorks({ style, cardStyle }: Props) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '1.5rem', ...style,
    }}>
      {steps.map((step, i) => (
        <motion.div
          key={i}
          className="glass-card"
          style={{ padding: '1.5rem', ...cardStyle }}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.12, duration: 0.5 }}
        >
          <step.icon size={32} color="var(--accent)" weight="regular" style={{ marginBottom: '0.75rem' }} />
          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{step.title}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {step.desc}
          </p>
        </motion.div>
      ))}
    </div>
  )
}
