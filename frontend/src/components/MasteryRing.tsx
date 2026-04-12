import { motion } from 'framer-motion';

interface MasteryRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export default function MasteryRing({ percentage, size = 48, strokeWidth = 4, showLabel = true }: MasteryRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(percentage, 100));
  const offset = circumference * (1 - pct / 100);

  const getColor = () => {
    if (pct >= 80) return '#78b478';
    if (pct >= 50) return 'var(--accent)';
    if (pct >= 20) return '#e8a87c';
    return '#dc7864';
  };

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(196,149,106,0.1)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      {showLabel && (
        <span
          className="absolute"
          style={{
            color: getColor(),
            fontWeight: 600,
            fontSize: size <= 40 ? '0.6rem' : '0.7rem',
          }}
        >
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}
