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
} from 'lucide-react';
import { getModules, uploadDocument } from '../api/client';
import type { Document } from '../types';

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
        // auto-upload
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
        <Upload className="w-6 h-6 text-teal" />
        <h1 className="text-2xl font-bold">Upload Center</h1>
      </div>

      {/* Module selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select Module
        </label>
        <select
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          className="w-full bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-teal transition-colors"
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
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
          dragOver
            ? 'border-teal bg-teal/5'
            : 'border-gray-700 hover:border-gray-500'
        } ${!moduleId ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <CloudUpload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-300 mb-1">
          Drag & drop files here, or click to browse
        </p>
        <p className="text-sm text-gray-500">
          Accepted: .pdf, .txt, .md
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              addFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
      </div>

      {/* Upload list */}
      {uploads.length > 0 && (
        <div className="mt-6 space-y-2">
          {uploads.map((item, idx) => (
            <div
              key={idx}
              className="bg-navy-light rounded-lg border border-gray-800 px-4 py-3 flex items-center gap-3"
            >
              <FileText className="w-5 h-5 text-gray-400 shrink-0" />
              <span className="flex-1 text-sm truncate">{item.file.name}</span>
              <span className="text-xs text-gray-500">
                {(item.file.size / 1024).toFixed(0)} KB
              </span>
              {item.status === 'uploading' && (
                <Loader2 className="w-4 h-4 animate-spin text-teal" />
              )}
              {item.status === 'done' && (
                <CheckCircle className="w-4 h-4 text-green-400" />
              )}
              {item.status === 'error' && (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              {item.status === 'pending' && (
                <span className="text-xs text-gray-500">Waiting…</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
