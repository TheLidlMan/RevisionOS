import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { previewCardImport, commitCardImport } from '../api/client';
import type { CardImportPreview } from '../types';

interface Props {
  moduleId: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

export default function ImportCardsModal({ moduleId, open, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CardImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({ front: null, back: null, tags: null, study_difficulty: null, is_bookmarked: null });

  const previewMutation = useMutation({
    mutationFn: (selected: File) => previewCardImport(moduleId, selected),
    onSuccess: (data) => {
      setPreview(data);
      setMapping(data.suggested_mapping);
    },
  });

  const commitMutation = useMutation({
    mutationFn: () => file ? commitCardImport(moduleId, file, mapping) : Promise.reject(new Error('Choose a file first.')),
    onSuccess: () => {
      onImported();
      onClose();
      setFile(null);
      setPreview(null);
    },
  });

  const fields = useMemo(() => [
    ['front', 'Front'],
    ['back', 'Back'],
    ['tags', 'Tags'],
    ['study_difficulty', 'Difficulty'],
    ['is_bookmarked', 'Bookmark flag'],
  ] as const, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,15,15,0.8)' }}>
      <div className="w-full max-w-4xl p-6" style={glass}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.2rem' }}>Import Cards</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Preview the file, confirm field mapping, then import.</p>
          </div>
          <button type="button" onClick={onClose} style={{ color: 'var(--text-secondary)' }}>Close</button>
        </div>

        <div className="flex flex-col gap-4">
          <input
            type="file"
            accept=".csv,.json,application/json,text/csv"
            onChange={(event) => {
              const selected = event.target.files?.[0] || null;
              setFile(selected);
              setPreview(null);
            }}
          />

          <div className="flex gap-3">
            <button type="button" className="scholar-btn" disabled={!file || previewMutation.isPending} onClick={() => file && previewMutation.mutate(file)}>
              {previewMutation.isPending ? 'Previewing…' : 'Preview'}
            </button>
            <button type="button" className="scholar-btn" disabled={!preview || commitMutation.isPending || !mapping.front || !mapping.back} onClick={() => commitMutation.mutate()}>
              {commitMutation.isPending ? 'Importing…' : 'Import cards'}
            </button>
          </div>

          {preview && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map(([key, label]) => (
                  <label key={key}>
                    <span className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>{label}</span>
                    <select
                      value={mapping[key] || ''}
                      onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value || null }))}
                      className="w-full px-3 py-3"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
                    >
                      <option value="">Ignore</option>
                      {preview.columns.map((column) => <option key={column} value={column}>{column}</option>)}
                    </select>
                  </label>
                ))}
              </div>

              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginBottom: 8 }}>Preview ({preview.total_rows} rows)</p>
                <div className="overflow-auto max-h-64" style={{ border: '1px solid var(--border)', borderRadius: '12px' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {preview.columns.map((column) => <th key={column} className="text-left px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{column}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview_rows.map((row, index) => (
                        <tr key={index} style={{ borderTop: '1px solid var(--border)' }}>
                          {preview.columns.map((column) => <td key={column} className="px-3 py-2" style={{ color: 'var(--text)' }}>{String(row[column] ?? '')}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
