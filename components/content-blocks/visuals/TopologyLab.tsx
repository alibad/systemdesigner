'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CircleAlert,
  CloudCog,
  Database,
  Globe2,
  KeyRound,
  Network,
  RadioTower,
  Route,
  Server,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react';

type NodeKind =
  | 'client'
  | 'edge'
  | 'service'
  | 'cache'
  | 'database'
  | 'stream'
  | 'analytics'
  | 'security'
  | 'allocator';
type NodeTone = 'blue' | 'green' | 'violet' | 'amber' | 'rose' | 'cyan' | 'neutral';

interface TopologyNodeData {
  id: string;
  label: string;
  eyebrow?: string;
  detail: string;
  kind: NodeKind;
  tone: NodeTone;
  x: number;
  y: number;
}

interface TopologyEdgeData {
  id: string;
  from: string;
  to: string;
  label?: string;
  mode?: 'sync' | 'async';
  via?: { x: number; y: number };
}

interface TopologyScenarioData {
  id: string;
  label: string;
  summary: string;
  activeEdges: string[];
  failedNodes?: string[];
  degradedNodes?: string[];
  focusNode?: string;
  result: string;
}

interface TopologyData {
  title: string;
  description?: string;
  nodes: TopologyNodeData[];
  edges: TopologyEdgeData[];
  scenarios: TopologyScenarioData[];
}

const NODE_STYLES = {
  blue: 'border-blue-400/50 bg-blue-950 text-blue-100',
  green: 'border-emerald-400/50 bg-emerald-950 text-emerald-100',
  violet: 'border-violet-400/50 bg-violet-950 text-violet-100',
  amber: 'border-amber-400/50 bg-amber-950 text-amber-100',
  rose: 'border-rose-400/50 bg-rose-950 text-rose-100',
  cyan: 'border-cyan-400/50 bg-cyan-950 text-cyan-100',
  neutral: 'border-neutral-500/60 bg-neutral-800 text-neutral-100',
} as const;

const ICON_STYLES = {
  blue: 'bg-blue-400/20 text-blue-300',
  green: 'bg-emerald-400/20 text-emerald-300',
  violet: 'bg-violet-400/20 text-violet-300',
  amber: 'bg-amber-400/20 text-amber-300',
  rose: 'bg-rose-400/20 text-rose-300',
  cyan: 'bg-cyan-400/20 text-cyan-300',
  neutral: 'bg-neutral-700 text-neutral-300',
} as const;

const KIND_ICONS = {
  client: Globe2,
  edge: Network,
  service: Route,
  cache: Server,
  database: Database,
  stream: RadioTower,
  analytics: BarChart3,
  security: ShieldCheck,
  allocator: KeyRound,
} as const;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isTopologyData(value: unknown): value is TopologyData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TopologyData>;
  if (typeof candidate.title !== 'string' || !Array.isArray(candidate.nodes)) return false;
  if (!Array.isArray(candidate.edges) || !Array.isArray(candidate.scenarios)) return false;

  const nodesValid = candidate.nodes.every(
    (node) =>
      node &&
      typeof node.id === 'string' &&
      typeof node.label === 'string' &&
      typeof node.detail === 'string' &&
      node.kind in KIND_ICONS &&
      node.tone in NODE_STYLES &&
      typeof node.x === 'number' &&
      node.x >= 0 &&
      node.x <= 100 &&
      typeof node.y === 'number' &&
      node.y >= 0 &&
      node.y <= 100
  );
  const nodeIds = new Set(candidate.nodes.map((node) => node.id));
  const edgesValid = candidate.edges.every(
    (edge) =>
      edge &&
      typeof edge.id === 'string' &&
      typeof edge.from === 'string' &&
      typeof edge.to === 'string' &&
      nodeIds.has(edge.from) &&
      nodeIds.has(edge.to) &&
      (edge.mode === undefined || edge.mode === 'sync' || edge.mode === 'async') &&
      (edge.via === undefined ||
        (typeof edge.via.x === 'number' &&
          edge.via.x >= 0 &&
          edge.via.x <= 100 &&
          typeof edge.via.y === 'number' &&
          edge.via.y >= 0 &&
          edge.via.y <= 100))
  );
  const edgeIds = new Set(candidate.edges.map((edge) => edge.id));
  const scenariosValid = candidate.scenarios.every(
    (scenario) =>
      scenario &&
      typeof scenario.id === 'string' &&
      typeof scenario.label === 'string' &&
      typeof scenario.summary === 'string' &&
      isStringArray(scenario.activeEdges) &&
      scenario.activeEdges.every((edgeId) => edgeIds.has(edgeId)) &&
      (scenario.failedNodes === undefined ||
        (isStringArray(scenario.failedNodes) && scenario.failedNodes.every((nodeId) => nodeIds.has(nodeId)))) &&
      (scenario.degradedNodes === undefined ||
        (isStringArray(scenario.degradedNodes) && scenario.degradedNodes.every((nodeId) => nodeIds.has(nodeId)))) &&
      typeof scenario.result === 'string'
  );

  return nodesValid && edgesValid && scenariosValid && candidate.nodes.length > 0 && candidate.scenarios.length > 0;
}

