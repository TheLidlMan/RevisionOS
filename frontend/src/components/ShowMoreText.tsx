import { useState } from 'react';

interface Props {
  text: string;
  collapsedLines?: number;
  color?: string;
  secondaryColor?: string;
  fontSize?: string;
}

export default function ShowMoreText({
  text,
  collapsedLines = 3,
  color = 'var(--text-secondary)',
  secondaryColor = 'var(--accent)',
  fontSize = '0.9rem',
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const shouldClamp = text.trim().length > 180 || text.includes('\n');

  return (
    <div>
      <p
        style={{
          color,
          fontSize,
          marginTop: 8,
          display: expanded ? 'block' : '-webkit-box',
          WebkitLineClamp: expanded ? 'unset' : collapsedLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
        }}
      >
        {text}
      </p>
      {shouldClamp ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-2"
          style={{ color: secondaryColor, fontSize: '0.84rem' }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}
