'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleDot,
  Database,
  GitBranch,
  Layers3,
  Network,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';

type CapabilityId =
  | 'identity'
  | 'catalog'
  | 'checkout'
  | 'inventory'
  | 'payments'
  | 'notifications';
type Placement = 'module' | 'service';
type Owner = 'Commerce' | 'Experience' | 'Payments' | 'Platform';
type ArchitecturePreset = 'modular' | 'selective' | 'distributed';
type ChallengeId =
  | 'baseline'
  | 'chatty'
  | 'distributed-transaction'
  | 'ownership-conflict'
  | 'hotspot'
  | 'dependency-failure';
type WorkflowId = 'place-order' | 'publish-product';

interface Capability {
  id: CapabilityId;
  name: string;
  purpose: string;
  data: string[];
  dependencies: CapabilityId[];
  defaultOwner: Owner;
  tone: 'blue' | 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose';
}

interface CapabilityState {
  placement: Placement;
  owner: Owner;
  changeAutonomy: number;
  trafficIsolation: number;
  teamAlignment: number;
  synchronousCalls: number;
}

interface Challenge {
  id: ChallengeId;
  label: string;
  description: string;
  consequence: string;
}

const CAPABILITIES: Capability[] = [
  {
    id: 'identity',
    name: 'Identity',
    purpose: 'Authenticates customers and owns account lifecycle.',
    data: ['accounts', 'sessions'],
    dependencies: ['notifications'],
    defaultOwner: 'Experience',
    tone: 'blue',
  },
  {
    id: 'catalog',
    name: 'Catalog',
    purpose: 'Publishes products, prices, and merchandising metadata.',
    data: ['products', 'price-lists'],
    dependencies: ['inventory'],
    defaultOwner: 'Commerce',
    tone: 'cyan',
  },
  {
    id: 'checkout',
    name: 'Checkout',
    purpose: 'Validates a cart and coordinates the order commitment.',
    data: ['carts', 'orders'],
    dependencies: ['identity', 'inventory', 'payments', 'notifications'],
    defaultOwner: 'Commerce',
    tone: 'emerald',
  },
  {
    id: 'inventory',
    name: 'Inventory',
    purpose: 'Owns stock, reservations, and availability promises.',
    data: ['stock', 'reservations'],
    dependencies: [],
    defaultOwner: 'Commerce',
    tone: 'amber',
  },
  {
    id: 'payments',
    name: 'Payments',
    purpose: 'Authorizes money movement and protects ledger invariants.',
    data: ['payment-intents', 'ledger'],
    dependencies: [],
    defaultOwner: 'Payments',
    tone: 'violet',
  },
  {
    id: 'notifications',
    name: 'Notifications',
    purpose: 'Delivers customer messages without blocking core commits.',
    data: ['templates', 'deliveries'],
    dependencies: [],
    defaultOwner: 'Platform',
    tone: 'rose',
  },
];

const INITIAL_STATE: Record<CapabilityId, CapabilityState> = {
  identity: {
    placement: 'module',
    owner: 'Experience',
    changeAutonomy: 58,
    trafficIsolation: 48,
    teamAlignment: 72,
    synchronousCalls: 1,
  },
  catalog: {
    placement: 'module',
    owner: 'Commerce',
    changeAutonomy: 44,
    trafficIsolation: 54,
    teamAlignment: 82,
    synchronousCalls: 2,
  },
  checkout: {
    placement: 'module',
    owner: 'Commerce',
    changeAutonomy: 28,
    trafficIsolation: 36,
    teamAlignment: 86,
    synchronousCalls: 4,
  },
  inventory: {
    placement: 'module',
    owner: 'Commerce',
    changeAutonomy: 52,
    trafficIsolation: 74,
    teamAlignment: 76,
    synchronousCalls: 2,
  },
  payments: {
    placement: 'module',
    owner: 'Payments',
    changeAutonomy: 86,
    trafficIsolation: 68,
    teamAlignment: 94,
    synchronousCalls: 1,
  },
  notifications: {
    placement: 'module',
    owner: 'Platform',
    changeAutonomy: 92,
    trafficIsolation: 82,
    teamAlignment: 88,
    synchronousCalls: 1,
  },
};

