import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Brain, CheckCircle, Graph, Sparkle, SpinnerGap, ArrowRight } from '@phosphor-icons/react';
import {
  buildStudyCoachPlan,
  evaluateStudyCoachAnswer,
  getModules,
  getStudyCoachState,
  updateStudyCoachProgress,
} from '../api/client';
import type { StudyCoachPlan, StudyCoachQuestion, StudyCoachTopic } from '../types';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

export default function StudyCoachPage() {
  const queryClient = useQueryClient();
  const [moduleId, setModuleId] = useState('');
  const [selectedConceptId, setSelectedConceptId] = useState('');
  const [draftProgress, setDraftProgress] = useState<Record<string, number>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedbackByQuestion, setFeedbackByQuestion] = useState<Record<string, string>>({});

  const modulesQuery = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const resolvedModuleId = moduleId || modulesQuery.data?.[0]?.id || '';

  const coachQuery = useQuery({
    queryKey: ['study-coach', resolvedModuleId],
    queryFn: () => getStudyCoachState(resolvedModuleId),
    enabled: !!resolvedModuleId,
  });

  const resolvedConceptId = selectedConceptId || coachQuery.data?.focus_topic_id || coachQuery.data?.topics[0]?.concept_id || '';

  const selectedTopic = useMemo(
    () => coachQuery.data?.topics.find((topic) => topic.concept_id === resolvedConceptId) || null,
    [coachQuery.data, resolvedConceptId],
  );

  const planQuery = useQuery({
    queryKey: ['study-coach-plan', resolvedModuleId, resolvedConceptId],
    queryFn: () => buildStudyCoachPlan(resolvedModuleId, resolvedConceptId ? { concept_id: resolvedConceptId } : {}),
    enabled: !!resolvedModuleId && !!resolvedConceptId,
  });

  const progressMutation = useMutation({
    mutationFn: ({ topic, progress, notes }: { topic: StudyCoachTopic; progress: number; notes: string }) =>
      updateStudyCoachProgress(resolvedModuleId, topic.concept_id, {
        progress_pct: progress,
        status: progress >= 85 ? 'mastered' : progress >= 60 ? 'solid' : progress > 0 ? 'in_progress' : 'not_started',
        notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-coach', resolvedModuleId] });
      queryClient.invalidateQueries({ queryKey: ['study-coach-plan', resolvedModuleId, resolvedConceptId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-graph', resolvedModuleId] });
    },
  });

  const evaluationMutation = useMutation({
    mutationFn: ({ conceptId, question, answer }: { conceptId: string; question: StudyCoachQuestion; answer: string }) =>
      evaluateStudyCoachAnswer(resolvedModuleId, {
        concept_id: conceptId,
        question: question.question,
        answer_outline: question.answer_outline,
        user_answer: answer,
      }),
    onSuccess: (result, variables) => {
      setFeedbackByQuestion((current) => ({
        ...current,
        [variables.question.question]: `${Math.round(result.score)}% · ${result.feedback}`,
      }));
      queryClient.invalidateQueries({ queryKey: ['study-coach', resolvedModuleId] });
      queryClient.invalidateQueries({ queryKey: ['study-coach-plan', resolvedModuleId, resolvedConceptId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-graph', resolvedModuleId] });
    },
  });

  const plan = planQuery.data as StudyCoachPlan | undefined;
  const dependencyView = useMemo(() => {
    if (!selectedTopic || !coachQuery.data) {
      return { parent: null, children: [] as StudyCoachTopic[] };
    }
    return {
      parent: coachQuery.data.topics.find((topic) => topic.concept_id === selectedTopic.parent_id) || null,
      children: coachQuery.data.topics.filter((topic) => topic.parent_id === selectedTopic.concept_id),
    };
  }, [coachQuery.data, selectedTopic]);

  const coachPrompts = useMemo(() => {
    if (!selectedTopic) {
      return [];
    }
    const cues = [] as string[];
    if (selectedTopic.progress_pct < 40) {
      cues.push('Start with the definition, then explain one example from memory before checking your notes.');
    }
    if (selectedTopic.progress_pct >= 40 && selectedTopic.progress_pct < 85) {
      cues.push('You are in consolidation mode — teach this topic aloud and then mark your explanation.');
    }
    if (selectedTopic.progress_pct >= 85) {
      cues.push('This topic is nearly mastered — keep it warm by connecting it to neighbouring concepts.');
    }
    if (dependencyView.parent) {
      cues.push(`Anchor this topic back to ${dependencyView.parent.name} before moving on.`);
    }
    if (dependencyView.children.length > 0) {
      cues.push(`Next, branch into ${dependencyView.children.slice(0, 2).map((topic) => topic.name).join(' and ')}.`);
    }
    return cues;
  }, [dependencyView.children, dependencyView.parent, selectedTopic]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Brain size={24} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontWeight: 600 }} className="text-2xl">
              Study Coach
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>
            Build a graph-aware checklist, answer coach questions, and keep your topic progress visible in the UI.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={resolvedModuleId}
            onChange={(event) => {
              setModuleId(event.target.value);
              setSelectedConceptId('');
              setFeedbackByQuestion({});
            }}
            className="px-3 py-2.5"
            style={{ ...glass, color: 'var(--text)', minWidth: 220 }}
          >
            <option value="">Select a module...</option>
            {modulesQuery.data?.map((module) => (
              <option key={module.id} value={module.id}>{module.name}</option>
            ))}
          </select>

          <select
            value={resolvedConceptId}
            onChange={(event) => setSelectedConceptId(event.target.value)}
            className="px-3 py-2.5"
            style={{ ...glass, color: 'var(--text)', minWidth: 260 }}
            disabled={!coachQuery.data?.topics.length}
          >
            <option value="">Select a focus topic...</option>
            {coachQuery.data?.topics.map((topic) => (
              <option key={topic.concept_id} value={topic.concept_id}>
                {topic.name} · {Math.round(topic.progress_pct)}%
              </option>
            ))}
          </select>
        </div>
      </div>

      {coachQuery.isLoading ? (
        <div style={glass} className="p-8 flex items-center justify-center gap-3">
          <SpinnerGap className="animate-spin" size={20} style={{ color: 'var(--accent)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Loading study coach…</span>
        </div>
      ) : !coachQuery.data ? (
        <div style={glass} className="p-8 text-center" />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            {[
              ['Topics', coachQuery.data.summary.total_topics],
              ['Completed', coachQuery.data.summary.completed_topics],
              ['Active', coachQuery.data.summary.active_topics],
              ['Avg progress', `${Math.round(coachQuery.data.summary.average_progress_pct)}%`],
            ].map(([label, value]) => (
              <div key={label} style={glass} className="p-4">
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
                <p style={{ color: 'var(--text)', fontSize: '1.4rem', marginTop: 8 }}>{value}</p>
              </div>
            ))}
          </div>

          {selectedTopic && (
            <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
              <div style={glass} className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Graph size={18} style={{ color: 'var(--accent)' }} />
                  <p style={{ color: 'var(--text)', fontWeight: 500 }}>Concept dependency view</p>
                </div>
                <div className="space-y-3">
                  {dependencyView.parent && (
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Prerequisite</p>
                      <p style={{ color: 'var(--text)', marginTop: 6 }}>{dependencyView.parent.name}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 p-4 rounded-2xl" style={{ background: 'rgba(196,149,106,0.12)', border: '1px solid rgba(196,149,106,0.25)' }}>
                      <p style={{ color: 'var(--accent)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current focus</p>
                      <p style={{ color: 'var(--text)', fontSize: '1rem', marginTop: 6 }}>{selectedTopic.name}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 6 }}>
                        Mastery {Math.round(selectedTopic.mastery)}% · progress {Math.round(selectedTopic.progress_pct)}%
                      </p>
                    </div>
                    <ArrowRight size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                    <div className="flex-1 p-4 rounded-2xl" style={{ background: 'rgba(120,180,120,0.08)', border: '1px solid rgba(120,180,120,0.2)' }}>
                      <p style={{ color: '#78b478', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Next step</p>
                      <p style={{ color: 'var(--text)', fontSize: '0.95rem', marginTop: 6 }}>
                        {dependencyView.children[0]?.name || plan?.checklist[0]?.title || 'Strengthen this explanation with a marked answer.'}
                      </p>
                    </div>
                  </div>
                  {dependencyView.children.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {dependencyView.children.map((topic) => (
                        <button
                          key={topic.concept_id}
                          type="button"
                          onClick={() => setSelectedConceptId(topic.concept_id)}
                          className="text-left p-3 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
                        >
                          <p style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{topic.name}</p>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>Child topic · {Math.round(topic.progress_pct)}%</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      No child concepts yet — use the plan below to deepen this topic before branching out.
                    </p>
                  )}
                </div>
              </div>

              <div style={glass} className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkle size={18} style={{ color: 'var(--accent)' }} />
                  <p style={{ color: 'var(--text)', fontWeight: 500 }}>Encouragement engine</p>
                </div>
                <div className="space-y-3">
                  {coachPrompts.map((prompt) => (
                    <div key={prompt} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                      <p style={{ color: 'var(--text)', fontSize: '0.88rem', lineHeight: 1.6 }}>{prompt}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.1fr_1.5fr]">
            <div style={glass} className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p style={{ color: 'var(--text)', fontFamily: 'var(--heading)', fontSize: '1.05rem' }}>Topic checklist</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Backend: {coachQuery.data.graph_backend} · {coachQuery.data.document_count} document{coachQuery.data.document_count === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-2" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>
                  <Graph size={16} />
                  Graph-backed
                </div>
              </div>

              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                {coachQuery.data.topics.map((topic) => {
                  const draftValue = draftProgress[topic.concept_id] ?? topic.progress_pct;
                  const isSelected = topic.concept_id === selectedConceptId;
                  return (
                    <div
                      key={topic.concept_id}
                      className="p-4 cursor-pointer transition-colors"
                      style={{
                        ...glass,
                        border: isSelected ? '1px solid rgba(196,149,106,0.45)' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(196,149,106,0.08)' : 'var(--surface)',
                      }}
                      onClick={() => setSelectedConceptId(topic.concept_id)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p style={{ color: 'var(--text)', fontSize: '0.95rem' }}>{topic.name}</p>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
                            {topic.status.replace('_', ' ')} · mastery {Math.round(topic.mastery)}% · {topic.item_count} items
                          </p>
                        </div>
                        {topic.progress_pct >= 85 && <CheckCircle size={18} weight="fill" style={{ color: 'var(--success)' }} />}
                      </div>

                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={draftValue}
                        onChange={(event) => setDraftProgress((current) => ({ ...current, [topic.concept_id]: Number(event.target.value) }))}
                        className="w-full"
                      />
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{Math.round(draftValue)}%</span>
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-lg"
                          style={{ background: 'rgba(196,149,106,0.14)', color: 'var(--accent)', fontSize: '0.8rem' }}
                          onClick={(event) => {
                            event.stopPropagation();
                            progressMutation.mutate({
                              topic,
                              progress: draftValue,
                              notes: draftNotes[topic.concept_id] ?? '',
                            });
                          }}
                        >
                          Save
                        </button>
                      </div>

                      {isSelected && (
                        <textarea
                          value={draftNotes[topic.concept_id] ?? ''}
                          onChange={(event) => setDraftNotes((current) => ({ ...current, [topic.concept_id]: event.target.value }))}
                          placeholder="Optional note for this topic"
                          className="w-full mt-3 px-3 py-2 rounded-xl min-h-[84px]"
                          style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text)', border: '1px solid var(--border)' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={glass} className="p-5 space-y-5">
              {!selectedTopic ? (
                <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>
                  Pick a topic to generate a study plan.
                </div>
              ) : planQuery.isLoading ? (
                <div className="py-16 flex items-center justify-center gap-3">
                  <SpinnerGap className="animate-spin" size={20} style={{ color: 'var(--accent)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Building your graph-aware coach plan…</span>
                </div>
              ) : plan ? (
                <>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkle size={18} style={{ color: 'var(--accent)' }} />
                      <p style={{ color: 'var(--text)', fontFamily: 'var(--heading)', fontSize: '1.1rem' }}>
                        {plan.focus_topic.name}
                      </p>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{plan.overview}</p>
                    {plan.encouragement && (
                      <p style={{ color: 'var(--accent)', marginTop: 10, fontSize: '0.88rem' }}>{plan.encouragement}</p>
                    )}
                  </div>

                  <div>
                    <p style={{ color: 'var(--text)', marginBottom: 10, fontSize: '0.95rem' }}>Checklist</p>
                    <div className="space-y-2">
                      {plan.checklist.map((item, index) => (
                        <div key={`${item.title}-${index}`} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                          <p style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{item.title}</p>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>{item.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p style={{ color: 'var(--text)', fontSize: '0.95rem' }}>Coach questions</p>
                    {plan.questions.map((question, index) => {
                      const key = question.question;
                      const answer = answers[key] ?? '';
                      return (
                        <div key={key} className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                          <p style={{ color: 'var(--text)', fontSize: '0.92rem' }}>{index + 1}. {question.question}</p>
                          <textarea
                            value={answer}
                            onChange={(event) => setAnswers((current) => ({ ...current, [key]: event.target.value }))}
                            placeholder="Write your answer here..."
                            className="w-full mt-3 px-3 py-2 rounded-xl min-h-[120px]"
                            style={{ background: 'rgba(17,17,17,0.18)', color: 'var(--text)', border: '1px solid var(--border)' }}
                          />
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              disabled={!answer.trim() || evaluationMutation.isPending}
                              onClick={() => evaluationMutation.mutate({ conceptId: selectedTopic.concept_id, question, answer })}
                              className="px-3 py-2 rounded-xl disabled:opacity-60"
                              style={{ background: 'rgba(196,149,106,0.16)', color: 'var(--accent)' }}
                            >
                              {evaluationMutation.isPending ? 'Marking…' : 'Ask coach to mark this'}
                            </button>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>
                              The answer outline stays on the backend and is used for grading.
                            </span>
                          </div>
                          {feedbackByQuestion[key] && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 10 }}>{feedbackByQuestion[key]}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
