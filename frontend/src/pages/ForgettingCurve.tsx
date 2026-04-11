import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CaretRight,
  MagnifyingGlass,
  TrendDown,
} from '@phosphor-icons/react';
import { getFlashcards, getForgettingCurve, getModules } from '../api/client';
import Skeleton from '../components/Skeleton';
import { usePersistentState } from '../hooks/usePersistentState';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import type { Flashcard, ForgettingCurveData, Module } from '../types';
import { formatDateTime, formatDays } from '../utils/formatters';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

function RetentionChart({ data }: { data: ForgettingCurveData }) {
  const points = data.data_points;
  if (points.length === 0) return null;

  const width = 600;
  const height = 280;
  const padding = { top: 20, right: 24, bottom: 38, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxDay = Math.max(90, ...points.map((point) => point.day));
  const toX = (day: number) => padding.left + (day / maxDay) * chartW;
  const toY = (retention: number) => padding.top + ((100 - retention) / 100) * chartH;
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${toX(point.day)},${toY(point.retention_pct)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 25, 50, 75, 100].map((tick) => (
        <line key={tick} x1={padding.left} y1={toY(tick)} x2={width - padding.right} y2={toY(tick)} stroke="rgba(255,255,255,0.08)" />
      ))}
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      {points.map((point) => (
        <circle key={point.day} cx={toX(point.day)} cy={toY(point.retention_pct)} r="3.5" fill="var(--accent)" />
      ))}
      <text x={width / 2} y={height - 6} textAnchor="middle" fill="var(--text-secondary)" fontSize="11">Days</text>
    </svg>
  );
}

function CurveDetail({ cardId }: { cardId: string }) {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['forgetting-curve', cardId],
    queryFn: () => getForgettingCurve(cardId),
  });

  if (query.isLoading) {
    return (
      <div>
        <Skeleton className="h-[280px] w-full mb-5" />
        <Skeleton className="h-[96px] w-full" />
      </div>
    );
  }

  if (!query.data) {
    return (
      <div className="p-10 text-center" style={glass}>
        <p style={{ color: 'var(--danger)' }}>Unable to load forgetting curve data.</p>
        <button type="button" className="mt-4" style={{ color: 'var(--accent)' }} onClick={() => navigate('/forgetting-curve')}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={() => navigate('/forgetting-curve')} className="hidden md:inline-flex items-center gap-2 mb-6" style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft size={18} />
        Back to Cards
      </button>
      <div className="p-5 mb-5" style={glass}>
        <RetentionChart data={query.data} />
      </div>
      <div className="p-5" style={glass}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 6 }}>Card stability</p>
        <p style={{ color: 'var(--text)', fontSize: '1.2rem' }}>{formatDays(query.data.stability)}</p>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', marginTop: 8 }}>
          Data generated from the card&apos;s current review state.
        </p>
      </div>
    </div>
  );
}

function CardBrowser() {
  const navigate = useNavigate();
  const [moduleId, setModuleId] = usePersistentState('forgetting-curve:module', '');
  const [search, setSearch] = usePersistentState('forgetting-curve:search', '');
  const searchRef = useRef<HTMLInputElement>(null);
  useScrollRestoration('forgetting-curve:browser');

  const modulesQuery = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const cardsQuery = useQuery<Flashcard[]>({
    queryKey: ['flashcards', moduleId || 'all'],
    queryFn: () => getFlashcards({ module_id: moduleId || undefined }),
  });

  const cards = (cardsQuery.data || []).filter((card) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return card.front.toLowerCase().includes(term) || card.back.toLowerCase().includes(term);
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (event.key === '/' && !isInput) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 mb-6">
        <select value={moduleId} onChange={(event) => setModuleId(event.target.value)} className="px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
          <option value="">All modules</option>
          {modulesQuery.data?.map((module) => (
            <option key={module.id} value={module.id}>
              {module.name}
            </option>
          ))}
        </select>
        <div className="relative">
          <MagnifyingGlass size={18} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-secondary)' }} />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search flashcards"
            className="w-full pl-10 pr-3 py-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
          />
        </div>
      </div>

      {cardsQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((idx) => (
            <Skeleton key={idx} className="h-24 w-full" />
          ))}
        </div>
      ) : cards.length > 0 ? (
        <div className="space-y-3">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => navigate(`/forgetting-curve/${card.id}`)}
              className="w-full text-left p-4 flex items-center justify-between gap-4"
              style={glass}
            >
              <div className="min-w-0">
                <p className="truncate" style={{ color: 'var(--text)', fontSize: '0.92rem' }}>{card.front}</p>
                <div className="flex flex-wrap gap-3 mt-2" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  <span>{card.state}</span>
                  <span>Stability: {formatDays(card.stability)}</span>
                  <span>Reps: {card.reps}</span>
                  <span title={formatDateTime(card.updated_at)}>Updated {new Date(card.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
              <CaretRight size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      ) : (
        <div className="p-10 text-center" style={glass}>
          <p style={{ color: 'var(--text)', marginBottom: 8 }}>
            {cardsQuery.data?.length === 0 ? 'No flashcards found yet.' : 'No cards match your search.'}
          </p>
          <p style={{ color: 'var(--text-secondary)' }}>
            {cardsQuery.data?.length === 0 ? 'Once cards exist, you can inspect one module or your entire collection here.' : 'Try clearing the module filter or shortening the search term.'}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ForgettingCurve() {
  const { cardId } = useParams<{ cardId?: string }>();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <TrendDown size={24} style={{ color: 'var(--accent)' }} />
        <div>
          <h1 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.8rem' }}>Forgetting Curve</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Browse stability across one module or all modules.</p>
        </div>
      </div>
      {cardId ? <CurveDetail cardId={cardId} /> : <CardBrowser />}
    </div>
  );
}