const PRESETS: Array<{
  id: ArchitecturePreset;
  label: string;
  detail: string;
  extracted: CapabilityId[];
}> = [
  {
    id: 'modular',
    label: 'Modular core',
    detail: 'One deployment with enforced module and data boundaries.',
    extracted: [],
  },
  {
    id: 'selective',
    label: 'Selective extraction',
    detail: 'Extract payments and notifications where evidence is strongest.',
    extracted: ['payments', 'notifications'],
  },
  {
    id: 'distributed',
    label: 'Distributed services',
    detail: 'Test the operational cost of four independently deployed capabilities.',
    extracted: ['identity', 'inventory', 'payments', 'notifications'],
  },
];

const CHALLENGES: Challenge[] = [
  {
    id: 'baseline',
    label: 'Healthy baseline',
    description: 'Evaluate the current boundaries at expected peak load.',
    consequence: 'Normal traffic exposes the design cost without an injected incident.',
  },
  {
    id: 'chatty',
    label: 'Chatty boundary',
    description: 'Checkout makes repeated fine-grained calls across every extracted seam.',
    consequence: 'Network round trips amplify tail latency and couple releases.',
  },
  {
    id: 'distributed-transaction',
    label: 'Distributed transaction',
    description: 'Order, inventory, and payment must appear atomic to the customer.',
    consequence: 'A local transaction becomes compensation, orchestration, and reconciliation work.',
  },
  {
    id: 'ownership-conflict',
    label: 'Ownership conflict',
    description: 'Two teams both write the same business record.',
    consequence: 'Schema authority and incident accountability become ambiguous.',
  },
  {
    id: 'hotspot',
    label: 'Hot capability',
    description: 'A product launch concentrates traffic on inventory reservations.',
    consequence: 'Isolation can help, but a poor key or shared database keeps the hotspot coupled.',
  },
  {
    id: 'dependency-failure',
    label: 'Dependency failure',
    description: 'The payment dependency stops responding during checkout.',
    consequence: 'Synchronous call depth determines timeout amplification and blast radius.',
  },
];

const WORKFLOWS: Array<{
  id: WorkflowId;
  label: string;
  path: CapabilityId[];
  invariant: string;
}> = [
  {
    id: 'place-order',
    label: 'Place an order',
    path: ['identity', 'checkout', 'inventory', 'payments', 'notifications'],
    invariant: 'Never confirm an order without a durable order and a known payment outcome.',
  },
  {
    id: 'publish-product',
    label: 'Publish a product',
    path: ['catalog', 'inventory', 'notifications'],
    invariant: 'A published product must not promise inventory that cannot be reserved.',
  },
];

const OWNERS: Owner[] = ['Commerce', 'Experience', 'Payments', 'Platform'];

const TONE_STYLES: Record<Capability['tone'], string> = {
  blue: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-50',
  cyan: 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-50',
  emerald:
    'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-50',
  amber:
    'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-50',
  violet:
    'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-700 dark:bg-violet-950/60 dark:text-violet-50',
  rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-50',
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function RangeControl({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint: string;
  onChange: (value: number) => void;
}) {
  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <span>{label}</span>
        <span className="shrink-0 font-mono text-blue-700 dark:text-blue-300">
          {value}
          {suffix}
        </span>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-2 w-full cursor-pointer accent-blue-600"
      />
      <span className="mt-1 block text-xs leading-5 text-slate-600 dark:text-slate-400">{hint}</span>
    </label>
  );
}

function Metric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneStyle = {
    neutral: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
    good: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40',
    warn: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40',
    bad: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40',
  }[tone];

  return (
    <div className={`min-w-0 rounded-lg border p-3 ${toneStyle}`}>
      <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">{detail}</p>
    </div>
  );
}

