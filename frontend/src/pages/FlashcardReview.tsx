import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, RotateCcw, PartyPopper } from 'lucide-react';
import { getFlashcards, reviewFlashcard } from '../api/client';
import type { Flashcard, Rating } from '../types';

const RATINGS: { label: string; value: Rating; key: string; color: string }[] = [
  { label: 'Again', value: 'AGAIN', key: '1', color: 'bg-red-500 hover:bg-red-600' },
  { label: 'Hard', value: 'HARD', key: '2', color: 'bg-orange-500 hover:bg-orange-600' },
  { label: 'Good', value: 'GOOD', key: '3', color: 'bg-teal hover:bg-teal-dark' },
  { label: 'Easy', value: 'EASY', key: '4', color: 'bg-green-500 hover:bg-green-600' },
];

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
        <Loader2 className="w-6 h-6 animate-spin text-teal" />
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <PartyPopper className="w-16 h-16 text-yellow-400 mb-4" />
        <h2 className="text-2xl font-bold mb-2">No cards due! 🎉</h2>
        <p className="text-gray-400 mb-6">
          You're all caught up. Come back later for more reviews.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="bg-teal hover:bg-teal-dark text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
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
        <PartyPopper className="w-16 h-16 text-yellow-400 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Session Complete!</h2>
        <p className="text-gray-400 mb-1">
          Reviewed <span className="text-white font-semibold">{reviewed}</span>{' '}
          cards
        </p>
        <p className="text-gray-400 mb-6">
          Time: {mins > 0 ? `${mins}m ` : ''}{secs}s
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="bg-navy-light border border-gray-700 hover:border-gray-500 rounded-lg px-4 py-2 text-sm transition-colors"
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
            className="bg-teal hover:bg-teal-dark text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
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
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span className="text-sm text-gray-400">
          {currentIdx + 1} / {cards.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-navy-lighter rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-teal rounded-full transition-all duration-300"
          style={{ width: `${((currentIdx) / cards.length) * 100}%` }}
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
            className="bg-navy-light rounded-2xl border border-gray-800 p-8 min-h-[300px] flex flex-col items-center justify-center cursor-pointer select-none"
          >
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-4">
              {flipped ? 'Answer' : 'Question'}
            </p>
            <p className="text-xl text-center leading-relaxed whitespace-pre-wrap">
              {flipped ? card.back : card.front}
            </p>
            {!flipped && (
              <p className="text-sm text-gray-500 mt-6">
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
              className={`${r.color} text-white rounded-lg px-6 py-3 text-sm font-medium transition-colors disabled:opacity-50`}
            >
              {r.label}
              <span className="text-xs opacity-60 ml-1">({r.key})</span>
            </button>
          ))}
        </motion.div>
      )}

      {/* Card info */}
      <div className="mt-8 flex justify-center gap-6 text-xs text-gray-500">
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
