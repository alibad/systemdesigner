/**
 * tldraw store records -> SystemGraph.
 *
 * The whiteboard (app/whiteboard/page.tsx) creates each component as a `geo`
 * rectangle whose `props.text` is `"{icon} {label}"` (e.g. "🗄️ Database"), and
 * connects them with `arrow` shapes. `editor.store.serialize()` returns a flat
 * record bag — there is no node/edge graph. This module reconstructs one so a
 * rubric can reason about topology.
 *
 * It tolerates every tldraw arrow-binding format we've seen in this repo:
 *   - v2 separate `binding` records ({ typeName:'binding', fromId:<arrow>, toId:<shape>, props.terminal })
 *   - inline `arrow.props.start/end = { type:'binding', boundShapeId }`
 * and both the `{ records: [...] }` array and `{ records: {...} }` map shapes.
 */

import type { SystemGraph, GraphNode, GraphEdge, NodeType } from './types';

/** Ordered most-specific-first so "Load Balancer" doesn't match "server", etc. */
const PALETTE_MATCHERS: { type: NodeType; keywords: string[] }[] = [
  { type: 'user', keywords: ['user', 'client', '👤'] },
  { type: 'balancer', keywords: ['load balancer', 'load-balancer', 'balancer', '⚖'] },
  { type: 'api', keywords: ['api gateway', 'gateway', 'api', '🔌'] },
  { type: 'cdn', keywords: ['cdn', 'content delivery', '🌐'] },
  { type: 'cache', keywords: ['cache', 'redis', 'memcached', '⚡'] },
  { type: 'queue', keywords: ['message queue', 'queue', 'kafka', 'rabbitmq', 'sqs', '📮'] },
  { type: 'database', keywords: ['database', 'datastore', 'data store', 'postgres', 'mysql', 'cassandra', 'dynamo', ' db', 'db ', '🗄'] },
  { type: 'monitor', keywords: ['monitor', 'metrics', 'logging', 'observability', '📊'] },
  { type: 'server', keywords: ['server', 'service', 'app', 'worker', 'backend', 'microservice', '🖥'] },
];

export function classifyLabel(rawText: string): NodeType {
  const text = (rawText || '').toLowerCase().trim();
  if (!text) return 'unknown';
  for (const m of PALETTE_MATCHERS) {
    if (m.keywords.some((kw) => text.includes(kw))) return m.type;
  }
  return 'unknown';
}

/** Flatten tldraw richText (newer versions) into plain text; fall back to props.text. */
function readShapeText(props: any): string {
  if (!props) return '';
  if (typeof props.text === 'string' && props.text.trim()) return props.text;
  const rich = props.richText;
  if (rich && Array.isArray(rich.content)) {
    const parts: string[] = [];
    const walk = (node: any) => {
      if (!node) return;
      if (typeof node.text === 'string') parts.push(node.text);
      if (Array.isArray(node.content)) node.content.forEach(walk);
    };
    rich.content.forEach(walk);
    return parts.join(' ');
  }
  return '';
}

/** Normalize `{ records }` (array OR id-keyed map) plus a few legacy shapes into a flat array. */
function toRecordArray(serialized: any): any[] {
  if (!serialized) return [];
  const root =
    serialized.records ??
    serialized.store?.records ??
    serialized; // tolerate being handed the records map directly
  if (Array.isArray(root)) return root;
  if (typeof root === 'object') return Object.values(root);
  return [];
}

export function extractSystemGraph(serialized: any): SystemGraph {
  const records = toRecordArray(serialized);

  const nodes: GraphNode[] = [];
  const nodeIds = new Set<string>();
  const arrows: { id: string; start?: string; end?: string }[] = [];
  // arrowId -> { start, end } collected from standalone binding records
  const bindingsByArrow = new Map<string, { start?: string; end?: string }>();

  for (const rec of records) {
    if (!rec || typeof rec !== 'object') continue;

    const typeName = rec.typeName;
    const shapeType = rec.type;

    // Standalone binding records (tldraw v2): tie an arrow terminal to a shape.
    if (typeName === 'binding' && shapeType === 'arrow') {
      const arrowId: string = rec.fromId;
      const target: string = rec.toId;
      const terminal: string = rec.props?.terminal; // 'start' | 'end'
      if (arrowId && target) {
        const entry = bindingsByArrow.get(arrowId) ?? {};
        if (terminal === 'end') entry.end = target;
        else entry.start = target;
        bindingsByArrow.set(arrowId, entry);
      }
      continue;
    }

    if (typeName && typeName !== 'shape') continue; // ignore camera/page/instance/etc.

    if (shapeType === 'arrow') {
      const props = rec.props ?? {};
      const start = props.start?.boundShapeId;
      const end = props.end?.boundShapeId;
      arrows.push({ id: rec.id, start, end });
      continue;
    }

    // Treat any text-bearing shape (geo / text / note) as a candidate component node.
    if (shapeType === 'geo' || shapeType === 'text' || shapeType === 'note') {
      const label = readShapeText(rec.props).trim();
      if (!label) continue;
      nodes.push({ id: rec.id, type: classifyLabel(label), label });
      nodeIds.add(rec.id);
    }
  }

  // Merge inline arrow endpoints with standalone binding records.
  const edges: GraphEdge[] = [];
  for (const arrow of arrows) {
    const bound = bindingsByArrow.get(arrow.id) ?? {};
    const from = arrow.start ?? bound.start;
    const to = arrow.end ?? bound.end;
    if (from && to && nodeIds.has(from) && nodeIds.has(to) && from !== to) {
      edges.push({ id: arrow.id, from, to });
    }
  }

  return { nodes, edges };
}

/** Convenience: does an edge connect a node of type `a` to one of type `b` (either direction)? */
export function hasEdgeBetween(graph: SystemGraph, a: NodeType, b: NodeType): boolean {
  const typeOf = new Map(graph.nodes.map((n) => [n.id, n.type]));
  return graph.edges.some((e) => {
    const ft = typeOf.get(e.from);
    const tt = typeOf.get(e.to);
    return (ft === a && tt === b) || (ft === b && tt === a);
  });
}

export function hasNodeType(graph: SystemGraph, t: NodeType): boolean {
  return graph.nodes.some((n) => n.type === t);
}
