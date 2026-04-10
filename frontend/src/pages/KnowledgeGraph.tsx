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
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

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
    const nodes = [...graph.nodes].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.name.localeCompare(b.name),
    );
    const positions = new Map<string, { x: number; y: number }>();
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    const childrenMap = new Map<string, GraphNode[]>();
    nodes.forEach((n) => {
      if (n.parent_id) {
        const existing = childrenMap.get(n.parent_id) || [];
        existing.push(n);
        childrenMap.set(n.parent_id, existing);
      }
    });
    childrenMap.forEach((children) => {
      children.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.name.localeCompare(b.name));
    });

    const roots = nodes.filter((node) => !node.parent_id || !nodeMap.has(node.parent_id));
    const orderedRoots = roots.length > 0 ? roots : nodes;

    const subtreeWidths = new Map<string, number>();
    const activePath = new Set<string>();
    let maxDepth = 0;

    const measureSubtree = (node: GraphNode): number => {
      if (subtreeWidths.has(node.id)) {
        return subtreeWidths.get(node.id)!;
      }
      if (activePath.has(node.id)) {
        return 1;
      }

      activePath.add(node.id);
      const children = childrenMap.get(node.id) || [];
      const width = children.length > 0
        ? children.reduce((sum, child) => sum + measureSubtree(child), 0)
        : 1;
      activePath.delete(node.id);
      subtreeWidths.set(node.id, Math.max(1, width));
      return subtreeWidths.get(node.id)!;
    };

    const unitWidth = 120;
    const levelHeight = 150;
    const marginX = 90;
    const marginY = 110;

    const placeSubtree = (node: GraphNode, startUnit: number, depth: number): number => {
      const widthUnits = subtreeWidths.get(node.id) ?? 1;
      const centerUnit = startUnit + widthUnits / 2;
      positions.set(node.id, {
        x: marginX + centerUnit * unitWidth,
        y: marginY + depth * levelHeight,
      });
      maxDepth = Math.max(maxDepth, depth);

      let cursor = startUnit;
      for (const child of childrenMap.get(node.id) || []) {
        const childWidth = subtreeWidths.get(child.id) ?? 1;
        placeSubtree(child, cursor, depth + 1);
        cursor += childWidth;
      }

      return widthUnits;
    };

    let cursor = 0;
    orderedRoots.forEach((root) => {
      measureSubtree(root);
      const consumed = placeSubtree(root, cursor, 0);
      cursor += consumed + 0.5;
    });

    const unplaced = nodes.filter((node) => !positions.has(node.id));
    let fallbackCursor = cursor;
    unplaced.forEach((node) => {
      positions.set(node.id, {
        x: marginX + (fallbackCursor + 0.5) * unitWidth,
        y: marginY + (maxDepth + 1) * levelHeight,
      });
      fallbackCursor += 1.5;
    });

    const totalUnits = Math.max(1, fallbackCursor, cursor);
    const width = Math.max(900, marginX * 2 + totalUnits * unitWidth);
    const height = Math.max(700, marginY * 2 + (maxDepth + 2) * levelHeight);

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
              const isFocused = focusedNodeId === node.id;
              const isRoot = !node.parent_id;
              return (
                <g
                  key={node.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Inspect node ${node.name || node.id}`}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onFocus={() => {
                    setHoveredNode(node);
                    setFocusedNodeId(node.id);
                  }}
                  onBlur={() => {
                    setHoveredNode(null);
                    setFocusedNodeId((current) => (current === node.id ? null : current));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedNode(node);
                    }
                  }}
                  onClick={() => setSelectedNode(node)}
                  className="cursor-pointer"
                  style={{ transition: 'transform 0.2s', outline: 'none' }}
                >
                  {/* Glow effect for hovered/selected */}
                  {(isHovered || isSelected || isFocused) && (
                    <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke={masteryColor(node.mastery)} strokeWidth={2} opacity={0.3} />
                  )}
                  {isFocused && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={r + 10}
                      fill="none"
                      stroke="var(--text)"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      opacity={0.9}
                    />
                  )}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r}
                    fill={masteryColor(node.mastery)}
                    opacity={isHovered || isSelected || isFocused ? 1 : 0.75}
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
