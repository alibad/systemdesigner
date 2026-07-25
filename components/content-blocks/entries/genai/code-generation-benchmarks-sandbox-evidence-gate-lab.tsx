'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  FileLock2,
  FlaskConical,
  Network,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Policy = {
  id: string;
  label: string;
  detail: string;
  riskPoints: number;
  evidencePoints: number;
};

type HiddenTestPolicy = {
  id: string;
  label: string;
  detail: string;
  evidencePoints: number;
};

type GateData = {
  defaultDependencyId: string;
  defaultFilesystemId: string;
  defaultNetworkId: string;
  defaultHiddenTestId: string;
  defaultBehaviorId: string;
  defaultFlakyTestPct: number;
  defaultContaminationPct: number;
  gates: {
    maximumFlakyTestPct: number;
    maximumContaminationPct: number;
    minimumEvidenceQualityPct: number;
    maximumRiskPoints: number;
  };
  dependencyPolicies: Policy[];
  filesystemPolicies: Policy[];
  networkPolicies: Policy[];
  hiddenTestPolicies: HiddenTestPolicy[];
  behaviorSignals: Policy[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/code-generation-benchmarks/data/sandbox-evidence-gate.json';

function validData(value: unknown): value is GateData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GateData>;
  return typeof candidate.defaultDependencyId === 'string'
    && typeof candidate.defaultFilesystemId === 'string'
    && typeof candidate.defaultNetworkId === 'string'
    && typeof candidate.defaultHiddenTestId === 'string'
    && typeof candidate.defaultBehaviorId === 'string'
    && typeof candidate.defaultFlakyTestPct === 'number'
    && typeof candidate.defaultContaminationPct === 'number'
    && Boolean(candidate.gates)
    && Array.isArray(candidate.dependencyPolicies)
    && Array.isArray(candidate.filesystemPolicies)
    && Array.isArray(candidate.networkPolicies)
    && Array.isArray(candidate.hiddenTestPolicies)
    && Array.isArray(candidate.behaviorSignals);
}

function stateTone(state: 'canary' | 'hold' | 'block') {
  return state === 'canary' ? 'emerald' : state === 'hold' ? 'amber' : 'rose';
}

export default function CodeGenerationBenchmarksSandboxEvidenceGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<GateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dependencyId, setDependencyId] = useState('');
  const [filesystemId, setFilesystemId] = useState('');
  const [networkId, setNetworkId] = useState('');
  const [hiddenTestId, setHiddenTestId] = useState('');
  const [behaviorId, setBehaviorId] = useState('');
  const [flakyTestPct, setFlakyTestPct] = useState(1);
  const [contaminationPct, setContaminationPct] = useState(1);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!validData(payload)) throw new Error('Sandbox gate data is incomplete.');
        if (!active) return;
        setData(payload);
        setDependencyId(payload.defaultDependencyId);
        setFilesystemId(payload.defaultFilesystemId);
        setNetworkId(payload.defaultNetworkId);
        setHiddenTestId(payload.defaultHiddenTestId);
        setBehaviorId(payload.defaultBehaviorId);
        setFlakyTestPct(payload.defaultFlakyTestPct);
        setContaminationPct(payload.defaultContaminationPct);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load gate data.');
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const dependency = data?.dependencyPolicies.find((item) => item.id === dependencyId) ?? data?.dependencyPolicies[0];
  const filesystem = data?.filesystemPolicies.find((item) => item.id === filesystemId) ?? data?.filesystemPolicies[0];
  const network = data?.networkPolicies.find((item) => item.id === networkId) ?? data?.networkPolicies[0];
  const hiddenTests = data?.hiddenTestPolicies.find((item) => item.id === hiddenTestId) ?? data?.hiddenTestPolicies[0];
  const behavior = data?.behaviorSignals.find((item) => item.id === behaviorId) ?? data?.behaviorSignals[0];

  const model = useMemo(() => {
    if (!data || !dependency || !filesystem || !network || !hiddenTests || !behavior) return null;
    const riskPoints = dependency.riskPoints + filesystem.riskPoints + network.riskPoints + behavior.riskPoints;
    const rawEvidence = dependency.evidencePoints + filesystem.evidencePoints + network.evidencePoints + hiddenTests.evidencePoints + behavior.evidencePoints;
    const evidenceQualityPct = Math.max(0, Math.min(100, rawEvidence - flakyTestPct * 4 - contaminationPct * 3));
    const isolationBroken = filesystem.id === 'host-mount' || network.id === 'open' || dependency.id === 'unrestricted-fetch';
    const behaviorBlocked = behavior.id === 'malicious';
    const integrityBlocked = contaminationPct > data.gates.maximumContaminationPct;
    const flaky = flakyTestPct > data.gates.maximumFlakyTestPct;
    const riskBlocked = riskPoints > data.gates.maximumRiskPoints;
    const weakEvidence = evidenceQualityPct < data.gates.minimumEvidenceQualityPct || hiddenTests.id === 'none';

    let state: 'canary' | 'hold' | 'block';
    let decision: string;
    let explanation: string;
    if (behaviorBlocked || isolationBroken || riskBlocked) {
      state = 'block';
      decision = 'Block execution and investigate';
      explanation = behaviorBlocked
        ? 'A confirmed boundary-evasion signal is a security incident candidate. Preserve the minimal forensic record and do not retry with broader permissions.'
        : 'The runner gives untrusted code an escape or supply-chain path. Remove the host, open egress, or unrestricted resolution before producing a score.';
    } else if (integrityBlocked) {
      state = 'block';
      decision = 'Block the benchmark claim';
      explanation = `Estimated contamination exceeds the ${data.gates.maximumContaminationPct}% integrity limit. More samples cannot restore independent holdout evidence.`;
    } else if (flaky || weakEvidence) {
      state = 'hold';
      decision = 'Hold for stronger evidence';
      explanation = flaky
        ? `Known-good fixtures are flaky above the ${data.gates.maximumFlakyTestPct}% limit. Stabilize the verifier before attributing failures to model code.`
        : 'The current setup lacks enough protected, independent evidence to support a release claim. Add or rotate hidden tests before widening exposure.';
    } else {
      state = 'canary';
      decision = 'Eligible for a bounded canary';
      explanation = 'The isolated path, protected evidence, and integrity checks clear this gate. A canary still needs monitoring, abort thresholds, and rollback.';
    }

    const executionPath = [
      `Pinned runtime: ${dependency.label}`,
      `Filesystem: ${filesystem.label}`,
      `Network: ${network.label}`,
      `Verifier: ${hiddenTests.label}`,
      behavior.id === 'none-observed' ? 'Record bounded outputs and exit reasons' : `Escalate signal: ${behavior.label}`,
    ];

    return { decision, evidenceQualityPct, executionPath, explanation, riskPoints, state };
  }, [behavior, contaminationPct, data, dependency, filesystem, flakyTestPct, hiddenTests, network]);

  function reset() {
    if (!data) return;
    setDependencyId(data.defaultDependencyId);
    setFilesystemId(data.defaultFilesystemId);
    setNetworkId(data.defaultNetworkId);
    setHiddenTestId(data.defaultHiddenTestId);
    setBehaviorId(data.defaultBehaviorId);
    setFlakyTestPct(data.defaultFlakyTestPct);
    setContaminationPct(data.defaultContaminationPct);
  }

  return (
    <div data-content-block="genai/code-generation-benchmarks-sandbox-evidence-gate-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Sandbox and evidence gate"
          title="A passing program is not automatically trustworthy evidence"
          description="Choose the runner boundaries and evidence conditions. The execution path, risk, evidence quality, and release decision update independently so a high score cannot hide an unsafe evaluator."
          icon={ShieldCheck}
          accent="rose"
          onReset={data ? reset : undefined}
        />

        {!data || !dependency || !filesystem || !network || !hiddenTests || !behavior || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <PolicyChoices title="1. Dependency access" options={data.dependencyPolicies} selectedId={dependency.id} icon={PackageCheck} accent="amber" onChange={setDependencyId} />
                <PolicyChoices title="2. Filesystem permissions" options={data.filesystemPolicies} selectedId={filesystem.id} icon={FileLock2} accent="rose" onChange={setFilesystemId} />
                <PolicyChoices title="3. Network permissions" options={data.networkPolicies} selectedId={network.id} icon={Network} accent="rose" onChange={setNetworkId} />
                <PolicyChoices title="4. Protected-test policy" options={data.hiddenTestPolicies} selectedId={hiddenTests.id} icon={FlaskConical} accent="blue" onChange={setHiddenTestId} />
                <LabRange
                  label="5. Flaky verifier rate"
                  value={flakyTestPct}
                  output={`${flakyTestPct}%`}
                  min={0}
                  max={15}
                  step={1}
                  lowLabel="Repeatable"
                  highLabel="Unreliable evidence"
                  accent="amber"
                  onChange={setFlakyTestPct}
                />
                <LabRange
                  label="6. Estimated contamination"
                  value={contaminationPct}
                  output={`${contaminationPct}%`}
                  min={0}
                  max={20}
                  step={1}
                  lowLabel="Independent holdout"
                  highLabel="Claim compromised"
                  accent="rose"
                  onChange={setContaminationPct}
                />
                <PolicyChoices title="7. Candidate behavior" options={data.behaviorSignals} selectedId={behavior.id} icon={AlertTriangle} accent="rose" onChange={setBehaviorId} />
              </div>
            )}
          >
            <div className="min-w-0 space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <LabMetric label="Release decision" value={model.state === 'canary' ? 'Canary' : model.state === 'hold' ? 'Hold' : 'Block'} detail={model.decision} icon={model.state === 'canary' ? CheckCircle2 : ShieldX} tone={stateTone(model.state)} />
                <LabMetric label="Execution risk" value={`${model.riskPoints} points`} detail={`Maximum allowed: ${data.gates.maximumRiskPoints}`} icon={ShieldX} tone={model.riskPoints <= data.gates.maximumRiskPoints ? 'emerald' : 'rose'} />
                <LabMetric label="Evidence quality" value={`${model.evidenceQualityPct}%`} detail={`Gate: ${data.gates.minimumEvidenceQualityPct}%`} icon={CircleAlert} tone={model.evidenceQualityPct >= data.gates.minimumEvidenceQualityPct ? 'blue' : 'amber'} />
              </div>

              <section className={`rounded-md border p-4 ${model.state === 'canary' ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50' : model.state === 'hold' ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'}`}>
                <h4 className="font-semibold">{model.decision}</h4>
                <p className="mt-1 text-sm leading-6 opacity-90">{model.explanation}</p>
              </section>

              <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Execution path</h4>
                <ol className="mt-3 space-y-3 text-sm text-neutral-700 dark:text-neutral-200">
                  {model.executionPath.map((step, index) => (
                    <li key={step} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-xs font-semibold tabular-nums dark:border-neutral-700">{index + 1}</span><span className="pt-0.5 leading-5">{step}</span></li>
                  ))}
                </ol>
              </section>

              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">Evidence quality is a teaching model, not a certification calculation. Its purpose is to show that test independence and verifier reliability are separate from an evaluator's containment controls.</p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function PolicyChoices({
  title,
  options,
  selectedId,
  icon,
  accent,
  onChange,
}: {
  title: string;
  options: Array<Policy | HiddenTestPolicy>;
  selectedId: string;
  icon: typeof PackageCheck;
  accent: 'amber' | 'blue' | 'rose';
  onChange: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{title}</legend>
      <div className="mt-3 space-y-2">
        {options.map((item) => (
          <LabChoice key={item.id} selected={item.id === selectedId} label={item.label} detail={item.detail} icon={icon} accent={accent} onClick={() => onChange(item.id)} />
        ))}
      </div>
    </fieldset>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="min-h-[360px] p-6" aria-live="polite">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
          <p className="font-semibold">The sandbox gate could not load.</p>
          <p className="mt-1 opacity-80">{error}</p>
          <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-2 rounded-md border border-current px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"><RefreshCw aria-hidden="true" className="h-4 w-4" />Retry</button>
        </div>
      ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading sandbox gate...</p>}
    </div>
  );
}
