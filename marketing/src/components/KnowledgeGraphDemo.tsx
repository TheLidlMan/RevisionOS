import { motion } from 'framer-motion'
import { demoGraphNodes, demoGraphEdges } from '../data/demo'
import { useMemo } from 'react'

export default function KnowledgeGraphDemo() {
  const width = 420
  const height = 300

  // Simple radial layout
  const positioned = useMemo(() => {
    const cx = width / 2
    const cy = height / 2
    return demoGraphNodes.map((node, i) => {
      if (i === 0) return { ...node, x: cx, y: cy }
      const angle = ((i - 1) / (demoGraphNodes.length - 1)) * Math.PI * 2
      const r = 90 + (1 - node.importance) * 60
      return { ...node, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
    })
  }, [])

  const nodeMap = Object.fromEntries(positioned.map(n => [n.id, n]))

  const groupColors: Record<string, string> = {
    core: 'var(--accent)',
    organelle: '#7ba5c4',
    process: '#a5c47b',
    concept: '#c47bb3',
  }

  return (
    <div style={{ width: '100%', maxWidth: 440 }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {/* Edges */}
        {demoGraphEdges.map((edge, i) => {
          const s = nodeMap[edge.source]
          const t = nodeMap[edge.target]
          if (!s || !t) return null
          return (
            <motion.line
              key={i}
              x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke="var(--border-focus)" strokeWidth={edge.weight * 1.5}
              initial={{ opacity: 0 }} animate={{ opacity: 0.6 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            />
          )
        })}

        {/* Nodes */}
        {positioned.map((node, i) => (
          <motion.g
            key={node.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.08, type: 'spring', stiffness: 200 }}
          >
            <circle
              cx={node.x} cy={node.y}
              r={8 + node.importance * 12}
              fill={groupColors[node.group] ?? 'var(--accent)'}
              opacity={0.25}
            />
            <circle
              cx={node.x} cy={node.y}
              r={4 + node.importance * 6}
              fill={groupColors[node.group] ?? 'var(--accent)'}
            />
            <text
              x={node.x} y={node.y + (8 + node.importance * 12) + 14}
              textAnchor="middle" fill="var(--text-secondary)"
              fontSize={node.importance > 0.8 ? 10 : 8}
              fontFamily="var(--sans)"
            >
              {node.label}
            </text>
          </motion.g>
        ))}
      </svg>
    </div>
  )
}
