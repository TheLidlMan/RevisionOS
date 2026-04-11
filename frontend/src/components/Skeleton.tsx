import type { CSSProperties } from 'react';

interface Props {
  className?: string;
  style?: CSSProperties;
}

export default function Skeleton({ className = '', style }: Props) {
  return (
    <div
      className={`animate-pulse rounded-2xl ${className}`.trim()}
      style={{ background: 'rgba(255,255,255,0.06)', ...style }}
      aria-hidden="true"
    />
  );
}
