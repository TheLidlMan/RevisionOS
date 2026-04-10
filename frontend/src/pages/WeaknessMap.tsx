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

function confidenceColor(score: number): string {
  if (score < 40) return 'bg-red-500/20 border-red-500/40 text-red-400';
  if (score < 60) return 'bg-orange-500/20 border-orange-500/40 text-orange-400';
  if (score < 75) return 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400';
  if (score < 85) return 'bg-green-500/20 border-green-500/40 text-green-400';
  return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
}

function TrendIcon({ trend }: { trend: ConceptConfidence['trend'] }) {
  if (trend === 'improving') return <TrendingUp className="w-3.5 h-3.5 text-green-400" />;
  if (trend === 'declining') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-gray-500" />;
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
        <Map className="w-6 h-6 text-teal" />
        <h1 className="text-2xl font-bold">Weakness Map</h1>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <select
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          className="bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal transition-colors"
        >
          <option value="">All Modules</option>
          {modules?.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <button
          onClick={() => setShowMastered(!showMastered)}
          className="flex items-center gap-2 bg-navy-light border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors"
        >
          {showMastered ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showMastered ? 'Showing Mastered' : 'Mastered Hidden'}
        </button>

        <button
          onClick={() => navigate(`/quiz?mode=weakness_drill${moduleId ? `&module=${moduleId}` : ''}`)}
          className="ml-auto flex items-center gap-2 bg-teal hover:bg-teal-dark text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Zap className="w-4 h-4" />
          Start Optimal Session
        </button>
      </div>

      {/* Stats bar */}
      {weaknessData && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-navy-light rounded-xl border border-gray-800 p-4 text-center">
            <p className="text-2xl font-bold">{weaknessData.total_concepts}</p>
            <p className="text-sm text-gray-400">Total Concepts</p>
          </div>
          <div className="bg-navy-light rounded-xl border border-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{weaknessData.weak_count}</p>
            <p className="text-sm text-gray-400">Weak</p>
          </div>
          <div className="bg-navy-light rounded-xl border border-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{weaknessData.mastered_count}</p>
            <p className="text-sm text-gray-400">Mastered</p>
          </div>
        </div>
      )}

      {/* Heatmap grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-teal" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 bg-navy-light rounded-xl border border-gray-800">
          <p className="text-gray-400">No concepts to display. Upload documents and generate content first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {displayed.map((concept) => (
            <button
              key={concept.id}
              onClick={() => setSelectedConceptId(concept.id)}
              className={`rounded-xl border p-4 text-left transition-all hover:scale-[1.02] ${confidenceColor(concept.confidence_score)} ${
                selectedConceptId === concept.id ? 'ring-2 ring-teal' : ''
              }`}
            >
              <p className="text-sm font-medium truncate mb-2">{concept.name}</p>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">{Math.round(concept.confidence_score)}%</span>
                <TrendIcon trend={concept.trend} />
              </div>
              <div className="mt-2 text-xs opacity-70">
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
              className="fixed inset-0 bg-black z-40"
              onClick={() => setSelectedConceptId(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-navy-light border-l border-gray-800 z-50 overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold">Concept Detail</h2>
                  <button
                    onClick={() => setSelectedConceptId(null)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {detailLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-teal" />
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
        <h3 className="text-xl font-bold mb-1">{detail.name}</h3>
        {detail.definition && (
          <p className="text-gray-400 text-sm">{detail.definition}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-navy-lighter rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Accuracy</p>
          <p className="text-lg font-bold">{Math.round(detail.accuracy_rate)}%</p>
        </div>
        <div className="bg-navy-lighter rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Reviews</p>
          <p className="text-lg font-bold">{detail.review_count}</p>
        </div>
      </div>

      {detail.last_reviewed && (
        <p className="text-xs text-gray-500">
          Last reviewed: {new Date(detail.last_reviewed).toLocaleDateString()}
        </p>
      )}

      {/* Flashcards */}
      {detail.flashcards.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Flashcards ({detail.flashcards.length})
          </h4>
          <div className="space-y-2">
            {detail.flashcards.map((fc) => (
              <div key={fc.id} className="bg-navy-lighter rounded-lg p-3 text-sm">
                <p className="text-gray-300 truncate">{fc.front}</p>
                <p className="text-xs text-gray-500 mt-1">
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
          <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            Questions ({detail.questions.length})
          </h4>
          <div className="space-y-2">
            {detail.questions.map((q) => (
              <div key={q.id} className="bg-navy-lighter rounded-lg p-3 text-sm">
                <p className="text-gray-300 truncate">{q.question_text}</p>
                <p className="text-xs text-gray-500 mt-1">
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
        className="w-full bg-teal hover:bg-teal-dark disabled:opacity-50 text-white rounded-lg px-4 py-3 font-medium transition-colors flex items-center justify-center gap-2"
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
