import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
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
} from '@phosphor-icons/react';
import {
  deleteDocument,
  deleteModule,
  exportAnki,
  exportJson,
  getContentMap,
  getCurriculum,
  getKnowledgeGraph,
  getModule,
  updateModule,
} from '../api/client';
import UploadDocumentsModal from '../components/UploadDocumentsModal';
import type { ContentMapData, CurriculumData, KnowledgeGraphData, ModuleDetail } from '../types';
import { titleCase } from '../utils/formatters';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

export default function ModuleView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [examDateInput, setExamDateInput] = useState('');

  const moduleQuery = useQuery({
    queryKey: ['module', id],
    queryFn: () => getModule(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data as ModuleDetail | undefined;
      return data && ['queued', 'running'].includes(data.pipeline_status) ? 2000 : false;
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
      setExamDateInput(updated.exam_date ? updated.exam_date.slice(0, 10) : '');
      queryClient.invalidateQueries({ queryKey: ['module', id] });
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      queryClient.invalidateQueries({ queryKey: ['curriculum', id] });
    },
  });

  const deleteModuleMutation = useMutation({
    mutationFn: () => deleteModule(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      navigate('/');
    },
  });

  const graphPreview = useMemo(
    () => (graphQuery.data?.nodes || []).slice().sort((a, b) => b.importance - a.importance).slice(0, 6),
    [graphQuery.data],
  );

  if (moduleQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <SpinnerGap size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
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

  const pipelineActive = ['queued', 'running'].includes(mod.pipeline_status);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-2 mb-6"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span style={{ width: 12, height: 12, borderRadius: 999, background: mod.color, flexShrink: 0 }} />
            <h1 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '2rem' }}>{mod.name}</h1>
          </div>
          {mod.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 720 }}>{mod.description}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{mod.total_documents} documents</span>
            <span>{mod.total_cards} cards</span>
            <span>{mod.due_cards} due</span>
            <span>{Math.round(mod.mastery_pct)}% mastery</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="scholar-btn" onClick={() => setUploadOpen(true)}>
            <UploadSimple size={18} />
            Upload
          </button>
          <button
            type="button"
            className="scholar-btn"
            style={{ background: 'rgba(196,149,106,0.25)', color: 'var(--text)' }}
            onClick={() => navigate(`/flashcards/${mod.id}`)}
          >
            <PlayCircle size={18} />
            Start Review
          </button>
          <button
            type="button"
            className="scholar-btn"
            style={{ background: 'rgba(196,149,106,0.18)', color: 'var(--text)' }}
            onClick={() => navigate(`/quiz?module=${mod.id}`)}
          >
            <BookOpen size={18} />
            Take Quiz
          </button>
          <details>
            <summary
              className="list-none cursor-pointer px-4 py-2.5 inline-flex items-center gap-2"
              style={{ ...glass, color: 'var(--text)', fontSize: '0.9rem' }}
            >
              <Export size={18} />
              Export
            </summary>
            <div className="mt-2 p-2 space-y-1 absolute" style={{ ...glass, minWidth: 180 }}>
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
            </div>
          </details>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete ${mod.name}? This removes the module and all of its content.`)) {
                deleteModuleMutation.mutate();
              }
            }}
            className="px-4 py-2.5 inline-flex items-center gap-2"
            style={{ ...glass, color: 'var(--danger)' }}
          >
            <Trash size={18} />
            Delete Module
          </button>
        </div>
      </div>

      {pipelineActive && (
        <div className="p-4 mb-6" style={glass}>
          <div className="flex items-center gap-3 mb-3">
            <SpinnerGap size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <div>
              <p style={{ color: 'var(--text)', fontSize: '0.95rem' }}>Backend pipeline is running</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{titleCase(mod.pipeline_stage)}</p>
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
          <div className="flex items-center gap-2 mb-4">
            <FileText size={20} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.15rem' }}>Documents</h2>
          </div>
          {mod.documents.length > 0 ? (
            <div className="space-y-3">
              {mod.documents.map((doc) => (
                <div key={doc.id} className="p-4" style={{ ...glass, borderRadius: '12px' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate" style={{ color: 'var(--text)', fontSize: '0.95rem' }}>{doc.filename}</p>
                      <div className="flex flex-wrap gap-3 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <span>{doc.file_type}</span>
                        <span>{doc.word_count.toLocaleString()} words</span>
                        <span>{titleCase(doc.processing_status)}</span>
                      </div>
                      {doc.summary && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 10 }}>{doc.summary}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete ${doc.filename}?`)) {
                          deleteDocumentMutation.mutate(doc.id);
                        }
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                      aria-label={`Delete ${doc.filename}`}
                    >
                      <Trash size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>
              No documents yet. Upload files to kick off the backend pipeline.
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
              value={examDateInput || (mod.exam_date ? mod.exam_date.slice(0, 10) : '')}
              onChange={(event) => setExamDateInput(event.target.value)}
              className="flex-1 px-3 py-2.5"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
            />
            <button
              type="button"
              className="scholar-btn"
              onClick={() => updateModuleMutation.mutate({ exam_date: examDateInput || undefined })}
            >
              Save
            </button>
          </div>

          {curriculumQuery.data ? (
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
              <button type="button" style={{ color: 'var(--accent)' }} onClick={() => navigate(`/curriculum?module=${mod.id}`)}>
                View Full Plan
              </button>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              {mod.exam_date
                ? 'The plan will appear after the backend finishes processing the module.'
                : 'Add an exam date to generate a deterministic plan automatically.'}
            </p>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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
          </div>
          <button type="button" className="mt-4 inline-flex items-center gap-2" style={{ color: 'var(--accent)' }} onClick={() => navigate(`/modules/${mod.id}/flashcards`)}>
            Manage Flashcards
            <ArrowRight size={16} />
          </button>
        </section>

        <section className="xl:col-span-2 p-5" style={glass}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Graph size={20} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.15rem' }}>Content Map & Knowledge Graph</h2>
            </div>
            <button type="button" style={{ color: 'var(--accent)' }} onClick={() => navigate(`/knowledge-graph?module=${mod.id}`)}>
              View Larger
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h3 style={{ color: 'var(--text)', fontSize: '0.95rem', marginBottom: 10 }}>Ordered Topics</h3>
              {contentMapQuery.data?.topics.length ? (
                <div className="space-y-2">
                  {contentMapQuery.data.topics.slice(0, 8).map((topic) => (
                    <div key={topic.id} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="min-w-0">
                        <p className="truncate" style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{topic.name}</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                          Weight {topic.study_weight.toFixed(1)} · {topic.flashcard_count} cards
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
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Topics will appear here after document processing.</p>
              )}
            </div>

            <div>
              <h3 style={{ color: 'var(--text)', fontSize: '0.95rem', marginBottom: 10 }}>Graph Preview</h3>
              {graphPreview.length > 0 ? (
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
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Graph data will appear after topic extraction and card generation.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      <UploadDocumentsModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        moduleId={mod.id}
        moduleName={mod.name}
        onUploaded={() => {
          queryClient.invalidateQueries({ queryKey: ['module', id] });
          queryClient.invalidateQueries({ queryKey: ['modules'] });
        }}
      />
    </div>
  );
}
