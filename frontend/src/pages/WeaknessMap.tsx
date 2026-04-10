import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  X,
  Zap,
  BookOpen,
  HelpCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  getModules,
  getWeaknessMap,
  getConceptDetail,
  drillConcept,
} from '../api/client';
import type { ConceptConfidence, ConceptDetail } from '../types';

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

function confidenceStyle(score: number): React.CSSProperties {
  if (score < 40) return { background: 'rgba(220,120,100,0.12)', border: '1px solid rgba(220,120,100,0.25)', borderRadius: '12px' };
  if (score < 60) return { background: 'rgba(210,160,90,0.12)', border: '1px solid rgba(210,160,90,0.25)', borderRadius: '12px' };
  if (score < 75) return { background: 'rgba(196,149,106,0.12)', border: '1px solid rgba(196,149,106,0.25)', borderRadius: '12px' };
  if (score < 85) return { background: 'rgba(140,180,120,0.12)', border: '1px solid rgba(140,180,120,0.25)', borderRadius: '12px' };
  return { background: 'rgba(120,180,120,0.12)', border: '1px solid rgba(120,180,120,0.25)', borderRadius: '12px' };
}

function confidenceTextColor(score: number): string {
  if (score < 40) return 'rgba(220,120,100,0.9)';
  if (score < 60) return 'rgba(210,160,90,0.9)';
  if (score < 75) return '#c4956a';
  if (score < 85) return 'rgba(140,180,120,0.9)';
  return 'rgba(120,180,120,0.9)';
}

function TrendIcon({ trend }: { trend: ConceptConfidence['trend'] }) {
  if (trend === 'improving') return <TrendingUp className="w-3.5 h-3.5" style={{ color: 'rgba(120,180,120,0.9)' }} />;
  if (trend === 'declining') return <TrendingDown className="w-3.5 h-3.5" style={{ color: 'rgba(220,120,100,0.8)' }} />;
  return <Minus className="w-3.5 h-3.5" style={{ color: 'rgba(245,240,232,0.25)' }} />;
}

