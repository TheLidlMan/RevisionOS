import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, RotateCcw, PartyPopper } from 'lucide-react';
import { getFlashcards, reviewFlashcard } from '../api/client';
import type { Flashcard, Rating } from '../types';

const RATINGS: { label: string; value: Rating; key: string; color: string; bg: string; hoverBg: string }[] = [
  { label: 'Again', value: 'AGAIN', key: '1', color: '#fff', bg: 'rgba(220,120,100,0.8)', hoverBg: 'rgba(220,120,100,1)' },
  { label: 'Hard', value: 'HARD', key: '2', color: '#f5f0e8', bg: 'rgba(245,240,232,0.1)', hoverBg: 'rgba(245,240,232,0.18)' },
  { label: 'Good', value: 'GOOD', key: '3', color: '#1a1714', bg: '#c4956a', hoverBg: '#d4a57a' },
  { label: 'Easy', value: 'EASY', key: '4', color: '#fff', bg: 'rgba(120,180,120,0.8)', hoverBg: 'rgba(120,180,120,1)' },
];

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

export default function FlashcardReview() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [startTime] = useState(Date.now());
  const [done, setDone] = useState(false);

  const { data: cards, isLoading } = useQuery({
    queryKey: ['flashcards', moduleId, 'due'],
    queryFn: () => getFlashcards({ module_id: moduleId!, due: true }),
    enabled: !!moduleId,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: Rating }) =>
      reviewFlashcard(id, rating),
    onSuccess: () => {
      setReviewed((r) => r + 1);
      setFlipped(false);
      if (cards && currentIdx + 1 >= cards.length) {
        setDone(true);
      } else {
        setCurrentIdx((i) => i + 1);
      }
    },
  });

  const handleFlip = useCallback(() => {
    if (!flipped) setFlipped(true);
  }, [flipped]);

  const handleRate = useCallback(
    (rating: Rating) => {
      if (!cards) return;
      const card = cards[currentIdx];
      reviewMutation.mutate({ id: card.id, rating });
    },
    [cards, currentIdx, reviewMutation]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleFlip();
      }
      if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        handleRate(RATINGS[idx].value);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flipped, handleFlip, handleRate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#c4956a' }} />
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <PartyPopper className="w-16 h-16 mb-4" style={{ color: '#c4956a' }} />
        <h2
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8' }}
          className="text-2xl mb-2"
        >
          No cards due! 🎉
        </h2>
        <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }} className="mb-6">
          You're all caught up. Come back later for more reviews.
        </p>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: '#c4956a',
            color: '#1a1714',
            borderRadius: '8px',
            fontWeight: 500,
          }}
          className="px-4 py-2 text-sm transition-opacity hover:opacity-90"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (done) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <PartyPopper className="w-16 h-16 mb-4" style={{ color: '#c4956a' }} />
        <h2
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8' }}
          className="text-2xl mb-2"
        >
          Session Complete!
        </h2>
        <p style={{ color: '#c4956a', fontWeight: 200, fontSize: '3rem' }} className="my-4">
          {reviewed}
        </p>
        <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }} className="mb-1">
          cards reviewed
        </p>
        <p style={{ color: 'rgba(245,240,232,0.25)', fontWeight: 300, fontSize: '0.9rem' }} className="mb-6">
          Time: {mins > 0 ? `${mins}m ` : ''}{secs}s
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            style={{
              ...glass,
              color: '#f5f0e8',
              fontWeight: 300,
              fontSize: '0.9rem',
            }}
            className="px-4 py-2 text-sm transition-all hover:opacity-80"
          >
            Go Back
          </button>
          <button
            onClick={() => {
              setCurrentIdx(0);
              setFlipped(false);
              setReviewed(0);
              setDone(false);
            }}
            style={{
              background: '#c4956a',
              color: '#1a1714',
              borderRadius: '8px',
              fontWeight: 500,
            }}
            className="px-4 py-2 text-sm transition-opacity hover:opacity-90 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Review Again
          </button>
        </div>
      </div>
    );
  }

  const card: Flashcard = cards[currentIdx];

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm transition-colors"
          style={{ color: 'rgba(245,240,232,0.5)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#f5f0e8')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(245,240,232,0.5)')}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }}>
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
            background: '#c4956a',
            borderRadius: '4px',
            transition: 'width 0.3s ease',
            width: `${((currentIdx) / cards.length) * 100}%`,
          }}
        />
      </div>

      {/* Card */}
      <div className="perspective-[1200px] mb-8" onClick={handleFlip}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${card.id}-${flipped}`}
            initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              ...glass,
              borderRadius: '16px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            className="p-8 min-h-[300px] flex flex-col items-center justify-center"
          >
            <p style={{ color: 'rgba(245,240,232,0.25)', fontWeight: 300, fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase' }} className="mb-4">
              {flipped ? 'Answer' : 'Question'}
            </p>
            <p
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                color: '#f5f0e8',
                fontSize: '1.25rem',
                lineHeight: 1.7,
              }}
              className="text-center whitespace-pre-wrap"
            >
              {flipped ? card.back : card.front}
            </p>
            {!flipped && (
              <p style={{ color: 'rgba(245,240,232,0.25)', fontWeight: 300, fontSize: '0.8rem' }} className="mt-6">
                Click or press Space to flip
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Rating buttons */}
      {flipped && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center gap-3"
        >
          {RATINGS.map((r) => (
            <button
              key={r.value}
              onClick={() => handleRate(r.value)}
              disabled={reviewMutation.isPending}
              style={{
                background: r.bg,
                color: r.color,
                borderRadius: '8px',
                fontWeight: 500,
                border: 'none',
                transition: 'all 0.2s',
              }}
              className="px-6 py-3 text-sm disabled:opacity-50"
              onMouseEnter={(e) => (e.currentTarget.style.background = r.hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = r.bg)}
            >
              {r.label}
              <span style={{ opacity: 0.6, marginLeft: '4px', fontSize: '0.75rem' }}>({r.key})</span>
            </button>
          ))}
        </motion.div>
      )}

      {/* Card info */}
      <div className="mt-8 flex justify-center gap-6" style={{ fontSize: '0.75rem', color: 'rgba(245,240,232,0.25)' }}>
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
