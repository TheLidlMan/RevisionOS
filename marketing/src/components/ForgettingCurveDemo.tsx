import { motion } from 'framer-motion'
import { demoForgettingCurve, demoForgettingWithReview } from '../data/demo'

export default function ForgettingCurveDemo() {
  const width = 400
  const height = 200
  const pad = { top: 20, right: 20, bottom: 30, left: 40 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom

  const xScale = (day: number) => pad.left + (day / 30) * plotW
  const yScale = (ret: number) => pad.top + plotH - (ret / 100) * plotH

  const pathNoReview = demoForgettingCurve
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.day)},${yScale(p.retention)}`)
    .join(' ')

  const pathWithReview = demoForgettingWithReview
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.day)},${yScale(p.retention)}`)
    .join(' ')

  return (
    <div style={{ width: '100%', maxWidth: 440 }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line
              x1={pad.left} y1={yScale(v)} x2={width - pad.right} y2={yScale(v)}
              stroke="var(--border)" strokeWidth={0.5}
            />
            <text x={pad.left - 6} y={yScale(v) + 4} textAnchor="end"
              fill="var(--text-tertiary)" fontSize={9}>{v}%</text>
          </g>
        ))}

        {/* No-review curve */}
        <motion.path
          d={pathNoReview}
          fill="none" stroke="var(--danger)" strokeWidth={2} strokeDasharray="4 3"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />

        {/* With-review curve */}
        <motion.path
          d={pathWithReview}
          fill="none" stroke="var(--accent)" strokeWidth={2.5}
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: 'easeOut', delay: 0.5 }}
        />

        {/* Review dots */}
        {demoForgettingWithReview
          .filter((_, i) => i > 0 && i % 2 === 0)
          .map((p, i) => (
            <motion.circle
              key={i}
              cx={xScale(p.day)} cy={yScale(p.retention)} r={4}
              fill="var(--accent)"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: 0.8 + i * 0.3 }}
            />
          ))}

        {/* X axis labels */}
        <text x={pad.left} y={height - 5} fill="var(--text-tertiary)" fontSize={9}>Day 0</text>
        <text x={width - pad.right} y={height - 5} textAnchor="end" fill="var(--text-tertiary)" fontSize={9}>Day 30</text>
      </svg>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ width: 16, height: 2, background: 'var(--danger)', display: 'inline-block', borderRadius: 1 }} />
          Without review
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ width: 16, height: 2, background: 'var(--accent)', display: 'inline-block', borderRadius: 1 }} />
          Spaced repetition
        </span>
      </div>
    </div>
  )
}
