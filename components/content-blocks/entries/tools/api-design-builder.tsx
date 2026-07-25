'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Braces,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clipboard,
  Clock3,
  CloudCog,
  Code2,
  Copy,
  Download,
  Gauge,
  KeyRound,
  Layers3,
  LockKeyhole,
  Plus,
  RotateCcw,
  Server,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Unplug,
  Zap,
} from 'lucide-react';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type ParameterLocation = 'path' | 'query' | 'header';
type ParameterType = 'string' | 'integer' | 'boolean' | 'array';
type DeliveryMode = 'synchronous' | 'asynchronous';
type AuthMode = 'public' | 'user' | 'service' | 'admin';
type Challenge = 'baseline' | 'slow-dependency' | 'retry-storm' | 'launch-spike';

interface ApiParameter {
  id: string;
  name: string;
  location: ParameterLocation;
  type: ParameterType;
  required: boolean;
}

interface ApiResponse {
  id: string;
  statusCode: number;
  description: string;
}

interface ApiEndpoint {
  id: string;
  label: string;
  method: HttpMethod;
  path: string;
  description: string;
  auth: AuthMode;
  delivery: DeliveryMode;
  idempotencyKey: boolean;
  parameters: ApiParameter[];
  responses: ApiResponse[];
}

interface ContractIssue {
  id: string;
  severity: 'error' | 'warning';
  title: string;
  detail: string;
  endpointId?: string;
}

interface PressureState {
  requestsPerSecond: number;
  dependencyLatencyMs: number;
  retryPercent: number;
}

const METHOD_STYLES: Record<HttpMethod, string> = {
  GET: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  POST: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200',
  PUT: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100',
  PATCH: 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200',
  DELETE: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
};

const CHALLENGES: Array<{
  id: Challenge;
  label: string;
  description: string;
  icon: typeof Gauge;
  values: PressureState;
}> = [
  {
    id: 'baseline',
    label: 'Normal traffic',
    description: 'Steady demand and a healthy dependency.',
    icon: CheckCircle2,
    values: { requestsPerSecond: 1200, dependencyLatencyMs: 80, retryPercent: 2 },
  },
  {
    id: 'slow-dependency',
    label: 'Slow dependency',
    description: 'The inventory service misses its latency budget.',
    icon: Clock3,
    values: { requestsPerSecond: 1200, dependencyLatencyMs: 680, retryPercent: 8 },
  },
  {
    id: 'retry-storm',
    label: 'Retry storm',
    description: 'Clients amplify a partial failure with unbounded retries.',
    icon: RotateCcw,
    values: { requestsPerSecond: 3600, dependencyLatencyMs: 420, retryPercent: 68 },
  },
  {
    id: 'launch-spike',
    label: 'Launch spike',
    description: 'Traffic jumps before the service has scaled out.',
    icon: Zap,
    values: { requestsPerSecond: 12000, dependencyLatencyMs: 170, retryPercent: 14 },
  },
];

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const PARAMETER_LOCATIONS: ParameterLocation[] = ['path', 'query', 'header'];
const PARAMETER_TYPES: ParameterType[] = ['string', 'integer', 'boolean', 'array'];
const STATUS_CODES = [
  { value: 200, label: '200 OK' },
  { value: 201, label: '201 Created' },
  { value: 202, label: '202 Accepted' },
  { value: 204, label: '204 No Content' },
  { value: 400, label: '400 Bad Request' },
  { value: 401, label: '401 Unauthorized' },
  { value: 404, label: '404 Not Found' },
  { value: 409, label: '409 Conflict' },
  { value: 422, label: '422 Unprocessable Entity' },
  { value: 429, label: '429 Too Many Requests' },
  { value: 500, label: '500 Internal Server Error' },
] as const;

const INITIAL_ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'create-order',
    label: 'Create order',
    method: 'POST',
    path: '/orders',
    description: 'Accept a validated order and return its durable identity.',
    auth: 'user',
    delivery: 'synchronous',
    idempotencyKey: true,
    parameters: [
      {
        id: 'tenant-header',
        name: 'X-Tenant-Id',
        location: 'header',
        type: 'string',
        required: true,
      },
    ],
    responses: [
      { id: 'created-response', statusCode: 201, description: 'Order created' },
      { id: 'conflict-response', statusCode: 409, description: 'Duplicate order key' },
      { id: 'validation-response', statusCode: 422, description: 'Order failed validation' },
    ],
  },
  {
    id: 'get-order',
    label: 'Get order',
    method: 'GET',
    path: '/orders/{orderId}',
    description: 'Return the current representation of one order.',
    auth: 'user',
    delivery: 'synchronous',
    idempotencyKey: false,
    parameters: [
      {
        id: 'order-id-path',
        name: 'orderId',
        location: 'path',
        type: 'string',
        required: true,
      },
    ],
    responses: [
      { id: 'order-response', statusCode: 200, description: 'Order found' },
      { id: 'missing-response', statusCode: 404, description: 'Order not found' },
    ],
  },
];

let generatedId = 0;

