'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleAlert,
  Eye,
  FileCheck2,
  Image as ImageIcon,
  LoaderCircle,
  ScanSearch,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Action = 'block-input' | 'block-output' | 'hold-review' | 'release' | 'release-gap';
type StageState = 'pass' | 'block' | 'hold' | 'skip' | 'gap';

type ReleasePolicy = {
  id: string;
  label: string;
  detail: string;
  inputBlockThreshold: number;
  outputBlockThreshold: number;
  outputReviewThreshold: number;
  identityReviewThreshold: number;
  humanReview: boolean;
  provenance: boolean;
  decisionEvidence: boolean;
};

type ReleaseScenario = {
  id: string;
  label: string;
  prompt: string;
  candidate: string;
  promptRisk: number;
  outputRisk: number;
  identityRisk: number;
  provenanceRequired: boolean;
  recommendedPolicyId: string;
  lesson: string;
};

type ReleaseGateData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    policyId: string;
  };
  policies: ReleasePolicy[];
  scenarios: ReleaseScenario[];
};

const BLOCK_ID = 'genai/text-to-image-system-design-release-gate-lab';

function isReleaseGateData(value: unknown): value is ReleaseGateData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseGateData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((policy) => (
        typeof policy.id === 'string'
        && typeof policy.inputBlockThreshold === 'number'
        && typeof policy.outputBlockThreshold === 'number'
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

export default function TextToImageSystemDesignReleaseGateLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseGateData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No release-policy scenarios were supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReleaseGateData(payload)) {
          throw new Error('Release-policy data is incomplete.');
        }
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load release-policy data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {loadError ? <LoadError detail={loadError} /> : data ? <ReleaseGateLab data={data} /> : <LoadState />}
    </div>
  );
}

