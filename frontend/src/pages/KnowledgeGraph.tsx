import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Share2, Loader2 } from 'lucide-react';
import { getModules, getKnowledgeGraph } from '../api/client';
import type { GraphNode } from '../types';

function masteryColor(mastery: number): string {
  if (mastery < 40) return '#ef4444';
  if (mastery < 70) return '#eab308';
  return '#22c55e';
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
        <Share2 className="w-6 h-6 text-teal" />
        <h1 className="text-2xl font-bold">Knowledge Graph</h1>
      </div>

      {/* Module selector */}
      <div className="mb-6">
        <select
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          className="bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal transition-colors"
        >
          <option value="">Select a module…</option>
          {modules?.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {!moduleId ? (
        <div className="text-center py-16 bg-navy-light rounded-xl border border-gray-800">
          <Share2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Select a module to view its knowledge graph.</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-teal" />
        </div>
      ) : !graph || graph.nodes.length === 0 ? (
        <div className="text-center py-16 bg-navy-light rounded-xl border border-gray-800">
          <p className="text-gray-400">No concepts found for this module.</p>
        </div>
      ) : (
        <div className="bg-navy-light rounded-xl border border-gray-800 p-4 overflow-hidden">
          {graph.module_name && (
            <p className="text-sm text-gray-400 mb-2">Module: {graph.module_name}</p>
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
                  stroke="#30363d"
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
                    stroke={isHovered ? '#fff' : 'transparent'}
                    strokeWidth={2}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + r + 14}
                    textAnchor="middle"
                    className="text-[10px] fill-gray-400"
                  >
                    {node.name.length > 16 ? node.name.slice(0, 14) + '…' : node.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {hoveredNode && (
            <div className="mt-2 bg-navy-lighter rounded-lg border border-gray-700 px-4 py-2 inline-block">
              <p className="text-sm font-medium">{hoveredNode.name}</p>
              <p className="text-xs text-gray-400">
                Mastery: {Math.round(hoveredNode.mastery)}% · Importance: {hoveredNode.importance}
              </p>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>&lt; 40% mastery</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>40-70%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>&gt; 70%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
