import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Share2, Loader2 } from 'lucide-react';
import { getModules, getKnowledgeGraph } from '../api/client';
import type { GraphNode } from '../types';

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

  const { data: modules } = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const { data: graph, isLoading } = useQuery({
    queryKey: ['knowledge-graph', moduleId],
    queryFn: () => getKnowledgeGraph(moduleId),
    enabled: !!moduleId,
  });

  // Position nodes in a circle layout
  const layout = useMemo(() => {
    if (!graph || graph.nodes.length === 0) return { positions: new Map<string, { x: number; y: number }>(), width: 800, height: 600 };
    const nodes = graph.nodes;
    const cx = 400;
    const cy = 300;
    const radius = Math.min(250, Math.max(120, nodes.length * 18));
    const positions = new Map<string, { x: number; y: number }>();
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      positions.set(node.id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });
    return { positions, width: 800, height: 600 };
  }, [graph]);

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
      <div className="mb-6">
        <select
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
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
          <div className="flex items-center gap-4 mt-4" style={{ fontSize: '0.75rem', color: 'rgba(245,240,232,0.35)' }}>
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
          </div>
        </div>
      )}
    </div>
  );
}
