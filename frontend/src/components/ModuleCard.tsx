import { useNavigate } from 'react-router-dom';
import { FileText, Layers, Clock } from 'lucide-react';
import type { Module } from '../types';

interface Props {
  module: Module;
}

export default function ModuleCard({ module }: Props) {
  const navigate = useNavigate();

  const masteryColor =
    module.mastery_pct >= 80
      ? 'bg-green-500'
      : module.mastery_pct >= 50
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <button
      onClick={() => navigate(`/modules/${module.id}`)}
      className="bg-navy-light rounded-xl border border-gray-800 p-5 text-left hover:border-gray-600 transition-all group w-full"
    >
      {/* Color bar + name */}
      <div className="flex items-start gap-3">
        <div
          className="w-1 h-12 rounded-full shrink-0 mt-0.5"
          style={{ backgroundColor: module.color }}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white group-hover:text-teal transition-colors truncate">
            {module.name}
          </h3>
          {module.description && (
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">
              {module.description}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" />
          {module.total_documents} docs
        </span>
        <span className="flex items-center gap-1">
          <Layers className="w-3.5 h-3.5" />
          {module.total_cards} cards
        </span>
        {module.due_cards > 0 && (
          <span className="flex items-center gap-1 text-teal">
            <Clock className="w-3.5 h-3.5" />
            {module.due_cards} due
          </span>
        )}
      </div>

      {/* Mastery bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">Mastery</span>
          <span className="text-gray-400">{Math.round(module.mastery_pct)}%</span>
        </div>
        <div className="h-1.5 bg-navy-lighter rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${masteryColor}`}
            style={{ width: `${module.mastery_pct}%` }}
          />
        </div>
      </div>
    </button>
  );
}