function nextId(prefix: string) {
  generatedId += 1;
  return `${prefix}-${generatedId}`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function describeStatus(statusCode: number) {
  return STATUS_CODES.find((status) => status.value === statusCode)?.label.split(' ').slice(1).join(' ')
    ?? 'Response';
}

function buildOpenApiDocument(apiName: string, version: string, endpoints: ApiEndpoint[]) {
  const paths: Record<string, Record<string, unknown>> = {};

  endpoints.forEach((endpoint) => {
    const operation: Record<string, unknown> = {
      operationId: endpoint.label
        .trim()
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, character: string) => character.toUpperCase())
        .replace(/^[A-Z]/, (character) => character.toLowerCase()) || 'unnamedOperation',
      summary: endpoint.description || endpoint.label,
      security: endpoint.auth === 'public' ? [] : [{ oauth2: [endpoint.auth] }],
      parameters: endpoint.parameters.map((parameter) => ({
        name: parameter.name,
        in: parameter.location,
        required: parameter.location === 'path' ? true : parameter.required,
        schema: { type: parameter.type },
      })),
      responses: Object.fromEntries(
        endpoint.responses.map((response) => [
          response.statusCode.toString(),
          { description: response.description || describeStatus(response.statusCode) },
        ]),
      ),
      'x-delivery-mode': endpoint.delivery,
    };

    if (endpoint.idempotencyKey) {
      operation.parameters = [
        ...(operation.parameters as Array<Record<string, unknown>>),
        {
          name: 'Idempotency-Key',
          in: 'header',
          required: true,
          schema: { type: 'string' },
        },
      ];
    }

    paths[endpoint.path || '/'] ??= {};
    paths[endpoint.path || '/'][endpoint.method.toLowerCase()] = operation;
  });

  return {
    openapi: '3.1.0',
    info: {
      title: apiName || 'Untitled API',
      version: version || '0.0.0',
    },
    servers: [{ url: 'https://api.example.com' }],
    paths,
  };
}

function validateContract(endpoints: ApiEndpoint[], apiName: string): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const operationKeys = new Map<string, string>();

  if (!apiName.trim()) {
    issues.push({
      id: 'missing-api-name',
      severity: 'error',
      title: 'Name the contract',
      detail: 'Clients need a stable API identity in generated documentation.',
    });
  }

  if (endpoints.length === 0) {
    issues.push({
      id: 'missing-endpoint',
      severity: 'error',
      title: 'Add at least one operation',
      detail: 'An API contract without an operation cannot describe a usable workflow.',
    });
  }

  endpoints.forEach((endpoint) => {
    const operationKey = `${endpoint.method} ${endpoint.path.trim()}`;
    const duplicateId = operationKeys.get(operationKey);

    if (!endpoint.path.startsWith('/')) {
      issues.push({
        id: `${endpoint.id}-path-prefix`,
        severity: 'error',
        title: 'Path must start with /',
        detail: `${endpoint.method} ${endpoint.path || '(empty path)'} is not a valid resource path.`,
        endpointId: endpoint.id,
      });
    }

    if (duplicateId) {
      issues.push({
        id: `${endpoint.id}-duplicate`,
        severity: 'error',
        title: 'Duplicate operation',
        detail: `${operationKey} already exists. A method and path must identify one operation.`,
        endpointId: endpoint.id,
      });
    } else {
      operationKeys.set(operationKey, endpoint.id);
    }

    const referencedPathParameters = Array.from(endpoint.path.matchAll(/{([^}]+)}/g)).map(
      (match) => match[1],
    );
    const declaredPathParameters = endpoint.parameters
      .filter((parameter) => parameter.location === 'path')
      .map((parameter) => parameter.name);

    referencedPathParameters.forEach((parameterName) => {
      if (!declaredPathParameters.includes(parameterName)) {
        issues.push({
          id: `${endpoint.id}-missing-${parameterName}`,
          severity: 'error',
          title: `Declare {${parameterName}}`,
          detail: 'Every path token needs a required path parameter in the contract.',
          endpointId: endpoint.id,
        });
      }
    });

    declaredPathParameters.forEach((parameterName) => {
      if (!referencedPathParameters.includes(parameterName)) {
        issues.push({
          id: `${endpoint.id}-unused-${parameterName}`,
          severity: 'warning',
          title: `Remove unused path parameter ${parameterName}`,
          detail: 'The parameter is declared as part of the path but does not appear in the path.',
          endpointId: endpoint.id,
        });
      }
    });

    const hasSuccessResponse = endpoint.responses.some(
      (response) => response.statusCode >= 200 && response.statusCode < 300,
    );
    if (!hasSuccessResponse) {
      issues.push({
        id: `${endpoint.id}-success`,
        severity: 'error',
        title: 'Define a success response',
        detail: 'Clients cannot distinguish a completed operation without a 2xx response.',
        endpointId: endpoint.id,
      });
    }

    if (endpoint.delivery === 'asynchronous' && !endpoint.responses.some((response) => response.statusCode === 202)) {
      issues.push({
        id: `${endpoint.id}-accepted`,
        severity: 'warning',
        title: 'Return 202 for accepted work',
        detail: 'An asynchronous operation should distinguish acceptance from completion.',
        endpointId: endpoint.id,
      });
    }

    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(endpoint.method);
    if (isWrite && endpoint.auth === 'public') {
      issues.push({
        id: `${endpoint.id}-public-write`,
        severity: 'error',
        title: 'Public write boundary',
        detail: 'A public mutation needs an explicit abuse and authorization decision.',
        endpointId: endpoint.id,
      });
    }

    if (isWrite && !endpoint.idempotencyKey) {
      issues.push({
        id: `${endpoint.id}-idempotency`,
        severity: 'warning',
        title: 'Retries can repeat the write',
        detail: 'Require an idempotency key or document why duplicate side effects are safe.',
        endpointId: endpoint.id,
      });
    }
  });

  return issues;
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
      {children}
    </label>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-white"
    >
      {children}
    </button>
  );
}

