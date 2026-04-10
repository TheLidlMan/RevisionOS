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
  Download,
  Share2,
  Calendar,
} from 'lucide-react';
import { getModule, deleteDocument, generateCards, exportAnki, exportJson } from '../api/client';
import type { Document } from '../types';

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

const accentBtn = {
  background: '#c4956a',
  color: '#1a1714',
  borderRadius: '8px',
  fontWeight: 500 as const,
  border: 'none',
};

const secondaryBtn = {
  ...glass,
  color: '#f5f0e8',
  fontWeight: 300 as const,
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    done: { bg: 'rgba(120,180,120,0.1)', color: 'rgba(120,180,120,0.9)' },
    processing: { bg: 'rgba(196,149,106,0.1)', color: '#c4956a' },
    pending: { bg: 'rgba(245,240,232,0.06)', color: 'rgba(245,240,232,0.5)' },
    failed: { bg: 'rgba(220,120,100,0.1)', color: 'rgba(220,120,100,0.9)' },
  };
  const s = colors[status] ?? colors.pending;
  return (
    <span
      style={{ background: s.bg, color: s.color, borderRadius: '9999px', fontWeight: 300, fontSize: '0.75rem' }}
      className="px-2 py-0.5"
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
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#c4956a' }} />
      </div>
    );
  }

  if (error || !mod) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: 'rgba(220,120,100,0.8)' }}>Failed to load module.</p>
        <button
          onClick={() => navigate('/')}
          style={{ color: '#c4956a' }}
          className="mt-4 text-sm hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const masteryColor =
    mod.mastery_pct >= 80
      ? 'rgba(120,180,120,0.9)'
      : mod.mastery_pct >= 50
        ? '#c4956a'
        : 'rgba(220,120,100,0.8)';

  const kpiIcons = [
    { icon: FileText, color: '#c4956a', label: 'Documents', value: mod.total_documents },
    { icon: Layers, color: 'rgba(196,149,106,0.7)', label: 'Flashcards', value: mod.total_cards },
    { icon: Clock, color: '#c4956a', label: 'Due Cards', value: mod.due_cards },
    { icon: TrendingUp, color: masteryColor, label: 'Mastery', value: `${Math.round(mod.mastery_pct)}%` },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-sm mb-6 transition-colors"
        style={{ color: 'rgba(245,240,232,0.5)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#f5f0e8')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(245,240,232,0.5)')}
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
          <h1
            style={{ fontFamily: "'Clash Display', sans-serif", color: '#f5f0e8' }}
            className="text-2xl"
          >
            {mod.name}
          </h1>
          {mod.description && (
            <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }} className="mt-1">
              {mod.description}
            </p>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {kpiIcons.map(({ icon: Icon, color, label, value }) => (
          <div key={label} style={glass} className="p-4 flex items-center gap-3">
            <Icon className="w-5 h-5" style={{ color }} />
            <div>
              <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.8rem' }}>{label}</p>
              <p style={{ color: '#f5f0e8', fontWeight: 200, fontSize: '1.5rem' }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => navigate(`/upload?module=${id}`)}
          style={secondaryBtn}
          className="flex items-center gap-2 px-4 py-2 text-sm transition-all hover:opacity-80"
        >
          <Upload className="w-4 h-4" />
          Upload Documents
        </button>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          style={secondaryBtn}
          className="flex items-center gap-2 px-4 py-2 text-sm transition-all hover:opacity-80 disabled:opacity-50"
        >
          {generateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" style={{ color: '#c4956a' }} />
          )}
          Generate Flashcards
        </button>
        <button
          onClick={() => navigate(`/flashcards/${id}`)}
          style={accentBtn}
          className="flex items-center gap-2 px-4 py-2 text-sm transition-opacity hover:opacity-90"
        >
          <Play className="w-4 h-4" />
          Start Review
        </button>
        <button
          onClick={() => navigate(`/quiz?module=${id}`)}
          style={{ ...accentBtn, background: 'rgba(196,149,106,0.7)' }}
          className="flex items-center gap-2 px-4 py-2 text-sm transition-opacity hover:opacity-90"
        >
          <Brain className="w-4 h-4" />
          Take Quiz
        </button>
        <button
          onClick={async () => {
            const blob = await exportAnki(id!);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${mod.name}.apkg`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={secondaryBtn}
          className="flex items-center gap-2 px-4 py-2 text-sm transition-all hover:opacity-80"
        >
          <Download className="w-4 h-4" />
          Export Anki
        </button>
        <button
          onClick={async () => {
            const blob = await exportJson(id!);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${mod.name}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={secondaryBtn}
          className="flex items-center gap-2 px-4 py-2 text-sm transition-all hover:opacity-80"
        >
          <Download className="w-4 h-4" />
          Export JSON
        </button>
        <button
          onClick={() => navigate(`/knowledge-graph?module=${id}`)}
          style={secondaryBtn}
          className="flex items-center gap-2 px-4 py-2 text-sm transition-all hover:opacity-80"
        >
          <Share2 className="w-4 h-4" style={{ color: '#c4956a' }} />
          View Knowledge Graph
        </button>
        <button
          onClick={() => navigate(`/curriculum?module=${id}`)}
          style={secondaryBtn}
          className="flex items-center gap-2 px-4 py-2 text-sm transition-all hover:opacity-80"
        >
          <Calendar className="w-4 h-4" style={{ color: '#c4956a' }} />
          Generate Study Plan
        </button>
      </div>

      {/* Generate result */}
      {generateMutation.isSuccess && (
        <div
          style={{ background: 'rgba(120,180,120,0.06)', border: '1px solid rgba(120,180,120,0.15)', borderRadius: '12px' }}
          className="p-4 mb-6"
        >
          <p style={{ color: 'rgba(120,180,120,0.9)', fontWeight: 300, fontSize: '0.9rem' }}>
            Generated {generateMutation.data.generated} flashcards!
          </p>
        </div>
      )}
      {generateMutation.isError && (
        <div
          style={{ background: 'rgba(220,120,100,0.06)', border: '1px solid rgba(220,120,100,0.15)', borderRadius: '12px' }}
          className="p-4 mb-6"
        >
          <p style={{ color: 'rgba(220,120,100,0.8)', fontWeight: 300, fontSize: '0.9rem' }}>
            Failed to generate flashcards. Make sure you have documents and an API key configured.
          </p>
        </div>
      )}

      {/* Documents table */}
      <h2
        style={{ fontFamily: "'Clash Display', sans-serif", color: '#f5f0e8' }}
        className="text-lg mb-4"
      >
        Documents
      </h2>
      {mod.documents && mod.documents.length > 0 ? (
        <div style={{ ...glass, overflow: 'hidden' }}>
          <table className="w-full" style={{ fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(139,115,85,0.15)' }}>
                <th style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }} className="text-left px-4 py-3">Filename</th>
                <th style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }} className="text-left px-4 py-3">Type</th>
                <th style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }} className="text-left px-4 py-3">Status</th>
                <th style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }} className="text-right px-4 py-3">Words</th>
                <th style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }} className="text-right px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {mod.documents.map((doc: Document) => (
                <tr
                  key={doc.id}
                  style={{ borderBottom: '1px solid rgba(139,115,85,0.08)' }}
                >
                  <td className="px-4 py-3" style={{ color: '#f5f0e8', fontWeight: 300 }}>{doc.filename}</td>
                  <td className="px-4 py-3" style={{ color: 'rgba(245,240,232,0.5)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 300 }}>
                    {doc.file_type}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={doc.processing_status} />
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>
                    {doc.word_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>
                    {doc.created_at
                      ? new Date(doc.created_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(doc.id)}
                      style={{ color: 'rgba(245,240,232,0.25)' }}
                      className="transition-colors"
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(220,120,100,0.8)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(245,240,232,0.25)')}
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
        <div style={glass} className="text-center py-12">
          <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }}>
            No documents yet.{' '}
            <button
              onClick={() => navigate(`/upload?module=${id}`)}
              style={{ color: '#c4956a' }}
              className="hover:underline"
            >
              Upload one
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