export default function MicroservicesDecomposer() {
  const [capabilityState, setCapabilityState] =
    useState<Record<CapabilityId, CapabilityState>>(INITIAL_STATE);
  const [selectedCapability, setSelectedCapability] = useState<CapabilityId>('payments');
  const [challenge, setChallenge] = useState<ChallengeId>('baseline');
  const [workflow, setWorkflow] = useState<WorkflowId>('place-order');
  const [peakRps, setPeakRps] = useState(18_000);
  const [operationsCapacity, setOperationsCapacity] = useState(3);

  const model = useMemo(() => {
    const capabilityById = Object.fromEntries(
      CAPABILITIES.map((capability) => [capability.id, capability]),
    ) as Record<CapabilityId, Capability>;
    const boundaryOf = (id: CapabilityId) =>
      capabilityState[id].placement === 'module' ? 'modular-core' : `${id}-service`;

    const edges = CAPABILITIES.flatMap((capability) =>
      capability.dependencies.map((dependency) => ({
        from: capability.id,
        to: dependency,
        crossesBoundary: boundaryOf(capability.id) !== boundaryOf(dependency),
      })),
    );
    const crossEdges = edges.filter((edge) => edge.crossesBoundary);
    const extracted = CAPABILITIES.filter(
      (capability) => capabilityState[capability.id].placement === 'service',
    );
    const coreModules = CAPABILITIES.filter(
      (capability) => capabilityState[capability.id].placement === 'module',
    );

    const evidence = CAPABILITIES.map((capability) => {
      const state = capabilityState[capability.id];
      const score = Math.round(
        state.changeAutonomy * 0.31 +
          state.trafficIsolation * 0.25 +
          state.teamAlignment * 0.25 +
          (state.owner === capability.defaultOwner ? 12 : -8) -
          state.synchronousCalls * 4 -
          capability.dependencies.length * 2,
      );
      const verdict = score >= 67 ? 'strong' : score >= 48 ? 'conditional' : 'keep-module';
      return { capability, state, score: clamp(score, 0, 100), verdict };
    });

    const activeWorkflow =
      WORKFLOWS.find((candidate) => candidate.id === workflow) ?? WORKFLOWS[0];
    const workflowBoundaries = activeWorkflow.path.map(boundaryOf);
    const distinctWorkflowBoundaries = new Set(workflowBoundaries).size;
    const baseTransactionSpans = Math.max(0, distinctWorkflowBoundaries - 1);
    const boundaryTransitions = activeWorkflow.path.slice(1).reduce((count, id, index) => {
      return count + (boundaryOf(activeWorkflow.path[index]) === boundaryOf(id) ? 0 : 1);
    }, 0);

    const ownerConflicts = CAPABILITIES.filter(
      (capability) => capabilityState[capability.id].owner !== capability.defaultOwner,
    ).length;
    const baseCrossCalls = crossEdges.reduce(
      (sum, edge) => sum + capabilityState[edge.from].synchronousCalls,
      0,
    );
    const scenarioCrossCalls = baseCrossCalls + (challenge === 'chatty' ? 9 : 0);
    const transactionSpans =
      baseTransactionSpans + (challenge === 'distributed-transaction' ? 1 : 0);
    const conflicts = ownerConflicts + (challenge === 'ownership-conflict' ? 1 : 0);
    const synchronousDepth =
      boundaryTransitions +
      (challenge === 'chatty' ? 2 : 0) +
      (challenge === 'dependency-failure' ? 1 : 0);

    const selectedState = capabilityState[selectedCapability];
    const hotspotMultiplier = challenge === 'hotspot' ? 4.2 : 1;
    const selectedShare = 0.18 + (100 - selectedState.trafficIsolation) / 220;
    const hotBoundaryRps = Math.round(peakRps * selectedShare * hotspotMultiplier);
    const assumedBoundaryCapacity = selectedState.placement === 'service' ? 24_000 : 31_000;
    const hotUtilization = Math.round((hotBoundaryRps / assumedBoundaryCapacity) * 100);

    const p99Ms = Math.round(
      74 +
        scenarioCrossCalls * 11 +
        transactionSpans * 24 +
        (challenge === 'dependency-failure' ? 720 : 0),
    );
    const availability = clamp(
      99.98 -
        synchronousDepth * 0.025 -
        (challenge === 'dependency-failure' ? Math.max(0.4, synchronousDepth * 0.55) : 0),
      90,
      99.99,
    );
    const deploymentUnits = extracted.length + (coreModules.length > 0 ? 1 : 0);
    const operationalBurden =
      deploymentUnits + crossEdges.length * 0.35 + transactionSpans * 0.55 + conflicts * 0.7;
    const overload =
      operationalBurden > operationsCapacity * 1.8 ||
      scenarioCrossCalls > 20 ||
      hotUtilization > 100 ||
      transactionSpans > 3;

    let outcome: {
      label: string;
      summary: string;
      action: string;
      tone: 'good' | 'warn' | 'bad';
    };
    if (extracted.length === 0) {
      outcome = {
        label: 'Modular monolith',
        summary:
          'One deployment keeps transactions local while module contracts preserve future options.',
        action:
          'Keep data writes behind module APIs, measure cross-module traffic, and extract only when evidence changes.',
        tone: 'good',
      };
    } else if (overload) {
      outcome = {
        label: 'Consolidate boundaries',
        summary:
          'The current split creates more network and operational coordination than the team can absorb.',
        action:
          'Merge the chattiest boundary or return it to the modular core before adding another deployment.',
        tone: 'bad',
      };
    } else {
      outcome = {
        label: 'Selective services',
        summary:
          'A small number of independently owned boundaries can justify their deployment cost.',
        action:
          'Extract one boundary at a time, preserve a local fallback, and prove its runtime isolation.',
        tone: 'warn',
      };
    }

    const migrationOrder = [...extracted]
      .sort((left, right) => {
        const leftScore = evidence.find((item) => item.capability.id === left.id)?.score ?? 0;
        const rightScore = evidence.find((item) => item.capability.id === right.id)?.score ?? 0;
        return rightScore - leftScore;
      })
      .map((capability, index) => ({
        capability,
        position: index + 1,
        score: evidence.find((item) => item.capability.id === capability.id)?.score ?? 0,
        reason:
          capabilityState[capability.id].synchronousCalls <= 1
            ? 'Low synchronous coupling makes this a safer first extraction.'
            : 'Add a coarse API or asynchronous seam before moving this boundary.',
      }));

    const consequences = [
      challenge === 'chatty'
        ? `${scenarioCrossCalls} cross-boundary calls push the request toward ${p99Ms} ms p99.`
        : `${crossEdges.length} dependency edges now cross a deployable boundary.`,
      transactionSpans > 0
        ? `${activeWorkflow.label} spans ${transactionSpans + 1} consistency domains and needs compensation.`
        : `${activeWorkflow.label} can commit inside one consistency domain.`,
      conflicts > 0
        ? `${conflicts} data ownership conflict${conflicts === 1 ? '' : 's'} block safe extraction.`
        : 'Every data set has one accountable write owner.',
      hotUtilization > 100
        ? `${capabilityById[selectedCapability].name} reaches ${hotUtilization}% of assumed capacity.`
        : `${capabilityById[selectedCapability].name} retains ${100 - hotUtilization}% modeled headroom.`,
      challenge === 'dependency-failure'
        ? `A failed dependency lowers modeled request availability to ${availability.toFixed(2)}%.`
        : `The synchronous path has ${synchronousDepth} cross-boundary hop${synchronousDepth === 1 ? '' : 's'}.`,
    ];

    return {
      activeWorkflow,
      capabilityById,
      consequences,
      conflicts,
      coreModules,
      crossEdges,
      deploymentUnits,
      edges,
      evidence,
      extracted,
      hotBoundaryRps,
      hotUtilization,
      migrationOrder,
      operationalBurden,
      outcome,
      p99Ms,
      scenarioCrossCalls,
      synchronousDepth,
      transactionSpans,
      availability,
    };
  }, [
    capabilityState,
    challenge,
    operationsCapacity,
    peakRps,
    selectedCapability,
    workflow,
  ]);

  const selectedSpec = model.capabilityById[selectedCapability];
  const selectedState = capabilityState[selectedCapability];
  const activeChallenge = CHALLENGES.find((item) => item.id === challenge) ?? CHALLENGES[0];

  const updateSelected = <Key extends keyof CapabilityState>(
    key: Key,
    value: CapabilityState[Key],
  ) => {
    setCapabilityState((current) => ({
      ...current,
      [selectedCapability]: {
        ...current[selectedCapability],
        [key]: value,
      },
    }));
  };

  const applyPreset = (preset: ArchitecturePreset) => {
    const extracted = PRESETS.find((item) => item.id === preset)?.extracted ?? [];
    setCapabilityState((current) => {
      const next = { ...current };
      CAPABILITIES.forEach((capability) => {
        next[capability.id] = {
          ...current[capability.id],
          placement: extracted.includes(capability.id) ? 'service' : 'module',
        };
      });
      return next;
    });
  };

  const reset = () => {
    setCapabilityState(INITIAL_STATE);
    setSelectedCapability('payments');
    setChallenge('baseline');
    setWorkflow('place-order');
    setPeakRps(18_000);
    setOperationsCapacity(3);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-950 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50">
      <header className="border-b border-slate-200 bg-slate-950 px-4 py-5 text-white dark:border-slate-700 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-300">
              <GitBranch className="h-4 w-4" aria-hidden="true" />
              Boundary evidence workbench
            </div>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Decompose only when the evidence earns it</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Assign capability and data ownership, measure change and runtime coupling, then
              pressure-test the result. A modular monolith is a successful outcome when network
              boundaries add cost without real autonomy.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-md border border-slate-600 px-3 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Reset
          </button>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Starting architecture
            </p>
            <h3 className="mt-1 text-lg font-bold">Choose a hypothesis, then edit each boundary</h3>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Presets change deployment units only. Ownership and coupling evidence remain visible so
            the recommendation can disagree with the chosen architecture.
          </p>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {PRESETS.map((preset) => {
            const presetActive = CAPABILITIES.every(
              (capability) =>
                (capabilityState[capability.id].placement === 'service') ===
                preset.extracted.includes(capability.id),
            );
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={presetActive}
                onClick={() => applyPreset(preset.id)}
                className={`min-h-20 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  presetActive
                    ? 'border-blue-700 bg-blue-700 text-white dark:border-blue-400 dark:bg-blue-500 dark:text-slate-950'
                    : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
                }`}
              >
                <span className="block text-sm font-bold">{preset.label}</span>
                <span
                  className={`mt-1 block text-xs leading-5 ${
                    presetActive ? 'text-blue-50 dark:text-slate-950' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {preset.detail}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="min-w-0 border-b border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 lg:border-b-0 lg:border-r sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Boxes className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">
                Loop 1 · Capability and ownership
              </p>
              <h3 className="mt-1 text-lg font-bold">Place one business boundary</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Select a capability, decide whether it needs an independent deployment, and assign
                exactly one write owner.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {CAPABILITIES.map((capability) => {
              const state = capabilityState[capability.id];
              const selected = selectedCapability === capability.id;
              return (
                <button
                  key={capability.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedCapability(capability.id)}
                  className={`min-h-20 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    selected
                      ? 'border-slate-950 bg-slate-950 text-white dark:border-cyan-300 dark:bg-cyan-300 dark:text-slate-950'
                      : `${TONE_STYLES[capability.tone]} hover:border-slate-500`
                  }`}
                >
                  <span className="block text-sm font-bold">{capability.name}</span>
                  <span
                    className={`mt-1 block text-xs leading-5 ${
                      selected ? 'text-slate-200 dark:text-slate-800' : 'opacity-75'
                    }`}
                  >
                    {state.placement === 'module' ? 'Core module' : 'Independent service'} ·{' '}
                    {state.owner}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-bold">{selectedSpec.name}</h4>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {selectedSpec.purpose}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {selectedSpec.data.length} data sets
              </span>
            </div>

            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">Deployment boundary</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ['module', 'Keep as module', 'Local calls and transactions'],
                    ['service', 'Extract service', 'Independent deploy and runtime'],
                  ] as const
                ).map(([value, label, detail]) => {
                  const selected = selectedState.placement === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => updateSelected('placement', value)}
                      className={`rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        selected
                          ? 'border-blue-700 bg-blue-700 text-white dark:border-blue-400 dark:bg-blue-500 dark:text-slate-950'
                          : 'border-slate-200 bg-slate-50 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-950'
                      }`}
                    >
                      <span className="block text-sm font-bold">{label}</span>
                      <span
                        className={`mt-1 block text-xs ${
                          selected ? 'text-blue-50 dark:text-slate-950' : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {detail}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="mt-4 block text-sm font-semibold" htmlFor="data-owner">
              Accountable data owner
              <select
                id="data-owner"
                value={selectedState.owner}
                onChange={(event) => updateSelected('owner', event.target.value as Owner)}
                className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              >
                {OWNERS.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner} team
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 flex flex-wrap gap-2" aria-label={`${selectedSpec.name} owned data`}>
              {selectedSpec.data.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <Database className="h-3.5 w-3.5" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="min-w-0 bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">
                Loop 2 · Change, traffic, and team coupling
              </p>
              <h3 className="mt-1 text-lg font-bold">Measure whether the seam is real</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Strong boundaries change independently, isolate load, have one capable owner, and
                avoid fine-grained synchronous calls.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <RangeControl
              id="change-autonomy"
              label="Independent change"
              value={selectedState.changeAutonomy}
              min={0}
              max={100}
              suffix="%"
              hint="How often this capability can ship without coordinated code changes."
              onChange={(value) => updateSelected('changeAutonomy', value)}
            />
            <RangeControl
              id="traffic-isolation"
              label="Traffic isolation"
              value={selectedState.trafficIsolation}
              min={0}
              max={100}
              suffix="%"
              hint="How independently this workload can scale and shed load."
              onChange={(value) => updateSelected('trafficIsolation', value)}
            />
            <RangeControl
              id="team-alignment"
              label="Team alignment"
              value={selectedState.teamAlignment}
              min={0}
              max={100}
              suffix="%"
              hint="How clearly one team can own delivery and incidents."
              onChange={(value) => updateSelected('teamAlignment', value)}
            />
            <RangeControl
              id="synchronous-calls"
              label="Synchronous calls per request"
              value={selectedState.synchronousCalls}
              min={0}
              max={8}
              hint="Fine-grained calls increase runtime and release coupling."
              onChange={(value) => updateSelected('synchronousCalls', value)}
            />
          </div>

          <div className="mt-6 grid gap-5 border-t border-slate-200 pt-5 dark:border-slate-700 sm:grid-cols-2">
            <RangeControl
              id="peak-rps"
              label="System peak traffic"
              value={peakRps}
              min={1_000}
              max={80_000}
              step={1_000}
              suffix=" req/s"
              hint="Used to estimate pressure on the selected capability."
              onChange={setPeakRps}
            />
            <RangeControl
              id="operations-capacity"
              label="Operational team capacity"
              value={operationsCapacity}
              min={1}
              max={6}
              suffix=" teams"
              hint="Teams able to own deploys, alerts, on-call, and recovery."
              onChange={setOperationsCapacity}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric
              label="Evidence"
              value={`${
                model.evidence.find((item) => item.capability.id === selectedCapability)?.score ?? 0
              }/100`}
              detail="Extraction confidence"
              tone={
                (model.evidence.find((item) => item.capability.id === selectedCapability)?.score ??
                  0) >= 67
                  ? 'good'
                  : 'warn'
              }
            />
            <Metric
              label="Boundary load"
              value={`${formatNumber(model.hotBoundaryRps)}/s`}
              detail={`${model.hotUtilization}% utilized`}
              tone={model.hotUtilization > 100 ? 'bad' : model.hotUtilization > 75 ? 'warn' : 'good'}
            />
            <Metric
              label="Cross calls"
              value={String(model.scenarioCrossCalls)}
              detail="Per modeled request"
              tone={model.scenarioCrossCalls > 20 ? 'bad' : model.scenarioCrossCalls > 8 ? 'warn' : 'good'}
            />
            <Metric
              label="Ops load"
              value={model.operationalBurden.toFixed(1)}
              detail={`${operationsCapacity} team capacity`}
              tone={
                model.operationalBurden > operationsCapacity * 1.8
                  ? 'bad'
                  : model.operationalBurden > operationsCapacity * 1.25
                    ? 'warn'
                    : 'good'
              }
            />
          </div>
        </section>
      </div>

      <section className="border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Candidate boundary map
            </p>
            <h3 className="mt-1 text-xl font-bold">Deployment, dependency, and data ownership</h3>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />
              {model.deploymentUnits} deployment units
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Network className="h-3.5 w-3.5" aria-hidden="true" />
              {model.crossEdges.length} cross-boundary dependencies
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950 sm:p-4">
          <div className="flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-600 dark:bg-slate-900">
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-300" aria-hidden="true" />
            Web and mobile clients
          </div>
          <div className="flex justify-center py-2 text-slate-400" aria-hidden="true">
            <ArrowRight className="h-5 w-5 rotate-90" />
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="min-w-0 rounded-lg border-2 border-slate-400 bg-white p-3 dark:border-slate-500 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                    One process and transaction boundary
                  </p>
                  <h4 className="mt-1 font-bold">Modular commerce core</h4>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-slate-800">
                  {model.coreModules.length} modules
                </span>
              </div>
              {model.coreModules.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {model.coreModules.map((capability) => (
                    <button
                      key={capability.id}
                      type="button"
                      onClick={() => setSelectedCapability(capability.id)}
                      aria-pressed={selectedCapability === capability.id}
                      className={`rounded-md border p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        selectedCapability === capability.id
                          ? 'border-slate-950 bg-slate-950 text-white dark:border-cyan-300 dark:bg-cyan-300 dark:text-slate-950'
                          : TONE_STYLES[capability.tone]
                      }`}
                    >
                      <span className="block text-sm font-bold">{capability.name}</span>
                      <span
                        className={`mt-1 block text-xs ${
                          selectedCapability === capability.id
                            ? 'text-slate-200 dark:text-slate-800'
                            : 'opacity-75'
                        }`}
                      >
                        {capabilityState[capability.id].owner} owns {capability.data.join(' · ')}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
                  No capabilities remain in the modular core. Every local call is now a network
                  contract.
                </p>
              )}
            </div>

            <div className="min-w-0">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Independent deployables
              </p>
              {model.extracted.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {model.extracted.map((capability) => (
                    <button
                      key={capability.id}
                      type="button"
                      onClick={() => setSelectedCapability(capability.id)}
                      aria-pressed={selectedCapability === capability.id}
                      className={`rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        selectedCapability === capability.id
                          ? 'border-slate-950 bg-slate-950 text-white dark:border-cyan-300 dark:bg-cyan-300 dark:text-slate-950'
                          : TONE_STYLES[capability.tone]
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-bold">{capability.name} service</span>
                        <span className="rounded-full border border-current px-2 py-0.5 text-[11px] font-semibold">
                          {capabilityState[capability.id].owner}
                        </span>
                      </span>
                      <span
                        className={`mt-2 flex items-center gap-1.5 text-xs ${
                          selectedCapability === capability.id
                            ? 'text-slate-200 dark:text-slate-800'
                            : 'opacity-75'
                        }`}
                      >
                        <Database className="h-3.5 w-3.5" aria-hidden="true" />
                        {capability.data.join(' · ')}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-emerald-400 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100">
                  <ShieldCheck className="mb-2 h-5 w-5" aria-hidden="true" />
                  No independent service is required yet. Module APIs preserve boundaries without
                  distributed-system overhead.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Dependency evidence
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {model.edges.map((edge) => (
                <span
                  key={`${edge.from}-${edge.to}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    edge.crossesBoundary
                      ? 'border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100'
                      : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  {model.capabilityById[edge.from].name}
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  {model.capabilityById[edge.to].name}
                  {edge.crossesBoundary ? ' · network' : ' · local'}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Workflow className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">
              Transaction span
            </p>
            <h3 className="mt-1 text-lg font-bold">Trace a business invariant across boundaries</h3>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {WORKFLOWS.map((item) => {
            const selected = item.id === workflow;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setWorkflow(item.id)}
                className={`rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  selected
                    ? 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-300 dark:bg-emerald-300 dark:text-slate-950'
                    : 'border-slate-200 bg-white hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900'
                }`}
              >
                <span className="block text-sm font-bold">{item.label}</span>
                <span
                  className={`mt-1 block text-xs leading-5 ${
                    selected ? 'text-emerald-50 dark:text-slate-800' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {item.invariant}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
            {model.activeWorkflow.path.map((id, index) => {
              const capability = model.capabilityById[id];
              const state = capabilityState[id];
              return (
                <div key={id} className="contents">
                  <div className={`min-w-0 flex-1 rounded-md border p-3 ${TONE_STYLES[capability.tone]}`}>
                    <p className="text-sm font-bold">{capability.name}</p>
                    <p className="mt-1 text-xs opacity-75">
                      {state.placement === 'module' ? 'Local module' : 'Service'} · {state.owner}
                    </p>
                  </div>
                  {index < model.activeWorkflow.path.length - 1 ? (
                    <ArrowRight
                      className="h-5 w-5 shrink-0 self-center rotate-90 text-slate-400 md:rotate-0"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric
              label="Consistency domains"
              value={String(model.transactionSpans + 1)}
              detail={model.transactionSpans === 0 ? 'One local commit' : 'Compensation required'}
              tone={model.transactionSpans > 2 ? 'bad' : model.transactionSpans > 0 ? 'warn' : 'good'}
            />
            <Metric
              label="Sync call depth"
              value={String(model.synchronousDepth)}
              detail="Cross-boundary hops"
              tone={model.synchronousDepth > 3 ? 'bad' : model.synchronousDepth > 1 ? 'warn' : 'good'}
            />
            <Metric
              label="Modeled p99"
              value={`${model.p99Ms} ms`}
              detail="Illustrative path latency"
              tone={model.p99Ms > 500 ? 'bad' : model.p99Ms > 180 ? 'warn' : 'good'}
            />
            <Metric
              label="Availability"
              value={`${model.availability.toFixed(2)}%`}
              detail="Request-path estimate"
              tone={model.availability < 99 ? 'bad' : model.availability < 99.9 ? 'warn' : 'good'}
            />
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-rose-700 dark:text-rose-300">
              Architecture challenge
            </p>
            <h3 className="mt-1 text-lg font-bold">Break the healthy assumptions</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Each challenge changes the same request, ownership, and capacity model.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
          {CHALLENGES.map((item) => {
            const selected = challenge === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setChallenge(item.id);
                  if (item.id === 'hotspot') setSelectedCapability('inventory');
                  if (item.id === 'dependency-failure') setSelectedCapability('payments');
                }}
                className={`min-h-24 rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                  selected
                    ? 'border-rose-700 bg-rose-700 text-white dark:border-rose-300 dark:bg-rose-300 dark:text-slate-950'
                    : 'border-slate-200 bg-slate-50 hover:border-rose-400 dark:border-slate-700 dark:bg-slate-950'
                }`}
              >
                <span className="block text-sm font-bold">{item.label}</span>
                <span
                  className={`mt-1 block text-xs leading-5 ${
                    selected ? 'text-rose-50 dark:text-slate-800' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>

        <div
          role="status"
          className={`mt-4 rounded-lg border p-4 ${
            challenge === 'baseline'
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
              : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
          }`}
        >
          <div className="flex items-start gap-3">
            {challenge === 'baseline' ? (
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300"
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300"
                aria-hidden="true"
              />
            )}
            <div>
              <p className="font-bold">{activeChallenge.label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
                {activeChallenge.consequence}
              </p>
            </div>
          </div>
          <ul className="mt-4 grid gap-2 text-sm text-slate-700 dark:text-slate-300 md:grid-cols-2">
            {model.consequences.map((consequence) => (
              <li key={consequence} className="flex items-start gap-2">
                <CircleDot className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                <span>{consequence}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid min-w-0 border-t border-slate-200 dark:border-slate-700 lg:grid-cols-2">
        <div className="min-w-0 border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950 lg:border-b-0 lg:border-r sm:p-6">
          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            Coupling evidence
          </p>
          <h3 className="mt-1 text-lg font-bold">Which boundaries have earned extraction?</h3>
          <div className="mt-4 space-y-3">
            {model.evidence.map(({ capability, score, verdict }) => (
              <button
                key={capability.id}
                type="button"
                onClick={() => setSelectedCapability(capability.id)}
                className="block w-full rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-bold">{capability.name}</span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      verdict === 'strong'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                        : verdict === 'conditional'
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {verdict === 'strong'
                      ? 'Strong candidate'
                      : verdict === 'conditional'
                        ? 'Conditional'
                        : 'Keep as module'}
                  </span>
                </span>
                <span className="mt-2 block h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <span
                    className={`block h-full rounded-full ${
                      verdict === 'strong'
                        ? 'bg-emerald-600'
                        : verdict === 'conditional'
                          ? 'bg-amber-500'
                          : 'bg-slate-500'
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </span>
                <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
                  Evidence score {score}/100 · {capabilityState[capability.id].synchronousCalls}{' '}
                  synchronous call
                  {capabilityState[capability.id].synchronousCalls === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 bg-white p-4 dark:bg-slate-900 sm:p-6">
          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            Migration order
          </p>
          <h3 className="mt-1 text-lg font-bold">Move the least coupled boundary first</h3>
          {model.migrationOrder.length > 0 ? (
            <ol className="mt-4 space-y-3">
              {model.migrationOrder.map(({ capability, position, score, reason }) => (
                <li
                  key={capability.id}
                  className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white dark:bg-cyan-300 dark:text-slate-950">
                    {position}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold">
                      {capability.name} · evidence {score}/100
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-400">
                      {reason}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Transfer ownership of {capability.data.join(' and ')} after routing reads
                      through the new contract.
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-bold">No service extraction is queued</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
                    First enforce module APIs, remove shared writes, and capture runtime dependency
                    traces. Revisit extraction when one boundary needs independent change, scale, or
                    ownership.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer
        className={`border-t p-4 sm:p-6 ${
          model.outcome.tone === 'good'
            ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50'
            : model.outcome.tone === 'bad'
              ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/50'
              : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50'
        }`}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-3xl items-start gap-3">
            {model.outcome.tone === 'good' ? (
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" />
            ) : model.outcome.tone === 'bad' ? (
              <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-rose-700 dark:text-rose-300" />
            ) : (
              <Zap className="mt-0.5 h-6 w-6 shrink-0 text-amber-700 dark:text-amber-300" />
            )}
            <div>
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                Current architecture verdict
              </p>
              <h3 className="mt-1 text-xl font-bold">{model.outcome.label}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                {model.outcome.summary}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6">{model.outcome.action}</p>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2">
            <div className="rounded-md border border-current/20 bg-white/70 p-3 dark:bg-slate-950/50">
              <p className="text-xs text-slate-600 dark:text-slate-400">Ownership conflicts</p>
              <p className="mt-1 text-lg font-bold">{model.conflicts}</p>
            </div>
            <div className="rounded-md border border-current/20 bg-white/70 p-3 dark:bg-slate-950/50">
              <p className="text-xs text-slate-600 dark:text-slate-400">Deployment units</p>
              <p className="mt-1 text-lg font-bold">{model.deploymentUnits}</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
