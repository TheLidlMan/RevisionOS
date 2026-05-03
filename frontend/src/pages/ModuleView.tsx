import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDots,
  CardsThree,
  CheckCircle,
  Export,
  FileText,
  Graph,
  PlayCircle,
  SpinnerGap,
  Trash,
  UploadSimple,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react';
import {
  cancelDocumentProcessing,
  cancelModuleProcessing,
  deleteDocument,
  deleteModule,
  exportAnki,
  exportCardsCsv,
  exportCardsJson,
  exportJson,
  generateCardsStream,
  getContentMap,
  getCurriculum,
  getKnowledgeGraph,
  getModule,
  updateModule,
  generateCardsFromTopic,
} from '../api/client';
import DocumentSummary from '../components/DocumentSummary';
import ShowMoreText from '../components/ShowMoreText';
import Skeleton from '../components/Skeleton';
import { useToast } from '../hooks/useToast';
import UploadDocumentsModal from '../components/UploadDocumentsModal';
import { usePersistentState } from '../hooks/usePersistentState';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import type { ContentMapData, CurriculumData, Document, KnowledgeGraphData, ModuleDetail } from '../types';
import { formatDateTime, formatRelativeTime, titleCase } from '../utils/formatters';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

type DocumentSort = 'UPDATED' | 'NEWEST' | 'OLDEST' | 'A_Z';

const ACTIVE_DOCUMENT_STATUSES = new Set(['pending', 'processing', 'cancelling']);
const CANCELLABLE_DOCUMENT_STATUSES = new Set(['pending', 'processing']);

function getPipelineRefetchInterval(status: string | undefined, updatedAt: string | null | undefined) {
  if (!status || !['queued', 'running', 'cancelling'].includes(status)) {
    return false;
  }

  const lastUpdate = updatedAt ? new Date(updatedAt).getTime() : 0;
  const ageMs = lastUpdate > 0 ? Date.now() - lastUpdate : Number.POSITIVE_INFINITY;
  if (ageMs < 15_000) {
    return 2_000;
  }
  if (ageMs < 60_000) {
    return 5_000;
  }
  return 10_000;
}

