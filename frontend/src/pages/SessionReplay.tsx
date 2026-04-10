import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  History,
  Loader2,
  CheckCircle,
  XCircle,
  Play,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import { getSessionReplay, getSessions } from '../api/client';
import type { StudySession, SessionReplayData } from '../types';

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

const labelStyle = {
  color: 'rgba(245,240,232,0.5)',
  fontWeight: 300,
  fontSize: '0.9rem',
} as const;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ── Session List View ──
function SessionList() {
  const navigate = useNavigate();

  const { data: sessions, isLoading } = useQuery<StudySession[]>({
    queryKey: ['sessions', { limit: 50 }],
    queryFn: () => getSessions({ limit: 50 }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#c4956a' }} />
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center py-20">
        <History className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(245,240,232,0.15)' }} />
        <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>No sessions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session, idx) => (
        <motion.div
          key={session.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.03 }}
          style={glass}
          className="p-4 flex items-center justify-between hover:opacity-80 transition-opacity"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span style={{
                color: '#c4956a',
                fontWeight: 500,
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {session.session_type}
              </span>
              {session.module_name && (
                <span style={{ color: 'rgba(245,240,232,0.35)', fontWeight: 300, fontSize: '0.8rem' }}>
                  · {session.module_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span style={{ color: 'rgba(245,240,232,0.4)', fontWeight: 300, fontSize: '0.8rem' }}>
                {formatDate(session.started_at)}
              </span>
              <span style={{
                color: session.score_pct >= 70 ? 'rgba(120,180,120,0.8)' : session.score_pct >= 40 ? '#c4956a' : 'rgba(220,120,100,0.8)',
                fontWeight: 500,
                fontSize: '0.85rem',
              }}>
                {Math.round(session.score_pct)}%
              </span>
              <span style={{ color: 'rgba(245,240,232,0.3)', fontWeight: 300, fontSize: '0.8rem' }}>
                {session.correct}/{session.total_items} correct
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate(`/session-replay/${session.id}`)}
            style={{
              background: 'rgba(196,149,106,0.1)',
              border: '1px solid rgba(196,149,106,0.3)',
              borderRadius: '8px',
              color: '#c4956a',
              cursor: 'pointer',
            }}
            className="px-3 py-1.5 text-sm flex items-center gap-1.5 transition-all hover:opacity-80"
          >
            <Play className="w-3.5 h-3.5" /> Replay
          </button>
        </motion.div>
      ))}
    </div>
  );
}

// ── Replay Detail View ──
function ReplayDetail({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery<SessionReplayData>({
    queryKey: ['session-replay', sessionId],
    queryFn: () => getSessionReplay(sessionId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#c4956a' }} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-20">
        <p style={{ color: 'rgba(220,120,100,0.8)', fontWeight: 300 }}>Failed to load session replay.</p>
        <button
          onClick={() => navigate('/session-replay')}
          style={{ ...glass, color: '#f5f0e8', fontWeight: 300 }}
          className="mt-4 px-4 py-2 text-sm transition-all hover:opacity-80 inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Sessions
        </button>
      </div>
    );
  }

  const { session, items } = data;
  const pct = Math.round(session.score_pct);

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/session-replay')}
        style={{ color: 'rgba(245,240,232,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}
        className="mb-6 text-sm flex items-center gap-1.5 hover:opacity-80 transition-opacity"
      >
        <ArrowLeft className="w-4 h-4" /> All Sessions
      </button>

      {/* Session info */}
      <div style={glass} className="p-5 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <span style={{
            color: '#c4956a',
            fontWeight: 500,
            fontSize: '0.9rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {session.session_type}
          </span>
          {session.module_name && (
            <span style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.85rem' }}>
              {session.module_name}
            </span>
          )}
          <span style={{ color: 'rgba(245,240,232,0.35)', fontWeight: 300, fontSize: '0.85rem' }}>
            {formatDate(session.started_at)}
          </span>
          <span style={{
            color: pct >= 70 ? 'rgba(120,180,120,0.8)' : pct >= 40 ? '#c4956a' : 'rgba(220,120,100,0.8)',
            fontWeight: 600,
            fontSize: '1.1rem',
          }}>
            {pct}%
          </span>
          <span style={{ color: 'rgba(245,240,232,0.4)', fontWeight: 300, fontSize: '0.85rem' }}>
            {session.correct}/{session.total_items} correct
          </span>
        </div>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <p style={{ color: 'rgba(245,240,232,0.4)', fontWeight: 300 }}>No items to replay.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, idx) => (
            <motion.div
              key={item.item_id + '-' + idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              style={{
                ...glass,
                background: item.was_correct ? 'rgba(120,180,120,0.03)' : 'rgba(220,120,100,0.03)',
                border: item.was_correct ? '1px solid rgba(120,180,120,0.15)' : '1px solid rgba(220,120,100,0.15)',
              }}
              className="p-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {item.was_correct ? (
                    <CheckCircle className="w-5 h-5" style={{ color: 'rgba(120,180,120,0.8)' }} />
                  ) : (
                    <XCircle className="w-5 h-5" style={{ color: 'rgba(220,120,100,0.8)' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {/* Question */}
                  <p style={{ color: '#f5f0e8', fontWeight: 400, fontSize: '0.95rem', lineHeight: 1.6 }} className="mb-3">
                    {idx + 1}. {item.question_text}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                    <div>
                      <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: '0.7rem', fontWeight: 300, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Your answer
                      </span>
                      <p style={{
                        color: item.was_correct ? 'rgba(120,180,120,0.9)' : 'rgba(220,120,100,0.9)',
                        fontWeight: 400,
                        fontSize: '0.85rem',
                        marginTop: '2px',
                      }}>
                        {item.user_answer || '(no answer)'}
                      </p>
                    </div>
                    <div>
                      <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: '0.7rem', fontWeight: 300, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Correct answer
                      </span>
                      <p style={{ color: 'rgba(120,180,120,0.9)', fontWeight: 400, fontSize: '0.85rem', marginTop: '2px' }}>
                        {item.correct_answer}
                      </p>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-4 mt-2">
                    {item.rating && (
                      <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: '0.75rem', fontWeight: 300 }}>
                        Rating: {item.rating}
                      </span>
                    )}
                    {item.time_taken > 0 && (
                      <span className="flex items-center gap-1" style={{ color: 'rgba(245,240,232,0.3)', fontSize: '0.75rem', fontWeight: 300 }}>
                        <Clock className="w-3 h-3" /> {formatTime(item.time_taken)}
                      </span>
                    )}
                    <span style={{
                      color: 'rgba(245,240,232,0.25)',
                      fontSize: '0.7rem',
                      fontWeight: 300,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {item.item_type}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──
export default function SessionReplay() {
  const { sessionId } = useParams<{ sessionId?: string }>();

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <History className="w-6 h-6" style={{ color: '#c4956a' }} />
        <h1
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 600 }}
          className="text-2xl"
        >
          Session Replay
        </h1>
      </div>

      {sessionId ? <ReplayDetail sessionId={sessionId} /> : <SessionList />}
    </div>
  );
}
