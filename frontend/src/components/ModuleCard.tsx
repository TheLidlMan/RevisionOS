import { CardsThree, ClockCountdown, FileText, Sparkle } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import type { Module } from '../types';

interface Props {
  module: Module;
}

export default function ModuleCard({ module }: Props) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/modules/${module.id}`)}
      className="w-full text-left p-5 transition-colors"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        borderLeft: `4px solid ${module.color}`,
        backdropFilter: 'var(--blur)',
        WebkitBackdropFilter: 'var(--blur)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate" style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.05rem' }}>
            {module.name}
          </h3>
          {module.description && (
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.88rem',
                marginTop: 4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {module.description}
            </p>
          )}
        </div>
        <div
          className="px-2 py-1 rounded-full"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: '0.8rem' }}
        >
          {Math.round(module.mastery_pct)}%
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <span className="inline-flex items-center gap-1.5">
          <FileText size={16} />
          {module.total_documents} docs
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CardsThree size={16} />
          {module.total_cards} cards
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ClockCountdown size={16} />
          {module.due_cards} due
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Sparkle size={16} />
          {module.auto_cards} auto
        </span>
      </div>

      {(module.pipeline_status === 'running' || module.pipeline_status === 'queued') && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span>{module.pipeline_stage.replace(/_/g, ' ')}</span>
            <span>
              {module.pipeline_completed}/{Math.max(module.pipeline_total, 1)}
            </span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999 }}>
            <div
              style={{
                height: '100%',
                width: `${(module.pipeline_completed / Math.max(module.pipeline_total, 1)) * 100}%`,
                background: 'var(--accent)',
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      )}
    </button>
  );
}
