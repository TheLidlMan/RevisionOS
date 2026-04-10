import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowRight,
  Trophy,
} from 'lucide-react';
import { getModules, startQuizSession, submitAnswer, completeSession } from '../api/client';
import type {
  Difficulty,
  SessionResponse,
  AnswerResponse,
  SessionResults,
  QuestionForQuiz,
} from '../types';

type Phase = 'config' | 'quiz' | 'results';

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

export default function QuizMode() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preModule = searchParams.get('module') ?? '';

  // Config state
  const [moduleId, setModuleId] = useState(preModule);
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty | 'MIXED'>('MEDIUM');
  const [mode, setMode] = useState<'random' | 'weakness_drill' | 'unseen'>('random');

  // Quiz state
  const [phase, setPhase] = useState<Phase>('config');
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResponse | null>(null);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<SessionResults | null>(null);

  const { data: modules } = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const startMutation = useMutation({
    mutationFn: startQuizSession,
    onSuccess: (data) => {
      setSession(data);
      setQuestionIdx(0);
      setScore(0);
      setPhase('quiz');
    },
  });

  const answerMutation = useMutation({
    mutationFn: ({ sessionId, questionId, answer }: { sessionId: string; questionId: string; answer: string }) =>
      submitAnswer(sessionId, { question_id: questionId, user_answer: answer }),
    onSuccess: (data) => {
      setAnswerResult(data);
      if (data.is_correct) setScore((s) => s + 1);
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeSession,
    onSuccess: (data) => {
      setResults(data);
      setPhase('results');
    },
  });

  const handleStart = () => {
    if (!moduleId) return;
    startMutation.mutate({
      module_id: moduleId,
      session_type: 'QUIZ',
    });
  };

  const handleSubmitAnswer = () => {
    if (!session || !selectedAnswer) return;
    const q = session.questions[questionIdx];
    answerMutation.mutate({
      sessionId: session.id,
      questionId: q.id,
      answer: selectedAnswer,
    });
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setAnswerResult(null);
    if (session && questionIdx + 1 >= session.questions.length) {
      completeMutation.mutate(session.id);
    } else {
      setQuestionIdx((i) => i + 1);
    }
  };

  // Keyboard shortcut for next
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (phase !== 'quiz') return;
      if (answerResult && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleNext();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answerResult, phase, questionIdx, session]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Config phase
  if (phase === 'config') {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-8">
          <Brain className="w-6 h-6" style={{ color: '#c4956a' }} />
          <h1
            style={{ fontFamily: "'Clash Display', sans-serif", color: '#f5f0e8', fontWeight: 600 }}
            className="text-2xl"
          >
            Quiz Mode
          </h1>
        </div>

        <div style={glass} className="p-6 space-y-6">
          {/* Module */}
          <div>
            <label style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }} className="block mb-2">
              Module
            </label>
            <select
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              style={{
                background: 'rgba(255,248,240,0.04)',
                border: '1px solid rgba(139,115,85,0.15)',
                borderRadius: '8px',
                color: '#f5f0e8',
              }}
              className="w-full px-3 py-2.5 focus:outline-none transition-colors"
            >
              <option value="">Choose a module…</option>
              {modules?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Number of questions */}
          <div>
            <label style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }} className="block mb-2">
              Number of Questions
            </label>
            <div className="flex gap-2">
              {[5, 10, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setNumQuestions(n)}
                  style={
                    numQuestions === n
                      ? { background: '#c4956a', color: '#1a1714', borderRadius: '8px', fontWeight: 500, border: 'none' }
                      : { ...glass, color: '#f5f0e8', fontWeight: 300 }
                  }
                  className="px-4 py-2 text-sm transition-all"
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={50}
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value) || 10)}
                style={{
                  background: 'rgba(255,248,240,0.04)',
                  border: '1px solid rgba(139,115,85,0.15)',
                  borderRadius: '8px',
                  color: '#f5f0e8',
                  fontWeight: 300,
                }}
                className="w-20 px-3 py-2 text-sm focus:outline-none"
                placeholder="Custom"
              />
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }} className="block mb-2">
              Difficulty
            </label>
            <div className="flex gap-2">
              {(['EASY', 'MIXED', 'HARD'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  style={
                    difficulty === d
                      ? { background: '#c4956a', color: '#1a1714', borderRadius: '8px', fontWeight: 500, border: 'none' }
                      : { ...glass, color: '#f5f0e8', fontWeight: 300 }
                  }
                  className="px-4 py-2 text-sm transition-all"
                >
                  {d.charAt(0) + d.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Mode */}
          <div>
            <label style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }} className="block mb-2">
              Mode
            </label>
            <div className="flex gap-2">
              {([
                { value: 'random' as const, label: 'Random' },
                { value: 'weakness_drill' as const, label: 'Weakness Drill' },
                { value: 'unseen' as const, label: 'Unseen' },
              ]).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  style={
                    mode === value
                      ? { background: '#c4956a', color: '#1a1714', borderRadius: '8px', fontWeight: 500, border: 'none' }
                      : { ...glass, color: '#f5f0e8', fontWeight: 300 }
                  }
                  className="px-4 py-2 text-sm transition-all"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {startMutation.isError && (
            <p style={{ color: 'rgba(220,120,100,0.8)', fontSize: '0.9rem', fontWeight: 300 }}>
              Failed to start quiz. Make sure you have questions generated for this module.
            </p>
          )}

          <button
            onClick={handleStart}
            disabled={!moduleId || startMutation.isPending}
            style={accentBtn}
            className="w-full px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {startMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Brain className="w-4 h-4" />
            )}
            Start Quiz
          </button>
        </div>
      </div>
    );
  }

  // Results phase
  if (phase === 'results' && results) {
    const pct = results.total_items > 0 ? Math.round(results.score_pct) : 0;
    const ringR = 70;
    const circumference = 2 * Math.PI * ringR;
    const offset = circumference - (pct / 100) * circumference;

    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto w-full">
        <div className="flex flex-col items-center text-center py-12">
          <Trophy className="w-16 h-16 mb-4" style={{ color: '#c4956a' }} />
          <h2
            style={{ fontFamily: "'Clash Display', sans-serif", color: '#f5f0e8' }}
            className="text-3xl mb-6"
          >
            Quiz Complete!
          </h2>

          {/* Score ring */}
          <div className="relative mb-8" style={{ width: 180, height: 180 }}>
            <svg viewBox="0 0 180 180" style={{ width: '100%', height: '100%' }}>
              <circle cx="90" cy="90" r={ringR} fill="none" stroke="rgba(139,115,85,0.15)" strokeWidth="8" />
              <circle
                cx="90"
                cy="90"
                r={ringR}
                fill="none"
                stroke="#c4956a"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform="rotate(-90 90 90)"
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span style={{ color: '#c4956a', fontWeight: 200, fontSize: '3rem' }}>{pct}%</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-8">
            <div style={glass} className="p-4">
              <p style={{ color: 'rgba(120,180,120,0.8)', fontWeight: 200, fontSize: '2rem' }}>
                {results.correct}
              </p>
              <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.8rem' }}>Correct</p>
            </div>
            <div style={glass} className="p-4">
              <p style={{ color: 'rgba(220,120,100,0.8)', fontWeight: 200, fontSize: '2rem' }}>
                {results.incorrect}
              </p>
              <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.8rem' }}>Incorrect</p>
            </div>
            <div style={glass} className="p-4">
              <p style={{ color: '#f5f0e8', fontWeight: 200, fontSize: '2rem' }}>
                {results.total_items}
              </p>
              <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.8rem' }}>Total</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              style={{ ...glass, color: '#f5f0e8', fontWeight: 300 }}
              className="px-4 py-2 text-sm transition-all hover:opacity-80"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => {
                setPhase('config');
                setSession(null);
                setResults(null);
              }}
              style={accentBtn}
              className="px-4 py-2 text-sm transition-opacity hover:opacity-90"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz phase
  if (!session) return null;
  const question: QuestionForQuiz = session.questions[questionIdx];
  if (!question) return null;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <span style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }}>
          Question {questionIdx + 1} of {session.questions.length}
        </span>
        <span style={{ color: '#c4956a', fontWeight: 500, fontSize: '0.9rem' }}>
          Score: {score}/{questionIdx + (answerResult ? 1 : 0)}
        </span>
      </div>

      {/* Progress */}
      <div
        className="mb-8 overflow-hidden"
        style={{ height: '3px', background: 'rgba(255,248,240,0.06)', borderRadius: '4px' }}
      >
        <div
          style={{
            height: '100%',
            background: '#c4956a',
            borderRadius: '4px',
            transition: 'width 0.3s ease',
            width: `${((questionIdx + (answerResult ? 1 : 0)) / session.questions.length) * 100}%`,
          }}
        />
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          style={glass}
          className="p-6 mb-6"
        >
          <span style={{ color: 'rgba(245,240,232,0.25)', fontWeight: 300, fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase' }} className="mb-2 inline-block">
            {question.difficulty}
          </span>
          <p
            style={{ fontFamily: "'Clash Display', sans-serif", color: '#f5f0e8', fontSize: '1.1rem', lineHeight: 1.7 }}
            className="mb-6 whitespace-pre-wrap"
          >
            {question.question_text}
          </p>

          {/* MCQ Options */}
          {question.options && (
            <div className="space-y-3">
              {question.options.map((opt, idx) => {
                let optStyle: React.CSSProperties = {
                  ...glass,
                  color: '#f5f0e8',
                  fontWeight: 300,
                  textAlign: 'left' as const,
                  width: '100%',
                  cursor: 'pointer',
                };

                if (answerResult) {
                  if (opt === answerResult.correct_answer) {
                    optStyle = {
                      ...optStyle,
                      background: 'rgba(120,180,120,0.1)',
                      border: '1px solid rgba(120,180,120,0.3)',
                      color: 'rgba(120,180,120,0.9)',
                    };
                  } else if (opt === selectedAnswer && !answerResult.is_correct) {
                    optStyle = {
                      ...optStyle,
                      background: 'rgba(220,120,100,0.1)',
                      border: '1px solid rgba(220,120,100,0.3)',
                      color: 'rgba(220,120,100,0.9)',
                    };
                  } else {
                    optStyle = {
                      ...optStyle,
                      background: 'rgba(255,248,240,0.02)',
                      border: '1px solid rgba(139,115,85,0.08)',
                      color: 'rgba(245,240,232,0.25)',
                    };
                  }
                } else if (opt === selectedAnswer) {
                  optStyle = {
                    ...optStyle,
                    background: 'rgba(196,149,106,0.15)',
                    border: '1px solid rgba(196,149,106,0.4)',
                    color: '#c4956a',
                  };
                }

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!answerResult) setSelectedAnswer(opt);
                    }}
                    disabled={!!answerResult}
                    style={optStyle}
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
          )}
        </motion.div>
      </AnimatePresence>

      {/* Explanation panel */}
      {answerResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            ...glass,
            background: answerResult.is_correct ? 'rgba(120,180,120,0.06)' : 'rgba(220,120,100,0.06)',
            border: answerResult.is_correct ? '1px solid rgba(120,180,120,0.2)' : '1px solid rgba(220,120,100,0.2)',
          }}
          className="p-4 mb-6"
        >
          <div className="flex items-center gap-2 mb-2">
            {answerResult.is_correct ? (
              <CheckCircle className="w-5 h-5" style={{ color: 'rgba(120,180,120,0.9)' }} />
            ) : (
              <XCircle className="w-5 h-5" style={{ color: 'rgba(220,120,100,0.9)' }} />
            )}
            <span style={{ fontWeight: 500, color: answerResult.is_correct ? 'rgba(120,180,120,0.9)' : 'rgba(220,120,100,0.9)' }}>
              {answerResult.is_correct ? 'Correct!' : 'Incorrect'}
            </span>
          </div>
          {answerResult.explanation && (
            <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }}>{answerResult.explanation}</p>
          )}
        </motion.div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        {!answerResult ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={!selectedAnswer || answerMutation.isPending}
            style={accentBtn}
            className="px-6 py-2.5 text-sm transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {answerMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Submit Answer'
            )}
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={completeMutation.isPending}
            style={accentBtn}
            className="px-6 py-2.5 text-sm transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {completeMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : questionIdx + 1 >= session.questions.length ? (
              'See Results'
            ) : (
              <>
                Next <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
