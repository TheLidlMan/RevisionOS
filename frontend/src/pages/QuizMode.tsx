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

export default function QuizMode() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preModule = searchParams.get('module') ?? '';

  // Config state
  const [moduleId, setModuleId] = useState(preModule);
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty | 'MIXED'>('MEDIUM');

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
          <Brain className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-bold">Quiz Mode</h1>
        </div>

        <div className="bg-navy-light rounded-xl border border-gray-800 p-6 space-y-6">
          {/* Module */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Module
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

          {/* Number of questions */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Number of Questions
            </label>
            <div className="flex gap-2">
              {[5, 10, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setNumQuestions(n)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    numQuestions === n
                      ? 'bg-teal text-white'
                      : 'bg-navy-lighter border border-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
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
                className="w-20 bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal"
                placeholder="Custom"
              />
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Difficulty
            </label>
            <div className="flex gap-2">
              {(['EASY', 'MIXED', 'HARD'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    difficulty === d
                      ? 'bg-teal text-white'
                      : 'bg-navy-lighter border border-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {d.charAt(0) + d.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {startMutation.isError && (
            <p className="text-red-400 text-sm">
              Failed to start quiz. Make sure you have questions generated for this module.
            </p>
          )}

          <button
            onClick={handleStart}
            disabled={!moduleId || startMutation.isPending}
            className="w-full bg-teal hover:bg-teal-dark disabled:opacity-50 text-white rounded-lg px-4 py-3 font-medium transition-colors flex items-center justify-center gap-2"
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
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto w-full">
        <div className="flex flex-col items-center text-center py-12">
          <Trophy className="w-16 h-16 text-yellow-400 mb-4" />
          <h2 className="text-3xl font-bold mb-2">Quiz Complete!</h2>
          <p className="text-5xl font-bold text-teal my-6">{pct}%</p>

          <div className="grid grid-cols-3 gap-6 mb-8">
            <div>
              <p className="text-2xl font-bold text-green-400">
                {results.correct}
              </p>
              <p className="text-sm text-gray-400">Correct</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">
                {results.incorrect}
              </p>
              <p className="text-sm text-gray-400">Incorrect</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-400">
                {results.total_items}
              </p>
              <p className="text-sm text-gray-400">Total</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="bg-navy-light border border-gray-700 hover:border-gray-500 rounded-lg px-4 py-2 text-sm transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => {
                setPhase('config');
                setSession(null);
                setResults(null);
              }}
              className="bg-teal hover:bg-teal-dark text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
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
        <span className="text-sm text-gray-400">
          Question {questionIdx + 1} of {session.questions.length}
        </span>
        <span className="text-sm font-medium text-teal">
          Score: {score}/{questionIdx + (answerResult ? 1 : 0)}
        </span>
      </div>

      {/* Progress */}
      <div className="h-1 bg-navy-lighter rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-teal rounded-full transition-all duration-300"
          style={{
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
          className="bg-navy-light rounded-xl border border-gray-800 p-6 mb-6"
        >
          <span className="text-xs text-gray-500 uppercase mb-2 inline-block">
            {question.difficulty}
          </span>
          <p className="text-lg mb-6 whitespace-pre-wrap">
            {question.question_text}
          </p>

          {/* MCQ Options */}
          {question.options && (
            <div className="space-y-3">
              {question.options.map((opt, idx) => {
                let optClass =
                  'bg-navy-lighter border border-gray-700 hover:border-gray-500 text-gray-200';

                if (answerResult) {
                  if (opt === answerResult.correct_answer) {
                    optClass =
                      'bg-green-500/10 border border-green-500/30 text-green-400';
                  } else if (
                    opt === selectedAnswer &&
                    !answerResult.is_correct
                  ) {
                    optClass =
                      'bg-red-500/10 border border-red-500/30 text-red-400';
                  } else {
                    optClass =
                      'bg-navy-lighter border border-gray-800 text-gray-500';
                  }
                } else if (opt === selectedAnswer) {
                  optClass =
                    'bg-teal/10 border border-teal text-teal';
                }

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!answerResult) setSelectedAnswer(opt);
                    }}
                    disabled={!!answerResult}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all ${optClass}`}
                  >
                    <span className="font-mono mr-2 opacity-50">
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
          className={`rounded-xl border p-4 mb-6 ${
            answerResult.is_correct
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-red-500/10 border-red-500/20'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {answerResult.is_correct ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
            <span
              className={`font-medium ${
                answerResult.is_correct ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {answerResult.is_correct ? 'Correct!' : 'Incorrect'}
            </span>
          </div>
          {answerResult.explanation && (
            <p className="text-sm text-gray-300">{answerResult.explanation}</p>
          )}
        </motion.div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        {!answerResult ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={!selectedAnswer || answerMutation.isPending}
            className="bg-teal hover:bg-teal-dark disabled:opacity-50 text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-colors flex items-center gap-2"
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
            className="bg-teal hover:bg-teal-dark disabled:opacity-50 text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-colors flex items-center gap-2"
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
