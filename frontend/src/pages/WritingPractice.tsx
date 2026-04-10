import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  PenTool,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  Send,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { getModules, getWritingPrompt, gradeWriting } from '../api/client';
import type { Module, WritingPrompt, WritingGradeResult } from '../types';

type Phase = 'setup' | 'write' | 'results';

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

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function WritingPractice() {
  const [moduleId, setModuleId] = useState('');
  const [phase, setPhase] = useState<Phase>('setup');
  const [prompt, setPrompt] = useState<WritingPrompt | null>(null);
  const [userText, setUserText] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [showMarkScheme, setShowMarkScheme] = useState(false);
  const [results, setResults] = useState<WritingGradeResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: modules } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const promptMutation = useMutation({
    mutationFn: () => getWritingPrompt(moduleId),
    onSuccess: (data) => {
      setPrompt(data);
      setUserText('');
      setElapsed(0);
      setPhase('write');
    },
  });

  const gradeMutation = useMutation({
    mutationFn: () => {
      if (!prompt) throw new Error('No prompt');
      return gradeWriting(prompt.question, prompt.mark_scheme, userText);
    },
    onSuccess: (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setResults(data);
      setPhase('results');
    },
  });

  // Elapsed timer
  useEffect(() => {
    if (phase !== 'write') return;
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const wordCount = userText.split(/\s+/).filter(Boolean).length;

  const handleReset = () => {
    setPhase('setup');
    setPrompt(null);
    setUserText('');
    setResults(null);
    setElapsed(0);
    setShowMarkScheme(false);
  };

  // ── Setup Phase ──
  if (phase === 'setup') {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-8">
          <PenTool className="w-6 h-6" style={{ color: '#c4956a' }} />
          <h1
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 600 }}
            className="text-2xl"
          >
            Writing Practice
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

          {promptMutation.isError && (
            <p style={{ color: 'rgba(220,120,100,0.8)', fontSize: '0.9rem', fontWeight: 300 }}>
              Failed to generate prompt. Please try again.
            </p>
          )}

          <button
            onClick={() => { if (moduleId) promptMutation.mutate(); }}
            disabled={!moduleId || promptMutation.isPending}
            style={accentBtn}
            className="w-full px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {promptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate Prompt
          </button>
        </div>
      </div>
    );
  }

  // ── Results Phase ──
  if (phase === 'results' && results && prompt) {
    const pct = prompt.max_marks > 0 ? Math.round((results.score / results.max_marks) * 100) : 0;
    const ringR = 70;
    const circumference = 2 * Math.PI * ringR;
    const offset = circumference - (pct / 100) * circumference;

    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-8">
          <PenTool className="w-6 h-6" style={{ color: '#c4956a' }} />
          <h1
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 600 }}
            className="text-2xl"
          >
            Writing Results
          </h1>
        </div>

        <div className="flex flex-col items-center mb-8">
          {/* Score ring */}
          <div className="relative mb-4" style={{ width: 180, height: 180 }}>
            <svg viewBox="0 0 180 180" style={{ width: '100%', height: '100%' }}>
              <circle cx="90" cy="90" r={ringR} fill="none" stroke="rgba(139,115,85,0.15)" strokeWidth="8" />
              <circle
                cx="90" cy="90" r={ringR} fill="none" stroke="#c4956a" strokeWidth="8"
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
                transform="rotate(-90 90 90)" style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span style={{ color: '#c4956a', fontWeight: 200, fontSize: '2.5rem' }}>{results.score}</span>
              <span style={{ color: 'rgba(245,240,232,0.4)', fontWeight: 300, fontSize: '0.85rem' }}>/ {results.max_marks}</span>
            </div>
          </div>

          <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.85rem' }}>
            {wordCount} words · {formatElapsed(elapsed)}
          </p>
        </div>

        {/* Overall feedback */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={glass} className="p-5 mb-6"
        >
          <h3 style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 500, fontSize: '1rem' }} className="mb-3">
            Overall Feedback
          </h3>
          <p style={{ color: 'rgba(245,240,232,0.7)', fontWeight: 300, fontSize: '0.9rem', lineHeight: 1.7 }}>
            {results.overall_feedback}
          </p>
        </motion.div>

        {/* Paragraph feedback */}
        {results.paragraph_feedback.length > 0 && (
          <div className="space-y-4 mb-8">
            <h3 style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 500, fontSize: '1rem' }}>
              Paragraph Feedback
            </h3>
            {results.paragraph_feedback.map((pf, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                style={glass}
                className="p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.8rem' }}>
                    Paragraph {pf.paragraph_idx + 1}
                  </span>
                  <span style={{ color: '#c4956a', fontWeight: 500, fontSize: '0.85rem' }}>
                    {pf.marks} marks
                  </span>
                </div>
                <p style={{ color: 'rgba(245,240,232,0.7)', fontWeight: 300, fontSize: '0.85rem', lineHeight: 1.6 }}>
                  {pf.feedback}
                </p>
              </motion.div>
            ))}
          </div>
        )}

        <div className="flex justify-center">
          <button onClick={handleReset} style={accentBtn}
            className="px-6 py-2.5 text-sm transition-opacity hover:opacity-90 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> New Writing Task
          </button>
        </div>
      </div>
    );
  }

  // ── Write Phase ──
  if (!prompt) return null;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PenTool className="w-6 h-6" style={{ color: '#c4956a' }} />
          <h1
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 600 }}
            className="text-xl"
          >
            Writing Practice
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" style={{ color: 'rgba(245,240,232,0.5)' }} />
            <span style={{ color: '#c4956a', fontWeight: 500, fontSize: '0.95rem', fontFamily: 'monospace' }}>
              {formatElapsed(elapsed)}
            </span>
          </div>
          <span style={{ color: 'rgba(245,240,232,0.35)', fontWeight: 300, fontSize: '0.8rem' }}>
            {wordCount} words
          </span>
        </div>
      </div>

      {/* Question */}
      <div style={glass} className="p-5 mb-4">
        <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontSize: '1.05rem', lineHeight: 1.7 }}>
          {prompt.question}
        </p>
        <div className="flex items-center gap-4 mt-3">
          <span style={{ color: 'rgba(245,240,232,0.35)', fontWeight: 300, fontSize: '0.75rem' }}>
            Max marks: {prompt.max_marks}
          </span>
          {prompt.time_limit_minutes > 0 && (
            <span style={{ color: 'rgba(245,240,232,0.35)', fontWeight: 300, fontSize: '0.75rem' }}>
              Suggested time: {prompt.time_limit_minutes} min
            </span>
          )}
        </div>
      </div>

      {/* Mark scheme collapsible */}
      <div style={glass} className="mb-4 overflow-hidden">
        <button
          onClick={() => setShowMarkScheme(!showMarkScheme)}
          className="w-full px-5 py-3 flex items-center justify-between transition-colors hover:opacity-80"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <span style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.85rem' }}>
            Mark Scheme
          </span>
          {showMarkScheme
            ? <ChevronUp className="w-4 h-4" style={{ color: 'rgba(245,240,232,0.5)' }} />
            : <ChevronDown className="w-4 h-4" style={{ color: 'rgba(245,240,232,0.5)' }} />
          }
        </button>
        {showMarkScheme && (
          <div className="px-5 pb-4">
            <p style={{ color: 'rgba(245,240,232,0.6)', fontWeight: 300, fontSize: '0.85rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {prompt.mark_scheme}
            </p>
          </div>
        )}
      </div>

      {/* Editor */}
      <textarea
        value={userText}
        onChange={(e) => setUserText(e.target.value)}
        placeholder="Start writing your response…"
        rows={16}
        autoFocus
        style={{
          ...inputStyle,
          resize: 'vertical',
          lineHeight: 1.8,
          fontWeight: 300,
          fontSize: '0.95rem',
        }}
        className="w-full px-5 py-4 focus:outline-none transition-colors mb-4"
      />

      <div className="flex items-center justify-between">
        <button
          onClick={handleReset}
          style={{ ...glass, color: '#f5f0e8', fontWeight: 300 }}
          className="px-4 py-2 text-sm transition-all hover:opacity-80"
        >
          Cancel
        </button>

        {gradeMutation.isError && (
          <span style={{ color: 'rgba(220,120,100,0.8)', fontSize: '0.85rem', fontWeight: 300 }}>
            Grading failed. Try again.
          </span>
        )}

        <button
          onClick={() => gradeMutation.mutate()}
          disabled={!userText.trim() || gradeMutation.isPending}
          style={accentBtn}
          className="px-6 py-2.5 text-sm transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {gradeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {gradeMutation.isPending ? 'Grading…' : 'Submit for Grading'}
        </button>
      </div>
    </div>
  );
}
