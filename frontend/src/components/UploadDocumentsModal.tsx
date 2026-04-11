import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle,
  FileText,
  SpinnerGap,
  UploadSimple,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { uploadDocument } from '../api/client';
import type { Document } from '../types';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

export interface UploadItem {
  file: File;
  status: 'pending' | 'uploading' | 'queued' | 'error';
  result?: Document;
  error?: string;
}

interface UploadPaneProps {
  moduleId: string;
  moduleName?: string;
  onUploaded?: () => void;
}

export function UploadDocumentsPane({ moduleId, moduleName, onUploaded }: UploadPaneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: ({ file, idx }: { file: File; idx: number }) => {
      setUploads((current) => current.map((item, itemIdx) => (itemIdx === idx ? { ...item, status: 'uploading' } : item)));
      return uploadDocument(moduleId, file);
    },
    onSuccess: (result, { idx }) => {
      setUploads((current) =>
        current.map((item, itemIdx) => (itemIdx === idx ? { ...item, status: 'queued', result } : item)),
      );
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      queryClient.invalidateQueries({ queryKey: ['module', moduleId] });
      onUploaded?.();
    },
    onError: (error, { idx }) => {
      setUploads((current) =>
        current.map((item, itemIdx) =>
          itemIdx === idx ? { ...item, status: 'error', error: (error as Error).message } : item,
        ),
      );
    },
  });

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const newItems = Array.from(incoming).map((file) => ({ file, status: 'pending' as const }));
      setUploads((current) => {
        const next = [...current, ...newItems];
        newItems.forEach((item, offset) => {
          uploadMutation.mutate({ file: item.file, idx: current.length + offset });
        });
        return next;
      });
    },
    [uploadMutation],
  );

  const counts = useMemo(
    () => ({
      queued: uploads.filter((item) => item.status === 'queued').length,
      uploading: uploads.filter((item) => item.status === 'uploading').length,
    }),
    [uploads],
  );

  return (
    <div>
      <div className="mb-4">
        <h3 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.05rem' }}>
          Upload Documents{moduleName ? ` to ${moduleName}` : ''}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Files start processing as soon as they upload. Summaries, topic mapping, flashcards, and the study plan all run on the backend.
        </p>
      </div>

      <div
        className="p-8 text-center cursor-pointer transition-colors"
        style={{
          ...glass,
          border: dragOver ? '1px solid var(--accent)' : '1px dashed var(--border)',
          background: dragOver ? 'var(--accent-soft)' : 'var(--surface)',
        }}
        onClick={() => fileRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (event.dataTransfer.files.length) {
            addFiles(event.dataTransfer.files);
          }
        }}
      >
        <UploadSimple size={36} weight="duotone" style={{ color: 'var(--accent)', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text)', fontSize: '0.95rem', marginBottom: 6 }}>Drag files here or click to browse</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          PDF, text, slides, docs, audio, video, and images are supported.
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.pptx,.docx,.mp3,.mp4,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) {
              addFiles(event.target.files);
              event.target.value = '';
            }
          }}
        />
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <span>{counts.uploading} uploading</span>
        <span>{counts.queued} queued for backend processing</span>
      </div>

      {uploads.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploads.map((item, index) => (
            <div key={`${item.file.name}-${index}`} className="flex items-center gap-3 p-3" style={glass}>
              <FileText size={20} style={{ color: 'var(--text-secondary)' }} />
              <div className="flex-1 min-w-0">
                <p className="truncate" style={{ color: 'var(--text)', fontSize: '0.9rem' }}>
                  {item.file.name}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  {(item.file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              {item.status === 'uploading' && <SpinnerGap size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />}
              {item.status === 'queued' && <CheckCircle size={18} weight="fill" style={{ color: 'var(--success)' }} />}
              {item.status === 'error' && <WarningCircle size={18} weight="fill" style={{ color: 'var(--danger)' }} />}
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                {item.status === 'queued' ? 'Queued' : item.status === 'uploading' ? 'Uploading' : item.status === 'error' ? 'Failed' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface UploadDocumentsModalProps extends UploadPaneProps {
  open: boolean;
  onClose: () => void;
}

export default function UploadDocumentsModal({ open, onClose, ...paneProps }: UploadDocumentsModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 15, 15, 0.75)' }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-3xl p-6" style={glass}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.35rem' }}>Upload Documents</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Everything after upload happens automatically.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            aria-label="Close upload modal"
          >
            <X size={20} />
          </button>
        </div>
        <UploadDocumentsPane {...paneProps} />
      </div>
    </div>
  );
}
