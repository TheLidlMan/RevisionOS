import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  TrendingDown,
  Loader2,
  ArrowLeft,
  Search,
  ChevronRight,
} from 'lucide-react';
import { getForgettingCurve, getModules, getFlashcards } from '../api/client';
import type { Module, Flashcard, ForgettingCurveData } from '../types';

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

const inputStyle = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '8px',
  color: '#f5f0e8',
} as const;

// ── SVG Chart Component ──
function RetentionChart({ data }: { data: ForgettingCurveData }) {
  const points = data.data_points;
  if (points.length === 0) return null;

  const width = 600;
  const height = 300;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxDay = Math.max(90, ...points.map((p) => p.day));

  const toX = (day: number) => padding.left + (day / maxDay) * chartW;
  const toY = (pct: number) => padding.top + ((100 - pct) / 100) * chartH;

  // Line path
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.day).toFixed(1)},${toY(p.retention_pct).toFixed(1)}`)
    .join(' ');

  // Area path (fill below line)
  const areaPath =
    linePath +
    ` L${toX(points[points.length - 1].day).toFixed(1)},${toY(0).toFixed(1)}` +
    ` L${toX(points[0].day).toFixed(1)},${toY(0).toFixed(1)} Z`;

  // Y-axis ticks
  const yTicks = [0, 25, 50, 75, 100];
  // X-axis ticks
  const xTicks = [0, 15, 30, 45, 60, 75, 90].filter((d) => d <= maxDay);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {/* Grid lines */}
      {yTicks.map((tick) => (
        <line
          key={`y-${tick}`}
          x1={padding.left} y1={toY(tick)} x2={width - padding.right} y2={toY(tick)}
          stroke="rgba(139,115,85,0.1)" strokeWidth="1"
        />
      ))}

      {/* 90% desired retention line */}
      <line
        x1={padding.left} y1={toY(90)} x2={width - padding.right} y2={toY(90)}
        stroke="rgba(196,149,106,0.4)" strokeWidth="1" strokeDasharray="6 4"
      />
      <text
        x={width - padding.right + 4} y={toY(90) + 4}
        fill="rgba(196,149,106,0.5)" fontSize="10" fontWeight="300"
      >
        90%
      </text>

      {/* Area fill */}
      <path d={areaPath} fill="rgba(196,149,106,0.08)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke="#c4956a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={toX(p.day)} cy={toY(p.retention_pct)} r="3" fill="#c4956a" />
      ))}

      {/* Y-axis labels */}
      {yTicks.map((tick) => (
        <text
          key={`yl-${tick}`}
          x={padding.left - 8} y={toY(tick) + 4}
          fill="rgba(245,240,232,0.35)" fontSize="10" fontWeight="300" textAnchor="end"
        >
          {tick}%
        </text>
      ))}

      {/* X-axis labels */}
      {xTicks.map((tick) => (
        <text
          key={`xl-${tick}`}
          x={toX(tick)} y={height - padding.bottom + 20}
          fill="rgba(245,240,232,0.35)" fontSize="10" fontWeight="300" textAnchor="middle"
        >
          {tick}d
        </text>
      ))}

      {/* Axis labels */}
      <text
        x={padding.left - 35} y={padding.top + chartH / 2}
        fill="rgba(245,240,232,0.25)" fontSize="10" fontWeight="300"
        textAnchor="middle" transform={`rotate(-90, ${padding.left - 35}, ${padding.top + chartH / 2})`}
      >
        Retention %
      </text>
      <text
        x={padding.left + chartW / 2} y={height - 4}
        fill="rgba(245,240,232,0.25)" fontSize="10" fontWeight="300" textAnchor="middle"
      >
        Days
      </text>
    </svg>
  );
}

// ── Curve Detail View ──
function CurveDetail({ cardId }: { cardId: string }) {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery<ForgettingCurveData>({
    queryKey: ['forgetting-curve', cardId],
    queryFn: () => getForgettingCurve(cardId),
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
        <p style={{ color: 'rgba(220,120,100,0.8)', fontWeight: 300 }}>Failed to load forgetting curve data.</p>
        <button
          onClick={() => navigate('/forgetting-curve')}
          style={{ ...glass, color: '#f5f0e8', fontWeight: 300 }}
          className="mt-4 px-4 py-2 text-sm inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate('/forgetting-curve')}
        style={{ color: 'rgba(245,240,232,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}
        className="mb-6 text-sm flex items-center gap-1.5 hover:opacity-80 transition-opacity"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Cards
      </button>

      {/* Chart */}
      <div style={glass} className="p-5 mb-6">
        <RetentionChart data={data} />
      </div>

      {/* Card info */}
      <div style={glass} className="p-5">
        <h3 style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 500, fontSize: '1rem' }} className="mb-4">
          Card Info
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: '0.75rem', fontWeight: 300, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Card ID
            </span>
            <p style={{ color: '#f5f0e8', fontWeight: 400, fontSize: '0.85rem', marginTop: '2px', fontFamily: 'monospace' }}>
              {data.card_id.slice(0, 12)}…
            </p>
          </div>
          <div>
            <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: '0.75rem', fontWeight: 300, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Stability
            </span>
            <p style={{ color: '#c4956a', fontWeight: 500, fontSize: '0.95rem', marginTop: '2px' }}>
              {data.stability.toFixed(1)} days
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card Browser View ──
function CardBrowser() {
  const navigate = useNavigate();
  const [moduleId, setModuleId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: modules } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const { data: cards, isLoading: cardsLoading } = useQuery<Flashcard[]>({
    queryKey: ['flashcards', moduleId],
    queryFn: () => getFlashcards({ module_id: moduleId }),
    enabled: Boolean(moduleId),
  });

  const filteredCards = (cards || []).filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return c.front.toLowerCase().includes(term) || c.back.toLowerCase().includes(term);
  });

  const stateColor = (state: string) => {
    switch (state) {
      case 'NEW': return 'rgba(196,149,106,0.7)';
      case 'LEARNING': return 'rgba(220,180,100,0.7)';
      case 'REVIEW': return 'rgba(120,180,120,0.7)';
      case 'RELEARNING': return 'rgba(220,120,100,0.7)';
      default: return 'rgba(245,240,232,0.4)';
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <select
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          style={inputStyle}
          className="px-3 py-2.5 focus:outline-none transition-colors md:w-64"
        >
          <option value="">All modules</option>
          {modules?.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(245,240,232,0.3)' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search cards…"
            style={inputStyle}
            className="w-full pl-9 pr-3 py-2.5 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Card list */}
      {cardsLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#c4956a' }} />
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center py-20">
          <TrendingDown className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(245,240,232,0.15)' }} />
          <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>
            {cards?.length === 0 ? 'No flashcards found' : 'No cards match your search'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCards.map((card, idx) => (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              onClick={() => navigate(`/forgetting-curve/${card.id}`)}
              style={{
                ...glass,
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
              }}
              className="p-4 flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="flex-1 min-w-0">
                <p style={{ color: '#f5f0e8', fontWeight: 400, fontSize: '0.9rem' }} className="truncate">
                  {card.front}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span style={{ color: stateColor(card.state), fontSize: '0.7rem', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {card.state}
                  </span>
                  <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: '0.75rem', fontWeight: 300 }}>
                    Stability: {card.stability.toFixed(1)}d
                  </span>
                  <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: '0.75rem', fontWeight: 300 }}>
                    Reps: {card.reps}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(245,240,232,0.2)' }} />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──
export default function ForgettingCurve() {
  const { cardId } = useParams<{ cardId?: string }>();

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <TrendingDown className="w-6 h-6" style={{ color: '#c4956a' }} />
        <h1
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 600 }}
          className="text-2xl"
        >
          Forgetting Curve
        </h1>
      </div>

      {cardId ? <CurveDetail cardId={cardId} /> : <CardBrowser />}
    </div>
  );
}