export default function ApiDesignBuilder() {
  const [apiName, setApiName] = useState('Orders API');
  const [apiVersion, setApiVersion] = useState('1.0.0');
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>(INITIAL_ENDPOINTS);
  const [selectedEndpointId, setSelectedEndpointId] = useState(INITIAL_ENDPOINTS[0].id);
  const [challenge, setChallenge] = useState<Challenge | 'custom'>('baseline');
  const [pressure, setPressure] = useState<PressureState>(CHALLENGES[0].values);
  const [activeInspector, setActiveInspector] = useState<'readiness' | 'openapi'>('readiness');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const selectedEndpoint = endpoints.find((endpoint) => endpoint.id === selectedEndpointId);
  const issues = useMemo(() => validateContract(endpoints, apiName), [apiName, endpoints]);
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  const openApiDocument = useMemo(
    () => buildOpenApiDocument(apiName, apiVersion, endpoints),
    [apiName, apiVersion, endpoints],
  );
  const openApiJson = useMemo(() => JSON.stringify(openApiDocument, null, 2), [openApiDocument]);

  const operationalForecast = useMemo(() => {
    const retryRps = pressure.requestsPerSecond * (pressure.retryPercent / 100);
    const effectiveRps = pressure.requestsPerSecond + retryRps;
    const concurrentRequests = effectiveRps * (pressure.dependencyLatencyMs / 1000);
    const concurrencyLimit = selectedEndpoint?.delivery === 'asynchronous' ? 1800 : 520;
    const saturation = concurrentRequests / concurrencyLimit;
    const queueDelayMs = saturation <= 0.72
      ? 8
      : Math.round((saturation - 0.72) * pressure.dependencyLatencyMs * 2.4);
    const estimatedP99Ms = Math.round(pressure.dependencyLatencyMs + Math.max(0, queueDelayMs));
    const status = saturation >= 1.15
      ? 'overloaded'
      : saturation >= 0.78 || estimatedP99Ms > 500
        ? 'degraded'
        : 'healthy';
    const availability = clamp(
      99.99 - Math.max(0, saturation - 0.7) * 3.2 - pressure.retryPercent * 0.008,
      91,
      99.99,
    );

    return {
      retryRps,
      effectiveRps,
      concurrentRequests,
      saturation,
      estimatedP99Ms,
      status,
      availability,
    };
  }, [pressure, selectedEndpoint?.delivery]);

  const readinessScore = clamp(100 - errors.length * 24 - warnings.length * 9, 0, 100);
  const selectedIssues = issues.filter(
    (issue) => !issue.endpointId || issue.endpointId === selectedEndpointId,
  );

  const updateEndpoint = (updates: Partial<ApiEndpoint>) => {
    if (!selectedEndpoint) return;
    setEndpoints((current) =>
      current.map((endpoint) =>
        endpoint.id === selectedEndpoint.id ? { ...endpoint, ...updates } : endpoint,
      ),
    );
  };

  const addEndpoint = () => {
    const endpointId = nextId('endpoint');
    const endpoint: ApiEndpoint = {
      id: endpointId,
      label: 'New operation',
      method: 'GET',
      path: '/resources/{resourceId}',
      description: 'Describe the client-visible outcome.',
      auth: 'user',
      delivery: 'synchronous',
      idempotencyKey: false,
      parameters: [],
      responses: [{ id: nextId('response'), statusCode: 200, description: 'Successful response' }],
    };

    setEndpoints((current) => [...current, endpoint]);
    setSelectedEndpointId(endpointId);
    setActiveInspector('readiness');
  };

  const duplicateEndpoint = () => {
    if (!selectedEndpoint) return;
    const endpointId = nextId('endpoint');
    setEndpoints((current) => [
      ...current,
      {
        ...selectedEndpoint,
        id: endpointId,
        label: `${selectedEndpoint.label} copy`,
        parameters: selectedEndpoint.parameters.map((parameter) => ({
          ...parameter,
          id: nextId('parameter'),
        })),
        responses: selectedEndpoint.responses.map((response) => ({
          ...response,
          id: nextId('response'),
        })),
      },
    ]);
    setSelectedEndpointId(endpointId);
    setActiveInspector('readiness');
  };

  const deleteEndpoint = (endpointId: string) => {
    setEndpoints((current) => {
      const remaining = current.filter((endpoint) => endpoint.id !== endpointId);
      if (selectedEndpointId === endpointId) {
        setSelectedEndpointId(remaining[0]?.id ?? '');
      }
      return remaining;
    });
  };

  const addParameter = () => {
    if (!selectedEndpoint) return;
    updateEndpoint({
      parameters: [
        ...selectedEndpoint.parameters,
        {
          id: nextId('parameter'),
          name: 'parameterName',
          location: 'query',
          type: 'string',
          required: false,
        },
      ],
    });
  };

  const updateParameter = (parameterId: string, updates: Partial<ApiParameter>) => {
    if (!selectedEndpoint) return;
    updateEndpoint({
      parameters: selectedEndpoint.parameters.map((parameter) =>
        parameter.id === parameterId ? { ...parameter, ...updates } : parameter,
      ),
    });
  };

  const deleteParameter = (parameterId: string) => {
    if (!selectedEndpoint) return;
    updateEndpoint({
      parameters: selectedEndpoint.parameters.filter((parameter) => parameter.id !== parameterId),
    });
  };

  const addResponse = () => {
    if (!selectedEndpoint) return;
    updateEndpoint({
      responses: [
        ...selectedEndpoint.responses,
        {
          id: nextId('response'),
          statusCode: 200,
          description: 'Successful response',
        },
      ],
    });
  };

  const updateResponse = (responseId: string, updates: Partial<ApiResponse>) => {
    if (!selectedEndpoint) return;
    updateEndpoint({
      responses: selectedEndpoint.responses.map((response) =>
        response.id === responseId ? { ...response, ...updates } : response,
      ),
    });
  };

  const deleteResponse = (responseId: string) => {
    if (!selectedEndpoint) return;
    updateEndpoint({
      responses: selectedEndpoint.responses.filter((response) => response.id !== responseId),
    });
  };

  const applyChallenge = (nextChallenge: Challenge) => {
    const scenario = CHALLENGES.find((item) => item.id === nextChallenge) ?? CHALLENGES[0];
    setChallenge(nextChallenge);
    setPressure(scenario.values);
  };

  const updatePressure = (updates: Partial<PressureState>) => {
    setChallenge('custom');
    setPressure((current) => ({ ...current, ...updates }));
  };

  const copySpec = async () => {
    try {
      await navigator.clipboard.writeText(openApiJson);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1600);
    } catch {
      setCopyState('failed');
      window.setTimeout(() => setCopyState('idle'), 2200);
    }
  };

  const downloadSpec = () => {
    const blob = new Blob([openApiJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${apiName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'api'}-openapi.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const inputClassName =
    'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-blue-400';

  return (
    <section
      data-content-block="tools/api-design-builder"
      className="not-prose w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <header className="border-b border-zinc-800 bg-zinc-950 px-4 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-cyan-300">
              <Braces className="size-4" aria-hidden="true" />
              Contract workbench
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl">Design the behavior clients depend on</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300 sm:text-base">
              Shape each operation, validate retry and response semantics, then pressure-test the
              request path before publishing the contract.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              aria-live="polite"
              className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                errors.length > 0
                  ? 'border-rose-700 bg-rose-950 text-rose-100'
                  : warnings.length > 0
                    ? 'border-amber-700 bg-amber-950 text-amber-100'
                    : 'border-emerald-700 bg-emerald-950 text-emerald-100'
              }`}
            >
              {errors.length > 0 ? (
                <TriangleAlert className="size-4" aria-hidden="true" />
              ) : (
                <ShieldCheck className="size-4" aria-hidden="true" />
              )}
              {errors.length > 0
                ? `${errors.length} blocking ${errors.length === 1 ? 'issue' : 'issues'}`
                : warnings.length > 0
                  ? `${warnings.length} design ${warnings.length === 1 ? 'warning' : 'warnings'}`
                  : 'Ready to publish'}
            </div>
            <button
              type="button"
              onClick={downloadSpec}
              disabled={endpoints.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-3.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="size-4" aria-hidden="true" />
              Export OpenAPI
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-w-0 xl:grid-cols-[15rem_minmax(0,1fr)_20rem]">
        <aside className="min-w-0 border-b border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/45 xl:border-b-0 xl:border-r">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div>
              <FieldLabel htmlFor="api-name">API name</FieldLabel>
              <input
                id="api-name"
                value={apiName}
                onChange={(event) => setApiName(event.target.value)}
                className={inputClassName}
                placeholder="Orders API"
              />
            </div>
            <div>
              <FieldLabel htmlFor="api-version">Version</FieldLabel>
              <input
                id="api-version"
                value={apiVersion}
                onChange={(event) => setApiVersion(event.target.value)}
                className={inputClassName}
                placeholder="1.0.0"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-100">Operations</h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {endpoints.length} in this contract
              </p>
            </div>
            <IconButton label="Add operation" onClick={addEndpoint}>
              <Plus className="size-4" aria-hidden="true" />
            </IconButton>
          </div>

          <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:max-h-[34rem] xl:grid-cols-1">
            {endpoints.map((endpoint) => {
              const endpointIssueCount = issues.filter(
                (issue) => issue.endpointId === endpoint.id,
              ).length;
              const selected = endpoint.id === selectedEndpointId;

              return (
                <button
                  key={endpoint.id}
                  type="button"
                  onClick={() => setSelectedEndpointId(endpoint.id)}
                  aria-pressed={selected}
                  className={`min-w-0 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    selected
                      ? 'border-blue-600 bg-blue-600 text-white shadow-sm dark:border-blue-400 dark:bg-blue-400 dark:text-zinc-950'
                      : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-600'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${selected ? 'border-white/40 bg-white/15 text-current dark:border-zinc-950/30 dark:bg-zinc-950/10' : METHOD_STYLES[endpoint.method]}`}>
                      {endpoint.method}
                    </span>
                    {endpointIssueCount > 0 ? (
                      <span className={`flex items-center gap-1 text-xs font-semibold ${selected ? 'text-white dark:text-zinc-950' : 'text-rose-600 dark:text-rose-300'}`}>
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                        {endpointIssueCount}
                      </span>
                    ) : (
                      <Check className={`size-4 ${selected ? 'text-white dark:text-zinc-950' : 'text-emerald-600 dark:text-emerald-400'}`} aria-label="Valid operation" />
                    )}
                  </span>
                  <span className="mt-2 block truncate text-sm font-semibold">{endpoint.label}</span>
                  <span className={`mt-1 block truncate font-mono text-xs ${selected ? 'text-blue-100 dark:text-zinc-800' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {endpoint.path || '(empty path)'}
                  </span>
                </button>
              );
            })}

            {endpoints.length === 0 && (
              <div className="rounded-md border border-dashed border-zinc-300 px-4 py-7 text-center dark:border-zinc-700">
                <Unplug className="mx-auto size-6 text-zinc-400" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  No operations yet
                </p>
                <button
                  type="button"
                  onClick={addEndpoint}
                  className="mt-3 text-sm font-semibold text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300"
                >
                  Create the first operation
                </button>
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 bg-white dark:bg-zinc-950">
          {selectedEndpoint ? (
            <>
              <div className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">
                      Contract loop
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-zinc-950 dark:text-zinc-100">
                      Shape the operation
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                      Every choice updates validation and the generated OpenAPI document.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <IconButton label="Duplicate operation" onClick={duplicateEndpoint}>
                      <Copy className="size-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label="Delete operation"
                      onClick={() => deleteEndpoint(selectedEndpoint.id)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </IconButton>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[9rem_minmax(0,1fr)]">
                  <div>
                    <FieldLabel htmlFor="endpoint-method">Method</FieldLabel>
                    <select
                      id="endpoint-method"
                      value={selectedEndpoint.method}
                      onChange={(event) =>
                        updateEndpoint({ method: event.target.value as HttpMethod })
                      }
                      className={inputClassName}
                    >
                      {HTTP_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel htmlFor="endpoint-path">Resource path</FieldLabel>
                    <input
                      id="endpoint-path"
                      value={selectedEndpoint.path}
                      onChange={(event) => updateEndpoint({ path: event.target.value })}
                      className={`${inputClassName} font-mono`}
                      placeholder="/orders/{orderId}"
                      spellCheck={false}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel htmlFor="endpoint-label">Operation name</FieldLabel>
                    <input
                      id="endpoint-label"
                      value={selectedEndpoint.label}
                      onChange={(event) => updateEndpoint({ label: event.target.value })}
                      className={inputClassName}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel htmlFor="endpoint-description">Client-visible outcome</FieldLabel>
                    <textarea
                      id="endpoint-description"
                      value={selectedEndpoint.description}
                      onChange={(event) => updateEndpoint({ description: event.target.value })}
                      className={`${inputClassName} min-h-20 resize-y py-2.5`}
                    />
                  </div>
                </div>
              </div>

              <div className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800 sm:px-6">
                <h4 className="text-base font-bold text-zinc-950 dark:text-zinc-100">
                  Execution contract
                </h4>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <fieldset>
                    <legend className="mb-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Delivery
                    </legend>
                    <div className="grid grid-cols-2 gap-1 rounded-md bg-zinc-100 p-1 dark:bg-zinc-900">
                      {(['synchronous', 'asynchronous'] as DeliveryMode[]).map((mode) => {
                        const selected = selectedEndpoint.delivery === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => updateEndpoint({ delivery: mode })}
                            aria-pressed={selected}
                            className={`min-h-9 rounded px-2 text-xs font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                              selected
                                ? 'bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950'
                                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100'
                            }`}
                          >
                            {mode === 'synchronous' ? 'Sync' : 'Async'}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <div>
                    <FieldLabel htmlFor="endpoint-auth">Authorization boundary</FieldLabel>
                    <select
                      id="endpoint-auth"
                      value={selectedEndpoint.auth}
                      onChange={(event) => updateEndpoint({ auth: event.target.value as AuthMode })}
                      className={inputClassName}
                    >
                      <option value="public">Public</option>
                      <option value="user">Authenticated user</option>
                      <option value="service">Trusted service</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <label className="flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        Idempotency key
                      </span>
                      <span className="mt-0.5 block text-xs leading-4 text-zinc-500 dark:text-zinc-400">
                        Deduplicate retried writes
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedEndpoint.idempotencyKey}
                      onChange={(event) =>
                        updateEndpoint({ idempotencyKey: event.target.checked })
                      }
                      className="size-4 accent-blue-600"
                    />
                  </label>
                </div>
              </div>

              <div className="border-b border-zinc-200 dark:border-zinc-800">
                <section className="min-w-0 border-b border-zinc-200 px-4 py-5 dark:border-zinc-800 sm:px-6">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-base font-bold text-zinc-950 dark:text-zinc-100">
                        Parameters
                      </h4>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        Path, query, and header inputs
                      </p>
                    </div>
                    <IconButton label="Add parameter" onClick={addParameter}>
                      <Plus className="size-4" aria-hidden="true" />
                    </IconButton>
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedEndpoint.parameters.map((parameter) => (
                      <div
                        key={parameter.id}
                        className="grid min-w-0 gap-2 border-b border-zinc-200 pb-3 last:border-b-0 last:pb-0 dark:border-zinc-800 sm:grid-cols-[minmax(0,1fr)_7.5rem]"
                      >
                        <input
                          aria-label="Parameter name"
                          value={parameter.name}
                          onChange={(event) =>
                            updateParameter(parameter.id, { name: event.target.value })
                          }
                          className={`${inputClassName} min-w-0 font-mono`}
                        />
                        <select
                          aria-label="Parameter location"
                          value={parameter.location}
                          onChange={(event) =>
                            updateParameter(parameter.id, {
                              location: event.target.value as ParameterLocation,
                            })
                          }
                          className={inputClassName}
                        >
                          {PARAMETER_LOCATIONS.map((location) => (
                            <option key={location} value={location}>
                              {location}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Parameter type"
                          value={parameter.type}
                          onChange={(event) =>
                            updateParameter(parameter.id, {
                              type: event.target.value as ParameterType,
                            })
                          }
                          className={inputClassName}
                        >
                          {PARAMETER_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            <input
                              type="checkbox"
                              checked={parameter.required}
                              onChange={(event) =>
                                updateParameter(parameter.id, { required: event.target.checked })
                              }
                              className="size-4 accent-blue-600"
                            />
                            Required
                          </label>
                          <IconButton
                            label={`Delete ${parameter.name || 'parameter'}`}
                            onClick={() => deleteParameter(parameter.id)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </IconButton>
                        </div>
                      </div>
                    ))}

                    {selectedEndpoint.parameters.length === 0 && (
                      <p className="rounded-md border border-dashed border-zinc-300 px-3 py-5 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                        No parameters. Path tokens such as <code>{'{orderId}'}</code> must be
                        declared here.
                      </p>
                    )}
                  </div>
                </section>

                <section className="min-w-0 px-4 py-5 sm:px-6">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-base font-bold text-zinc-950 dark:text-zinc-100">
                        Responses
                      </h4>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        Observable outcomes for clients
                      </p>
                    </div>
                    <IconButton label="Add response" onClick={addResponse}>
                      <Plus className="size-4" aria-hidden="true" />
                    </IconButton>
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedEndpoint.responses.map((response) => (
                      <div
                        key={response.id}
                        className="grid min-w-0 gap-2 border-b border-zinc-200 pb-3 last:border-b-0 last:pb-0 dark:border-zinc-800 sm:grid-cols-[8.5rem_minmax(0,1fr)_2.25rem]"
                      >
                        <select
                          aria-label="Response status"
                          value={response.statusCode}
                          onChange={(event) =>
                            updateResponse(response.id, {
                              statusCode: Number(event.target.value),
                            })
                          }
                          className={inputClassName}
                        >
                          {STATUS_CODES.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label="Response description"
                          value={response.description}
                          onChange={(event) =>
                            updateResponse(response.id, { description: event.target.value })
                          }
                          className={`${inputClassName} min-w-0`}
                        />
                        <IconButton
                          label={`Delete ${response.statusCode} response`}
                          onClick={() => deleteResponse(response.id)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </IconButton>
                      </div>
                    ))}

                    {selectedEndpoint.responses.length === 0 && (
                      <p className="rounded-md border border-dashed border-rose-300 bg-rose-50 px-3 py-5 text-center text-sm font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                        This operation has no observable outcome. Add a success and a failure
                        response.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <section className="px-4 py-5 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">
                      Pressure loop
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-zinc-950 dark:text-zinc-100">
                      Challenge the request path
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                      Inject demand and dependency failure to expose unsafe retry behavior.
                    </p>
                  </div>
                  <div
                    aria-live="polite"
                    className={`inline-flex h-9 items-center gap-2 self-start rounded-md border px-3 text-xs font-bold uppercase ${
                      operationalForecast.status === 'healthy'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                        : operationalForecast.status === 'degraded'
                          ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100'
                          : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
                    }`}
                  >
                    <CircleDot className="size-3.5" aria-hidden="true" />
                    {operationalForecast.status}
                  </div>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {CHALLENGES.map((scenario) => {
                    const ScenarioIcon = scenario.icon;
                    const selected = challenge === scenario.id;
                    return (
                      <button
                        key={scenario.id}
                        type="button"
                        onClick={() => applyChallenge(scenario.id)}
                        aria-pressed={selected}
                        className={`min-h-[5.5rem] rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                          selected
                            ? 'border-violet-600 bg-violet-600 text-white shadow-sm dark:border-violet-400 dark:bg-violet-400 dark:text-zinc-950'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600'
                        }`}
                      >
                        <span className="flex items-center gap-2 text-sm font-bold">
                          <ScenarioIcon className="size-4" aria-hidden="true" />
                          {scenario.label}
                        </span>
                        <span className={`mt-1.5 block text-xs leading-5 ${selected ? 'text-violet-100 dark:text-zinc-800' : 'text-zinc-500 dark:text-zinc-400'}`}>
                          {scenario.description}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-3">
                  <label className="block">
                    <span className="flex items-center justify-between gap-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Client traffic
                      <output className="font-mono text-zinc-950 dark:text-zinc-100">
                        {formatNumber(pressure.requestsPerSecond)} rps
                      </output>
                    </span>
                    <input
                      type="range"
                      min={100}
                      max={15000}
                      step={100}
                      value={pressure.requestsPerSecond}
                      onChange={(event) =>
                        updatePressure({ requestsPerSecond: Number(event.target.value) })
                      }
                      className="mt-3 w-full accent-blue-600"
                    />
                  </label>
                  <label className="block">
                    <span className="flex items-center justify-between gap-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Dependency p99
                      <output className="font-mono text-zinc-950 dark:text-zinc-100">
                        {pressure.dependencyLatencyMs} ms
                      </output>
                    </span>
                    <input
                      type="range"
                      min={20}
                      max={1000}
                      step={10}
                      value={pressure.dependencyLatencyMs}
                      onChange={(event) =>
                        updatePressure({ dependencyLatencyMs: Number(event.target.value) })
                      }
                      className="mt-3 w-full accent-amber-500"
                    />
                  </label>
                  <label className="block">
                    <span className="flex items-center justify-between gap-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Requests retried
                      <output className="font-mono text-zinc-950 dark:text-zinc-100">
                        {pressure.retryPercent}%
                      </output>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={80}
                      step={1}
                      value={pressure.retryPercent}
                      onChange={(event) =>
                        updatePressure({ retryPercent: Number(event.target.value) })
                      }
                      className="mt-3 w-full accent-rose-600"
                    />
                  </label>
                </div>

                <div className="mt-6 overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="grid min-w-[25.5rem] grid-cols-[minmax(7.5rem,1fr)_1.5rem_minmax(7.5rem,1fr)_1.5rem_minmax(7.5rem,1fr)] items-stretch p-4">
                    <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-blue-950 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-100">
                      <Activity className="size-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                      <p className="mt-2 text-xs font-semibold uppercase">Clients</p>
                      <p className="mt-1 text-lg font-bold">{formatNumber(pressure.requestsPerSecond)} rps</p>
                      <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
                        +{formatNumber(operationalForecast.retryRps)} retry rps
                      </p>
                    </div>
                    <div className="flex items-center justify-center text-zinc-400" aria-hidden="true">
                      <ChevronRight className="size-5" />
                    </div>
                    <div className={`rounded-md border p-3 ${
                      operationalForecast.status === 'overloaded'
                        ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100'
                        : 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100'
                    }`}>
                      <Server className="size-5 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                      <p className="mt-2 text-xs font-semibold uppercase">API service</p>
                      <p className="mt-1 text-lg font-bold">
                        {Math.round(operationalForecast.saturation * 100)}% saturated
                      </p>
                      <p className="mt-1 text-xs opacity-80">
                        {formatNumber(operationalForecast.concurrentRequests)} in flight
                      </p>
                    </div>
                    <div className="flex items-center justify-center text-zinc-400" aria-hidden="true">
                      <ChevronRight className="size-5" />
                    </div>
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
                      <CloudCog className="size-5 text-amber-600 dark:text-amber-300" aria-hidden="true" />
                      <p className="mt-2 text-xs font-semibold uppercase">Dependency</p>
                      <p className="mt-1 text-lg font-bold">{pressure.dependencyLatencyMs} ms</p>
                      <p className="mt-1 text-xs opacity-80">Inventory and payment path</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-4">
                  {[
                    {
                      label: 'Effective load',
                      value: `${formatNumber(operationalForecast.effectiveRps)} rps`,
                      icon: Gauge,
                    },
                    {
                      label: 'Estimated p99',
                      value: `${formatNumber(operationalForecast.estimatedP99Ms)} ms`,
                      icon: Clock3,
                    },
                    {
                      label: 'Availability',
                      value: `${operationalForecast.availability.toFixed(2)}%`,
                      icon: ShieldCheck,
                    },
                    {
                      label: 'Contract readiness',
                      value: `${readinessScore}%`,
                      icon: Clipboard,
                    },
                  ].map((metric) => {
                    const MetricIcon = metric.icon;
                    return (
                      <div key={metric.label} className="min-h-24 bg-white p-3 dark:bg-zinc-950">
                        <MetricIcon className="size-4 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
                        <p className="mt-2 text-lg font-bold text-zinc-950 dark:text-zinc-100">
                          {metric.value}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {metric.label}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {operationalForecast.status !== 'healthy' && (
                  <div
                    role="status"
                    className={`mt-4 flex items-start gap-3 rounded-md border p-4 ${
                      operationalForecast.status === 'overloaded'
                        ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
                        : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                    }`}
                  >
                    <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-bold">
                        {operationalForecast.status === 'overloaded'
                          ? 'The service cannot drain work as fast as clients create it.'
                          : 'The request path is consuming most of its latency and concurrency budget.'}
                      </p>
                      <p className="mt-1 text-sm leading-6 opacity-85">
                        {selectedEndpoint.delivery === 'asynchronous'
                          ? 'Keep 202 acceptance fast, expose job status, and bound worker retries with a dead-letter path.'
                          : 'Add a timeout shorter than the client deadline, exponential backoff with jitter, and an idempotency key for retried writes.'}
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="flex min-h-[32rem] items-center justify-center px-6 py-14 text-center">
              <div className="max-w-sm">
                <Code2 className="mx-auto size-10 text-zinc-400" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-bold text-zinc-950 dark:text-zinc-100">
                  Start with a client operation
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  Add an operation, then define the path, authorization boundary, responses, and
                  retry semantics that clients can rely on.
                </p>
                <button
                  type="button"
                  onClick={addEndpoint}
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-blue-500 dark:text-zinc-950 dark:hover:bg-blue-400"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add operation
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="min-w-0 border-t border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/45 xl:border-l xl:border-t-0">
          <div className="grid grid-cols-2 border-b border-zinc-200 dark:border-zinc-800">
            {[
              { id: 'readiness' as const, label: 'Readiness', icon: ShieldCheck },
              { id: 'openapi' as const, label: 'OpenAPI', icon: Braces },
            ].map((tab) => {
              const TabIcon = tab.icon;
              const selected = activeInspector === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveInspector(tab.id)}
                  aria-pressed={selected}
                  className={`flex h-12 items-center justify-center gap-2 border-b-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                    selected
                      ? 'border-blue-600 bg-white text-blue-800 dark:border-blue-400 dark:bg-zinc-950 dark:text-blue-200'
                      : 'border-transparent text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                  }`}
                >
                  <TabIcon className="size-4" aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeInspector === 'readiness' ? (
            <div className="p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                    Contract score
                  </p>
                  <p className="mt-1 text-3xl font-bold text-zinc-950 dark:text-zinc-100">
                    {readinessScore}
                    <span className="text-base text-zinc-500">/100</span>
                  </p>
                </div>
                <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                  <p>{errors.length} errors</p>
                  <p>{warnings.length} warnings</p>
                </div>
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800"
                aria-label={`Contract readiness ${readinessScore} percent`}
              >
                <div
                  className={`h-full transition-[width] ${
                    readinessScore >= 90
                      ? 'bg-emerald-500'
                      : readinessScore >= 60
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                  }`}
                  style={{ width: `${readinessScore}%` }}
                />
              </div>

              <div className="mt-5 space-y-2" aria-live="polite">
                {selectedIssues.map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => {
                      if (issue.endpointId) setSelectedEndpointId(issue.endpointId);
                    }}
                    className={`w-full rounded-md border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      issue.severity === 'error'
                        ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
                        : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold">
                      {issue.severity === 'error' ? (
                        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                      )}
                      {issue.title}
                    </span>
                    <span className="mt-1.5 block text-xs leading-5 opacity-80">
                      {issue.detail}
                    </span>
                  </button>
                ))}

                {selectedIssues.length === 0 && (
                  <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                    <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                    <p className="mt-2 text-sm font-bold">This operation is coherent</p>
                    <p className="mt-1 text-xs leading-5 opacity-80">
                      Method, resource path, authorization, retry policy, and responses agree.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Published request
                </p>
                <div className="mt-3 flex min-w-0 items-center gap-2 rounded-md bg-zinc-950 px-3 py-3 text-zinc-100 dark:bg-black">
                  <span className="shrink-0 text-xs font-bold text-cyan-300">
                    {selectedEndpoint?.method ?? '---'}
                  </span>
                  <code className="min-w-0 truncate text-xs">
                    https://api.example.com{selectedEndpoint?.path ?? '/'}
                  </code>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                    <LockKeyhole className="size-4 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                    {selectedEndpoint?.auth ?? 'No auth'}
                  </div>
                  <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                    <KeyRound className="size-4 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                    {selectedEndpoint?.idempotencyKey ? 'Retry safe' : 'No dedupe key'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-bold text-zinc-950 dark:text-zinc-100">OpenAPI 3.1</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Live generated contract</p>
                </div>
                <IconButton label="Copy OpenAPI document" onClick={copySpec}>
                  {copyState === 'copied' ? (
                    <Check className="size-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4" aria-hidden="true" />
                  )}
                </IconButton>
              </div>
              <div aria-live="polite" className="sr-only">
                {copyState === 'copied'
                  ? 'OpenAPI document copied'
                  : copyState === 'failed'
                    ? 'Could not copy the OpenAPI document'
                    : ''}
              </div>
              <pre className="max-h-[54rem] overflow-auto bg-zinc-950 p-4 text-xs leading-5 text-zinc-200">
                <code>{openApiJson}</code>
              </pre>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