const formatFileSize = (bytes: number) => {
  if (!bytes || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
};

export default function ModuleView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [topicGenOpen, setTopicGenOpen] = useState(false);
  const [topicInput, setTopicInput] = useState('');
  const [examDateDraft, setExamDateDraft] = useState<string | null>(null);
  const [documentSort, setDocumentSort] = usePersistentState<DocumentSort>(`module:${id}:document-sort`, 'UPDATED');
  const [pendingDocumentDeletes, setPendingDocumentDeletes] = useState<string[]>([]);
  const [cancellingDocumentId, setCancellingDocumentId] = useState<string | null>(null);
  const [flashcardStatus, setFlashcardStatus] = useState('');
  const deleteTimeoutsRef = useRef<Map<string, number>>(new Map());
  const moduleDeleteTimeoutRef = useRef<number | null>(null);
  useScrollRestoration(`module:${id}`);

  const refreshModuleData = () => {
    queryClient.invalidateQueries({ queryKey: ['module', id] });
    queryClient.invalidateQueries({ queryKey: ['modules'] });
    queryClient.invalidateQueries({ queryKey: ['content-map', id] });
    queryClient.invalidateQueries({ queryKey: ['knowledge-graph', id] });
    queryClient.invalidateQueries({ queryKey: ['curriculum', id] });
  };

  const moduleQuery = useQuery({
    queryKey: ['module', id],
    queryFn: () => getModule(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data as ModuleDetail | undefined;
      return getPipelineRefetchInterval(data?.pipeline_status, data?.pipeline_updated_at);
    },
  });

  const mod = moduleQuery.data;

  const contentMapQuery = useQuery<ContentMapData>({
    queryKey: ['content-map', id],
    queryFn: () => getContentMap(id!),
    enabled: !!id,
  });

  const graphQuery = useQuery<KnowledgeGraphData>({
    queryKey: ['knowledge-graph', id],
    queryFn: () => getKnowledgeGraph(id!),
    enabled: !!id,
  });

  const curriculumQuery = useQuery<CurriculumData>({
    queryKey: ['curriculum', id],
    queryFn: () => getCurriculum(id!),
    enabled: !!id && Boolean(mod?.has_study_plan),
  });

  const serverExamDate = mod?.exam_date ? mod.exam_date.slice(0, 10) : '';
  const examDateInput = examDateDraft ?? serverExamDate;

  const deleteDocumentMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['module', id] });
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      queryClient.invalidateQueries({ queryKey: ['content-map', id] });
    },
  });

  const updateModuleMutation = useMutation({
    mutationFn: (payload: { exam_date?: string }) => updateModule(id!, payload),
    onSuccess: (updated) => {
      setExamDateDraft(updated.exam_date ? updated.exam_date.slice(0, 10) : '');
      queryClient.invalidateQueries({ queryKey: ['module', id] });
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      queryClient.invalidateQueries({ queryKey: ['curriculum', id] });
      showToast({ title: 'Exam date saved', description: 'The study plan will refresh automatically.', tone: 'success' });
    },
  });

  const deleteModuleMutation = useMutation({
    mutationFn: () => deleteModule(id!),
    onSuccess: () => {
      if (typeof window !== 'undefined') {
        ['curriculum:module', 'forgetting-curve:module'].forEach((storageKey) => {
          if (window.localStorage.getItem(storageKey) === id) {
            window.localStorage.removeItem(storageKey);
          }
        });
      }
      queryClient.setQueryData(['modules'], (current: Array<{ id: string }> | undefined) =>
        current?.filter((module) => module.id !== id),
      );
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.removeQueries({
        predicate: ({ queryKey }) =>
          Array.isArray(queryKey)
          && typeof queryKey[0] === 'string'
          && ['module', 'content-map', 'knowledge-graph', 'curriculum', 'flashcards', 'forgetting-curve', 'search'].includes(queryKey[0]),
      });
      navigate('/');
    },
  });

  const generateCardsMutation = useMutation({
    mutationFn: () => generateCardsStream(id!, undefined, (event) => {
      if (event.event === 'status') {
        setFlashcardStatus(event.message || 'Generating flashcards');
      }
      if (event.event === 'final' && event.result) {
        setFlashcardStatus(`Generated ${event.result.generated} card${event.result.generated === 1 ? '' : 's'}`);
      }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['module', id] });
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      queryClient.invalidateQueries({ queryKey: ['flashcards', id] });
    },
  });

  const topicGenerateMutation = useMutation({
    mutationFn: (topic: string) => generateCardsFromTopic(topic, id!, 30),
    onSuccess: (data) => {
      showToast({
        title: 'Cards Generated',
        description: `Generated ${data.generated} flashcards for "${data.topic}"`,
        tone: 'success',
      });
      setTopicGenOpen(false);
      setTopicInput('');
      queryClient.invalidateQueries({ queryKey: ['module', id] });
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      queryClient.invalidateQueries({ queryKey: ['flashcards', id] });
    },
    onError: () => {
      showToast({ title: 'Generation failed', description: 'Could not generate cards for this topic.', tone: 'error' });
    },
  });

  const cancelProcessingMutation = useMutation({
    mutationFn: () => cancelModuleProcessing(id!),
    onSuccess: (result) => {
      refreshModuleData();
      showToast({
        title: result.cancelled > 0 ? 'Cancellation requested' : 'No active processing found',
        description: result.cancelled > 0 ? `${result.cancelled} pipeline job${result.cancelled === 1 ? '' : 's'} marked for cancellation.` : undefined,
        tone: result.cancelled > 0 ? 'info' : 'success',
      });
    },
  });

  const cancelDocumentMutation = useMutation({
    mutationFn: cancelDocumentProcessing,
    onMutate: (documentId) => {
      setCancellingDocumentId(documentId);
    },
    onSuccess: (document) => {
      refreshModuleData();
      showToast({
        title: document.processing_status === 'cancelling' ? 'Document cancellation requested' : 'No active processing found',
        description: document.processing_status === 'cancelling' ? 'The backend will stop after the current step completes.' : undefined,
        tone: document.processing_status === 'cancelling' ? 'info' : 'success',
      });
    },
    onSettled: () => {
      setCancellingDocumentId(null);
    },
  });

  const graphPreview = useMemo(
    () => (graphQuery.data?.nodes || []).slice().sort((a, b) => b.importance - a.importance).slice(0, 6),
    [graphQuery.data],
  );

  const contentMapOverview = useMemo(() => {
    const data = contentMapQuery.data;
    const topics = data?.topics || [];
    const totalTopics = data?.total_topics ?? topics.length;
    const coveredTopics = data?.covered_topics ?? topics.filter((topic) => topic.has_content).length;
    const uncoveredTopics = data?.uncovered_topics ?? Math.max(totalTopics - coveredTopics, 0);
    const averageWeight = topics.length ? topics.reduce((sum, topic) => sum + topic.study_weight, 0) / topics.length : 0;
    const flashcardCount = topics.reduce((sum, topic) => sum + topic.flashcard_count, 0);
    const questionCount = topics.reduce((sum, topic) => sum + topic.question_count, 0);
    const rootTopicCount = topics.filter((topic) => !topic.parent_id).length;

    return {
      totalTopics,
      coveredTopics,
      uncoveredTopics,
      averageWeight,
      flashcardCount,
      questionCount,
      rootTopicCount,
    };
  }, [contentMapQuery.data]);

  const graphOverview = useMemo(() => {
    const nodes = graphQuery.data?.nodes || [];
    const edges = graphQuery.data?.edges || [];

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      strongestNode: graphPreview[0],
    };
  }, [graphPreview, graphQuery.data]);

  const sortedDocuments = useMemo(() => {
    const documents = [...(mod?.documents || [])].filter((doc) => !pendingDocumentDeletes.includes(doc.id));
    if (documentSort === 'A_Z') {
      return documents.sort((a, b) => a.filename.localeCompare(b.filename));
    }
    if (documentSort === 'NEWEST') {
      return documents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    if (documentSort === 'OLDEST') {
      return documents.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return documents.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [documentSort, mod?.documents, pendingDocumentDeletes]);

  const queueDocumentDelete = (doc: Document) => {
    setPendingDocumentDeletes((current) => [...current, doc.id]);
    const timeout = window.setTimeout(() => {
      deleteDocumentMutation.mutate(doc.id);
      setPendingDocumentDeletes((current) => current.filter((value) => value !== doc.id));
      deleteTimeoutsRef.current.delete(doc.id);
    }, 5000);
    deleteTimeoutsRef.current.set(doc.id, timeout);
    showToast({
      title: `Deleted "${doc.filename}"`,
      description: 'Undo within 5 seconds if you still need this file.',
      tone: 'info',
      durationMs: 5200,
      action: {
        label: 'Undo',
        onClick: () => {
          const pending = deleteTimeoutsRef.current.get(doc.id);
          if (pending) {
            window.clearTimeout(pending);
            deleteTimeoutsRef.current.delete(doc.id);
            setPendingDocumentDeletes((current) => current.filter((value) => value !== doc.id));
          }
        },
      },
    });
  };

  const queueModuleDelete = () => {
    if (moduleDeleteTimeoutRef.current) {
      window.clearTimeout(moduleDeleteTimeoutRef.current);
    }
    moduleDeleteTimeoutRef.current = window.setTimeout(() => {
      deleteModuleMutation.mutate();
      moduleDeleteTimeoutRef.current = null;
    }, 5000);

    showToast({
      title: `Module "${mod?.name}" scheduled for deletion`,
      description: 'Undo within 5 seconds to keep everything intact.',
      tone: 'info',
      durationMs: 5200,
      action: {
        label: 'Undo',
        onClick: () => {
          if (moduleDeleteTimeoutRef.current) {
            window.clearTimeout(moduleDeleteTimeoutRef.current);
            moduleDeleteTimeoutRef.current = null;
          }
        },
      },
    });
  };

  if (moduleQuery.isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full">
        <Skeleton className="h-5 w-40 mb-6" />
        <div className="mb-8">
          <Skeleton className="h-10 w-72 mb-3" />
          <Skeleton className="h-4 w-full max-w-2xl mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          <div className="xl:col-span-2 p-5" style={glass}>
            <Skeleton className="h-6 w-32 mb-5" />
            {[0, 1].map((idx) => (
              <div key={idx} className="mb-3 p-4" style={{ ...glass, borderRadius: '12px' }}>
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-4 w-36 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
          <div className="p-5" style={glass}>
            <Skeleton className="h-6 w-28 mb-5" />
            <Skeleton className="h-11 w-full mb-3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!mod) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: 'var(--danger)' }}>Module not found.</p>
        <button type="button" onClick={() => navigate('/')} className="mt-4" style={{ color: 'var(--accent)' }}>
          Go back
        </button>
      </div>
    );
  }

  const pipelineActive = ['queued', 'running', 'cancelling'].includes(mod.pipeline_status);
  const pipelineUpdatedAt = mod.pipeline_updated_at || mod.updated_at;
  const planSaveDisabled = updateModuleMutation.isPending || examDateInput === serverExamDate;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="hidden md:inline-flex items-center gap-2 mb-6"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>

      <div className="sticky top-0 z-20 -mx-2 px-2 pb-4 mb-6" style={{ background: 'linear-gradient(to bottom, var(--bg) 80%, rgba(15,15,15,0))' }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4" style={glass}>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span style={{ width: 12, height: 12, borderRadius: 999, background: mod.color, flexShrink: 0 }} />
              <h1 className="truncate" style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: 'clamp(1.35rem, 3vw, 1.85rem)' }}>
                {mod.name}
              </h1>
            </div>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {mod.due_cards} due · {Math.round(mod.mastery_pct)}% mastery
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 md:w-auto">
            <button
              type="button"
              className="scholar-btn"
              style={{ background: 'rgba(196,149,106,0.28)', color: 'var(--text)' }}
              onClick={() => navigate(`/flashcards/${mod.id}`)}
            >
              <PlayCircle size={18} />
              Start Review
            </button>
            <button
              type="button"
              className="scholar-btn-secondary"
              onClick={() => navigate(`/quiz?module=${mod.id}`)}
            >
              <BookOpen size={18} />
              Take Quiz
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-6 mb-6">
        <section className="p-5" style={glass}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            Overview
          </p>
          {mod.description ? (
            <ShowMoreText text={mod.description} collapsedLines={2} color="var(--text-secondary)" fontSize="0.95rem" />
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Add source material and let the backend keep this module up to date.</p>
          )}
          <div className="flex flex-wrap gap-3 mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{mod.total_documents} documents</span>
            <span>{mod.total_cards} cards</span>
            <span>{mod.due_cards} due</span>
            <span>{Math.round(mod.mastery_pct)}% mastery</span>
            <span title={formatDateTime(mod.updated_at)}>Updated {formatRelativeTime(mod.updated_at)}</span>
          </div>
        </section>

        <aside className="p-5" style={glass}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Module tools
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button type="button" className="scholar-btn-secondary" onClick={() => setUploadOpen(true)}>
              <UploadSimple size={18} />
              Upload
            </button>
            <button
              type="button"
              className="scholar-btn-secondary"
              onClick={() => generateCardsMutation.mutate()}
              disabled={generateCardsMutation.isPending}
            >
              {generateCardsMutation.isPending ? <SpinnerGap size={18} className="animate-spin" /> : <CardsThree size={18} />}
              {generateCardsMutation.isPending ? 'Generating Cards' : 'Generate Cards'}
            </button>
            <button
              type="button"
              className="scholar-btn-secondary"
              onClick={() => setTopicGenOpen(!topicGenOpen)}
            >
              <BookOpen size={18} />
              {topicGenOpen ? 'Close Topic Tool' : 'From Topic'}
            </button>
            <details className="relative">
              <summary
                className="list-none cursor-pointer px-4 py-2.5 inline-flex items-center justify-center gap-2 w-full"
                style={{ ...glass, color: 'var(--text)', fontSize: '0.9rem', minHeight: 44 }}
              >
                <Export size={18} />
                Export
              </summary>
              <div className="mt-2 p-2 space-y-1 absolute left-0 right-0 sm:right-auto z-10" style={{ ...glass, minWidth: 180 }}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-xl"
                  style={{ color: 'var(--text)' }}
                  onClick={async () => {
                    const blob = await exportAnki(mod.id);
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = `${mod.name}.apkg`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export Anki
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-xl"
                  style={{ color: 'var(--text)' }}
                  onClick={async () => {
                    const blob = await exportJson(mod.id);
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = `${mod.name}.json`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-xl"
                  style={{ color: 'var(--text)' }}
                  onClick={async () => {
                    const blob = await exportCardsJson(mod.id);
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = `${mod.name}_cards.json`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export Cards JSON
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-xl"
                  style={{ color: 'var(--text)' }}
                  onClick={async () => {
                    const blob = await exportCardsCsv(mod.id);
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = `${mod.name}_cards.csv`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export Cards CSV
                </button>
              </div>
            </details>
            <button
              type="button"
              onClick={queueModuleDelete}
              className="px-4 py-2.5 inline-flex items-center justify-center gap-2 rounded-[var(--radius)] sm:col-span-2"
              style={{ ...glass, color: 'var(--danger)', minHeight: 44 }}
            >
              <Trash size={18} />
              Delete Module
            </button>
          </div>

          {flashcardStatus && (
            <p className="mt-3" style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{flashcardStatus}</p>
          )}

          {topicGenOpen && (
            <div className="mt-3 p-4" style={{ ...glass, borderRadius: '12px' }}>
              <p style={{ color: 'var(--text)', fontWeight: 500, fontSize: '0.9rem', marginBottom: 8 }}>
                Generate Cards from Topic
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 12 }}>
                Enter a topic name and AI will generate flashcards from scratch — no upload needed.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder="e.g. Black-Scholes model, Krebs cycle, Treaty of Versailles"
                  className="flex-1 px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(139,115,85,0.1)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.9rem' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && topicInput.trim()) {
                      topicGenerateMutation.mutate(topicInput.trim());
                    }
                  }}
                />
                <button
                  onClick={() => topicGenerateMutation.mutate(topicInput.trim())}
                  disabled={!topicInput.trim() || topicGenerateMutation.isPending}
                  className="scholar-btn px-4 py-2"
                >
                  {topicGenerateMutation.isPending ? <SpinnerGap size={16} className="animate-spin" /> : 'Generate'}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {pipelineActive && (
        <div className="p-4 mb-6" style={glass}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <SpinnerGap size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
              <div>
                <p style={{ color: 'var(--text)', fontSize: '0.95rem' }}>
                  {mod.pipeline_status === 'cancelling' ? 'Backend pipeline is cancelling' : 'Backend pipeline is running'}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{titleCase(mod.pipeline_stage)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                {mod.pipeline_completed} of {Math.max(mod.pipeline_total, 1)} steps complete · updated {formatRelativeTime(pipelineUpdatedAt)}
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl"
                style={{ ...glass, color: 'var(--text-secondary)' }}
                onClick={refreshModuleData}
              >
                <ArrowClockwise size={16} />
                Refresh
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl"
                style={{ ...glass, color: 'var(--danger)', opacity: cancelProcessingMutation.isPending ? 0.6 : 1 }}
                onClick={() => cancelProcessingMutation.mutate()}
                disabled={cancelProcessingMutation.isPending || mod.pipeline_status === 'cancelling'}
              >
                <XCircle size={16} />
                {mod.pipeline_status === 'cancelling' ? 'Cancelling' : 'Cancel Processing'}
              </button>
            </div>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999 }}>
            <div
              style={{
                height: '100%',
                width: `${(mod.pipeline_completed / Math.max(mod.pipeline_total, 1)) * 100}%`,
                background: 'var(--accent)',
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      )}

      {mod.pipeline_status === 'failed' && (
        <div className="p-4 mb-6" style={{ ...glass, borderColor: 'rgba(220,120,100,0.35)' }}>
          <div className="flex items-start gap-3">
            <WarningCircle size={20} weight="fill" style={{ color: 'var(--danger)' }} />
            <div>
              <p style={{ color: 'var(--text)' }}>Pipeline failed</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{mod.pipeline_error || 'Please retry by uploading the document again.'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <section className="xl:col-span-2 p-5" style={glass}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <FileText size={20} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.15rem' }}>Documents</h2>
            </div>
            <select value={documentSort} onChange={(event) => setDocumentSort(event.target.value as DocumentSort)} className="px-3 py-2.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
              <option value="UPDATED">Recently updated</option>
              <option value="NEWEST">Newest</option>
              <option value="OLDEST">Oldest</option>
              <option value="A_Z">A-Z</option>
            </select>
          </div>
          {sortedDocuments.length > 0 ? (
            <div className="space-y-3">
              {sortedDocuments.map((doc) => (
                <div key={doc.id} className="p-4" style={{ ...glass, borderRadius: '12px' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate" style={{ color: 'var(--text)', fontSize: '0.95rem' }}>{doc.filename}</p>
                      <div className="flex flex-wrap gap-3 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <span>{doc.file_type}</span>
                        <span>{formatFileSize(doc.file_size_bytes)}</span>
                        <span>{doc.word_count.toLocaleString()} words</span>
                        <span>{titleCase(doc.processing_status)}</span>
                        <span>{titleCase(doc.processing_stage)}</span>
                        <span title={formatDateTime(doc.last_pipeline_updated_at || doc.updated_at)}>Updated {formatRelativeTime(doc.last_pipeline_updated_at || doc.updated_at)}</span>
                      </div>
                      {ACTIVE_DOCUMENT_STATUSES.has(doc.processing_status) ? (
                        <div style={{ marginTop: 10 }}>
                          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', marginBottom: 8 }}>
                            Step {Math.min(doc.processing_completed, Math.max(doc.processing_total, 1))} of {Math.max(doc.processing_total, 1)}
                          </p>
                          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999 }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${(Math.min(doc.processing_completed, Math.max(doc.processing_total, 1)) / Math.max(doc.processing_total, 1)) * 100}%`,
                                background: 'var(--accent)',
                                borderRadius: 999,
                              }}
                            />
                          </div>
                        </div>
                      ) : null}
                      {doc.summary || doc.summary_data ? (
                        <DocumentSummary summary={doc.summary} summaryData={doc.summary_data} />
                      ) : doc.processing_error ? (
                        <p style={{ color: 'var(--danger)', fontSize: '0.84rem', marginTop: 10 }}>
                          {doc.processing_error}
                        </p>
                      ) : (
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.84rem', marginTop: 10 }}>
                          Summary will appear here when processing completes.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {CANCELLABLE_DOCUMENT_STATUSES.has(doc.processing_status) ? (
                        <button
                          type="button"
                          onClick={() => cancelDocumentMutation.mutate(doc.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{ ...glass, color: 'var(--danger)', opacity: cancellingDocumentId === doc.id ? 0.6 : 1 }}
                          disabled={cancellingDocumentId === doc.id}
                        >
                          {cancellingDocumentId === doc.id ? <SpinnerGap size={16} className="animate-spin" /> : <XCircle size={16} />}
                          {cancellingDocumentId === doc.id ? 'Cancelling' : 'Cancel'}
                        </button>
                      ) : doc.processing_status === 'cancelling' ? (
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl" style={{ ...glass, color: 'var(--text-secondary)' }}>
                          <SpinnerGap size={16} className="animate-spin" />
                          Cancelling
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => queueDocumentDelete(doc)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl"
                        style={{ ...glass, color: 'var(--danger)' }}
                        aria-label={`Delete ${doc.filename}`}
                      >
                        <Trash size={16} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p style={{ color: 'var(--text)', marginBottom: 8 }}>No documents yet.</p>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                Upload files here to kick off summaries, topic mapping, flashcards, and the study plan.
              </p>
              <button type="button" className="scholar-btn" onClick={() => setUploadOpen(true)}>
                <UploadSimple size={18} />
                Upload Documents
              </button>
            </div>
          )}
        </section>

        <section className="p-5" style={glass}>
          <div className="flex items-center gap-2 mb-4">
            <CalendarDots size={20} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.15rem' }}>Study Plan</h2>
          </div>
          <label className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Exam date
          </label>
          <div className="flex gap-2 mb-4">
            <input
              type="date"
              value={examDateInput}
              onChange={(event) => setExamDateDraft(event.target.value)}
              className="flex-1 px-3 py-2.5"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
            />
            <button
              type="button"
              className="scholar-btn"
              disabled={planSaveDisabled}
              onClick={() => updateModuleMutation.mutate({ exam_date: examDateInput || undefined })}
            >
              Save
            </button>
          </div>

          {curriculumQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-18 w-full" />
            </div>
          ) : curriculumQuery.data ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                {curriculumQuery.data.total_weeks} weeks · {curriculumQuery.data.total_concepts} topics
              </div>
              {curriculumQuery.data.weeks.slice(0, 2).map((week) => (
                <div key={week.week} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ color: 'var(--text)', marginBottom: 8 }}>Week {week.week}</p>
                  {week.sessions.slice(0, 2).map((session) => (
                    <p key={`${week.week}-${session.day}-${session.activity}`} style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                      {session.day}: {session.activity}
                    </p>
                  ))}
                </div>
              ))}
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                Generated {formatRelativeTime(curriculumQuery.data.generated_at)}
              </p>
              <button type="button" style={{ color: 'var(--accent)' }} onClick={() => navigate(`/curriculum?module=${mod.id}`)}>
                View Full Plan
              </button>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text)', marginBottom: 8 }}>No study plan yet.</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                {mod.exam_date
                  ? 'The plan will appear after the backend finishes processing the module.'
                  : 'Add an exam date to generate a deterministic plan automatically.'}
              </p>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="p-5" style={glass}>
          <div className="flex items-center gap-2 mb-4">
            <CardsThree size={20} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.15rem' }}>Flashcards</h2>
          </div>
          <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <p>{mod.total_cards} total cards</p>
            <p>{mod.auto_cards} auto-generated</p>
            <p>{mod.manual_cards} manual</p>
            <p>{mod.due_cards} due now</p>
            <p title={formatDateTime(mod.updated_at)}>Last updated {formatRelativeTime(mod.updated_at)}</p>
          </div>
          <button type="button" className="mt-4 inline-flex items-center gap-2" style={{ color: 'var(--accent)' }} onClick={() => navigate(`/modules/${mod.id}/flashcards`)}>
            Manage Flashcards
            <ArrowRight size={16} />
          </button>
        </section>

        <section className="p-5" style={glass}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Graph size={20} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.15rem' }}>Content Map</h2>
            </div>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
              Refreshed {formatRelativeTime(pipelineUpdatedAt)}
            </p>
          </div>
          {contentMapQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-18 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : contentMapOverview.totalTopics > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Topics</p>
                  <p style={{ color: 'var(--text)', fontSize: '1.45rem' }}>{contentMapOverview.totalTopics}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Covered</p>
                  <p style={{ color: 'var(--text)', fontSize: '1.45rem' }}>{contentMapOverview.coveredTopics}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Roots</p>
                  <p style={{ color: 'var(--text)', fontSize: '1.45rem' }}>{contentMapOverview.rootTopicCount}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Avg weight</p>
                  <p style={{ color: 'var(--text)', fontSize: '1.45rem' }}>{contentMapOverview.averageWeight.toFixed(1)}</p>
                </div>
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p style={{ color: 'var(--text)', marginBottom: 6 }}>Current coverage</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  {contentMapOverview.coveredTopics} mapped topics already have study content. {contentMapOverview.uncoveredTopics} still need stronger source coverage.
                </p>
                <div className="flex flex-wrap gap-3 mt-3" style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                  <span>{contentMapOverview.flashcardCount} linked cards</span>
                  <span>{contentMapOverview.questionCount} linked questions</span>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Topic mapping will appear here after document processing finishes.</p>
          )}
        </section>

        <section className="p-5" style={glass}>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={20} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.15rem' }}>Ordered Topics</h2>
          </div>
          {contentMapQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((idx) => (
                <Skeleton key={idx} className="h-16 w-full" />
              ))}
            </div>
          ) : contentMapQuery.data?.topics.length ? (
            <div className="space-y-2">
              {contentMapQuery.data.topics.slice(0, 8).map((topic) => (
                <div key={topic.id} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="min-w-0">
                    <p className="truncate" style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{topic.name}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      Weight {topic.study_weight.toFixed(1)} · {topic.flashcard_count} cards · {topic.question_count} questions
                    </p>
                  </div>
                  {topic.has_content ? (
                    <CheckCircle size={18} weight="fill" style={{ color: 'var(--success)' }} />
                  ) : (
                    <WarningCircle size={18} weight="fill" style={{ color: 'var(--accent)' }} />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Ordered topics will appear here after extraction completes.</p>
          )}
        </section>

        <section className="p-5" style={glass}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Graph size={20} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.15rem' }}>Graph Preview</h2>
            </div>
            <button type="button" style={{ color: 'var(--accent)' }} onClick={() => navigate(`/knowledge-graph?module=${mod.id}`)}>
              View Larger
            </button>
          </div>
          {graphQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((idx) => (
                <Skeleton key={idx} className="h-20 w-full" />
              ))}
            </div>
          ) : graphPreview.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nodes</p>
                  <p style={{ color: 'var(--text)', fontSize: '1.25rem' }}>{graphOverview.nodeCount}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Edges</p>
                  <p style={{ color: 'var(--text)', fontSize: '1.25rem' }}>{graphOverview.edgeCount}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Top node</p>
                  <p className="truncate" style={{ color: 'var(--text)', fontSize: '1.05rem' }}>{graphOverview.strongestNode?.name || 'N/A'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {graphPreview.map((node) => (
                  <div key={node.id} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p style={{ color: 'var(--text)', fontSize: '0.88rem' }}>{node.name}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                      importance {node.importance.toFixed(1)} · mastery {Math.round(node.mastery)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Graph data will appear after topic extraction and card generation.</p>
          )}
        </section>
      </div>

      <UploadDocumentsModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        moduleId={mod.id}
        moduleName={mod.name}
        onUploaded={() => {
          refreshModuleData();
        }}
      />
    </div>
  );
}
