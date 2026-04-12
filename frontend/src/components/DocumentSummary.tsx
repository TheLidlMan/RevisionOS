import { useMemo, useState } from 'react';
import ShowMoreText from './ShowMoreText';

type SummaryData = Record<string, unknown> | unknown[];

interface DocumentSummaryProps {
  summary?: string;
  summaryData?: SummaryData;
}

const sectionLabelStyle = {
  color: 'var(--text)',
  fontSize: '0.74rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  marginBottom: 6,
  textTransform: 'uppercase' as const,
};

const bodyTextStyle = {
  color: 'var(--text-secondary)',
  fontSize: '0.88rem',
  lineHeight: 1.55,
};

const humanizeKey = (key: string) =>
  key
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toInlineText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(toInlineText).filter(Boolean).join('; ');
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => {
        const text = toInlineText(item);
        return text ? `${humanizeKey(key)}: ${text}` : '';
      })
      .filter(Boolean)
      .join(' ');
  }
  return '';
};

const hasOverflow = (value: unknown, itemLimit: number): boolean => {
  if (Array.isArray(value)) {
    return value.length > itemLimit || value.some((item) => hasOverflow(item, itemLimit));
  }
  if (isRecord(value)) {
    return Object.values(value).some((item) => hasOverflow(item, itemLimit));
  }
  return false;
};

function SummaryValue({ value, expanded, depth = 0 }: { value: unknown; expanded: boolean; depth?: number }) {
  if (typeof value === 'string') {
    return <p style={{ ...bodyTextStyle, margin: 0, whiteSpace: 'pre-wrap' }}>{value.trim()}</p>;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return <p style={{ ...bodyTextStyle, margin: 0 }}>{String(value)}</p>;
  }

  if (Array.isArray(value)) {
    const visibleItems = expanded ? value : value.slice(0, 3);
    const scalarItems = visibleItems.every((item) => !Array.isArray(item) && !isRecord(item));

    if (scalarItems) {
      return (
        <ul style={{ ...bodyTextStyle, margin: 0, paddingLeft: depth === 0 ? 18 : 16 }}>
          {visibleItems.map((item, index) => {
            const text = toInlineText(item);
            if (!text) {
              return null;
            }
            return <li key={`${text}-${index}`} style={{ marginTop: index === 0 ? 0 : 4 }}>{text}</li>;
          })}
        </ul>
      );
    }

    return (
      <div style={{ display: 'grid', gap: 10 }}>
        {visibleItems.map((item, index) => (
          <div key={index} style={{ paddingLeft: depth > 0 ? 10 : 0, borderLeft: depth > 0 ? '1px solid var(--border)' : 'none' }}>
            <SummaryValue value={item} expanded={expanded} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (isRecord(value)) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        {Object.entries(value).map(([key, item]) => {
          const text = toInlineText(item);
          if (!text && !Array.isArray(item) && !isRecord(item)) {
            return null;
          }
          return (
            <div key={key}>
              <p style={sectionLabelStyle}>{humanizeKey(key)}</p>
              <SummaryValue value={item} expanded={expanded} depth={depth + 1} />
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}

export default function DocumentSummary({ summary, summaryData }: DocumentSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  const normalizedSummaryData = useMemo(() => {
    if (!summaryData) {
      return null;
    }
    if (Array.isArray(summaryData)) {
      return summaryData.length > 0 ? summaryData : null;
    }
    return Object.keys(summaryData).length > 0 ? summaryData : null;
  }, [summaryData]);

  if (!normalizedSummaryData) {
    return summary ? (
      <ShowMoreText text={summary} collapsedLines={3} color="var(--text-secondary)" fontSize="0.88rem" />
    ) : null;
  }

  const overflow = hasOverflow(normalizedSummaryData, 3);

  return (
    <div style={{ marginTop: 10 }}>
      <SummaryValue value={normalizedSummaryData} expanded={expanded} />
      {overflow ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-2"
          style={{ color: 'var(--accent)', fontSize: '0.84rem' }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}