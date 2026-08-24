import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  properties?: Record<string, unknown>;
}

export interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  label: string;
}

export interface GraphData {
  nodes: { id: string; name: string; type: string; description?: string | null; properties?: Record<string, unknown> }[];
  edges: { source_id: string; target_id: string; label: string }[];
}

export interface NodePosition {
  x: number;
  y: number;
}

interface GraphViewProps {
  data: GraphData | null;
  onNodeClick?: (node: GraphNode) => void;
  /** Saved positions (node id -> x/y) used to restore layout on load. */
  initialPositions?: Record<string, NodePosition>;
  /** Fired after a drag ends so callers can persist the new position. */
  onNodePosition?: (id: string, x: number, y: number) => void;
  /** Node id highlighted as the pending edge source during connect mode. */
  highlightId?: string | null;
}

const NODE_COLORS: Record<string, string> = {
  idea: '#3b82f6', // blue
  project: '#10b981', // green
  task: '#f59e0b', // orange
};

const GraphView: React.FC<GraphViewProps> = ({
  data,
  onNodeClick,
  initialPositions,
  onNodePosition,
  highlightId,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Keep the latest callbacks without re-running the graph effect.
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  const onNodePositionRef = useRef(onNodePosition);
  useEffect(() => {
    onNodePositionRef.current = onNodePosition;
  }, [onNodePosition]);

  useEffect(() => {
    const onResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const { width, height } = dimensions;
    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .call(
        d3.zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
          g.attr('transform', event.transform);
        })
      );

    svg.selectAll('*').remove();
    const g = svg.append('g');

    // Normalize DB rows (source_id/target_id) into d3 link objects.
    const nodes: GraphNode[] = data.nodes.map((n) => ({
      ...n,
      properties: n.properties ?? undefined,
    }));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const edges: GraphEdge[] = data.edges
      .filter((e) => nodeById.has(e.source_id) && nodeById.has(e.target_id))
      .map((e) => ({
        source: nodeById.get(e.source_id)!,
        target: nodeById.get(e.target_id)!,
        label: e.label,
      }));

    // Restore persisted layout: nodes with a saved position are pinned so
    // the arrangement survives reloads; fresh nodes settle via forces.
    for (const n of nodes) {
      const saved = initialPositions?.[n.id];
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        n.x = saved.x;
        n.y = saved.y;
        n.fx = saved.x;
        n.fy = saved.y;
      }
    }

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphEdge>(edges)
          .id((d) => d.id)
          .distance(100)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    const link = g
      .append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('class', 'link')
      .attr('stroke', '#444');

    const linkLabel = g
      .append('g')
      .selectAll('text')
      .data(edges)
      .join('text')
      .text((d) => d.label)
      .attr('font-size', '9px')
      .attr('fill', '#71717a')
      .attr('text-anchor', 'middle');

    const node = g
      .append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('class', 'node')
      .attr('r', 8)
      .attr('fill', (d) => NODE_COLORS[d.type] ?? '#9ca3af') // gray fallback
      .attr('stroke', (d) => (d.id === highlightId ? '#ffffff' : 'none'))
      .attr('stroke-width', (d) => (d.id === highlightId ? 2 : 0))
      .attr('cursor', 'pointer')
      .call((selection) => {
        d3
          .drag<SVGCircleElement, GraphNode>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended)
          .call(selection);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClickRef.current?.(d);
      });

    const label = g
      .append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text((d) => d.name)
      .attr('font-size', '12px')
      .attr('dx', 12)
      .attr('dy', 4)
      .attr('fill', '#e5e7eb')
      .attr('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as any).x)
        .attr('y1', (d) => (d.source as any).y)
        .attr('x2', (d) => (d.target as any).x)
        .attr('y2', (d) => (d.target as any).y);

      linkLabel
        .attr('x', (d) => ((d.source as any).x + (d.target as any).x) / 2)
        .attr('y', (d) => ((d.source as any).y + (d.target as any).y) / 2);

      node.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);

      label.attr('x', (d) => d.x!).attr('y', (d) => d.y!);
    });

    // Drag events report viewport coordinates; convert them into graph
    // coordinates through the current zoom transform so positions saved to
    // the database match what the simulation/render uses.
    function toGraphCoords(event: { x: number; y: number }) {
      const t = d3.zoomTransform(svg.node()!);
      return { x: t.invertX(event.x), y: t.invertY(event.y) };
    }

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      const p = toGraphCoords(event);
      event.subject.fx = p.x;
      event.subject.fy = p.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      // Keep the node where the user dropped it and report the position so
      // it can be persisted.
      const p = toGraphCoords(event);
      event.subject.fx = p.x;
      event.subject.fy = p.y;
      onNodePositionRef.current?.(event.subject.id, p.x, p.y);
    }

    return () => {
      simulation.stop();
    };
    // initialPositions/highlightId are read through refs-free closure on
    // purpose: positions should apply once per data load, not per hover-like
    // highlight change. Highlight is applied via a separate lightweight pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dimensions]);

  // Lightweight highlight pass that does not rebuild the simulation.
  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current)
      .selectAll<SVGCircleElement, GraphNode>('circle.node')
      .attr('stroke', (d) => (d.id === highlightId ? '#ffffff' : 'none'))
      .attr('stroke-width', (d) => (d.id === highlightId ? 2 : 0));
  }, [highlightId]);

  return (
    <div className="w-full h-full bg-zinc-950">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default GraphView;
