import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowCounterClockwise, ArrowLeft, Confetti, Lightbulb, SpinnerGap, TrendUp } from '@phosphor-icons/react';
import { getFlashcards, reviewFlashcard, getElaborationPrompts, submitConfidence } from '../api/client';
import type { Flashcard, Rating, ElaborationResponse } from '../types';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const RATINGS: { label: string; value: Rating; key: string; color: string; bg: string; hoverBg: string }[] = [
  { label: 'Again', value: 'AGAIN', key: '1', color: '#fff', bg: 'rgba(220,120,100,0.8)', hoverBg: 'rgba(220,120,100,1)' },
  { label: 'Hard', value: 'HARD', key: '2', color: '#f5f0e8', bg: 'rgba(245,240,232,0.1)', hoverBg: 'rgba(245,240,232,0.18)' },
  { label: 'Good', value: 'GOOD', key: '3', color: '#1a1714', bg: '#c4956a', hoverBg: '#d4a57a' },
  { label: 'Easy', value: 'EASY', key: '4', color: '#fff', bg: 'rgba(120,180,120,0.8)', hoverBg: 'rgba(120,180,120,1)' },
];

const CONFIDENCE_LEVELS = [
  { value: 1, label: '1', desc: 'No idea' },
  { value: 2, label: '2', desc: 'Uncertain' },
  { value: 3, label: '3', desc: 'Maybe' },
  { value: 4, label: '4', desc: 'Fairly sure' },
  { value: 5, label: '5', desc: 'Certain' },
];
const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function RichText({ text }: { text: string }) {
  const html = useMemo(() => {
    let result = escapeHtml(text);

    result = result.replace(/\$\$([^$]+)\$\$/g, (_match, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return `$$${tex}$$`;
      }
    });

    result = result.replace(/\$([^$]+)\$/g, (_match, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return `$${tex}$`;
      }
    });

    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    result = result.replace(
      /`([^`]+)`/g,
      '<code style="background:rgba(196,149,106,0.15);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>'
    );

    return result;
  }, [text]);

  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.25rem', lineHeight: 1.7 }}
      className="text-center whitespace-pre-wrap"
    />
  );
}

export default function FlashcardReview() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [startTime] = useState(Date.now());
  const [done, setDone] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [confidenceSubmitted, setConfidenceSubmitted] = useState(false);
  const [elaboration, setElaboration] = useState<ElaborationResponse | null>(null);
  const [showElaboration, setShowElaboration] = useState(false);
  const elaborationLoadingRef = useRef(false);

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
      setConfidence(null);
      setConfidenceSubmitted(false);
      setElaboration(null);
      setShowElaboration(false);
      elaborationLoadingRef.current = false;
      if (cards && currentIdx + 1 >= cards.length) {
        setDone(true);
      } else {
        setCurrentIdx((i) => i + 1);
      }
    },
  });

  const confidenceMutation = useMutation({
    mutationFn: ({ cardId, conf }: { cardId: string; conf: number }) =>
      submitConfidence(cardId, conf),
    onSuccess: () => setConfidenceSubmitted(true),
  });

  const elaborationMutation = useMutation({
    mutationFn: (cardId: string) => getElaborationPrompts(cardId),
    onSuccess: (data) => {
      setElaboration(data);
      setShowElaboration(true);
      elaborationLoadingRef.current = false;
    },
    onError: () => { elaborationLoadingRef.current = false; },
  });

  const handleFlip = useCallback(() => {
    if (!flipped) setFlipped(true);
  }, [flipped]);

  const handleRate = useCallback(
    (rating: Rating) => {
      if (!cards) return;
      reviewMutation.mutate({ id: cards[currentIdx].id, rating });
    },
    [cards, currentIdx, reviewMutation]
  );

  const handleConfidence = useCallback(
    (level: number) => {
      if (!cards) return;
      setConfidence(level);
      confidenceMutation.mutate({ cardId: cards[currentIdx].id, conf: level });
    },
    [cards, currentIdx, confidenceMutation]
  );

  const handleElaborate = useCallback(() => {
    if (!cards || elaborationLoadingRef.current) return;
    elaborationLoadingRef.current = true;
    elaborationMutation.mutate(cards[currentIdx].id);
  }, [cards, currentIdx, elaborationMutation]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && !flipped) {
        e.preventDefault();
        handleFlip();
      }
      if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
        handleRate(RATINGS[parseInt(e.key, 10) - 1].value);
      }
      if (flipped && (e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey) {
        handleElaborate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flipped, handleFlip, handleRate, handleElaborate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <SpinnerGap className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <Confetti className="w-16 h-16 mb-4" style={{ color: 'var(--accent)' }} />
        <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)' }} className="text-2xl mb-2">
          No cards due
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontWeight: 300, fontSize: '0.9rem' }} className="mb-6">
          You're all caught up. Come back later for more reviews.
        </p>
        <button onClick={() => navigate(-1)} className="scholar-btn">
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
        <Confetti className="w-16 h-16 mb-4" style={{ color: 'var(--accent)' }} />
        <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)' }} className="text-2xl mb-2">
          Session Complete
        </h2>
        <p style={{ color: 'var(--accent)', fontWeight: 200, fontSize: '3rem' }} className="my-4">{reviewed}</p>
        <p style={{ color: 'var(--text-secondary)', fontWeight: 300, fontSize: '0.9rem' }} className="mb-1">cards reviewed</p>
        <p style={{ color: 'var(--text-tertiary)', fontWeight: 300, fontSize: '0.9rem' }} className="mb-6">
          Time: {mins > 0 ? `${mins}m ` : ''}{secs}s
        </p>
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
              setFlipped(false);
              setReviewed(0);
              setDone(false);
              setConfidence(null);
              setConfidenceSubmitted(false);
              setElaboration(null);
              setShowElaboration(false);
              elaborationLoadingRef.current = false;
            }}
            className="scholar-btn flex items-center gap-2"
          >
            <ArrowCounterClockwise className="w-4 h-4" />
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
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
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

      {/* Confidence rating (before flip) — Feature 12 */}
      {!flipped && !confidenceSubmitted && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <p style={{ color: 'var(--text-secondary)', fontWeight: 300, fontSize: '0.8rem', textAlign: 'center' }} className="mb-2">
            How confident are you? (before flipping)
          </p>
          <div className="flex justify-center gap-2">
            {CONFIDENCE_LEVELS.map((cl) => (
              <button
                key={cl.value}
                onClick={() => handleConfidence(cl.value)}
                title={cl.desc}
                style={{
                  background: confidence === cl.value ? 'rgba(196,149,106,0.3)' : 'rgba(255,248,240,0.04)',
                  border: confidence === cl.value ? '1px solid rgba(196,149,106,0.5)' : '1px solid rgba(139,115,85,0.15)',
                  borderRadius: '8px',
                  color: confidence === cl.value ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: 400,
                  width: 36, height: 36,
                  transition: 'all 0.2s',
                }}
                className="text-sm flex items-center justify-center"
              >
                {cl.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}
      {confidenceSubmitted && !flipped && (
        <p style={{ color: 'var(--accent)', fontWeight: 300, fontSize: '0.75rem', textAlign: 'center' }} className="mb-4">
          <TrendUp className="w-3 h-3 inline mr-1" />
          Confidence: {confidence}/5 recorded
        </p>
      )}

      {/* Card */}
      <div className="perspective-[1200px] mb-8" onClick={handleFlip}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${card.id}-${flipped}`}
            initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ ...glass, borderRadius: '16px', cursor: 'pointer', userSelect: 'none' }}
            className="p-8 min-h-[300px] flex flex-col items-center justify-center"
          >
            <p style={{ color: 'var(--text-tertiary)', fontWeight: 300, fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase' }} className="mb-4">
              {flipped ? 'Answer' : 'Question'}
            </p>
            <RichText text={flipped ? card.back : card.front} />
            {!flipped && (
              <p style={{ color: 'var(--text-tertiary)', fontWeight: 300, fontSize: '0.8rem' }} className="mt-6">
                Click or press Space to flip
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Rating buttons + Elaborate */}
      {flipped && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex justify-center gap-3 mb-3">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                onClick={() => handleRate(r.value)}
                disabled={reviewMutation.isPending}
                style={{ background: r.bg, color: r.color, borderRadius: '8px', fontWeight: 500, border: 'none', transition: 'all 0.2s' }}
                className="px-6 py-3 text-sm disabled:opacity-50"
                onMouseEnter={(e) => (e.currentTarget.style.background = r.hoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = r.bg)}
              >
                {r.label}
                <span style={{ opacity: 0.6, marginLeft: '4px', fontSize: '0.75rem' }}>({r.key})</span>
              </button>
            ))}
          </div>
          {/* Go Deeper button — Feature 5 */}
          <div className="flex justify-center">
            <button
              onClick={handleElaborate}
              disabled={elaborationMutation.isPending || showElaboration}
              style={{ ...glass, color: 'var(--accent)', fontWeight: 300, fontSize: '0.85rem', borderRadius: '8px' }}
              className="px-4 py-2 text-sm transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-2"
            >
              {elaborationMutation.isPending ? <SpinnerGap className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
              Go Deeper <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>(D)</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Elaboration prompts — Feature 5 */}
      {showElaboration && elaboration && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={glass} className="mt-4 p-5">
          <p style={{ color: 'var(--accent)', fontWeight: 400, fontSize: '0.85rem', marginBottom: 12 }}>
            <Lightbulb className="w-4 h-4 inline mr-1" /> Follow-up Questions
          </p>
          <div className="space-y-3">
            {elaboration.follow_up_questions.map((fq, i) => (
              <div key={i} style={{ borderLeft: '2px solid rgba(196,149,106,0.3)', paddingLeft: 12 }}>
                <p style={{ color: 'var(--text)', fontWeight: 400, fontSize: '0.9rem', marginBottom: 4 }}>
                  {i + 1}. {fq.question}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontWeight: 300, fontSize: '0.8rem' }}>
                  Hint: {fq.hint}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {reviewMutation.isError && (
        <p className="mt-4 text-sm text-center" style={{ color: 'rgba(220,120,100,0.9)' }}>
          Couldn&apos;t save this review. Please try again.
        </p>
      )}

      {/* Card info */}
      <div className="mt-8 flex justify-center gap-6" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
        <span>State: {card.state}</span>
        <span>Stability: {card.stability.toFixed(1)}</span>
        <span>Reviews: {card.reps}</span>
        {card.scheduled_days > 0 && <span>Next: ~{card.scheduled_days}d</span>}
      </div>
    </div>
  );
}
