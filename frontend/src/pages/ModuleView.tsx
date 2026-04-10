import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Layers,
  Clock,
  TrendingUp,
  Trash2,
  Upload,
  Sparkles,
  Play,
  Brain,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { getModule, deleteDocument, generateCards } from '../api/client';
import type { Document } from '../types';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    done: 'bg-green-500/10 text-green-400',
    processing: 'bg-yellow-500/10 text-yellow-400',
    pending: 'bg-gray-500/10 text-gray-400',
    failed: 'bg-red-500/10 text-red-400',
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}

export default function ModuleView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: mod,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['module', id],
    queryFn: () => getModule(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['module', id] });
      queryClient.invalidateQueries({ queryKey: ['modules'] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => generateCards(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['module', id] });
      queryClient.invalidateQueries({ queryKey: ['modules'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-teal" />
      </div>
    );
  }

  if (error || !mod) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">Failed to load module.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-teal hover:underline text-sm"
        >
          Go back
        </button>
      </div>
    );
  }

  const masteryColor =
    mod.mastery_pct >= 80
      ? 'text-green-400'
      : mod.mastery_pct >= 50
        ? 'text-yellow-400'
        : 'text-red-400';

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className="w-2 h-10 rounded-full shrink-0 mt-1"
          style={{ backgroundColor: mod.color }}
        />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{mod.name}</h1>
          {mod.description && (
            <p className="text-gray-400 mt-1">{mod.description}</p>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-navy-light rounded-xl border border-gray-800 p-4 flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-400" />
          <div>
            <p className="text-sm text-gray-400">Documents</p>
            <p className="text-xl font-bold">{mod.total_documents}</p>
          </div>
        </div>
        <div className="bg-navy-light rounded-xl border border-gray-800 p-4 flex items-center gap-3">
          <Layers className="w-5 h-5 text-purple-400" />
          <div>
            <p className="text-sm text-gray-400">Flashcards</p>
            <p className="text-xl font-bold">{mod.total_cards}</p>
          </div>
        </div>
        <div className="bg-navy-light rounded-xl border border-gray-800 p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-teal" />
          <div>
            <p className="text-sm text-gray-400">Due Cards</p>
            <p className="text-xl font-bold">{mod.due_cards}</p>
          </div>
        </div>
        <div className="bg-navy-light rounded-xl border border-gray-800 p-4 flex items-center gap-3">
          <TrendingUp className={`w-5 h-5 ${masteryColor}`} />
          <div>
            <p className="text-sm text-gray-400">Mastery</p>
            <p className="text-xl font-bold">{Math.round(mod.mastery_pct)}%</p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => navigate(`/upload?module=${id}`)}
          className="flex items-center gap-2 bg-navy-light border border-gray-700 hover:border-gray-500 rounded-lg px-4 py-2 text-sm transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload Documents
        </button>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="flex items-center gap-2 bg-navy-light border border-gray-700 hover:border-gray-500 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-50"
        >
          {generateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 text-yellow-400" />
          )}
          Generate Flashcards
        </button>
        <button
          onClick={() => navigate(`/flashcards/${id}`)}
          className="flex items-center gap-2 bg-teal hover:bg-teal-dark text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Play className="w-4 h-4" />
          Start Review
        </button>
        <button
          onClick={() => navigate(`/quiz?module=${id}`)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Brain className="w-4 h-4" />
          Take Quiz
        </button>
      </div>

      {/* Generate result */}
      {generateMutation.isSuccess && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6 text-sm text-green-400">
          ✅ Generated {generateMutation.data.generated} flashcards!
        </div>
      )}
      {generateMutation.isError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-sm text-red-400">
          Failed to generate flashcards. Make sure you have documents and an API key configured.
        </div>
      )}

      {/* Documents table */}
      <h2 className="text-lg font-semibold mb-4">Documents</h2>
      {mod.documents && mod.documents.length > 0 ? (
        <div className="bg-navy-light rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-4 py-3 font-medium">Filename</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Words</th>
                <th className="text-right px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {mod.documents.map((doc: Document) => (
                <tr
                  key={doc.id}
                  className="border-b border-gray-800/50 last:border-b-0"
                >
                  <td className="px-4 py-3 text-white">{doc.filename}</td>
                  <td className="px-4 py-3 text-gray-400 uppercase text-xs">
                    {doc.file_type}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={doc.processing_status} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {doc.word_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {doc.created_at
                      ? new Date(doc.created_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(doc.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-navy-light rounded-xl border border-gray-800">
          <p className="text-gray-400">
            No documents yet.{' '}
            <button
              onClick={() => navigate(`/upload?module=${id}`)}
              className="text-teal hover:underline"
            >
              Upload one
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