function edgePath(from: TopologyNodeData, to: TopologyNodeData, via?: TopologyEdgeData['via']) {
  const startX = from.x * 10;
  const startY = from.y * 5.2;
  const endX = to.x * 10;
  const endY = to.y * 5.2;
  if (via) {
    const viaX = via.x * 10;
    const viaY = via.y * 5.2;
    const firstControlX = (startX + viaX) / 2;
    const secondControlX = (viaX + endX) / 2;
    return `M ${startX} ${startY} C ${firstControlX} ${startY}, ${firstControlX} ${viaY}, ${viaX} ${viaY} S ${secondControlX} ${endY}, ${endX} ${endY}`;
  }
  const controlX = (startX + endX) / 2;
  return `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`;
}

export default function TopologyLab({ dataFile }: { dataFile: string }) {
  const [data, setData] = useState<TopologyData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [scenarioId, setScenarioId] = useState<string>('');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoadError(false);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Topology request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isTopologyData(payload)) throw new Error('Topology data is invalid');
        setData(payload);
        setScenarioId(payload.scenarios[0].id);
        setSelectedNodeId(payload.scenarios[0].focusNode ?? payload.nodes[0].id);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId) ?? data?.scenarios[0];
  const selectedNode = data?.nodes.find((node) => node.id === selectedNodeId) ?? data?.nodes[0];
  const activeEdgeIds = useMemo(() => new Set(scenario?.activeEdges ?? []), [scenario]);
  const activeNodeIds = useMemo(() => {
    if (!data) return new Set<string>();
    const ids = new Set<string>();
    data.edges.forEach((edge) => {
      if (!activeEdgeIds.has(edge.id)) return;
      ids.add(edge.from);
      ids.add(edge.to);
    });
    return ids;
  }, [activeEdgeIds, data]);

  const selectScenario = (nextScenario: TopologyScenarioData) => {
    setScenarioId(nextScenario.id);
    setSelectedNodeId(nextScenario.focusNode ?? selectedNodeId);
  };

  if (loadError) {
    return (
      <div className="not-prose my-7 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
        <TriangleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
        The interactive topology could not be loaded.
      </div>
    );
  }

  if (!data || !scenario || !selectedNode) {
    return (
      <div className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
        <div className="h-28 animate-pulse bg-neutral-900" />
        <div className="h-[520px] animate-pulse bg-neutral-950" />
      </div>
    );
  }

  return (
    <section
      className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 text-white shadow-xl shadow-neutral-950/10"
      data-content-block={`topology-lab:${dataFile}`}
    >
      <header className="border-b border-neutral-800 bg-black/40 px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <CloudCog aria-hidden="true" className="h-4 w-4" />
              Interactive topology
            </div>
            <h3 className="mt-2 text-xl font-semibold text-white md:text-2xl">{data.title}</h3>
            {data.description ? <p className="mt-2 text-sm leading-6 text-neutral-400">{data.description}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Topology scenario">
            {data.scenarios.map((item) => {
              const active = item.id === scenario.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectScenario(item)}
                  className={`min-h-10 rounded-md border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                    active
                      ? 'border-cyan-300 bg-cyan-300 text-neutral-950'
                      : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="border-b border-neutral-800 bg-neutral-900/70 px-5 py-4 md:px-6">
        <div className="flex items-start gap-3">
          <Activity aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
          <div>
            <p className="text-sm font-semibold text-white">{scenario.label}</p>
            <p className="mt-1 text-sm leading-6 text-neutral-400">{scenario.summary}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto overscroll-x-contain scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
        <div className="relative h-[520px] min-w-[820px] bg-[radial-gradient(circle_at_center,rgba(64,64,64,0.22)_1px,transparent_1px)] bg-[length:22px_22px]">
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 1000 520"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <marker id="topology-arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#525252" />
              </marker>
              <marker id="topology-arrow-sync" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#67e8f9" />
              </marker>
              <marker id="topology-arrow-async" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#c4b5fd" />
              </marker>
            </defs>
            {data.edges.map((edge) => {
              const from = data.nodes.find((node) => node.id === edge.from);
              const to = data.nodes.find((node) => node.id === edge.to);
              if (!from || !to) return null;
              const active = activeEdgeIds.has(edge.id);
              const asyncEdge = edge.mode === 'async';
              const path = edgePath(from, to, edge.via);
              const labelX = (edge.via?.x ?? (from.x + to.x) / 2) * 10;
              const labelY = (edge.via?.y ?? (from.y + to.y) / 2) * 5.2 - 10;

              return (
                <g key={edge.id}>
                  <path
                    d={path}
                    fill="none"
                    stroke={active ? (asyncEdge ? '#c4b5fd' : '#67e8f9') : '#404040'}
                    strokeWidth={active ? 4 : 2}
                    strokeDasharray={asyncEdge ? '9 8' : active ? '12 10' : undefined}
                    markerEnd={`url(#topology-arrow-${active ? (asyncEdge ? 'async' : 'sync') : 'muted'})`}
                    className={active ? 'content-flow-dash' : undefined}
                    opacity={active ? 1 : 0.58}
                  />
                  {active && edge.label ? (
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      fill={asyncEdge ? '#ddd6fe' : '#a5f3fc'}
                      stroke="#0a0a0a"
                      strokeWidth="5"
                      paintOrder="stroke"
                      className="text-[12px] font-semibold"
                    >
                      {edge.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {data.nodes.map((node) => {
            const Icon = KIND_ICONS[node.kind];
            const failed = scenario.failedNodes?.includes(node.id) ?? false;
            const degraded = scenario.degradedNodes?.includes(node.id) ?? false;
            const active = activeNodeIds.has(node.id);
            const selected = selectedNode.id === node.id;

            return (
              <button
                key={node.id}
                type="button"
                aria-pressed={selected}
                aria-label={`${node.label}${failed ? ', failed' : degraded ? ', degraded' : active ? ', active' : ''}`}
                onClick={() => setSelectedNodeId(node.id)}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                className={`absolute z-10 min-h-[76px] w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-lg border p-3 text-left shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                  NODE_STYLES[node.tone]
                } ${
                  failed
                    ? 'border-rose-400 bg-rose-950 ring-2 ring-rose-500/60'
                    : degraded
                      ? 'border-amber-300 bg-amber-950 ring-2 ring-amber-400/50'
                      : active
                        ? 'border-cyan-300 shadow-cyan-950/50 ring-1 ring-cyan-300/70'
                        : 'brightness-50 saturate-50 hover:brightness-100 hover:saturate-100'
                } ${selected ? 'ring-2 ring-white' : ''}`}
              >
                <span className="flex items-start gap-2.5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${ICON_STYLES[node.tone]}`}>
                    {failed ? (
                      <XCircle aria-hidden="true" className="h-4 w-4 text-rose-300" />
                    ) : degraded ? (
                      <CircleAlert aria-hidden="true" className="h-4 w-4 text-amber-300" />
                    ) : (
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    {node.eyebrow ? (
                      <span className="block text-[9px] font-semibold uppercase leading-3 text-neutral-400">{node.eyebrow}</span>
                    ) : null}
                    <span className="mt-0.5 block text-sm font-semibold leading-5 text-white">{node.label}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid border-t border-neutral-800 md:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-neutral-800 px-5 py-5 md:border-b-0 md:border-r md:px-6">
          <p className="text-xs font-semibold uppercase text-neutral-500">Selected component</p>
          <div className="mt-2 flex items-center gap-2">
            <Server aria-hidden="true" className="h-4 w-4 text-cyan-300" />
            <h4 className="text-base font-semibold text-white">{selectedNode.label}</h4>
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-400">{selectedNode.detail}</p>
        </div>
        <div className="bg-neutral-900/50 px-5 py-5 md:px-6">
          <p className="text-xs font-semibold uppercase text-neutral-500">Scenario result</p>
          <div className="mt-2 flex items-start gap-2.5">
            {scenario.failedNodes?.length || scenario.degradedNodes?.length ? (
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            ) : (
              <Activity aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            )}
            <p className="text-sm font-medium leading-6 text-neutral-200">{scenario.result}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
