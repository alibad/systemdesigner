'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Code2,
  Cpu,
  FileCheck2,
  GitBranch,
  PackageCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'reference/ml-framework-migration-lab';
const DEFAULT_DATA_FILE = '/api/content/reference/ml-frameworks-comparison/data/framework-migration-model.json';

type Framework = {
  id: string;
  label: string;
  nativeArtifact: string;
};

type Target = {
  id: string;
  label: string;
  detail: string;
  requiredBoundary: string;
  baseEffort: Record<string, number>;
  cautions: Record<string, string>;
};

type MigrationModel = {
  title: string;
  description: string;
  defaults: { frameworkId: string; targetId: string };
  frameworks: Framework[];
  targets: Target[];
  modifiers: Array<{ id: string; label: string; detail: string; points: number }>;
};

function isMigrationModel(value: unknown): value is MigrationModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MigrationModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.frameworkId
      && candidate.defaults?.targetId
      && Array.isArray(candidate.frameworks)
      && candidate.frameworks.length === 3
      && candidate.frameworks.every((framework) => framework.id && framework.label && framework.nativeArtifact)
      && Array.isArray(candidate.targets)
      && candidate.targets.length >= 3
      && candidate.targets.every((target) => target.id && target.label && target.detail && target.requiredBoundary && target.baseEffort && target.cautions)
      && Array.isArray(candidate.modifiers)
      && candidate.modifiers.length === 3
      && candidate.modifiers.every((modifier) => modifier.id && modifier.label && modifier.detail && Number.isInteger(modifier.points)),
  );
}

export default function MlFrameworkMigrationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<MigrationModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isMigrationModel(payload)) throw new Error('The migration model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load migration evidence.');
      });
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Artifact boundary lab"
            title="Trace the production contract before migrating"
            description="Loading framework and runtime boundaries."
            icon={PackageCheck}
            accent="amber"
          />
          <LearningLabBody>
            <div className="flex min-h-40 items-center justify-center text-center">
              {error ? (
                <div>
                  <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
                  <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{error}</p>
                  <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold dark:border-neutral-700">Retry</button>
                </div>
              ) : <span className="text-sm text-neutral-600 dark:text-neutral-300">Loading artifact boundaries</span>}
            </div>
          </LearningLabBody>
        </LearningLab>
      </div>
    );
  }

  return <MigrationWorkbench model={model} />;
}

function MigrationWorkbench({ model }: { model: MigrationModel }) {
  const [frameworkId, setFrameworkId] = useState(model.defaults.frameworkId);
  const [targetId, setTargetId] = useState(model.defaults.targetId);
  const [enabledModifiers, setEnabledModifiers] = useState<string[]>([]);
  const framework = model.frameworks.find((item) => item.id === frameworkId) ?? model.frameworks[0];
  const target = model.targets.find((item) => item.id === targetId) ?? model.targets[0];

  const result = useMemo(() => {
    const base = target.baseEffort[framework.id] ?? 4;
    const modifiers = model.modifiers.filter((modifier) => enabledModifiers.includes(modifier.id));
    const points = base + modifiers.reduce((sum, modifier) => sum + modifier.points, 0);
    return {
      base,
      modifiers,
      points,
      level: points <= 3 ? 'Contained' : points <= 6 ? 'Material' : 'High',
    };
  }, [enabledModifiers, framework.id, model.modifiers, target]);

  function toggleModifier(id: string) {
    setEnabledModifiers((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Artifact boundary lab"
          title={model.title}
          description={model.description}
          icon={PackageCheck}
          accent="amber"
          onReset={() => {
            setFrameworkId(model.defaults.frameworkId);
            setTargetId(model.defaults.targetId);
            setEnabledModifiers([]);
          }}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Training framework</legend>
                {model.frameworks.map((item) => (
                  <LabChoice key={item.id} selected={item.id === framework.id} label={item.label} detail={item.nativeArtifact} accent="amber" onClick={() => setFrameworkId(item.id)} />
                ))}
              </fieldset>
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Production target</legend>
                {model.targets.map((item) => (
                  <LabChoice key={item.id} selected={item.id === target.id} label={item.label} detail={item.detail} accent="blue" onClick={() => setTargetId(item.id)} />
                ))}
              </fieldset>
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric label="Relative effort" value={`${result.points} points`} detail={`${result.base} base + ${result.points - result.base} model-specific`} icon={GitBranch} tone={result.level === 'High' ? 'rose' : result.level === 'Material' ? 'amber' : 'emerald'} />
            <LabMetric label="Risk class" value={result.level} detail="A comparison aid, not a calendar estimate" icon={TriangleAlert} tone={result.level === 'High' ? 'rose' : result.level === 'Material' ? 'amber' : 'emerald'} />
            <LabMetric label="Required boundary" value={target.requiredBoundary} detail={target.cautions[framework.id]} icon={Cpu} tone="blue" />
          </div>

          <fieldset className="mt-6">
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Add model-specific migration work</legend>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {model.modifiers.map((modifier) => {
                const selected = enabledModifiers.includes(modifier.id);
                return (
                  <button
                    key={modifier.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleModifier(modifier.id)}
                    className={`rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${selected ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50' : 'border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'}`}
                  >
                    <span className="block text-sm font-semibold">{modifier.label} <span className="tabular-nums">+{modifier.points}</span></span>
                    <span className="mt-1 block text-xs leading-5 opacity-75">{modifier.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch">
            <FlowStep icon={Code2} label="Representative model" detail="Freeze inputs and source outputs" />
            <ArrowRight aria-hidden="true" className="hidden h-5 w-5 self-center text-neutral-400 md:block" />
            <FlowStep icon={Boxes} label="Export boundary" detail={framework.nativeArtifact} />
            <ArrowRight aria-hidden="true" className="hidden h-5 w-5 self-center text-neutral-400 md:block" />
            <FlowStep icon={Cpu} label="Target runtime" detail={target.requiredBoundary} />
            <ArrowRight aria-hidden="true" className="hidden h-5 w-5 self-center text-neutral-400 md:block" />
            <FlowStep icon={FileCheck2} label="Parity gate" detail="Numerics, latency, memory, and failure behavior" />
          </div>

          <div className="mt-6 rounded-md border border-blue-300 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50">
            <div className="flex items-start gap-3">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Treat export as a new program boundary.</p>
                <p className="mt-1 text-sm leading-6 opacity-80">Compare source and target outputs on fixed cases, then measure the actual target. Framework familiarity cannot prove operator coverage, numerical parity, or device performance.</p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function FlowStep({ icon: Icon, label, detail }: { icon: typeof Code2; label: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      <Icon aria-hidden="true" className="h-5 w-5 text-blue-600 dark:text-blue-300" />
      <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
      <p className="mt-1 break-words text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}
