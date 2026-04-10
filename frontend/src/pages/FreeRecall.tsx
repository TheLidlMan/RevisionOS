import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Brain,
  Loader2,
  AlertCircle,
  Send,
  RotateCcw,
} from 'lucide-react';
import { getModules, submitFreeRecall } from '../api/client';
import type { Module, FreeRecallResult } from '../types';

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

export default function FreeRecall() {
  const [moduleId, setModuleId] = useState('');
  const [topic, setTopic] = useState('');
  const [userText, setUserText] = useState('');
  const [result, setResult] = useState<FreeRecallResult | null>(null);

  const { data: modules } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const recallMutation = useMutation({
    mutationFn: () => submitFreeRecall(moduleId, topic, userText),
    onSuccess: (data) => setResult(data),
  });

  const handleSubmit = () => {
    if (!moduleId || !topic.trim() || !userText.trim()) return;
    recallMutation.mutate();
  };

  const handleReset = () => {
    setResult(null);
    setUserText('');
    setTopic('');
  };

  // Ctrl+Enter to submit
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !result) {
        e.preventDefault();
        handleSubmit();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moduleId, topic, userText, result],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Results view
  if (result) {
    const pct = Math.round(result.score_pct);
    const ringR = 70;
    const circumference = 2 * Math.PI * ringR;
    const offset = circumference - (pct / 100) * circumference;

    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-8">
          <Brain className="w-6 h-6" style={{ color: '#c4956a' }} />
          <h1
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 600 }}
            className="text-2xl"
          >
            Recall Results
          </h1>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center mb-8">
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

          <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-8">
            <div style={glass} className="p-4 text-center">
              <p style={{ color: 'rgba(120,180,120,0.8)', fontWeight: 200, fontSize: '2rem' }}>
                {result.recalled_concepts}
              </p>
              <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.8rem' }}>Recalled</p>
            </div>
            <div style={glass} className="p-4 text-center">
              <p style={{ color: '#f5f0e8', fontWeight: 200, fontSize: '2rem' }}>
                {result.total_concepts}
              </p>
              <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.8rem' }}>Total Concepts</p>
            </div>
          </div>
        </motion.div>

        {/* AI Feedback */}
        {result.feedback && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={glass} className="p-5 mb-6"
          >
            <h3 style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 500, fontSize: '1rem' }} className="mb-3">
              AI Feedback
            </h3>
            <p style={{ color: 'rgba(245,240,232,0.7)', fontWeight: 300, fontSize: '0.9rem', lineHeight: 1.7 }}>
              {result.feedback}
            </p>
          </motion.div>
        )}

        {/* Missed concepts */}
        {result.missed_concepts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            style={glass} className="p-5 mb-6"
          >
            <h3 style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 500, fontSize: '1rem' }} className="mb-4">
              Missed Concepts ({result.missed_concepts.length})
            </h3>
            <div className="space-y-3">
              {result.missed_concepts.map((concept, idx) => (
                <div key={idx} style={{
                  background: 'rgba(220,120,100,0.06)',
                  border: '1px solid rgba(220,120,100,0.15)',
                  borderRadius: '8px',
                }} className="p-3">
                  <p style={{ color: 'rgba(220,120,100,0.9)', fontWeight: 500, fontSize: '0.9rem' }} className="mb-1">
                    {concept.name}
                  </p>
                  <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.85rem', lineHeight: 1.6 }}>
                    {concept.definition}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <div className="flex justify-center">
          <button onClick={handleReset} style={accentBtn}
            className="px-6 py-2.5 text-sm transition-opacity hover:opacity-90 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  // Input view
  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <Brain className="w-6 h-6" style={{ color: '#c4956a' }} />
        <h1
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 600 }}
          className="text-2xl"
        >
          Free Recall
        </h1>
      </div>

      <div style={glass} className="p-6 space-y-6">
        {/* Module */}
        <div>
          <label style={labelStyle} className="block mb-2">Module</label>
          <select
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            style={inputStyle}
            className="w-full px-3 py-2.5 focus:outline-none transition-colors"
          >
            <option value="">Choose a module…</option>
            {modules?.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Topic */}
        <div>
          <label style={labelStyle} className="block mb-2">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Photosynthesis, Cell Division…"
            style={inputStyle}
            className="w-full px-3 py-2.5 focus:outline-none transition-colors"
          />
        </div>

        {/* Recall area */}
        <div>
          <label style={labelStyle} className="block mb-2">
            Write everything you can remember
          </label>
          <textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder="Start writing everything you know about this topic from memory…"
            rows={12}
            style={{
              ...inputStyle,
              resize: 'vertical',
              lineHeight: 1.7,
              fontWeight: 300,
            }}
            className="w-full px-4 py-3 focus:outline-none transition-colors"
          />
          <p style={{ color: 'rgba(245,240,232,0.25)', fontSize: '0.75rem', fontWeight: 300 }} className="mt-1 text-right">
            {userText.split(/\s+/).filter(Boolean).length} words
          </p>
        </div>

        {recallMutation.isError && (
          <div className="flex items-center gap-2" style={{ color: 'rgba(220,120,100,0.8)', fontSize: '0.9rem', fontWeight: 300 }}>
            <AlertCircle className="w-4 h-4" />
            <span>Failed to submit. Please try again.</span>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!moduleId || !topic.trim() || !userText.trim() || recallMutation.isPending}
          style={accentBtn}
          className="w-full px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {recallMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {recallMutation.isPending ? 'Analysing…' : 'Submit Recall'}
        </button>

        <p style={{ color: 'rgba(245,240,232,0.25)', fontSize: '0.75rem', fontWeight: 300 }} className="text-center">
          Press Ctrl+Enter to submit
        </p>
      </div>
    </div>
  );
}
