import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle, FolderSimplePlus, X } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { createModule } from '../api/client';
import type { Module } from '../types';
import { UploadDocumentsPane } from './UploadDocumentsModal';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRESET_COLORS = ['#c4956a', '#d97757', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#ec4899', '#6366f1'];

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

export default function CreateModuleModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [examDate, setExamDate] = useState('');
  const [createdModule, setCreatedModule] = useState<Module | null>(null);

  const mutation = useMutation({
    mutationFn: createModule,
    onSuccess: (module) => {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      setCreatedModule(module);
    },
  });

  const reset = () => {
    setName('');
    setDescription('');
    setColor(PRESET_COLORS[0]);
    setExamDate('');
    setCreatedModule(null);
    mutation.reset();
  };

  const canSubmit = useMemo(() => name.trim().length > 0 && !mutation.isPending, [name, mutation.isPending]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 15, 15, 0.78)' }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          reset();
          onClose();
        }
      }}
    >
      <div className="w-full max-w-2xl p-6" style={glass}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.3rem' }}>
              {createdModule ? 'Add Documents' : 'Create Module'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {createdModule
                ? 'Upload now and let the backend build the module automatically.'
                : 'Set up the module first, then upload documents in the next step.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {!createdModule ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit) {
                return;
              }
              mutation.mutate({
                name: name.trim(),
                description: description.trim(),
                color,
                exam_date: examDate || undefined,
              });
            }}
            className="space-y-5"
          >
            <div>
              <label className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Module name
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Molecular Biology"
                className="w-full px-3 py-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
                autoFocus
              />
            </div>

            <div>
              <label className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="A short description of what this module covers."
                className="w-full px-3 py-3"
                rows={3}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', resize: 'none' }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Exam date
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(event) => setExamDate(event.target.value)}
                  className="w-full px-3 py-3"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Accent colour
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setColor(preset)}
                      aria-label={`Select ${preset}`}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 999,
                        background: preset,
                        border: color === preset ? '2px solid #fff' : '2px solid transparent',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {mutation.isError && (
              <p style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>Failed to create module.</p>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  reset();
                  onClose();
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button type="submit" disabled={!canSubmit} className="scholar-btn">
                <FolderSimplePlus size={18} />
                {mutation.isPending ? 'Creating…' : 'Create Module'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div
              className="flex items-center gap-3 mb-4 p-3"
              style={{ ...glass, borderColor: 'rgba(120, 180, 120, 0.3)', background: 'rgba(120, 180, 120, 0.08)' }}
            >
              <CheckCircle size={20} weight="fill" style={{ color: 'var(--success)' }} />
              <div>
                <p style={{ color: 'var(--text)', fontSize: '0.95rem' }}>{createdModule.name} is ready.</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Upload files now or skip and do it later from the module page.</p>
              </div>
            </div>

            <UploadDocumentsPane moduleId={createdModule.id} moduleName={createdModule.name} />

            <div className="flex items-center justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => {
                  const moduleId = createdModule.id;
                  reset();
                  onClose();
                  navigate(`/modules/${moduleId}`);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Skip for now
              </button>
              <button
                type="button"
                className="scholar-btn"
                onClick={() => {
                  const moduleId = createdModule.id;
                  reset();
                  onClose();
                  navigate(`/modules/${moduleId}`);
                }}
              >
                Open Module
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
