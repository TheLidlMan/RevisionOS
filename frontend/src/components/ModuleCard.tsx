import { useNavigate } from 'react-router-dom';
import { FileText, Layers, Clock } from 'lucide-react';
import type { Module } from '../types';

interface Props { module: Module; }

const glass = { background: 'rgba(255,248,240,0.04)', border: '1px solid rgba(139,115,85,0.15)', borderRadius: '12px', backdropFilter: 'blur(20px)' } as const;

export default function ModuleCard({ module }: Props) {
  const navigate = useNavigate();
  const masteryColor = module.mastery_pct >= 80 ? 'rgba(120,180,120,0.8)' : module.mastery_pct >= 50 ? '#c4956a' : 'rgba(220,120,100,0.8)';

  return (
    <button onClick={() => navigate(`/modules/${module.id}`)} className="w-full text-left" style={{ ...glass, padding: '1.25rem', borderLeft: `4px solid ${module.color}`, cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,248,240,0.08)'; e.currentTarget.style.borderColor = module.color; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = glass.background; e.currentTarget.style.borderColor = 'rgba(139,115,85,0.15)'; e.currentTarget.style.borderLeft = `4px solid ${module.color}`; }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 600, fontSize: '1rem', margin: 0 }}>{module.name}</h3>
          {module.description && <p style={{ color: 'rgba(245,240,232,0.5)', fontSize: '0.8rem', fontWeight: 300, marginTop: 4 }} className="line-clamp-2">{module.description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3" style={{ fontSize: '0.75rem', color: 'rgba(245,240,232,0.4)' }}>
        <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{module.total_documents} docs</span>
        <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" />{module.total_cards} cards</span>
        {module.due_cards > 0 && <span className="flex items-center gap-1" style={{ color: '#c4956a' }}><Clock className="w-3.5 h-3.5" />{module.due_cards} due</span>}
      </div>
      <div className="mt-3">
        <div className="flex justify-between mb-1" style={{ fontSize: '0.7rem' }}>
          <span style={{ color: 'rgba(245,240,232,0.25)' }}>Mastery</span>
          <span style={{ color: masteryColor, fontWeight: 500 }}>{Math.round(module.mastery_pct)}%</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,248,240,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${module.mastery_pct}%`, background: masteryColor, borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      </div>
    </button>
  );
}
