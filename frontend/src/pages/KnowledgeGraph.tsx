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

function nodeRadius(node: GraphNode): number {
  const base = Math.max(16, Math.min(36, node.importance * 3.6));
  const itemBoost = Math.min(8, (node.item_count ?? 0) * 0.5);
  return base + itemBoost;
}

export default function KnowledgeGraph() {
  const [searchParams] = useSearchParams();
  const preModule = searchParams.get('module') ?? '';
  const [moduleId, setModuleId] = useState(preModule);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const { data: modules } = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const { data: graph, isLoading } = useQuery({
    queryKey: ['knowledge-graph', moduleId],
    queryFn: () => getKnowledgeGraph(moduleId),
    enabled: !!moduleId,
  });

  const layout = useMemo(() => {
    if (!graph || graph.nodes.length === 0) return { positions: new Map<string, { x: number; y: number }>(), width: 900, height: 700 };
    const nodes = graph.nodes;
    const positions = new Map<string, { x: number; y: number }>();

    // Separate root nodes (no parent) from children
    const roots = nodes.filter((n) => !n.parent_id);
    const childrenMap = new Map<string, GraphNode[]>();
    nodes.forEach((n) => {
      if (n.parent_id) {
        const existing = childrenMap.get(n.parent_id) || [];
        existing.push(n);
        childrenMap.set(n.parent_id, existing);
      }
    });

    // Layout: roots in a row, children clustered below their parent
    const width = 900;
    const height = 700;
    const rootY = 120;
    const childY = 320;
    const rootSpacing = width / (roots.length + 1);

    roots.forEach((root, i) => {
      const x = rootSpacing * (i + 1);
      positions.set(root.id, { x, y: rootY });

      const children = childrenMap.get(root.id) || [];
      if (children.length > 0) {
        const childSpacing = Math.min(100, rootSpacing / (children.length + 1));
        const startX = x - (children.length - 1) * childSpacing / 2;
        children.forEach((child, j) => {
          positions.set(child.id, { x: startX + j * childSpacing, y: childY + (j % 2) * 40 });
        });
      }
    });

    // Place any orphan children that reference non-existent parents
    const unplaced = nodes.filter((n) => !positions.has(n.id));
    if (unplaced.length > 0) {
      const orphanY = 520;
      const orphanSpacing = width / (unplaced.length + 1);
      unplaced.forEach((n, i) => {
        positions.set(n.id, { x: orphanSpacing * (i + 1), y: orphanY });
      });
    }

    return { positions, width, height };
  }, [graph]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <Share2 className="w-6 h-6" style={{ color: 'var(--accent)' }} />
        <h1
          style={{ fontFamily: "var(--heading)", color: 'var(--text)', fontWeight: 600 }}
          className="text-2xl"
        >
          Knowledge Graph
        </h1>
      </div>

      {/* Module selector */}
      <div className="mb-6">
        <select
          value={moduleId}
          onChange={(e) => { setModuleId(e.target.value); setSelectedNode(null); }}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text)',
            fontWeight: 300,
            fontSize: '0.9rem',
          }}
          className="px-3 py-2.5 focus:outline-none transition-colors"
        >
          <option value="">Select a module...</option>
          {modules?.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {!moduleId ? (
        <div style={glass} className="text-center py-16">
          <Share2 className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
          <p style={{ color: 'var(--text-secondary)', fontWeight: 300, fontSize: '0.9rem' }}>Select a module to view its knowledge graph.</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : !graph || graph.nodes.length === 0 ? (
        <div style={glass} className="text-center py-16">
          <p style={{ color: 'var(--text-secondary)', fontWeight: 300, fontSize: '0.9rem' }}>No concepts found for this module.</p>
        </div>
      ) : (
        <div style={glass} className="p-4 overflow-hidden">
          <svg
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="w-full"
            style={{ maxHeight: '70vh' }}
          >
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="rgba(139,115,85,0.4)" />
              </marker>
            </defs>

            {/* Edges */}
            {graph.edges.map((edge, i) => {
              const from = layout.positions.get(edge.source);
              const to = layout.positions.get(edge.target);
              if (!from || !to) return null;
              const isHierarchy = edge.type === 'parent_child';
              return (
                <line
                  key={i}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={isHierarchy ? 'rgba(196,149,106,0.4)' : 'rgba(139,115,85,0.2)'}
                  strokeWidth={isHierarchy ? 2 : 1}
                  strokeDasharray={isHierarchy ? undefined : '4 4'}
                  markerEnd={isHierarchy ? 'url(#arrowhead)' : undefined}
                />
              );
            })}

            {/* Nodes */}
            {graph.nodes.map((node) => {
              const pos = layout.positions.get(node.id);
              if (!pos) return null;
              const r = nodeRadius(node);
              const isHovered = hoveredNode?.id === node.id;
              const isSelected = selectedNode?.id === node.id;
              const isRoot = !node.parent_id;
              return (
                <g
                  key={node.id}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setSelectedNode(node)}
                  className="cursor-pointer"
                  style={{ transition: 'transform 0.2s' }}
                >
                  {/* Glow effect for hovered/selected */}
                  {(isHovered || isSelected) && (
                    <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke={masteryColor(node.mastery)} strokeWidth={2} opacity={0.3} />
                  )}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r}
                    fill={masteryColor(node.mastery)}
                    opacity={isHovered || isSelected ? 1 : 0.75}
                    stroke={isRoot ? 'var(--text)' : 'transparent'}
                    strokeWidth={isRoot ? 1.5 : 0}
                  />
                  {/* Mastery % inside node */}
                  <text
                    x={pos.x}
                    y={pos.y + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    style={{ fontSize: r > 20 ? '10px' : '8px', fontWeight: 600 }}
                  >
                    {Math.round(node.mastery)}%
                  </text>
                  <text
                    x={pos.x}
                    y={pos.y + r + 14}
                    textAnchor="middle"
                    fill="var(--text-secondary)"
                    style={{ fontSize: '10px' }}
                  >
                    {node.name.length > 18 ? node.name.slice(0, 16) + '...' : node.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Detail panel */}
          {(hoveredNode || selectedNode) && (
            <div
              style={{ ...glass, borderRadius: '8px', display: 'inline-block' }}
              className="mt-2 px-4 py-3"
            >
              <p style={{ color: 'var(--text)', fontWeight: 500, fontSize: '0.95rem', fontFamily: 'var(--heading)' }}>
                {(selectedNode || hoveredNode)!.name}
              </p>
              <div className="flex gap-4 mt-1" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>Mastery: {Math.round((selectedNode || hoveredNode)!.mastery)}%</span>
                <span>Importance: {(selectedNode || hoveredNode)!.importance}</span>
                {(selectedNode || hoveredNode)!.item_count !== undefined && (
                  <span>Items: {(selectedNode || hoveredNode)!.item_count}</span>
                )}
                {(selectedNode || hoveredNode)!.parent_id && <span>Has parent</span>}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
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
            <span style={{ marginLeft: 'auto' }}>
              <span style={{ display: 'inline-block', width: 20, height: 2, background: 'rgba(196,149,106,0.4)', verticalAlign: 'middle', marginRight: 4 }} />
              parent-child
            </span>
            <span>
              <span style={{ display: 'inline-block', width: 20, height: 0, borderBottom: '2px dashed rgba(139,115,85,0.2)', verticalAlign: 'middle', marginRight: 4 }} />
              shared doc
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
