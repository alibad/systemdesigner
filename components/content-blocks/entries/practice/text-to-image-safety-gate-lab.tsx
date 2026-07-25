'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Fingerprint,
  Image as ImageIcon,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  UserRoundSearch,
  XCircle,
} from 'lucide-react';

type ScenarioId = 'benign' | 'ambiguous' | 'identity' | 'evasion';
type PolicyId = 'strict' | 'balanced' | 'creative';
type Decision = 'release' | 'review' | 'block-input' | 'block-output' | 'hold-provenance';

type Scenario = {
  id: ScenarioId;
  label: string;
  prompt: string;
  note: string;
  promptRisk: number;
  outputRisk: number;
  identityRisk: number;
};

type Policy = {
  id: PolicyId;
  label: string;
  detail: string;
  promptBlock: number;
  outputBlock: number;
  review: number;
  identityReview: number;
};

const scenarios: Scenario[] = [
  {
    id: 'benign',
    label: 'Benign creative request',
    prompt: 'A watercolor robot tending a rooftop garden at sunrise',
    note: 'Low-risk fictional content with no identity claim.',
    promptRisk: 7,
    outputRisk: 9,
    identityRisk: 2,
  },
  {
    id: 'ambiguous',
    label: 'Ambiguous historical scene',
    prompt: 'A dramatic documentary-style scene from an ancient battle',
    note: 'Legitimate context can still produce graphic imagery.',
    promptRisk: 34,
    outputRisk: 28,
    identityRisk: 4,
  },
  {
    id: 'identity',
    label: 'Real-person identity request',
    prompt: 'A photorealistic local school principal announcing a false closure',
    note: 'Impersonation risk is high even when generic violence scores are low.',
    promptRisk: 28,
    outputRisk: 32,
    identityRisk: 81,
  },
  {
    id: 'evasion',
    label: 'Adversarial evasion attempt',
    prompt: 'Obfuscated instructions intended to bypass the violence policy',
    note: 'Input and output classifiers must not share one blind spot.',
    promptRisk: 78,
    outputRisk: 87,
    identityRisk: 12,
  },
];

const policies: Policy[] = [
  {
    id: 'strict',
    label: 'Family-safe',
    detail: 'Low review and block thresholds for a broad audience.',
    promptBlock: 45,
    outputBlock: 35,
    review: 22,
    identityReview: 25,
  },
  {
    id: 'balanced',
    label: 'General creative',
    detail: 'Allows context while escalating uncertain cases.',
    promptBlock: 70,
    outputBlock: 65,
    review: 40,
    identityReview: 55,
  },
  {
    id: 'creative',
    label: 'Professional studio',
    detail: 'Wider creative range with identity controls retained.',
    promptBlock: 85,
    outputBlock: 80,
    review: 55,
    identityReview: 70,
  },
];

const decisionMeta: Record<Decision, { title: string; detail: string }> = {
  release: {
    title: 'Release with provenance',
    detail: 'Both policy gates pass and the output carries traceable generation metadata.',
  },
  review: {
    title: 'Route to human review',
    detail: 'The request is not an automatic block, but uncertainty or identity risk needs a trained reviewer.',
  },
  'block-input': {
    title: 'Block before generation',
    detail: 'The prompt gate prevents unsafe work from consuming accelerator capacity.',
  },
  'block-output': {
    title: 'Quarantine the generated image',
    detail: 'The prompt passed, but the output classifier found release-level risk.',
  },
  'hold-provenance': {
    title: 'Hold the output',
    detail: 'Policy checks pass, but the release invariant requires provenance metadata.',
  },
};

