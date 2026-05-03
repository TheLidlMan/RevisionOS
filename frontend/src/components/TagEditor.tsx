import { useMemo, useState } from 'react';

interface Props {
  value: string[];
  suggestions?: string[];
  onChange: (value: string[]) => void;
}

function normalizeTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))).sort();
}

export default function TagEditor({ value, suggestions = [], onChange }: Props) {
  const [draft, setDraft] = useState('');
  const filteredSuggestions = useMemo(
    () => suggestions.filter((tag) => tag.includes(draft.toLowerCase()) && !value.includes(tag)).slice(0, 8),
    [draft, suggestions, value],
  );

  const addTag = (tag: string) => {
    const next = normalizeTags([...value, tag]);
    onChange(next);
    setDraft('');
  };

  return (
    <div>
      <label className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>Tags</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onChange(value.filter((item) => item !== tag))}
            className="px-2 py-1 rounded-full text-xs"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            #{tag} ×
          </button>
        ))}
      </div>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            if (draft.trim()) {
              addTag(draft);
            }
          }
        }}
        placeholder="Add a tag and press Enter"
        className="w-full px-3 py-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
      />
      {filteredSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {filteredSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="px-2 py-1 rounded-full text-xs"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
