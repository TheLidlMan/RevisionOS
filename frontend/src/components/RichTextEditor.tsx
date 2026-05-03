import { useState } from 'react';
import RichTextPreview from './RichTextPreview';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

export default function RichTextEditor({ label, value, onChange, rows = 6 }: Props) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>{label}</label>
        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {(['write', 'preview'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTab(mode)}
              className="px-3 py-1.5 text-xs capitalize"
              style={{
                background: tab === mode ? 'var(--accent-soft)' : 'var(--surface)',
                color: tab === mode ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
      {tab === 'write' ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          className="w-full px-3 py-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', resize: 'vertical' }}
        />
      ) : (
        <div className="px-3 py-3 min-h-[140px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <RichTextPreview text={value || '_Nothing to preview yet._'} />
        </div>
      )}
    </div>
  );
}
