import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import { getFlashcards, reviewFlashcard } from '../api/client';
import type { Flashcard, Rating } from '../types';

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

function extractClozeAnswer(back: string): string {
  return back.trim();
}

function renderClozeQuestion(front: string): ReactNode {
  return front.split(/(_{3,})/g).map((part, index) => (
    /_{3,}/.test(part) ? (
      <span
        key={`blank-${index}`}
        style={{
          display: 'inline-block',
          minWidth: 120,
          borderBottom: '2px dashed var(--accent)',
          margin: '0 4px',
        }}
      />
    ) : (
      <span key={`text-${index}`}>{part}</span>
    )
  ));
}

export default function FlashcardReview() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: cards, isLoading } = useQuery({
    queryKey: ['flashcards', moduleId, 'due'],
    queryFn: () => getFlashcards({ module_id: moduleId!, due: true }),
    enabled: !!moduleId,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: Rating }) =>
      reviewFlashcard(id, rating),
  });
  const isProcessing = reviewMutation.isPending;

  const handleSubmit = useCallback(async () => {
    if (!cards || submitted || isProcessing) return;
    const card = cards[currentIdx];
    const correctAnswer = extractClozeAnswer(card.back);
    const correct = userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase();
    const rating: Rating = correct ? 'GOOD' : 'AGAIN';
    reviewMutation.reset();
    try {
      await reviewMutation.mutateAsync({ id: card.id, rating });
      setIsCorrect(correct);
      setSubmitted(true);
      if (correct) setCorrectCount((c) => c + 1);
    } catch {
      return;
    }
  }, [cards, currentIdx, isProcessing, reviewMutation, submitted, userAnswer]);

  const handleNext = useCallback(() => {
    if (isProcessing) return;
    setReviewed((r) => r + 1);
    setUserAnswer('');
    setSubmitted(false);
    setIsCorrect(false);
    reviewMutation.reset();
    if (cards && currentIdx + 1 >= cards.length) {
      setElapsedSeconds(Math.round((Date.now() - startTime) / 1000));
      setDone(true);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  }, [cards, currentIdx, isProcessing, reviewMutation, startTime]);

  useEffect(() => {
    if (!submitted && inputRef.current) {
      inputRef.current.focus();
    }
  }, [submitted, currentIdx]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (submitted) {
          handleNext();
        } else if (userAnswer.trim()) {
          void handleSubmit();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [submitted, userAnswer, handleSubmit, handleNext]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <CheckCircle className="w-16 h-16 mb-4" style={{ color: 'var(--accent)' }} />
        <h2 style={{ fontFamily: "var(--heading)", color: 'var(--text)' }} className="text-2xl mb-2">
          No cards due
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontWeight: 300, fontSize: '0.9rem' }} className="mb-6">
          You're all caught up. Come back later for more reviews.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="scholar-btn"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (done) {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    const accuracy = reviewed > 0 ? Math.round((correctCount / reviewed) * 100) : 0;
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <CheckCircle className="w-16 h-16 mb-4" style={{ color: 'var(--accent)' }} />
        <h2 style={{ fontFamily: "var(--heading)", color: 'var(--text)' }} className="text-2xl mb-2">
          Session Complete
        </h2>
        <div className="grid grid-cols-3 gap-6 my-8">
          <div>
            <p style={{ color: 'var(--accent)', fontWeight: 200, fontSize: '3rem' }}>{reviewed}</p>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 300, fontSize: '0.8rem' }}>reviewed</p>
          </div>
          <div>
            <p style={{ color: 'var(--success)', fontWeight: 200, fontSize: '3rem' }}>{accuracy}%</p>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 300, fontSize: '0.8rem' }}>accuracy</p>
          </div>
          <div>
            <p style={{ color: 'var(--text)', fontWeight: 200, fontSize: '3rem' }}>{mins > 0 ? `${mins}m` : `${secs}s`}</p>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 300, fontSize: '0.8rem' }}>time</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            style={{ ...glass, color: 'var(--text)', fontWeight: 300, fontSize: '0.9rem' }}
            className="px-4 py-2 text-sm transition-all hover:opacity-80"
          >
            Go Back
          </button>
          <button
            onClick={() => {
              setCurrentIdx(0);
              setUserAnswer('');
              setSubmitted(false);
              setIsCorrect(false);
              setReviewed(0);
              setCorrectCount(0);
              setElapsedSeconds(0);
              setDone(false);
            }}
            className="scholar-btn flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Review Again
          </button>
        </div>
      </div>
    );
  }

  const card: Flashcard = cards[currentIdx];
  const correctAnswer = extractClozeAnswer(card.back);

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 300, fontSize: '0.9rem' }}>
          {currentIdx + 1} / {cards.length}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="mb-8 overflow-hidden"
        style={{ height: '3px', background: 'rgba(255,248,240,0.06)', borderRadius: '4px' }}
      >
        <div
          style={{
            height: '100%',
            background: 'var(--accent)',
            borderRadius: '4px',
            transition: 'width 0.3s ease',
            width: `${((currentIdx) / cards.length) * 100}%`,
          }}
        />
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.25 }}
          style={{ ...glass, borderRadius: '16px' }}
          className="p-8 mb-6"
        >
          <p style={{ color: 'var(--text-tertiary)', fontWeight: 300, fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase' }} className="mb-4">
            Fill in the blank
          </p>
          <p
            style={{
              fontFamily: "var(--heading)",
              color: 'var(--text)',
              fontSize: '1.25rem',
              lineHeight: 1.7,
            }}
            className="text-center whitespace-pre-wrap"
          >
            {renderClozeQuestion(card.front)}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Answer input */}
      <div className="mb-6">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={userAnswer}
            onChange={(e) => !submitted && !isProcessing && setUserAnswer(e.target.value)}
            placeholder="Type your answer..."
            disabled={submitted || isProcessing}
            style={{
              ...glass,
              width: '100%',
              padding: '16px 20px',
              fontSize: '1rem',
              fontFamily: 'var(--sans)',
              color: submitted
                ? isCorrect ? 'rgba(120,180,120,0.9)' : 'rgba(220,120,100,0.9)'
                : 'var(--text)',
              borderColor: submitted
                ? isCorrect ? 'rgba(120,180,120,0.3)' : 'rgba(220,120,100,0.3)'
                : undefined,
              outline: 'none',
            }}
            className="transition-all"
          />
          {submitted && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {isCorrect ? (
                <CheckCircle className="w-5 h-5" style={{ color: 'rgba(120,180,120,0.9)' }} />
              ) : (
                <XCircle className="w-5 h-5" style={{ color: 'rgba(220,120,100,0.9)' }} />
              )}
            </div>
          )}
        </div>
        {reviewMutation.isError && (
          <p className="mt-3 text-sm" style={{ color: 'rgba(220,120,100,0.9)' }}>
            Couldn&apos;t save this review. Please try again.
          </p>
        )}
      </div>

      {/* Feedback */}
      {submitted && !isCorrect && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            ...glass,
            background: 'rgba(220,120,100,0.06)',
            border: '1px solid rgba(220,120,100,0.2)',
          }}
          className="p-4 mb-6"
        >
          <p style={{ color: 'rgba(220,120,100,0.9)', fontWeight: 400, fontSize: '0.85rem' }} className="mb-1">
            Correct answer:
          </p>
          <p style={{ color: 'var(--text)', fontWeight: 500, fontSize: '1rem' }}>
            {correctAnswer}
          </p>
        </motion.div>
      )}

      {/* Action button */}
      <div className="flex justify-center">
        {!submitted ? (
          <button
            onClick={() => void handleSubmit()}
            disabled={!userAnswer.trim() || isProcessing}
            className="scholar-btn disabled:opacity-50 px-8 py-3"
          >
            {isProcessing ? 'Saving...' : 'Check Answer'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={isProcessing}
            className="scholar-btn px-8 py-3"
          >
            {currentIdx + 1 >= cards.length ? 'Finish' : 'Next Card'}
          </button>
        )}
      </div>

      {/* Card info */}
      <div className="mt-8 flex justify-center gap-6" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
        <span>State: {card.state}</span>
        <span>Stability: {card.stability.toFixed(1)}</span>
        <span>Reviews: {card.reps}</span>
        {card.scheduled_days > 0 && (
          <span>Next: ~{card.scheduled_days}d</span>
        )}
      </div>
    </div>
  );
}
