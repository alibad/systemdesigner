'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileCheck2,
  GitBranch,
  Lightbulb,
  Route,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Mode = {
  id: string;
  label: string;
  detail: string;
  strength: string;
  blindSpot: string;
};

type EvidencePolicy = {
  id: string;
  label: string;
  detail: string;
  supports: string[];
  evidenceScore: number;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  question: string;
  requiredMode: string;
  requiredEvidence: string;
  claim: string;
  failure: string;
};

type LabData = {
  title: string;
  description: string;
  defaults: { scenarioId: string; modeId: string; evidenceId: string };
  modes: Mode[];
  evidencePolicies: EvidencePolicy[];
  scenarios: Scenario[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      data.defaults &&
      Array.isArray(data.modes) && data.modes.length > 0 &&
      Array.isArray(data.evidencePolicies) && data.evidencePolicies.length > 0 &&
      Array.isArray(data.scenarios) && data.scenarios.length > 0,
  );
}

export default function AdvancedReasoningContractLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No reasoning-contract model was supplied.');
      return;
    }
    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load lab data (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('Reasoning-contract data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load lab data.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError message={error} />;
  if (!data) return <LoadState label="Loading reasoning contract lab" />;
  return <ContractLab data={data} />;
}

function ContractLab({ data }: { data: LabData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [modeId, setModeId] = useState(data.defaults.modeId);
  const [evidenceId, setEvidenceId] = useState(data.defaults.evidenceId);

  const result = useMemo(() => {
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const mode = data.modes.find((item) => item.id === modeId) ?? data.modes[0];
    const evidence = data.evidencePolicies.find((item) => item.id === evidenceId) ?? data.evidencePolicies[0];
    const modeFits = mode.id === scenario.requiredMode;
    const evidenceFits = evidence.id === scenario.requiredEvidence;
    const evidenceSupportsMode = evidence.supports.includes(mode.id);
    const readiness = Math.round(
      (modeFits ? 55 : 10) + (evidenceFits ? 30 : evidenceSupportsMode ? 18 : 4) + evidence.evidenceScore * 0.15,
    );
    const accepted = modeFits && evidenceFits;
    const verdict = accepted
      ? 'The claim is supported by the selected contract'
      : !modeFits
        ? 'The engine answers a different kind of question'
        : 'The evidence cannot justify this claim yet';
    return { scenario, mode, evidence, modeFits, evidenceFits, readiness: Math.min(100, readiness), accepted, verdict };
  }, [data, evidenceId, modeId, scenarioId]);

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setModeId(data.defaults.modeId);
    setEvidenceId(data.defaults.evidenceId);
  }

  return (
    <div data-content-block="ml-systems/advanced-reasoning-contract-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Reasoning contract lab"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Choose the claim</legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice key={scenario.id} selected={scenario.id === result.scenario.id} label={scenario.label} detail={scenario.detail} icon={Lightbulb} accent="violet" onClick={() => setScenarioId(scenario.id)} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Choose an engine</legend>
                <div className="mt-3 space-y-2">
                  {data.modes.map((mode) => (
                    <LabChoice key={mode.id} selected={mode.id === result.mode.id} label={mode.label} detail={mode.detail} icon={mode.id === 'causal' ? GitBranch : mode.id === 'adaptive' ? Sparkles : Scale} accent="cyan" onClick={() => setModeId(mode.id)} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Set the evidence boundary</legend>
                <div className="mt-3 space-y-2">
                  {data.evidencePolicies.map((policy) => (
                    <LabChoice key={policy.id} selected={policy.id === result.evidence.id} label={policy.label} detail={policy.detail} icon={FileCheck2} accent="emerald" onClick={() => setEvidenceId(policy.id)} />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Requested conclusion</p>
                <h4 className="mt-1 max-w-2xl text-xl font-semibold text-neutral-950 dark:text-white">{result.scenario.question}</h4>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${result.accepted ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100' : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100'}`}>
                {result.accepted ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                {result.accepted ? 'Contract holds' : 'Unsupported claim'}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <LabMetric label="Contract readiness" value={`${result.readiness}%`} detail="Fit between question, engine, and evidence" icon={ShieldCheck} tone={result.accepted ? 'emerald' : 'rose'} />
              <LabMetric label="Engine" value={result.mode.label} detail={result.mode.strength} icon={BrainCircuit} tone="violet" />
              <LabMetric label="Evidence" value={`${result.evidence.evidenceScore}%`} detail={result.evidence.label} icon={FileCheck2} tone="cyan" />
            </div>

            <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="grid items-stretch gap-2 md:flex md:gap-3">
                {[
                  ['Question', result.scenario.label],
                  ['Representation', result.mode.id === 'symbolic' ? 'Facts + rules' : result.mode.id === 'causal' ? 'Graph + assumptions' : 'Support + query tasks'],
                  ['Engine', result.mode.label],
                  ['Claim', result.accepted ? result.scenario.claim : 'Abstain or redesign'],
                ].map(([label, value], index, items) => (
                  <div key={label} className="contents">
                    <div className={`min-w-0 rounded-md border p-3 md:flex-1 ${index === items.length - 1 && !result.accepted ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30' : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950'}`}>
                      <p className="text-[11px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
                      <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{value}</p>
                    </div>
                    {index < items.length - 1 ? <ArrowRight className="mx-auto h-5 w-5 shrink-0 rotate-90 text-neutral-400 md:mx-0 md:mt-8 md:rotate-0" aria-hidden="true" /> : null}
                  </div>
                ))}
              </div>
            </div>

            <div className={`mt-6 rounded-md border p-4 ${result.accepted ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'}`}>
              <p className="font-semibold text-neutral-950 dark:text-white">{result.verdict}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {result.accepted ? result.scenario.claim : !result.modeFits ? result.scenario.failure : `Replace ${result.evidence.label.toLowerCase()} with evidence that matches the requested decision boundary.`}
              </p>
              <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-400"><strong>Engine blind spot:</strong> {result.mode.blindSpot}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState({ label }: { label: string }) {
  return <div className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" aria-label={label} />;
}

function LoadError({ message }: { message: string }) {
  return <p className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{message}</p>;
}