export default function WeaknessMap() {
  const navigate = useNavigate();
  const [moduleId, setModuleId] = useState('');
  const [showMastered, setShowMastered] = useState(false);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);

  const { data: modules } = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const { data: weaknessData, isLoading } = useQuery({
    queryKey: ['weakness-map', moduleId],
    queryFn: () => getWeaknessMap(moduleId || undefined),
  });

  const { data: conceptDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['concept-detail', selectedConceptId],
    queryFn: () => getConceptDetail(selectedConceptId!),
    enabled: !!selectedConceptId,
  });

  const drillMutation = useMutation({
    mutationFn: drillConcept,
    onSuccess: (data) => {
      navigate(`/quiz?session=${data.session_id}`);
    },
  });

  const concepts = weaknessData?.concepts ?? [];
  const displayed = showMastered
    ? concepts
    : concepts.filter((c) => c.confidence_score <= 85);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full relative">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Map className="w-6 h-6" style={{ color: '#c4956a' }} />
        <h1
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 600 }}
          className="text-2xl"
        >
          Weakness Map
        </h1>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <select
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          style={{
            background: 'rgba(255,248,240,0.04)',
            border: '1px solid rgba(139,115,85,0.15)',
            borderRadius: '8px',
            color: '#f5f0e8',
            fontWeight: 300,
            fontSize: '0.9rem',
          }}
          className="px-3 py-2.5 focus:outline-none transition-colors"
        >
          <option value="">All Modules</option>
          {modules?.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <button
          onClick={() => setShowMastered(!showMastered)}
          style={{
            ...glass,
            color: showMastered ? '#c4956a' : 'rgba(245,240,232,0.5)',
            fontWeight: 300,
            fontSize: '0.9rem',
          }}
          className="flex items-center gap-2 px-3 py-2 transition-all"
        >
          {showMastered ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showMastered ? 'Showing Mastered' : 'Mastered Hidden'}
        </button>

        <button
          onClick={() => navigate(`/quiz?mode=weakness_drill${moduleId ? `&module=${moduleId}` : ''}`)}
          style={{ background: '#c4956a', color: '#1a1714', borderRadius: '8px', fontWeight: 500, border: 'none' }}
          className="ml-auto flex items-center gap-2 px-4 py-2 text-sm transition-opacity hover:opacity-90"
        >
          <Zap className="w-4 h-4" />
          Start Optimal Session
        </button>
      </div>

      {/* Stats bar */}
      {weaknessData && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div style={glass} className="p-4 text-center">
            <p style={{ color: '#f5f0e8', fontWeight: 200, fontSize: '2rem' }}>{weaknessData.total_concepts}</p>
            <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.8rem' }}>Total Concepts</p>
          </div>
          <div style={glass} className="p-4 text-center">
            <p style={{ color: 'rgba(220,120,100,0.8)', fontWeight: 200, fontSize: '2rem' }}>{weaknessData.weak_count}</p>
            <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.8rem' }}>Weak</p>
          </div>
          <div style={glass} className="p-4 text-center">
            <p style={{ color: 'rgba(120,180,120,0.8)', fontWeight: 200, fontSize: '2rem' }}>{weaknessData.mastered_count}</p>
            <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.8rem' }}>Mastered</p>
          </div>
        </div>
      )}

      {/* Heatmap grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#c4956a' }} />
        </div>
      ) : displayed.length === 0 ? (
        <div style={glass} className="text-center py-16">
          <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }}>No concepts to display. Upload documents and generate content first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {displayed.map((concept) => (
            <button
              key={concept.id}
              onClick={() => setSelectedConceptId(concept.id)}
              style={{
                ...confidenceStyle(concept.confidence_score),
                backdropFilter: 'blur(20px)',
                textAlign: 'left' as const,
                transition: 'all 0.2s',
                outline: selectedConceptId === concept.id ? '2px solid #c4956a' : 'none',
                outlineOffset: '2px',
              }}
              className="p-4 hover:scale-[1.02]"
            >
              <p style={{ color: '#f5f0e8', fontWeight: 400, fontSize: '0.85rem' }} className="truncate mb-2">{concept.name}</p>
              <div className="flex items-center justify-between">
                <span style={{ color: confidenceTextColor(concept.confidence_score), fontWeight: 600, fontSize: '1.1rem' }}>
                  {Math.round(concept.confidence_score)}%
                </span>
                <TrendIcon trend={concept.trend} />
              </div>
              <div style={{ color: 'rgba(245,240,232,0.25)', fontWeight: 300, fontSize: '0.75rem' }} className="mt-2">
                {concept.review_count} reviews
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Concept detail slide-in panel */}
      <AnimatePresence>
        {selectedConceptId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: '#0f0f0f' }}
              onClick={() => setSelectedConceptId(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md z-50 overflow-y-auto"
              style={{
                background: '#1a1714',
                borderLeft: '1px solid rgba(139,115,85,0.15)',
              }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2
                    style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8' }}
                    className="text-lg"
                  >
                    Concept Detail
                  </h2>
                  <button
                    onClick={() => setSelectedConceptId(null)}
                    style={{ color: 'rgba(245,240,232,0.5)' }}
                    className="transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#f5f0e8')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(245,240,232,0.5)')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {detailLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#c4956a' }} />
                  </div>
                ) : conceptDetail ? (
                  <ConceptDetailPanel
                    detail={conceptDetail}
                    onDrill={() => drillMutation.mutate(conceptDetail.id)}
                    drilling={drillMutation.isPending}
                  />
                ) : null}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConceptDetailPanel({
  detail,
  onDrill,
  drilling,
}: {
  detail: ConceptDetail;
  onDrill: () => void;
  drilling: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 600 }}
          className="text-xl mb-1"
        >
          {detail.name}
        </h3>
        {detail.definition && (
          <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }}>{detail.definition}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div style={{ ...glass, borderRadius: '8px' }} className="p-3">
          <p style={{ color: 'rgba(245,240,232,0.25)', fontWeight: 300, fontSize: '0.75rem' }} className="mb-1">Accuracy</p>
          <p style={{ color: '#c4956a', fontWeight: 200, fontSize: '1.5rem' }}>{Math.round(detail.accuracy_rate)}%</p>
        </div>
        <div style={{ ...glass, borderRadius: '8px' }} className="p-3">
          <p style={{ color: 'rgba(245,240,232,0.25)', fontWeight: 300, fontSize: '0.75rem' }} className="mb-1">Reviews</p>
          <p style={{ color: '#f5f0e8', fontWeight: 200, fontSize: '1.5rem' }}>{detail.review_count}</p>
        </div>
      </div>

      {detail.last_reviewed && (
        <p style={{ color: 'rgba(245,240,232,0.25)', fontWeight: 300, fontSize: '0.75rem' }}>
          Last reviewed: {new Date(detail.last_reviewed).toLocaleDateString()}
        </p>
      )}

      {/* Flashcards */}
      {detail.flashcards.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 mb-2" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 400, fontSize: '0.85rem' }}>
            <BookOpen className="w-4 h-4" />
            Flashcards ({detail.flashcards.length})
          </h4>
          <div className="space-y-2">
            {detail.flashcards.map((fc) => (
              <div key={fc.id} style={{ ...glass, borderRadius: '8px' }} className="p-3">
                <p style={{ color: '#f5f0e8', fontWeight: 300, fontSize: '0.85rem' }} className="truncate">{fc.front}</p>
                <p style={{ color: 'rgba(245,240,232,0.25)', fontWeight: 300, fontSize: '0.75rem' }} className="mt-1">
                  {fc.state} · {fc.reps} reps
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Questions */}
      {detail.questions.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 mb-2" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 400, fontSize: '0.85rem' }}>
            <HelpCircle className="w-4 h-4" />
            Questions ({detail.questions.length})
          </h4>
          <div className="space-y-2">
            {detail.questions.map((q) => (
              <div key={q.id} style={{ ...glass, borderRadius: '8px' }} className="p-3">
                <p style={{ color: '#f5f0e8', fontWeight: 300, fontSize: '0.85rem' }} className="truncate">{q.question_text}</p>
                <p style={{ color: 'rgba(245,240,232,0.25)', fontWeight: 300, fontSize: '0.75rem' }} className="mt-1">
                  {q.difficulty} · {q.times_correct}/{q.times_answered} correct
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drill button */}
      <button
        onClick={onDrill}
        disabled={drilling}
        style={{ background: '#c4956a', color: '#1a1714', borderRadius: '8px', fontWeight: 500, border: 'none' }}
        className="w-full px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {drilling ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Zap className="w-4 h-4" />
        )}
        Drill This Concept
      </button>
    </div>
  );
}
