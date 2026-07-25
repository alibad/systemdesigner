'use client';

import { useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Database,
  Download,
  Gauge,
  Globe,
  Layers,
  MousePointer2,
  Network,
  Plus,
  RotateCcw,
  Server,
  ShieldAlert,
  Smartphone,
  Square,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';

type NodeType = 'service' | 'database' | 'cache' | 'queue' | 'gateway' | 'client' | 'external';
type Boundary = 'edge' | 'application' | 'data' | 'external' | 'unassigned';
type ConnectionType = 'sync' | 'async' | 'data';
type ToolMode = 'select' | 'add' | 'connect';

interface DiagramNode {
  id: string;
  type: NodeType;
  label: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  boundary: Boundary;
  replicas: number;
  capacity: number;
  baseLoad: number;
  critical: boolean;
}

interface DiagramConnection {
  id: string;
  from: string;
  to: string;
  label: string;
  type: ConnectionType;
  bidirectional: boolean;
}

interface DiagramTemplate {
  id: string;
  name: string;
  description: string;
  nodes: Omit<DiagramNode, 'id'>[];
  connections: Array<Omit<DiagramConnection, 'id' | 'from' | 'to'> & { from: string; to: string }>;
}

interface NodeCatalogItem {
  id: NodeType;
  label: string;
  icon: LucideIcon;
  color: string;
  boundary: Boundary;
  capacity: number;
  baseLoad: number;
  critical: boolean;
}

interface ReviewIssue {
  id: string;
  nodeId?: string;
  severity: 'critical' | 'warning' | 'notice';
  title: string;
  detail: string;
}

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 580;
const NODE_WIDTH = 132;
const NODE_HEIGHT = 76;

const nodeCatalog: NodeCatalogItem[] = [
  { id: 'client', label: 'Client', icon: Smartphone, color: '#0891b2', boundary: 'edge', capacity: 5000, baseLoad: 600, critical: false },
  { id: 'gateway', label: 'Gateway', icon: Globe, color: '#dc2626', boundary: 'edge', capacity: 2400, baseLoad: 1200, critical: true },
  { id: 'service', label: 'Service', icon: Server, color: '#2563eb', boundary: 'application', capacity: 1600, baseLoad: 700, critical: true },
  { id: 'queue', label: 'Queue', icon: Circle, color: '#7c3aed', boundary: 'application', capacity: 4000, baseLoad: 900, critical: true },
  { id: 'cache', label: 'Cache', icon: Square, color: '#d97706', boundary: 'data', capacity: 8000, baseLoad: 1000, critical: false },
  { id: 'database', label: 'Database', icon: Database, color: '#059669', boundary: 'data', capacity: 1200, baseLoad: 500, critical: true },
  { id: 'external', label: 'External', icon: Globe, color: '#64748b', boundary: 'external', capacity: 3000, baseLoad: 300, critical: false },
];

const connectionTypes: Array<{ id: ConnectionType; label: string; color: string; dash?: string }> = [
  { id: 'sync', label: 'Synchronous', color: '#2563eb' },
  { id: 'async', label: 'Asynchronous', color: '#7c3aed', dash: '9 6' },
  { id: 'data', label: 'Data flow', color: '#059669', dash: '3 5' },
];

const boundaryLabels: Record<Boundary, string> = {
  edge: 'Edge',
  application: 'Application',
  data: 'Data',
  external: 'External',
  unassigned: 'No boundary',
};

const templates: DiagramTemplate[] = [
  {
    id: 'request-path',
    name: 'Request path',
    description: 'Client, gateway, services, cache, and owned data.',
    nodes: [
      { type: 'client', label: 'Web client', description: 'Starts the user request.', x: 30, y: 90, width: NODE_WIDTH, height: NODE_HEIGHT, boundary: 'edge', replicas: 1, capacity: 5000, baseLoad: 900, critical: false },
      { type: 'gateway', label: 'API gateway', description: 'Authenticates and routes requests.', x: 210, y: 90, width: NODE_WIDTH, height: NODE_HEIGHT, boundary: 'edge', replicas: 2, capacity: 2400, baseLoad: 1400, critical: true },
      { type: 'service', label: 'Catalog service', description: 'Owns product reads.', x: 400, y: 35, width: NODE_WIDTH, height: NODE_HEIGHT, boundary: 'application', replicas: 2, capacity: 1600, baseLoad: 850, critical: true },
      { type: 'service', label: 'Order service', description: 'Owns checkout state changes.', x: 400, y: 150, width: NODE_WIDTH, height: NODE_HEIGHT, boundary: 'application', replicas: 2, capacity: 1400, baseLoad: 700, critical: true },
      { type: 'cache', label: 'Product cache', description: 'Absorbs repeated catalog reads.', x: 605, y: 35, width: NODE_WIDTH, height: NODE_HEIGHT, boundary: 'data', replicas: 2, capacity: 8000, baseLoad: 850, critical: false },
      { type: 'database', label: 'Order database', description: 'Stores authoritative order state.', x: 605, y: 150, width: NODE_WIDTH, height: NODE_HEIGHT, boundary: 'data', replicas: 2, capacity: 1200, baseLoad: 700, critical: true },
    ],
    connections: [
      { from: 'Web client', to: 'API gateway', label: 'HTTPS', type: 'sync', bidirectional: false },
      { from: 'API gateway', to: 'Catalog service', label: 'read', type: 'sync', bidirectional: false },
      { from: 'API gateway', to: 'Order service', label: 'command', type: 'sync', bidirectional: false },
      { from: 'Catalog service', to: 'Product cache', label: 'cache lookup', type: 'data', bidirectional: true },
      { from: 'Order service', to: 'Order database', label: 'transaction', type: 'data', bidirectional: true },
    ],
  },
  {
    id: 'event-pipeline',
    name: 'Event pipeline',
    description: 'Durable asynchronous work with separate state ownership.',
    nodes: [
      { type: 'gateway', label: 'Ingest API', description: 'Validates and accepts commands.', x: 35, y: 110, width: NODE_WIDTH, height: NODE_HEIGHT, boundary: 'edge', replicas: 2, capacity: 2200, baseLoad: 1400, critical: true },
      { type: 'service', label: 'Order service', description: 'Commits the order and outbox record.', x: 220, y: 110, width: NODE_WIDTH, height: NODE_HEIGHT, boundary: 'application', replicas: 2, capacity: 1600, baseLoad: 900, critical: true },
      { type: 'queue', label: 'Event bus', description: 'Buffers durable work for consumers.', x: 405, y: 110, width: NODE_WIDTH, height: NODE_HEIGHT, boundary: 'application', replicas: 3, capacity: 4000, baseLoad: 900, critical: true },
      { type: 'service', label: 'Payment worker', description: 'Consumes payment commands idempotently.', x: 595, y: 45, width: NODE_WIDTH, height: NODE_HEIGHT, boundary: 'application', replicas: 2, capacity: 1400, baseLoad: 620, critical: true },
      { type: 'service', label: 'Email worker', description: 'Sends retryable notifications.', x: 595, y: 175, width: NODE_WIDTH, height: NODE_HEIGHT, boundary: 'application', replicas: 2, capacity: 2000, baseLoad: 450, critical: false },
      { type: 'database', label: 'Order database', description: 'Owns order and outbox state.', x: 220, y: 260, width: NODE_WIDTH, height: NODE_HEIGHT, boundary: 'data', replicas: 2, capacity: 1200, baseLoad: 700, critical: true },
    ],
    connections: [
      { from: 'Ingest API', to: 'Order service', label: 'command', type: 'sync', bidirectional: false },
      { from: 'Order service', to: 'Order database', label: 'atomic write', type: 'data', bidirectional: true },
      { from: 'Order service', to: 'Event bus', label: 'OrderCreated', type: 'async', bidirectional: false },
      { from: 'Event bus', to: 'Payment worker', label: 'payment', type: 'async', bidirectional: false },
      { from: 'Event bus', to: 'Email worker', label: 'notification', type: 'async', bidirectional: false },
    ],
  },
];

function instantiateTemplate(template: DiagramTemplate, seed: string) {
  const nodes = template.nodes.map((node, index) => ({ ...node, id: `${seed}-node-${index}` }));
  const idsByLabel = new Map(nodes.map((node) => [node.label, node.id]));
  const connections = template.connections.map((connection, index) => ({
    ...connection,
    id: `${seed}-connection-${index}`,
    from: idsByLabel.get(connection.from) ?? '',
    to: idsByLabel.get(connection.to) ?? '',
  }));

  return { nodes, connections };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCatalogItem(type: NodeType) {
  return nodeCatalog.find((item) => item.id === type) ?? nodeCatalog[2];
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

const initialDiagram = instantiateTemplate(templates[0], 'initial');

export default function ArchitectureDiagramBuilder() {
  const [nodes, setNodes] = useState<DiagramNode[]>(initialDiagram.nodes);
  const [connections, setConnections] = useState<DiagramConnection[]>(initialDiagram.connections);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [selectedNodeType, setSelectedNodeType] = useState<NodeType>('service');
  const [connectionStartId, setConnectionStartId] = useState('');
  const [challengeMode, setChallengeMode] = useState(false);
  const [trafficMultiplier, setTrafficMultiplier] = useState(1);
  const [failedNodeId, setFailedNodeId] = useState('');
  const [importError, setImportError] = useState('');
  const [drag, setDrag] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);
  const didDrag = useRef(false);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId);

  const review = useMemo(() => {
    const degree = new Map(nodes.map((node) => [node.id, 0]));
    connections.forEach((connection) => {
      degree.set(connection.from, (degree.get(connection.from) ?? 0) + 1);
      degree.set(connection.to, (degree.get(connection.to) ?? 0) + 1);
    });

    const issues: ReviewIssue[] = [];
    nodes.forEach((node) => {
      const effectiveCapacity = node.capacity * Math.max(node.replicas, 1);
      const projectedLoad = node.baseLoad * trafficMultiplier;

      if ((degree.get(node.id) ?? 0) === 0) {
        issues.push({
          id: `disconnected-${node.id}`,
          nodeId: node.id,
          severity: 'warning',
          title: `${node.label} is disconnected`,
          detail: 'It has no visible request, event, or data path. Connect it or remove it from the design.',
        });
      }
      if (node.boundary === 'unassigned') {
        issues.push({
          id: `boundary-${node.id}`,
          nodeId: node.id,
          severity: 'warning',
          title: `${node.label} has no trust boundary`,
          detail: 'Assign an edge, application, data, or external boundary so ownership and crossing controls are reviewable.',
        });
      }
      if (node.critical && node.replicas < 2) {
        issues.push({
          id: `spof-${node.id}`,
          nodeId: node.id,
          severity: 'critical',
          title: `${node.label} is a single point of failure`,
          detail: 'This component is marked as core-path critical but has only one replica.',
        });
      }
      if (projectedLoad > effectiveCapacity) {
        issues.push({
          id: `overload-${node.id}`,
          nodeId: node.id,
          severity: 'critical',
          title: `${node.label} is overloaded`,
          detail: `${Math.round(projectedLoad).toLocaleString()} req/s exceeds ${effectiveCapacity.toLocaleString()} req/s of modeled capacity.`,
        });
      }
    });

    if (failedNodeId) {
      const failedNode = nodes.find((node) => node.id === failedNodeId);
      if (failedNode) {
        const neighbors = new Set(
          connections
            .filter((connection) => connection.from === failedNodeId || connection.to === failedNodeId)
            .map((connection) => (connection.from === failedNodeId ? connection.to : connection.from)),
        );
        issues.unshift({
          id: `failure-${failedNode.id}`,
          nodeId: failedNode.id,
          severity: failedNode.critical ? 'critical' : 'warning',
          title: `${failedNode.label} is unavailable`,
          detail: `${neighbors.size} directly connected component${neighbors.size === 1 ? '' : 's'} lose this path. Trace whether a retry, fallback, or alternate route exists.`,
        });
      }
    }

    const flaggedNodeIds = new Set(issues.flatMap((issue) => (issue.nodeId ? [issue.nodeId] : [])));
    const criticalCount = issues.filter((issue) => issue.severity === 'critical').length;
    const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

    return { issues, flaggedNodeIds, criticalCount, warningCount };
  }, [connections, failedNodeId, nodes, trafficMultiplier]);

  const nextId = (prefix: string) => {
    idCounter.current += 1;
    return `${prefix}-${Date.now().toString(36)}-${idCounter.current}`;
  };

  const setMode = (mode: ToolMode) => {
    setToolMode(mode);
    setConnectionStartId('');
  };

  const selectNode = (nodeId: string) => {
    if (toolMode === 'connect') {
      if (!connectionStartId) {
        setConnectionStartId(nodeId);
        setSelectedNodeId(nodeId);
        setSelectedConnectionId('');
        return;
      }
      if (connectionStartId !== nodeId) {
        const exists = connections.some(
          (connection) =>
            (connection.from === connectionStartId && connection.to === nodeId) ||
            (connection.from === nodeId && connection.to === connectionStartId),
        );
        if (!exists) {
          const source = nodes.find((node) => node.id === connectionStartId);
          const target = nodes.find((node) => node.id === nodeId);
          if (source && target) {
            const connection: DiagramConnection = {
              id: nextId('connection'),
              from: source.id,
              to: target.id,
              label: `${source.label} to ${target.label}`,
              type: 'sync',
              bidirectional: false,
            };
            setConnections((current) => [...current, connection]);
            setSelectedConnectionId(connection.id);
            setSelectedNodeId('');
          }
        }
      }
      setConnectionStartId('');
      return;
    }

    setSelectedNodeId(nodeId);
    setSelectedConnectionId('');
  };

  const addNode = (x = 360, y = 230) => {
    const catalogItem = getCatalogItem(selectedNodeType);
    const count = nodes.filter((node) => node.type === selectedNodeType).length + 1;
    const node: DiagramNode = {
      id: nextId('node'),
      type: selectedNodeType,
      label: `${catalogItem.label} ${count}`,
      description: `Describe the responsibility owned by this ${catalogItem.label.toLowerCase()}.`,
      x: clamp(x, 12, CANVAS_WIDTH - NODE_WIDTH - 12),
      y: clamp(y, 38, CANVAS_HEIGHT - NODE_HEIGHT - 12),
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      boundary: catalogItem.boundary,
      replicas: catalogItem.critical ? 1 : 2,
      capacity: catalogItem.capacity,
      baseLoad: catalogItem.baseLoad,
      critical: catalogItem.critical,
    };
    setNodes((current) => [...current, node]);
    setSelectedNodeId(node.id);
    setSelectedConnectionId('');
  };

  const updateNode = (nodeId: string, updates: Partial<DiagramNode>) => {
    setNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, ...updates } : node)));
  };

  const updateConnection = (connectionId: string, updates: Partial<DiagramConnection>) => {
    setConnections((current) =>
      current.map((connection) => (connection.id === connectionId ? { ...connection, ...updates } : connection)),
    );
  };

  const deleteNode = (nodeId: string) => {
    setNodes((current) => current.filter((node) => node.id !== nodeId));
    setConnections((current) =>
      current.filter((connection) => connection.from !== nodeId && connection.to !== nodeId),
    );
    if (selectedNodeId === nodeId) setSelectedNodeId('');
    if (failedNodeId === nodeId) setFailedNodeId('');
  };

  const deleteConnection = (connectionId: string) => {
    setConnections((current) => current.filter((connection) => connection.id !== connectionId));
    if (selectedConnectionId === connectionId) setSelectedConnectionId('');
  };

  const loadTemplate = (template: DiagramTemplate) => {
    const diagram = instantiateTemplate(template, nextId(template.id));
    setNodes(diagram.nodes);
    setConnections(diagram.connections);
    setSelectedNodeId('');
    setSelectedConnectionId('');
    setConnectionStartId('');
    setFailedNodeId('');
    setTrafficMultiplier(1);
    setImportError('');
  };

  const clearDiagram = () => {
    setNodes([]);
    setConnections([]);
    setSelectedNodeId('');
    setSelectedConnectionId('');
    setConnectionStartId('');
    setFailedNodeId('');
    setImportError('');
  };

  const exportDiagram = () => {
    const payload = {
      nodes,
      connections,
      metadata: { name: 'Architecture diagram', exportedAt: new Date().toISOString(), version: 2 },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'architecture-diagram.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const importDiagram = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { nodes?: unknown; connections?: unknown };
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.connections)) {
        throw new Error('The file must contain node and connection arrays.');
      }

      const importedNodes = parsed.nodes.map((value, index): DiagramNode => {
        if (!value || typeof value !== 'object') throw new Error(`Node ${index + 1} is invalid.`);
        const raw = value as Partial<DiagramNode>;
        const type = nodeCatalog.some((item) => item.id === raw.type) ? (raw.type as NodeType) : 'service';
        const catalogItem = getCatalogItem(type);
        return {
          id: typeof raw.id === 'string' && raw.id ? raw.id : nextId('imported-node'),
          type,
          label: typeof raw.label === 'string' && raw.label ? raw.label : `${catalogItem.label} ${index + 1}`,
          description: typeof raw.description === 'string' ? raw.description : '',
          x: clamp(typeof raw.x === 'number' ? raw.x : 40 + index * 28, 12, CANVAS_WIDTH - NODE_WIDTH - 12),
          y: clamp(typeof raw.y === 'number' ? raw.y : 80 + index * 20, 38, CANVAS_HEIGHT - NODE_HEIGHT - 12),
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          boundary: Object.keys(boundaryLabels).includes(raw.boundary ?? '') ? (raw.boundary as Boundary) : 'unassigned',
          replicas: clamp(typeof raw.replicas === 'number' ? raw.replicas : 1, 1, 12),
          capacity: clamp(typeof raw.capacity === 'number' ? raw.capacity : catalogItem.capacity, 100, 50000),
          baseLoad: clamp(typeof raw.baseLoad === 'number' ? raw.baseLoad : catalogItem.baseLoad, 0, 50000),
          critical: typeof raw.critical === 'boolean' ? raw.critical : catalogItem.critical,
        };
      });
      const nodeIds = new Set(importedNodes.map((node) => node.id));
      const importedConnections = parsed.connections.flatMap((value, index): DiagramConnection[] => {
        if (!value || typeof value !== 'object') return [];
        const raw = value as Partial<DiagramConnection>;
        if (typeof raw.from !== 'string' || typeof raw.to !== 'string' || !nodeIds.has(raw.from) || !nodeIds.has(raw.to)) {
          return [];
        }
        const type = connectionTypes.some((item) => item.id === raw.type) ? (raw.type as ConnectionType) : 'sync';
        return [{
          id: typeof raw.id === 'string' && raw.id ? raw.id : nextId(`imported-connection-${index}`),
          from: raw.from,
          to: raw.to,
          label: typeof raw.label === 'string' ? raw.label : '',
          type,
          bidirectional: Boolean(raw.bidirectional),
        }];
      });

      setNodes(importedNodes);
      setConnections(importedConnections);
      setSelectedNodeId('');
      setSelectedConnectionId('');
      setFailedNodeId('');
      setImportError('');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'This diagram could not be imported.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    if (event.target !== event.currentTarget && event.target !== canvasRef.current) return;
    if (toolMode === 'add' && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      addNode(event.clientX - rect.left - NODE_WIDTH / 2, event.clientY - rect.top - NODE_HEIGHT / 2);
      return;
    }
    setSelectedNodeId('');
    setSelectedConnectionId('');
    setConnectionStartId('');
  };

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>, node: DiagramNode) => {
    if (toolMode !== 'select' || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDrag({
      nodeId: node.id,
      offsetX: event.clientX - rect.left - node.x,
      offsetY: event.clientY - rect.top - node.y,
    });
    didDrag.current = false;
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left - drag.offsetX, 12, CANVAS_WIDTH - NODE_WIDTH - 12);
    const y = clamp(event.clientY - rect.top - drag.offsetY, 38, CANVAS_HEIGHT - NODE_HEIGHT - 12);
    updateNode(drag.nodeId, { x, y });
    didDrag.current = true;
  };

  const handleNodeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, node: DiagramNode) => {
    if (isTypingTarget(event.target)) return;
    const step = event.shiftKey ? 24 : 8;
    const moves: Record<string, Partial<DiagramNode>> = {
      ArrowLeft: { x: clamp(node.x - step, 12, CANVAS_WIDTH - NODE_WIDTH - 12) },
      ArrowRight: { x: clamp(node.x + step, 12, CANVAS_WIDTH - NODE_WIDTH - 12) },
      ArrowUp: { y: clamp(node.y - step, 38, CANVAS_HEIGHT - NODE_HEIGHT - 12) },
      ArrowDown: { y: clamp(node.y + step, 38, CANVAS_HEIGHT - NODE_HEIGHT - 12) },
    };
    if (moves[event.key]) {
      event.preventDefault();
      updateNode(node.id, moves[event.key]);
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      deleteNode(node.id);
    }
  };

  const selectConnection = (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    setSelectedNodeId('');
    setConnectionStartId('');
  };

  const issueTone = review.criticalCount
    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100'
    : review.warningCount
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100';

  return (
    <section
      data-content-block="tools/architecture-diagram-builder"
      className="w-full min-w-0 overflow-hidden rounded-lg border border-slate-300 bg-white text-slate-950 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
    >
      <div className="border-b border-slate-200 bg-slate-950 px-4 py-4 text-white dark:border-slate-800 sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-300">
              <Layers aria-hidden="true" className="h-4 w-4" />
              Architecture workbench
            </div>
            <h2 className="mt-1 text-xl font-semibold sm:text-2xl">Build the path, then try to break it</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
              Model responsibilities and connections, then inject traffic or a component failure to reveal hidden risk.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importDiagram(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-600 px-3 text-sm font-medium text-slate-100 hover:border-slate-400 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <Upload aria-hidden="true" className="h-4 w-4" />
              Import
            </button>
            <button
              type="button"
              onClick={exportDiagram}
              disabled={nodes.length === 0}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-600 px-3 text-sm font-medium text-slate-100 hover:border-slate-400 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              onClick={clearDiagram}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-500/70 px-3 text-sm font-medium text-rose-100 hover:bg-rose-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {importError && (
        <div className="flex items-start gap-3 border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100" role="alert">
          <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="font-semibold">Import failed.</span> {importError}
          </div>
          <button
            type="button"
            onClick={() => setImportError('')}
            className="rounded p-1 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:hover:bg-rose-900"
            aria-label="Dismiss import error"
          >
            <XCircle aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid min-w-0 lg:grid-cols-[218px_minmax(0,1fr)] xl:grid-cols-[218px_minmax(0,1fr)_292px]">
        <aside className="border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70 lg:border-b-0 lg:border-r">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Editing mode</p>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-md border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-950">
                {([
                  { id: 'select', label: 'Move', icon: MousePointer2 },
                  { id: 'add', label: 'Add', icon: Plus },
                  { id: 'connect', label: 'Link', icon: Network },
                ] as const).map((mode) => {
                  const Icon = mode.icon;
                  const selected = toolMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setMode(mode.id)}
                      className={`flex h-14 flex-col items-center justify-center gap-1 rounded text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        selected
                          ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500 dark:text-slate-950'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon aria-hidden="true" className="h-4 w-4" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500 dark:text-slate-400" aria-live="polite">
                {toolMode === 'select' && 'Drag nodes, or use arrow keys after selecting one.'}
                {toolMode === 'add' && 'Choose a component, then click the canvas or use Add centered.'}
                {toolMode === 'connect' && (connectionStartId ? 'Choose the destination node.' : 'Choose a source node, then its destination.')}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Components</p>
                <button
                  type="button"
                  onClick={() => addNode(340 + (nodes.length % 4) * 18, 215 + (nodes.length % 5) * 18)}
                  className="rounded p-1 text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-blue-950"
                  aria-label={`Add ${getCatalogItem(selectedNodeType).label} centered`}
                  title="Add selected component centered"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {nodeCatalog.map((item) => {
                  const Icon = item.icon;
                  const selected = selectedNodeType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setSelectedNodeType(item.id);
                        setMode('add');
                      }}
                      className={`flex min-h-16 flex-col items-start justify-between rounded-md border p-2 text-left text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        selected
                          ? 'border-blue-600 bg-blue-50 text-blue-950 ring-1 ring-blue-600 dark:border-blue-400 dark:bg-blue-950/70 dark:text-blue-100 dark:ring-blue-400'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-500'
                      }`}
                    >
                      <Icon aria-hidden="true" className="h-4 w-4" style={{ color: item.color }} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Starting points</p>
              <div className="mt-2 space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => loadTemplate(template)}
                    className="w-full rounded-md border border-slate-300 bg-white p-3 text-left hover:border-blue-500 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-400 dark:hover:bg-blue-950/40"
                  >
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{template.name}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{template.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 bg-slate-100 dark:bg-slate-900">
          <div className="flex min-h-[70px] flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span><strong>{nodes.length}</strong> components</span>
              <span><strong>{connections.length}</strong> links</span>
              {challengeMode && (
                <span className={review.criticalCount ? 'font-semibold text-rose-700 dark:text-rose-300' : 'font-semibold text-emerald-700 dark:text-emerald-300'}>
                  {review.issues.length} finding{review.issues.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <div className="inline-flex self-start rounded-md border border-slate-300 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900 sm:self-auto">
              <button
                type="button"
                aria-pressed={!challengeMode}
                onClick={() => setChallengeMode(false)}
                className={`h-8 rounded px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  !challengeMode ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Design
              </button>
              <button
                type="button"
                aria-pressed={challengeMode}
                onClick={() => setChallengeMode(true)}
                className={`inline-flex h-8 items-center gap-2 rounded px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                  challengeMode ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <ShieldAlert aria-hidden="true" className="h-4 w-4" />
                Challenge
              </button>
            </div>
          </div>

          {challengeMode && (
            <div className="grid gap-4 border-b border-slate-200 bg-amber-50 px-4 py-4 dark:border-slate-800 dark:bg-amber-950/20 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.7fr)]">
              <label className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                <span className="flex items-center justify-between gap-4">
                  Traffic pressure
                  <output className="font-mono font-semibold text-amber-800 dark:text-amber-300">{trafficMultiplier.toFixed(1)}x</output>
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="4"
                  step="0.25"
                  value={trafficMultiplier}
                  onChange={(event) => setTrafficMultiplier(Number(event.target.value))}
                  className="mt-3 w-full accent-amber-600"
                />
                <span className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>Quiet</span><span>Peak event</span></span>
              </label>
              <label className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                Unavailable component
                <select
                  value={failedNodeId}
                  onChange={(event) => setFailedNodeId(event.target.value)}
                  className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">No injected failure</option>
                  {nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
                </select>
              </label>
            </div>
          )}

          <div className="w-full min-w-0 overflow-x-auto p-3 sm:p-4" aria-label="Scrollable architecture canvas">
            <div
              ref={canvasRef}
              className="relative mx-auto h-[580px] w-[900px] overflow-hidden rounded-md border border-slate-300 bg-white shadow-inner dark:border-slate-700 dark:bg-slate-950"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgb(148 163 184 / 0.13) 1px, transparent 1px), linear-gradient(to bottom, rgb(148 163 184 / 0.13) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
              onClick={handleCanvasClick}
              onPointerMove={moveDrag}
              onPointerUp={() => setDrag(null)}
              onPointerLeave={() => setDrag(null)}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-8 items-center justify-between border-b border-slate-200 bg-white/95 px-3 text-[11px] font-semibold uppercase text-slate-500 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-400">
                <span>System canvas</span>
                <span>Arrow keys move selected nodes</span>
              </div>

              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
                aria-label={`${connections.length} architecture connections`}
              >
                <defs>
                  {connectionTypes.map((type) => (
                    <marker key={type.id} id={`architecture-arrow-${type.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={type.color} />
                    </marker>
                  ))}
                </defs>
                {connections.map((connection) => {
                  const source = nodes.find((node) => node.id === connection.from);
                  const target = nodes.find((node) => node.id === connection.to);
                  if (!source || !target) return null;
                  const type = connectionTypes.find((item) => item.id === connection.type) ?? connectionTypes[0];
                  const sourceX = source.x + source.width / 2;
                  const sourceY = source.y + source.height / 2;
                  const targetX = target.x + target.width / 2;
                  const targetY = target.y + target.height / 2;
                  const middleX = (sourceX + targetX) / 2;
                  const middleY = (sourceY + targetY) / 2;
                  const path = `M ${sourceX} ${sourceY} C ${middleX} ${sourceY}, ${middleX} ${targetY}, ${targetX} ${targetY}`;
                  const selected = selectedConnectionId === connection.id;
                  const failedPath = challengeMode && failedNodeId && (connection.from === failedNodeId || connection.to === failedNodeId);
                  const labelWidth = clamp(connection.label.length * 6.5 + 20, 54, 160);
                  return (
                    <g key={connection.id}>
                      <path
                        d={path}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="16"
                        className="pointer-events-auto cursor-pointer"
                        onClick={(event) => {
                          event.stopPropagation();
                          selectConnection(connection.id);
                        }}
                      />
                      {selected && <path d={path} fill="none" stroke="#0f172a" strokeWidth="7" opacity="0.2" className="pointer-events-none dark:stroke-white" />}
                      <path
                        d={path}
                        fill="none"
                        stroke={failedPath ? '#e11d48' : type.color}
                        strokeWidth={selected ? 3.5 : 2.5}
                        strokeDasharray={failedPath ? '5 5' : type.dash}
                        markerEnd={connection.bidirectional ? `url(#architecture-arrow-${type.id})` : `url(#architecture-arrow-${type.id})`}
                        markerStart={connection.bidirectional ? `url(#architecture-arrow-${type.id})` : undefined}
                        className="pointer-events-none"
                      />
                      {connection.label && (
                        <g className="pointer-events-none">
                          <rect x={middleX - labelWidth / 2} y={middleY - 11} width={labelWidth} height="22" rx="4" fill="white" stroke={selected ? type.color : '#cbd5e1'} className="dark:fill-slate-950 dark:stroke-slate-700" />
                          <text x={middleX} y={middleY + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor" className="text-slate-700 dark:text-slate-200">
                            {connection.label.length > 22 ? `${connection.label.slice(0, 21)}…` : connection.label}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>

              {nodes.map((node) => {
                const catalogItem = getCatalogItem(node.type);
                const Icon = catalogItem.icon;
                const selected = selectedNodeId === node.id;
                const connecting = connectionStartId === node.id;
                const failed = challengeMode && failedNodeId === node.id;
                const flagged = challengeMode && review.flaggedNodeIds.has(node.id);
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (didDrag.current) {
                        didDrag.current = false;
                        return;
                      }
                      selectNode(node.id);
                    }}
                    onPointerDown={(event) => startDrag(event, node)}
                    onKeyDown={(event) => handleNodeKeyDown(event, node)}
                    className={`absolute z-20 flex touch-none flex-col justify-between rounded-md border-2 bg-white p-2 text-left shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 dark:bg-slate-900 dark:focus-visible:ring-blue-800 ${
                      selected ? 'ring-4 ring-blue-200 dark:ring-blue-900' : ''
                    } ${connecting ? 'ring-4 ring-amber-300 dark:ring-amber-800' : ''} ${
                      failed ? 'border-rose-600 bg-rose-50 dark:border-rose-400 dark:bg-rose-950' : flagged ? 'border-amber-500 dark:border-amber-400' : ''
                    }`}
                    style={{
                      left: node.x,
                      top: node.y,
                      width: node.width,
                      height: node.height,
                      borderColor: failed || flagged ? undefined : selected ? '#2563eb' : catalogItem.color,
                    }}
                    aria-label={`${node.label}, ${boundaryLabels[node.boundary]} boundary${failed ? ', unavailable' : flagged ? ', review finding' : ''}`}
                    aria-pressed={selected || connecting}
                  >
                    <span className="flex w-full items-start justify-between gap-2">
                      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" style={{ color: catalogItem.color }} />
                      {failed ? <XCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" /> : flagged ? <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" /> : selected ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" /> : null}
                    </span>
                    <span className="block w-full truncate text-xs font-bold text-slate-950 dark:text-white">{node.label}</span>
                    <span className="block w-full truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      {boundaryLabels[node.boundary]} · {node.replicas} replica{node.replicas === 1 ? '' : 's'}
                    </span>
                  </button>
                );
              })}

              {nodes.length === 0 && (
                <div className="absolute inset-0 z-20 flex items-center justify-center p-8">
                  <div className="max-w-sm rounded-md border border-dashed border-slate-400 bg-white/95 p-6 text-center shadow-sm dark:border-slate-600 dark:bg-slate-900/95">
                    <Layers aria-hidden="true" className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-3 font-semibold">The canvas is empty</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Load a starting point or add a component to begin.</p>
                    <div className="mt-4 flex justify-center gap-2">
                      <button type="button" onClick={(event) => { event.stopPropagation(); loadTemplate(templates[0]); }} className="h-9 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        Load request path
                      </button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); addNode(); }} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:hover:bg-slate-800">
                        Add component
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0">
          <div className="grid min-h-[300px] gap-0 md:grid-cols-2 xl:block xl:min-h-[720px]">
            <div className="border-b border-slate-200 p-4 dark:border-slate-800 md:border-b-0 md:border-r xl:border-b xl:border-r-0">
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Inspector</p>
              <label className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Jump to connection
                <select
                  value={selectedConnectionId}
                  disabled={connections.length === 0}
                  onChange={(event) => {
                    if (event.target.value) selectConnection(event.target.value);
                    else setSelectedConnectionId('');
                  }}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <option value="">Select a connection</option>
                  {connections.map((connection) => {
                    const source = nodes.find((node) => node.id === connection.from);
                    const target = nodes.find((node) => node.id === connection.to);
                    return <option key={connection.id} value={connection.id}>{source?.label ?? 'Unknown'} to {target?.label ?? 'Unknown'}</option>;
                  })}
                </select>
              </label>
              {selectedNode && (
                <div className="mt-3 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">Component properties</p>
                    <button type="button" onClick={() => deleteNode(selectedNode.id)} className="rounded p-2 text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-rose-300 dark:hover:bg-rose-950" aria-label={`Delete ${selectedNode.label}`} title="Delete selected component">
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Label
                    <input value={selectedNode.label} onChange={(event) => updateNode(selectedNode.id, { label: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Responsibility
                    <textarea value={selectedNode.description} onChange={(event) => updateNode(selectedNode.id, { description: event.target.value })} rows={3} className="mt-1 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Trust boundary
                    <select value={selectedNode.boundary} onChange={(event) => updateNode(selectedNode.id, { boundary: event.target.value as Boundary })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                      {Object.entries(boundaryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Replicas
                      <input type="number" min="1" max="12" value={selectedNode.replicas} onChange={(event) => updateNode(selectedNode.id, { replicas: clamp(Number(event.target.value), 1, 12) })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                    </label>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Capacity
                      <input type="number" min="100" step="100" value={selectedNode.capacity} onChange={(event) => updateNode(selectedNode.id, { capacity: clamp(Number(event.target.value), 100, 50000) })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                    </label>
                  </div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Baseline load (req/s)
                    <input type="number" min="0" step="100" value={selectedNode.baseLoad} onChange={(event) => updateNode(selectedNode.id, { baseLoad: clamp(Number(event.target.value), 0, 50000) })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                  </label>
                  <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700">
                    <span>Required for core path</span>
                    <input type="checkbox" checked={selectedNode.critical} onChange={(event) => updateNode(selectedNode.id, { critical: event.target.checked })} className="h-4 w-4 accent-blue-600" />
                  </label>
                </div>
              )}

              {selectedConnection && (
                <div className="mt-3 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">Connection properties</p>
                    <button type="button" onClick={() => deleteConnection(selectedConnection.id)} className="rounded p-2 text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-rose-300 dark:hover:bg-rose-950" aria-label="Delete selected connection" title="Delete selected connection">
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Label
                    <input value={selectedConnection.label} onChange={(event) => updateConnection(selectedConnection.id, { label: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Contract
                    <select value={selectedConnection.type} onChange={(event) => updateConnection(selectedConnection.id, { type: event.target.value as ConnectionType })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                      {connectionTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                    </select>
                  </label>
                  <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700">
                    <span>Bidirectional path</span>
                    <input type="checkbox" checked={selectedConnection.bidirectional} onChange={(event) => updateConnection(selectedConnection.id, { bidirectional: event.target.checked })} className="h-4 w-4 accent-blue-600" />
                  </label>
                </div>
              )}

              {!selectedNode && !selectedConnection && (
                <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                  <MousePointer2 aria-hidden="true" className="h-5 w-5 text-slate-400" />
                  <p className="mt-2 text-sm font-semibold">Nothing selected</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Select a component or connection to edit its contract and capacity.</p>
                </div>
              )}
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Architecture review</p>
                {challengeMode && (
                  <button type="button" onClick={() => { setTrafficMultiplier(1); setFailedNodeId(''); }} className="rounded p-1.5 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Reset challenge" title="Reset challenge">
                    <RotateCcw aria-hidden="true" className="h-4 w-4" />
                  </button>
                )}
              </div>

              {!challengeMode ? (
                <div className="mt-3 rounded-md border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                  <ShieldAlert aria-hidden="true" className="h-5 w-5 text-rose-600 dark:text-rose-300" />
                  <p className="mt-2 text-sm font-semibold">Challenge the healthy path</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Switch to Challenge mode to raise traffic, fail a component, and surface resilience gaps.</p>
                  <button type="button" onClick={() => setChallengeMode(true)} className="mt-3 h-9 rounded-md bg-rose-600 px-3 text-sm font-semibold text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                    Start review
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className={`rounded-md border p-3 ${issueTone}`} role="status" aria-live="polite">
                    <div className="flex items-start gap-3">
                      {review.criticalCount ? <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : review.warningCount ? <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                      <div>
                        <p className="text-sm font-semibold">{review.criticalCount ? 'Critical design risk' : review.warningCount ? 'Review needed' : 'No modeled issues'}</p>
                        <p className="mt-1 text-xs leading-5 opacity-80">{review.criticalCount} critical · {review.warningCount} warning</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                      <Gauge aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                      <p className="mt-2 text-lg font-bold">{trafficMultiplier.toFixed(1)}x</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Traffic load</p>
                    </div>
                    <div className="rounded-md border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                      <Activity aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                      <p className="mt-2 text-lg font-bold">{review.flaggedNodeIds.size}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Nodes flagged</p>
                    </div>
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {review.issues.map((issue) => (
                      <button
                        key={issue.id}
                        type="button"
                        onClick={() => {
                          if (issue.nodeId) {
                            setSelectedNodeId(issue.nodeId);
                            setSelectedConnectionId('');
                          }
                        }}
                        className="w-full rounded-md border border-slate-300 bg-white p-3 text-left hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"
                      >
                        <span className={`block text-xs font-semibold ${issue.severity === 'critical' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`}>{issue.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{issue.detail}</span>
                      </button>
                    ))}
                    {review.issues.length === 0 && (
                      <p className="rounded-md border border-dashed border-emerald-300 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
                        The current model has no disconnected, unbounded, overloaded, failed, or single-replica critical components.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