function ReleaseGateLab({ data }: { data: ReleaseGateData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialPolicy = data.policies.find((item) => item.id === data.defaults.policyId)
    ?? data.policies[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [policyId, setPolicyId] = useState(initialPolicy.id);
  const [outputBlockThreshold, setOutputBlockThreshold] = useState(
    initialPolicy.outputBlockThreshold,
  );

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const inputBlocked = scenario.promptRisk >= policy.inputBlockThreshold;
    const outputBlocked = !inputBlocked && scenario.outputRisk >= outputBlockThreshold;
    const needsReview = !inputBlocked
      && !outputBlocked
      && (
        scenario.outputRisk >= policy.outputReviewThreshold
        || scenario.identityRisk >= policy.identityReviewThreshold
      );
    const reviewHeld = needsReview && policy.humanReview;
    const missingProvenance = scenario.provenanceRequired && !policy.provenance;
    const evidenceGap = !policy.decisionEvidence;
    const unmanagedReview = needsReview && !policy.humanReview;
    const releasedWithGap = !inputBlocked
      && !outputBlocked
      && !reviewHeld
      && (missingProvenance || evidenceGap || unmanagedReview);

    let action: Action = 'release';
    let title = 'Released with policy evidence';
    let detail = 'The candidate passed both configured gates and the release controls are available.';

    if (inputBlocked) {
      action = 'block-input';
      title = 'Blocked before GPU scheduling';
      detail = `Prompt risk ${scenario.promptRisk} crossed the policy threshold ${policy.inputBlockThreshold}.`;
    } else if (outputBlocked) {
      action = 'block-output';
      title = 'Candidate blocked after generation';
      detail = `Output risk ${scenario.outputRisk} crossed the tuned output threshold ${outputBlockThreshold}.`;
    } else if (reviewHeld) {
      action = 'hold-review';
      title = 'Held for accountable review';
      detail = scenario.identityRisk >= policy.identityReviewThreshold
        ? `Identity risk ${scenario.identityRisk} crossed the review threshold ${policy.identityReviewThreshold}.`
        : `Output risk ${scenario.outputRisk} crossed the review threshold ${policy.outputReviewThreshold}.`;
    } else if (releasedWithGap) {
      action = 'release-gap';
      title = 'Released with an unmanaged policy gap';
      const gaps = [
        unmanagedReview ? 'required review is unavailable' : null,
        missingProvenance ? 'required provenance is missing' : null,
        evidenceGap ? 'decision evidence is not retained' : null,
      ].filter(Boolean);
      detail = gaps.join('; ');
    }

    const stages: Array<{
      id: string;
      eyebrow: string;
      title: string;
      detail: string;
      state: StageState;
      icon: typeof ShieldCheck;
    }> = [
      {
        id: 'prompt',
        eyebrow: '1. Prompt gate',
        title: inputBlocked ? 'Request blocked' : 'Request admitted',
        detail: `${scenario.promptRisk} risk / ${policy.inputBlockThreshold} block threshold`,
        state: inputBlocked ? 'block' : 'pass',
        icon: ShieldCheck,
      },
      {
        id: 'generate',
        eyebrow: '2. Generation',
        title: inputBlocked ? 'GPU work avoided' : 'Candidate created',
        detail: inputBlocked ? 'The job stops before scheduling.' : 'Pixels remain untrusted output.',
        state: inputBlocked ? 'skip' : 'pass',
        icon: ImageIcon,
      },
      {
        id: 'output',
        eyebrow: '3. Output gate',
        title: inputBlocked ? 'Not evaluated' : outputBlocked ? 'Candidate blocked' : 'Candidate inspected',
        detail: inputBlocked ? 'No candidate exists.' : `${scenario.outputRisk} output risk / ${outputBlockThreshold} tuned block threshold`,
        state: inputBlocked ? 'skip' : outputBlocked ? 'block' : 'pass',
        icon: ScanSearch,
      },
      {
        id: 'release',
        eyebrow: '4. Final action',
        title,
        detail,
        state: action === 'release' ? 'pass' : action === 'hold-review' ? 'hold' : action === 'release-gap' ? 'gap' : 'skip',
        icon: action === 'hold-review' ? UserCheck : action === 'release' ? BadgeCheck : Ban,
      },
    ];

    const controlCount = [
      !inputBlocked,
      !inputBlocked,
      policy.humanReview,
      policy.provenance,
      policy.decisionEvidence,
    ].filter(Boolean).length;

    return {
      action,
      controlCount,
      detail,
      inputBlocked,
      missingProvenance,
      outputBlocked,
      stages,
      title,
    };
  }, [outputBlockThreshold, policy, scenario]);

  const chooseScenario = (next: ReleaseScenario) => {
    const recommended = data.policies.find((item) => item.id === next.recommendedPolicyId)
      ?? initialPolicy;
    setScenarioId(next.id);
    setPolicyId(recommended.id);
    setOutputBlockThreshold(recommended.outputBlockThreshold);
  };

  const choosePolicy = (next: ReleasePolicy) => {
    setPolicyId(next.id);
    setOutputBlockThreshold(next.outputBlockThreshold);
  };

  const reset = () => {
    setScenarioId(initialScenario.id);
    setPolicyId(initialPolicy.id);
    setOutputBlockThreshold(initialPolicy.outputBlockThreshold);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Release policy lab"
        title={data.title}
        description={data.description}
        icon={ShieldCheck}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Prompt and candidate
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.prompt}
                    icon={item.identityRisk >= 50 ? Users : item.promptRisk >= 70 ? Ban : ImageIcon}
                    accent={item.promptRisk >= 70 ? 'rose' : item.identityRisk >= 50 ? 'violet' : 'blue'}
                    onClick={() => chooseScenario(item)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Policy template
              </legend>
              <div className="mt-3 space-y-2">
                {data.policies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.humanReview ? UserCheck : Eye}
                    accent={item.id === 'strict-publication' ? 'rose' : item.id === 'two-gate-product' ? 'emerald' : 'amber'}
                    onClick={() => choosePolicy(item)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Output block threshold"
              value={outputBlockThreshold}
              output={`${outputBlockThreshold} / 100`}
              min={40}
              max={100}
              step={5}
              accent="rose"
              lowLabel="Block more"
              highLabel="Block less"
              onChange={setOutputBlockThreshold}
            />
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <div className={`rounded-md border p-4 ${actionClasses(result.action)}`}>
            <div className="flex items-start gap-3">
              {result.action === 'release' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div className="min-w-0">
                <p className="font-semibold">{result.title}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Final action" value={actionLabel(result.action)} detail={scenario.lesson} icon={result.action === 'release' ? BadgeCheck : result.action === 'hold-review' ? UserCheck : Ban} tone={actionTone(result.action)} />
            <LabMetric label="Compute spent" value={result.inputBlocked ? 'No' : 'Yes'} detail={result.inputBlocked ? 'Admission stopped the job before GPU work.' : 'Output evidence exists only after generation.'} icon={ImageIcon} tone={result.inputBlocked ? 'emerald' : 'violet'} />
            <LabMetric label="Controls active" value={`${result.controlCount} / 5`} detail="Input, output, review, provenance, and decision evidence." icon={ShieldCheck} tone={result.controlCount >= 4 ? 'emerald' : 'amber'} />
            <LabMetric label="Provenance" value={policy.provenance ? 'Attached' : scenario.provenanceRequired ? 'Missing' : 'Not configured'} detail={scenario.provenanceRequired ? 'This scenario requires a portable provenance control.' : 'Product policy still decides whether provenance is useful.'} icon={FileCheck2} tone={result.missingProvenance ? 'rose' : policy.provenance ? 'blue' : 'neutral'} />
          </div>

          <section aria-label="Release gate trace">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Decision trace</p>
              <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Follow the same evidence through every boundary</h4>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-4">
              {result.stages.map((stage) => (
                <GateStage key={stage.id} {...stage} />
              ))}
            </div>
          </section>

          <section className="border-t border-neutral-200 pt-5 dark:border-neutral-800">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.72fr)]">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Observed candidate</p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{scenario.candidate}</p>
                <p className="mt-3 text-sm font-medium text-neutral-950 dark:text-white">{scenario.lesson}</p>
              </div>
              <div className="space-y-3">
                <RiskBar label="Prompt risk" value={scenario.promptRisk} threshold={policy.inputBlockThreshold} tone="blue" />
                <RiskBar label="Output risk" value={scenario.outputRisk} threshold={outputBlockThreshold} tone="rose" />
                <RiskBar label="Identity risk" value={scenario.identityRisk} threshold={policy.identityReviewThreshold} tone="violet" />
              </div>
            </div>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function GateStage({
  eyebrow,
  title,
  detail,
  state,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  state: StageState;
  icon: typeof ShieldCheck;
}) {
  const styles: Record<StageState, string> = {
    pass: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    block: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50',
    hold: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50',
    gap: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-50',
    skip: 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
  };
  return (
    <div className={`min-w-0 rounded-md border p-4 ${styles[state]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase opacity-75">{eyebrow}</p>
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      </div>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function RiskBar({
  label,
  value,
  threshold,
  tone,
}: {
  label: string;
  value: number;
  threshold: number;
  tone: 'blue' | 'rose' | 'violet';
}) {
  const colors = {
    blue: 'bg-blue-500 dark:bg-blue-400',
    rose: 'bg-rose-500 dark:bg-rose-400',
    violet: 'bg-violet-500 dark:bg-violet-400',
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-neutral-700 dark:text-neutral-200">{label}</span>
        <span className="tabular-nums text-neutral-500 dark:text-neutral-400">{value} / threshold {threshold}</span>
      </div>
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${colors[tone]}`} style={{ width: `${Math.max(3, value)}%` }} />
        <span aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-neutral-950 dark:bg-white" style={{ left: `${Math.min(99, threshold)}%` }} />
      </div>
    </div>
  );
}

function actionLabel(action: Action) {
  if (action === 'block-input') return 'Block prompt';
  if (action === 'block-output') return 'Block candidate';
  if (action === 'hold-review') return 'Human review';
  if (action === 'release-gap') return 'Release with gap';
  return 'Release';
}

function actionTone(action: Action): 'emerald' | 'amber' | 'rose' | 'violet' {
  if (action === 'release') return 'emerald';
  if (action === 'hold-review') return 'amber';
  if (action === 'release-gap') return 'violet';
  return 'rose';
}

function actionClasses(action: Action) {
  if (action === 'release') return 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50';
  if (action === 'hold-review') return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-50';
  if (action === 'release-gap') return 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/35 dark:text-violet-50';
  return 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50';
}

function LoadState() {
  return (
    <LearningLab>
      <LearningLabHeader eyebrow="Release policy lab" title="Loading release scenarios" description="Preparing prompt, output, review, and provenance evidence." icon={ShieldCheck} accent="rose" />
      <LearningLabBody><div className="flex min-h-40 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300"><LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />Loading policy evidence...</div></LearningLabBody>
    </LearningLab>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <LearningLab>
      <LearningLabHeader eyebrow="Release policy lab" title="Release scenarios unavailable" description="The lesson could not load its local policy model." icon={CircleAlert} accent="rose" />
      <LearningLabBody><p className="text-sm text-rose-700 dark:text-rose-300">{detail}</p></LearningLabBody>
    </LearningLab>
  );
}
