import { motion } from 'framer-motion';

interface MasteryRingSegment {
  value: number;
  color: string;
}

interface MasteryRingProps {
  percentage?: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  segments?: MasteryRingSegment[];
  centerLabel?: string;
}

export default function MasteryRing({
  percentage = 0,
  size = 48,
  strokeWidth = 4,
  showLabel = true,
  segments,
  centerLabel,
}: MasteryRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(percentage, 100));
  const resolvedSegments = (segments || [])
    .map((segment) => ({
      ...segment,
      value: Math.max(0, Math.min(segment.value, 100)),
    }))
    .filter((segment) => segment.value > 0);
  const totalSegmentValue = resolvedSegments.reduce((sum, segment) => sum + segment.value, 0);

  const getColor = () => {
    if (pct >= 80) return '#78b478';
    if (pct >= 50) return 'var(--accent)';
    if (pct >= 20) return '#e8a87c';
    return '#dc7864';
  };

  const activeSegments = resolvedSegments.reduce<Array<MasteryRingSegment & { dashArray: string; dashOffset: number }>>(
    (accumulator, segment) => {
      const segmentStart = accumulator.reduce((sum, item) => sum + item.value, 0);
      accumulator.push({
        ...segment,
        dashArray: `${(circumference * segment.value) / 100} ${circumference}`,
        dashOffset: circumference * (1 - segmentStart / 100),
      });
      return accumulator;
    },
    [],
  );

  const fallbackDashOffset = circumference * (1 - pct / 100);
  const resolvedLabel = centerLabel ?? `${Math.round(totalSegmentValue > 0 ? Math.min(totalSegmentValue, 100) : pct)}%`;
  const labelColor = activeSegments[0]?.color || getColor();

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
        {activeSegments.length > 0 ? (
          activeSegments.map((segment) => (
            <motion.circle
              key={`${segment.color}-${segment.value}-${segment.dashOffset}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={segment.dashArray}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: segment.dashOffset }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          ))
        ) : (
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
            animate={{ strokeDashoffset: fallbackDashOffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        )}
      </svg>
      {showLabel && (
        <span
          className="absolute text-center leading-none"
          style={{
            color: labelColor,
            fontWeight: 600,
            fontSize: size <= 40 ? '0.6rem' : size >= 120 ? '0.95rem' : '0.7rem',
          }}
        >
          {resolvedLabel}
        </span>
      )}
    </div>
  );
}