export default function TextToImageSafetyGateLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('ambiguous');
  const [policyId, setPolicyId] = useState<PolicyId>('balanced');
  const [provenance, setProvenance] = useState(true);

  const model = useMemo(() => {
    const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[1];
    const policy = policies.find((item) => item.id === policyId) ?? policies[1];

    let decision: Decision;
    if (scenario.promptRisk >= policy.promptBlock) {
      decision = 'block-input';
    } else if (scenario.outputRisk >= policy.outputBlock) {
      decision = 'block-output';
    } else if (scenario.identityRisk >= policy.identityReview || Math.max(scenario.promptRisk, scenario.outputRisk) >= policy.review) {
      decision = 'review';
    } else if (!provenance) {
      decision = 'hold-provenance';
    } else {
      decision = 'release';
    }

    const stages = [
      {
        id: 'prompt',
        label: 'Prompt gate',
        detail: `${scenario.promptRisk}/100 risk`,
        state: decision === 'block-input' ? 'stop' : 'pass',
        icon: ScanSearch,
      },
      {
        id: 'generate',
        label: 'GPU generation',
        detail: decision === 'block-input' ? 'Skipped' : 'Completed',
        state: decision === 'block-input' ? 'idle' : 'pass',
        icon: ImageIcon,
      },
      {
        id: 'output',
        label: 'Output gate',
        detail: decision === 'block-input' ? 'Not reached' : `${scenario.outputRisk}/100 risk`,
        state: decision === 'block-output' ? 'stop' : decision === 'review' ? 'warn' : decision === 'block-input' ? 'idle' : 'pass',
        icon: ShieldAlert,
      },
      {
        id: 'release',
        label: 'Release gate',
        detail: decision === 'release' ? 'Delivered' : decision === 'review' ? 'Review queue' : 'Not delivered',
        state: decision === 'release' ? 'pass' : decision === 'review' || decision === 'hold-provenance' ? 'warn' : 'idle',
        icon: FileCheck2,
      },
    ] as const;

    return { scenario, policy, decision, stages };
  }, [policyId, provenance, scenarioId]);

  const reset = () => {
    setScenarioId('ambiguous');
    setPolicyId('balanced');
    setProvenance(true);
  };

  const decision = decisionMeta[model.decision];
  const decisionTone = model.decision === 'release'
    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
    : model.decision === 'review' || model.decision === 'hold-provenance'
      ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
      : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40';

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-300">
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              Release policy lab
            </div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">Decide whether an image may leave the system</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Test different requests against product policy. Watch where layered controls release, review, or stop the result.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-neutral-700 px-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[390px_minmax(0,1fr)]">
        <div className="border-b border-neutral-200 bg-neutral-50 p-5 lg:border-b-0 lg:border-r md:p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">1. Inject a request</legend>
            <div className="mt-3 space-y-2">
              {scenarios.map((scenario) => {
                const selected = scenario.id === scenarioId;
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setScenarioId(scenario.id)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${selected ? 'border-blue-500 bg-blue-50 text-blue-950 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-50' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600'}`}
                  >
                    <span className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded ${selected ? 'bg-white/70 dark:bg-black/20' : 'bg-neutral-100 dark:bg-neutral-900'}`}>
                        <ShieldAlert aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{scenario.label}</span>
                        <span className="mt-1 block text-xs leading-5 opacity-75">{scenario.note}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">2. Choose product policy</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {policies.map((policy) => {
                const selected = policy.id === policyId;
                return (
                  <button
                    key={policy.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPolicyId(policy.id)}
                    className={`rounded-md border p-3 text-left transition-colors ${selected ? 'border-violet-500 bg-violet-50 text-violet-950 ring-1 ring-violet-500 dark:border-violet-400 dark:bg-violet-950/60 dark:text-violet-50' : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'}`}
                  >
                    <span className="block text-sm font-semibold">{policy.label}</span>
                    <span className="mt-1 block text-xs leading-5 opacity-75">{policy.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <button
            type="button"
            role="switch"
            aria-checked={provenance}
            onClick={() => setProvenance((value) => !value)}
            className="mt-6 flex w-full items-center justify-between gap-4 rounded-md border border-neutral-200 bg-white p-3 text-left dark:border-neutral-800 dark:bg-neutral-950"
          >
            <span className="flex min-w-0 items-start gap-3">
              <Fingerprint aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
              <span>
                <span className="block text-sm font-semibold text-neutral-950 dark:text-white">Attach provenance</span>
                <span className="mt-1 block text-xs leading-5 text-neutral-500">Model, policy, and generation identifiers.</span>
              </span>
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${provenance ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
              <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${provenance ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </span>
          </button>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Active prompt</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-neutral-950 dark:text-white">“{model.scenario.prompt}”</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Prompt risk', value: model.scenario.promptRisk, icon: ScanSearch, threshold: model.policy.promptBlock, tone: 'bg-blue-500' },
              { label: 'Output risk', value: model.scenario.outputRisk, icon: ShieldAlert, threshold: model.policy.outputBlock, tone: 'bg-rose-500' },
              { label: 'Identity risk', value: model.scenario.identityRisk, icon: UserRoundSearch, threshold: model.policy.identityReview, tone: 'bg-violet-500' },
            ].map((risk) => (
              <div key={risk.label} className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-center justify-between gap-3">
                  <risk.icon aria-hidden="true" className="h-4 w-4 text-neutral-500" />
                  <span className="text-lg font-bold tabular-nums text-neutral-950 dark:text-white">{risk.value}</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">{risk.label}</p>
                <div className="relative mt-3 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
                  <div className={`h-full rounded ${risk.tone}`} style={{ width: `${risk.value}%` }} />
                  <div className="absolute inset-y-0 w-0.5 bg-neutral-950 dark:bg-white" style={{ left: `${risk.threshold}%` }} title={`Policy threshold ${risk.threshold}`} />
                </div>
                <p className="mt-2 text-[10px] text-neutral-500">Policy threshold {risk.threshold}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="grid gap-2 sm:grid-cols-4">
              {model.stages.map((stage, index) => {
                const Icon = stage.icon;
                const stageClass = stage.state === 'pass'
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35'
                  : stage.state === 'stop'
                    ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/35'
                    : stage.state === 'warn'
                      ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35'
                      : 'border-neutral-200 bg-neutral-100 opacity-65 dark:border-neutral-800 dark:bg-neutral-900';
                return (
                  <div key={stage.id} className="relative min-w-0">
                    <div className={`h-full rounded-md border p-3 ${stageClass}`}>
                      <div className="flex items-center justify-between gap-2">
                        <Icon aria-hidden="true" className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                        <span className="text-[10px] font-bold text-neutral-500">0{index + 1}</span>
                      </div>
                      <p className="mt-3 text-xs font-semibold text-neutral-950 dark:text-white">{stage.label}</p>
                      <p className="mt-1 text-[10px] leading-4 text-neutral-500">{stage.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`mt-5 rounded-lg border p-5 ${decisionTone}`}>
            <div className="flex items-start gap-3">
              {model.decision === 'release' ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
              ) : model.decision === 'review' || model.decision === 'hold-provenance' ? (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
              ) : (
                <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Release decision</p>
                <p className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">{decision.title}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{decision.detail}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6"><strong>Release rule:</strong> input filtering saves unsafe compute, output filtering catches generated surprises, identity policy handles a separate harm class, and provenance remains mandatory after every classifier passes.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
