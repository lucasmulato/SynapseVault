import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
}

interface Edge extends d3.SimulationLinkDatum<Node> {
  label: string;
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

interface GraphViewProps {
  data: GraphData;
  onNodeClick?: (node: Node) => void;
}

const GraphView: React.FC<GraphViewProps> = ({ data, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .call(d3.zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
        g.attr('transform', event.transform);
      }));

    svg.selectAll('*').remove();
    const g = svg.append('g');

    const simulation = d3.forceSimulation<Node>(data.nodes)
      .force('link', d3.forceLink<Node, Edge>(data.edges).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    const link = g.append('g')
      .selectAll('line')
      .data(data.edges)
      .join('line')
      .attr('class', 'link')
      .attr('stroke', '#444');

    const node = g.append('g')
      .selectAll('circle')
      .data(data.nodes)
      .join('circle')
      .attr('class', 'node')
      .attr('r', 8)
      .attr('fill', d => {
        switch (d.type) {
          case 'idea': return '#3b82f6'; // blue
          case 'project': return '#10b981'; // green
          case 'task': return '#f59e0b'; // orange
          default: return '#9ca3af'; // gray
        }
      })
      .call(d3.drag<SVGCircleElement, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))
      .on('click', (event, d) => onNodeClick?.(d));

    const label = g.append('g')
      .selectAll('text')
      .data(data.nodes)
      .join('text')
      .text(d => d.name)
      .attr('font-size', '12px')
      .attr('dx', 12)
      .attr('dy', 4)
      .attr('fill', '#e5e7eb');

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);

      node
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!);

      label
        .attr('x', d => d.x!)
        .attr('y', d => d.y!);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => simulation.stop();
  }, [data]);

  return (
    <div className="w-full h-full bg-zinc-950">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default GraphView;
