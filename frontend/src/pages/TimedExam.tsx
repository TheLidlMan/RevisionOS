import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Trophy,
  AlertCircle,
  Play,
} from 'lucide-react';
import { getModules, startExam, submitExam } from '../api/client';
import type { Module, ExamSession, ExamSubmitResult } from '../types';

type Phase = 'config' | 'exam' | 'results';

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
  fontWeight: 500,
  border: 'none',
} as const;

const inputStyle = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '8px',
  color: '#f5f0e8',
} as const;

const labelStyle = {
  color: 'rgba(245,240,232,0.5)',
  fontWeight: 300,
  fontSize: '0.9rem',
} as const;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function TimedExam() {
  // Config state
  const [moduleId, setModuleId] = useState('');
  const [timeLimit, setTimeLimit] = useState(120);
  const [numQuestions, setNumQuestions] = useState(20);

  // Exam state
  const [phase, setPhase] = useState<Phase>('config');
  const [examSession, setExamSession] = useState<ExamSession | null>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [results, setResults] = useState<ExamSubmitResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmittedRef = useRef(false);

  const { data: modules } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const startMutation = useMutation({
    mutationFn: () => startExam(moduleId, timeLimit, numQuestions),
    onSuccess: (data) => {
      setExamSession(data);
      setQuestionIdx(0);
      setAnswers({});
      setTimeRemaining(data.time_limit_minutes * 60);
      autoSubmittedRef.current = false;
      setPhase('exam');
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!examSession) throw new Error('No session');
      const answerList = examSession.questions.map((q) => ({
        question_id: q.id,
        user_answer: answers[q.id] || '',
      }));
      return submitExam(examSession.session_id, answerList);
    },
    onSuccess: (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setResults(data);
      setPhase('results');
    },
  });

  // Timer
  useEffect(() => {
    if (phase !== 'exam') return;
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // Auto-submit when timer reaches 0
  useEffect(() => {
    if (timeRemaining === 0 && phase === 'exam' && !autoSubmittedRef.current && !submitMutation.isPending) {
      autoSubmittedRef.current = true;
      submitMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining, phase]);

  const setAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = () => {
    if (submitMutation.isPending) return;
    submitMutation.mutate();
  };

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (phase !== 'exam' || !examSession) return;
      if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
        if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;
        e.preventDefault();
        setQuestionIdx((i) => Math.min(i + 1, examSession.questions.length - 1));
      } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
        if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;
        e.preventDefault();
        setQuestionIdx((i) => Math.max(i - 1, 0));
      }
    },
    [phase, examSession],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ── Config Phase ──
  if (phase === 'config') {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-8">
          <Clock className="w-6 h-6" style={{ color: '#c4956a' }} />
          <h1
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 600 }}
            className="text-2xl"
          >
            Timed Exam
          </h1>
        </div>

        <div style={glass} className="p-6 space-y-6">
          <div>
            <label style={labelStyle} className="block mb-2">Module</label>
            <select
              value={moduleId} onChange={(e) => setModuleId(e.target.value)}
              style={inputStyle} className="w-full px-3 py-2.5 focus:outline-none transition-colors"
            >
              <option value="">Choose a module…</option>
              {modules?.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle} className="block mb-2">Time Limit (minutes)</label>
            <input
              type="number" min={5} max={300} value={timeLimit}
              onChange={(e) => setTimeLimit(parseInt(e.target.value) || 120)}
              style={inputStyle} className="w-full px-3 py-2.5 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label style={labelStyle} className="block mb-2">Number of Questions</label>
            <div className="flex gap-2">
              {[10, 20, 30, 50].map((n) => (
                <button
                  key={n} onClick={() => setNumQuestions(n)}
                  style={numQuestions === n ? { ...accentBtn } : { ...glass, color: '#f5f0e8', fontWeight: 300 }}
                  className="px-4 py-2 text-sm transition-all"
                >
                  {n}
                </button>
              ))}
              <input
                type="number" min={1} max={100} value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value) || 20)}
                style={{ ...inputStyle, fontWeight: 300 }}
                className="w-20 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>

          {startMutation.isError && (
            <div className="flex items-center gap-2" style={{ color: 'rgba(220,120,100,0.8)', fontSize: '0.9rem', fontWeight: 300 }}>
              <AlertCircle className="w-4 h-4" />
              <span>Failed to start exam. Ensure this module has enough questions.</span>
            </div>
          )}

          <button
            onClick={() => { if (moduleId) startMutation.mutate(); }}
            disabled={!moduleId || startMutation.isPending}
            style={accentBtn}
            className="w-full px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Start Exam
          </button>
        </div>
      </div>
    );
  }

  // ── Results Phase ──
  if (phase === 'results' && results) {
    const pct = Math.round(results.score_pct);
    const ringR = 70;
    const circumference = 2 * Math.PI * ringR;
    const offset = circumference - (pct / 100) * circumference;

    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto w-full">
        <div className="flex flex-col items-center text-center py-8">
          <Trophy className="w-16 h-16 mb-4" style={{ color: '#c4956a' }} />
          <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8' }} className="text-3xl mb-6">
            Exam Complete!
          </h2>

          {/* Score ring */}
          <div className="relative mb-6" style={{ width: 180, height: 180 }}>
            <svg viewBox="0 0 180 180" style={{ width: '100%', height: '100%' }}>
              <circle cx="90" cy="90" r={ringR} fill="none" stroke="rgba(139,115,85,0.15)" strokeWidth="8" />
              <circle
                cx="90" cy="90" r={ringR} fill="none" stroke="#c4956a" strokeWidth="8"
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
                transform="rotate(-90 90 90)" style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span style={{ color: '#c4956a', fontWeight: 200, fontSize: '3rem' }}>{pct}%</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-md">
            <div style={glass} className="p-4">
              <p style={{ color: 'rgba(120,180,120,0.8)', fontWeight: 200, fontSize: '2rem' }}>{results.correct}</p>
              <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.8rem' }}>Correct</p>
            </div>
            <div style={glass} className="p-4">
              <p style={{ color: 'rgba(220,120,100,0.8)', fontWeight: 200, fontSize: '2rem' }}>{results.incorrect}</p>
              <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.8rem' }}>Incorrect</p>
            </div>
            <div style={glass} className="p-4">
              <p style={{ color: '#f5f0e8', fontWeight: 200, fontSize: '2rem' }}>{results.total}</p>
              <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.8rem' }}>Total</p>
            </div>
          </div>

          <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.85rem' }} className="mb-8">
            Time taken: {Math.floor(results.time_taken_seconds / 60)}m {results.time_taken_seconds % 60}s
          </p>
        </div>

        {/* Mark-scheme review */}
        <h3
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 500 }}
          className="text-lg mb-4"
        >
          Question Review
        </h3>
        <div className="space-y-4 mb-8">
          {results.review.map((item, idx) => (
            <motion.div
              key={item.question_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              style={{
                ...glass,
                background: item.is_correct ? 'rgba(120,180,120,0.04)' : 'rgba(220,120,100,0.04)',
                border: item.is_correct ? '1px solid rgba(120,180,120,0.2)' : '1px solid rgba(220,120,100,0.2)',
              }}
              className="p-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {item.is_correct ? (
                    <CheckCircle className="w-5 h-5" style={{ color: 'rgba(120,180,120,0.9)' }} />
                  ) : (
                    <XCircle className="w-5 h-5" style={{ color: 'rgba(220,120,100,0.9)' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ color: '#f5f0e8', fontWeight: 400, fontSize: '0.95rem', lineHeight: 1.6 }} className="mb-2">
                    {idx + 1}. {item.question_text}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                    <div>
                      <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: '0.75rem', fontWeight: 300 }}>Your answer</span>
                      <p style={{
                        color: item.is_correct ? 'rgba(120,180,120,0.9)' : 'rgba(220,120,100,0.9)',
                        fontWeight: 400, fontSize: '0.85rem',
                      }}>
                        {item.user_answer || '(no answer)'}
                      </p>
                    </div>
                    {!item.is_correct && (
                      <div>
                        <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: '0.75rem', fontWeight: 300 }}>Correct answer</span>
                        <p style={{ color: 'rgba(120,180,120,0.9)', fontWeight: 400, fontSize: '0.85rem' }}>
                          {item.correct_answer}
                        </p>
                      </div>
                    )}
                  </div>
                  {item.explanation && (
                    <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.8rem', lineHeight: 1.6 }}>
                      {item.explanation}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={() => {
              setPhase('config');
              setExamSession(null);
              setResults(null);
            }}
            style={accentBtn}
            className="px-6 py-2.5 text-sm transition-opacity hover:opacity-90 flex items-center gap-2"
          >
            New Exam
          </button>
        </div>
      </div>
    );
  }

  // ── Exam Phase ──
  if (!examSession) return null;
  const question = examSession.questions[questionIdx];
  if (!question) return null;

  const isLowTime = timeRemaining < 300;
  const answeredCount = Object.keys(answers).filter((k) => answers[k].trim() !== '').length;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto w-full">
      {/* Timer bar */}
      <div className="flex items-center justify-between mb-4">
        <span style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }}>
          Question {questionIdx + 1} of {examSession.questions.length}
        </span>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: isLowTime ? 'rgba(220,120,100,0.9)' : '#c4956a' }} />
          <span style={{
            color: isLowTime ? 'rgba(220,120,100,0.9)' : '#c4956a',
            fontWeight: 600,
            fontSize: '1.1rem',
            fontFamily: 'monospace',
          }}>
            {formatTime(timeRemaining)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6 overflow-hidden" style={{ height: '3px', background: 'rgba(255,248,240,0.06)', borderRadius: '4px' }}>
        <div style={{
          height: '100%',
          background: isLowTime ? 'rgba(220,120,100,0.8)' : '#c4956a',
          borderRadius: '4px',
          transition: 'width 1s linear',
          width: `${(timeRemaining / (examSession.time_limit_minutes * 60)) * 100}%`,
        }} />
      </div>

      <div className="flex gap-6">
        {/* Main question area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              style={glass} className="p-6 mb-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <span style={{ color: 'rgba(245,240,232,0.25)', fontWeight: 300, fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {question.difficulty}
                </span>
                {question.question_type !== 'MCQ' && (
                  <span style={{
                    color: 'rgba(245,240,232,0.25)',
                    fontWeight: 300,
                    fontSize: '0.7rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginLeft: '8px',
                  }}>
                    {question.question_type.replace('_', ' ')}
                  </span>
                )}
              </div>

              <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontSize: '1.05rem', lineHeight: 1.7 }}
                className="mb-6 whitespace-pre-wrap"
              >
                {question.question_text}
              </p>

              {/* MCQ options */}
              {question.options && question.options.length > 0 ? (
                <div className="space-y-3">
                  {question.options.map((opt, idx) => {
                    const selected = answers[question.id] === opt;
                    return (
                      <button
                        key={idx}
                        onClick={() => setAnswer(question.id, opt)}
                        style={{
                          ...glass,
                          color: '#f5f0e8',
                          fontWeight: 300,
                          textAlign: 'left',
                          width: '100%',
                          cursor: 'pointer',
                          ...(selected ? {
                            background: 'rgba(196,149,106,0.15)',
                            border: '1px solid rgba(196,149,106,0.4)',
                            color: '#c4956a',
                          } : {}),
                        }}
                        className="px-4 py-3 text-sm transition-all"
                      >
                        <span style={{ fontFamily: 'monospace', marginRight: '8px', opacity: 0.5 }}>
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={answers[question.id] || ''}
                  onChange={(e) => setAnswer(question.id, e.target.value)}
                  placeholder="Type your answer…"
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7, fontWeight: 300 }}
                  className="w-full px-4 py-3 focus:outline-none transition-colors"
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setQuestionIdx((i) => Math.max(i - 1, 0))}
              disabled={questionIdx === 0}
              style={{ ...glass, color: '#f5f0e8', fontWeight: 300 }}
              className="px-4 py-2 text-sm transition-all hover:opacity-80 disabled:opacity-30 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Previous
            </button>

            <div className="flex items-center gap-2">
              <span style={{ color: 'rgba(245,240,232,0.5)', fontSize: '0.8rem', fontWeight: 300 }}>
                {answeredCount}/{examSession.questions.length} answered
              </span>
              <button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                style={accentBtn}
                className="px-5 py-2 text-sm transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Exam'}
              </button>
            </div>

            <button
              onClick={() => setQuestionIdx((i) => Math.min(i + 1, examSession.questions.length - 1))}
              disabled={questionIdx === examSession.questions.length - 1}
              style={{ ...glass, color: '#f5f0e8', fontWeight: 300 }}
              className="px-4 py-2 text-sm transition-all hover:opacity-80 disabled:opacity-30 flex items-center gap-2"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Question grid sidebar */}
        <div className="hidden lg:block w-48 flex-shrink-0">
          <div style={glass} className="p-3">
            <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.75rem', letterSpacing: '0.05em' }}
              className="mb-3 text-center uppercase"
            >
              Questions
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {examSession.questions.map((q, idx) => {
                const answered = !!answers[q.id]?.trim();
                const isCurrent = idx === questionIdx;
                return (
                  <button
                    key={q.id}
                    onClick={() => setQuestionIdx(idx)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: isCurrent ? 600 : 300,
                      border: isCurrent ? '1px solid #c4956a' : '1px solid rgba(139,115,85,0.15)',
                      background: answered
                        ? isCurrent ? 'rgba(196,149,106,0.3)' : 'rgba(120,180,120,0.15)'
                        : isCurrent ? 'rgba(196,149,106,0.1)' : 'rgba(255,248,240,0.02)',
                      color: isCurrent ? '#c4956a' : answered ? 'rgba(120,180,120,0.8)' : 'rgba(245,240,232,0.3)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
