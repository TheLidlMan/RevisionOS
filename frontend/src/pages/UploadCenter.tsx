import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  CloudUpload,
  FolderOpen,
} from 'lucide-react';
import { getModules, uploadDocument, importFolder } from '../api/client';
import type { Document } from '../types';

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '8px',
  color: '#f5f0e8',
  outline: 'none',
  fontWeight: 300,
};

const buttonStyle: React.CSSProperties = {
  background: '#c4956a',
  color: '#1a1714',
  borderRadius: '8px',
  fontWeight: 500,
  border: 'none',
};

const headingFont: React.CSSProperties = {
  fontFamily: "'Clash Display', sans-serif",
  color: '#f5f0e8',
};

interface UploadItem {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  result?: Document;
  error?: string;
}

export default function UploadCenter() {
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('module') ?? '';
  const [moduleId, setModuleId] = useState(preselected);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [selectFocused, setSelectFocused] = useState(false);

  const { data: modules } = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, idx }: { file: File; idx: number }) => {
      setUploads((prev) =>
        prev.map((u, i) => (i === idx ? { ...u, status: 'uploading' } : u))
      );
      return uploadDocument(moduleId, file);
    },
    onSuccess: (result, { idx }) => {
      setUploads((prev) =>
        prev.map((u, i) =>
          i === idx ? { ...u, status: 'done', result } : u
        )
      );
      queryClient.invalidateQueries({ queryKey: ['modules'] });
    },
    onError: (err, { idx }) => {
      setUploads((prev) =>
        prev.map((u, i) =>
          i === idx
            ? { ...u, status: 'error', error: (err as Error).message }
            : u
        )
      );
    },
  });

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newItems: UploadItem[] = Array.from(files).map((file) => ({
        file,
        status: 'pending' as const,
      }));
      setUploads((prev) => {
        const updated = [...prev, ...newItems];
        newItems.forEach((item, i) => {
          const idx = prev.length + i;
          if (moduleId) {
            uploadMutation.mutate({ file: item.file, idx });
          }
        });
        return updated;
      });
    },
    [moduleId, uploadMutation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <Upload className="w-6 h-6" style={{ color: '#c4956a' }} />
        <h1 style={{ ...headingFont, fontSize: '1.5rem', fontWeight: 700 }}>
          Upload Center
        </h1>
      </div>

      {/* Module selector */}
      <div className="mb-6">
        <label
          className="block mb-2"
          style={{ color: 'rgba(245,240,232,0.5)', fontSize: '0.875rem', fontWeight: 300 }}
        >
          Select Module
        </label>
        <select
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          onFocus={() => setSelectFocused(true)}
          onBlur={() => setSelectFocused(false)}
          className="w-full px-3 py-2.5"
          style={{
            ...inputStyle,
            border: selectFocused
              ? '1px solid rgba(196,149,106,0.6)'
              : '1px solid rgba(139,115,85,0.15)',
          }}
        >
          <option value="">Choose a module…</option>
          {modules?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        className={`p-12 text-center cursor-pointer ${
          !moduleId ? 'opacity-50 pointer-events-none' : ''
        }`}
        style={{
          ...glass,
          border: dragOver
            ? '2px dashed rgba(196,149,106,0.4)'
            : '2px dashed rgba(139,115,85,0.3)',
          background: dragOver
            ? 'rgba(196,149,106,0.06)'
            : glass.background,
          transition: 'border-color 0.2s, background 0.2s',
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <CloudUpload
          className="w-12 h-12 mx-auto mb-4"
          style={{ color: 'rgba(245,240,232,0.25)' }}
        />
        <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, marginBottom: '0.25rem' }}>
          Drag & drop files here, or click to browse
        </p>
        <p style={{ color: 'rgba(245,240,232,0.25)', fontSize: '0.875rem', fontWeight: 300 }}>
          Accepted: .pdf, .txt, .md, .pptx, .docx, .mp3, .mp4, .png, .jpg, .jpeg
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.pptx,.docx,.mp3,.mp4,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              addFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
      </div>

      {/* Folder import */}
      <FolderImportSection moduleId={moduleId} />

      {/* Upload list */}
      {uploads.length > 0 && (
        <div className="mt-6" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {uploads.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 px-4 py-3"
              style={{ ...glass, borderRadius: '8px' }}
            >
              <FileText
                className="w-5 h-5 shrink-0"
                style={{ color: 'rgba(245,240,232,0.25)' }}
              />
              <span
                className="flex-1 truncate"
                style={{ color: '#f5f0e8', fontSize: '0.875rem', fontWeight: 300 }}
              >
                {item.file.name}
              </span>
              <span style={{ color: 'rgba(245,240,232,0.25)', fontSize: '0.75rem', fontWeight: 300 }}>
                {(item.file.size / 1024).toFixed(0)} KB
              </span>
              {item.status === 'uploading' && (
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#c4956a' }} />
              )}
              {item.status === 'done' && (
                <CheckCircle className="w-4 h-4" style={{ color: 'rgba(120,180,120,0.8)' }} />
              )}
              {item.status === 'error' && (
                <XCircle className="w-4 h-4" style={{ color: 'rgba(220,120,100,0.8)' }} />
              )}
              {item.status === 'pending' && (
                <span style={{ color: 'rgba(245,240,232,0.25)', fontSize: '0.75rem', fontWeight: 300 }}>
                  Waiting…
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FolderImportSection({ moduleId }: { moduleId: string }) {
  const [folderPath, setFolderPath] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const queryClient = useQueryClient();

  const folderMutation = useMutation({
    mutationFn: () => importFolder(moduleId, folderPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      setFolderPath('');
    },
  });

  return (
    <div className="mt-8">
      <h2
        className="flex items-center gap-2 mb-3"
        style={{ ...headingFont, fontSize: '1.125rem', fontWeight: 600 }}
      >
        <FolderOpen className="w-5 h-5" style={{ color: '#c4956a' }} />
        Folder Import
      </h2>
      <div className="p-5" style={glass}>
        <label
          className="block mb-2"
          style={{ color: 'rgba(245,240,232,0.5)', fontSize: '0.875rem', fontWeight: 300 }}
        >
          Local Folder Path
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="/path/to/your/notes"
            className="flex-1 px-3 py-2.5"
            style={{
              ...inputStyle,
              border: inputFocused
                ? '1px solid rgba(196,149,106,0.6)'
                : '1px solid rgba(139,115,85,0.15)',
            }}
          />
          <button
            onClick={() => folderMutation.mutate()}
            disabled={!moduleId || !folderPath || folderMutation.isPending}
            className="flex items-center gap-2 shrink-0 px-4 py-2.5"
            style={{
              ...buttonStyle,
              fontSize: '0.875rem',
              opacity: !moduleId || !folderPath || folderMutation.isPending ? 0.5 : 1,
              cursor: !moduleId || !folderPath || folderMutation.isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {folderMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4" />
            )}
            Import Folder
          </button>
        </div>
        {folderMutation.isSuccess && (
          <p className="mt-2" style={{ color: 'rgba(120,180,120,0.8)', fontSize: '0.875rem', fontWeight: 300 }}>
            Folder imported successfully!
          </p>
        )}
        {folderMutation.isError && (
          <p className="mt-2" style={{ color: 'rgba(220,120,100,0.8)', fontSize: '0.875rem', fontWeight: 300 }}>
            Failed to import folder.
          </p>
        )}
      </div>
    </div>
  );
}