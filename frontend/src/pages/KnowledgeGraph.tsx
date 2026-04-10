import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Share2, Loader2, AlertTriangle } from 'lucide-react';
import { getModules, getKnowledgeGraph, detectConceptGaps } from '../api/client';
import type { GraphNode, ConceptGap } from '../types';

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

function masteryColor(mastery: number): string {
  if (mastery < 40) return 'rgba(220,120,100,0.85)';
  if (mastery < 70) return '#c4956a';
  return 'rgba(120,180,120,0.85)';
}

function nodeRadius(importance: number): number {
  return Math.max(16, Math.min(36, importance * 3.6));
}

export default function KnowledgeGraph() {
  const [searchParams] = useSearchParams();
  const preModule = searchParams.get('module') ?? '';
  const [moduleId, setModuleId] = useState(preModule);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [gaps, setGaps] = useState<ConceptGap[]>([]);

  const gapMutation = useMutation({
    mutationFn: (modId: string) => detectConceptGaps(modId),
    onSuccess: (data) => setGaps(data.gaps),
  });

  const { data: modules } = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const { data: graph, isLoading } = useQuery({
    queryKey: ['knowledge-graph', moduleId],
    queryFn: () => getKnowledgeGraph(moduleId),
    enabled: !!moduleId,
  });

  // Position nodes in a circle layout (including gap nodes)
  const layout = useMemo(() => {
    if (!graph || graph.nodes.length === 0) return { positions: new Map<string, { x: number; y: number }>(), width: 800, height: 600 };
    const nodes = graph.nodes;
    const totalCount = nodes.length + gaps.length;
    const cx = 400;
    const cy = 300;
    const radius = Math.min(250, Math.max(120, totalCount * 18));
    const positions = new Map<string, { x: number; y: number }>();
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / totalCount - Math.PI / 2;
      positions.set(node.id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });
    gaps.forEach((gap, i) => {
      const angle = (2 * Math.PI * (nodes.length + i)) / totalCount - Math.PI / 2;
      positions.set(`gap-${gap.name}`, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });
    return { positions, width: 800, height: 600 };
  }, [graph, gaps]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <Share2 className="w-6 h-6" style={{ color: '#c4956a' }} />
        <h1
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#f5f0e8', fontWeight: 600 }}
          className="text-2xl"
        >
          Knowledge Graph
        </h1>
      </div>

      {/* Module selector */}
      <div className="mb-6 flex items-center gap-3">
        <select
          value={moduleId}
          onChange={(e) => { setModuleId(e.target.value); setGaps([]); }}
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
          <option value="">Select a module…</option>
          {modules?.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        {moduleId && (
          <button
            onClick={() => gapMutation.mutate(moduleId)}
            disabled={gapMutation.isPending}
            style={{
              background: 'rgba(255,165,0,0.12)',
              border: '1px solid rgba(255,165,0,0.3)',
              borderRadius: '8px',
              color: 'rgba(255,165,0,0.85)',
              fontWeight: 400,
              fontSize: '0.85rem',
              cursor: gapMutation.isPending ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: gapMutation.isPending ? 0.6 : 1,
            }}
            className="px-3 py-2.5 transition-colors"
          >
            {gapMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            Detect Gaps
          </button>
        )}
      </div>

      {!moduleId ? (
        <div style={glass} className="text-center py-16">
          <Share2 className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(245,240,232,0.15)' }} />
          <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }}>Select a module to view its knowledge graph.</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#c4956a' }} />
        </div>
      ) : !graph || graph.nodes.length === 0 ? (
        <div style={glass} className="text-center py-16">
          <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.9rem' }}>No concepts found for this module.</p>
        </div>
      ) : (
        <>
        <div style={glass} className="p-4 overflow-hidden">
          {graph.module_name && (
            <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.85rem' }} className="mb-2">
              Module: {graph.module_name}
            </p>
          )}
          <svg
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="w-full"
            style={{ maxHeight: '70vh' }}
          >
            {/* Edges */}
            {graph.edges.map((edge, i) => {
              const from = layout.positions.get(edge.source);
              const to = layout.positions.get(edge.target);
              if (!from || !to) return null;
              return (
                <line
                  key={i}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="rgba(139,115,85,0.3)"
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                />
              );
            })}

            {/* Nodes */}
            {graph.nodes.map((node) => {
              const pos = layout.positions.get(node.id);
              if (!pos) return null;
              const r = nodeRadius(node.importance);
              const isHovered = hoveredNode?.id === node.id;
              return (
                <g
                  key={node.id}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r}
                    fill={masteryColor(node.mastery)}
                    opacity={isHovered ? 1 : 0.7}
                    stroke={isHovered ? '#f5f0e8' : 'transparent'}
                    strokeWidth={2}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + r + 14}
                    textAnchor="middle"
                    fill="rgba(245,240,232,0.5)"
                    style={{ fontSize: '10px' }}
                  >
                    {node.name.length > 16 ? node.name.slice(0, 14) + '…' : node.name}
                  </text>
                </g>
              );
            })}

            {/* Gap Nodes */}
            {gaps.map((gap) => {
              const pos = layout.positions.get(`gap-${gap.name}`);
              if (!pos) return null;
              const r = 20;
              return (
                <g key={`gap-${gap.name}`}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r}
                    fill="rgba(255,165,0,0.15)"
                    stroke="rgba(255,165,0,0.85)"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    opacity={0.85}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 4}
                    textAnchor="middle"
                    fill="rgba(255,165,0,0.85)"
                    style={{ fontSize: '11px', fontWeight: 500 }}
                  >
                    ?
                  </text>
                  <text
                    x={pos.x}
                    y={pos.y + r + 14}
                    textAnchor="middle"
                    fill="rgba(255,165,0,0.7)"
                    style={{ fontSize: '10px' }}
                  >
                    {gap.name.length > 16 ? gap.name.slice(0, 14) + '…' : gap.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {hoveredNode && (
            <div
              style={{
                ...glass,
                borderRadius: '8px',
                display: 'inline-block',
              }}
              className="mt-2 px-4 py-2"
            >
              <p style={{ color: '#f5f0e8', fontWeight: 400, fontSize: '0.9rem' }}>{hoveredNode.name}</p>
              <p style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300, fontSize: '0.75rem' }}>
                Mastery: {Math.round(hoveredNode.mastery)}% · Importance: {hoveredNode.importance}
              </p>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 flex-wrap" style={{ fontSize: '0.75rem', color: 'rgba(245,240,232,0.35)' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: 'rgba(220,120,100,0.85)' }} />
              <span>&lt; 40% mastery</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: '#c4956a' }} />
              <span>40-70%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: 'rgba(120,180,120,0.85)' }} />
              <span>&gt; 70%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: 'rgba(255,165,0,0.85)', border: '1px dashed rgba(255,165,0,0.5)' }} />
              <span>Concept Gap</span>
            </div>
          </div>
        </div>

        {/* Concept Gap List */}
        {gaps.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                color: '#f5f0e8',
                fontWeight: 400,
                fontSize: '1rem',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle className="w-4 h-4" style={{ color: 'rgba(255,165,0,0.85)' }} />
              Detected Concept Gaps ({gaps.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gaps.map((gap) => (
                <div
                  key={gap.name}
                  style={{
                    ...glass,
                    padding: '12px 16px',
                    borderLeft: '3px solid rgba(255,165,0,0.85)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ color: 'rgba(255,165,0,0.85)', fontWeight: 500, fontSize: '0.9rem' }}>{gap.name}</span>
                    {!gap.has_definition && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          background: 'rgba(255,165,0,0.1)',
                          color: 'rgba(255,165,0,0.7)',
                          padding: '2px 6px',
                          borderRadius: 999,
                          fontWeight: 400,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        No definition
                      </span>
                    )}
                    <span style={{ fontSize: '0.7rem', color: 'rgba(245,240,232,0.35)', fontWeight: 300, marginLeft: 'auto' }}>
                      Mentioned in {gap.mentioned_in_documents} doc{gap.mentioned_in_documents !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {gap.context_snippet && (
                    <p style={{ color: 'rgba(245,240,232,0.45)', fontWeight: 300, fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
                      {gap.context_snippet}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
