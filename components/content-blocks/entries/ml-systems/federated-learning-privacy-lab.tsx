'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  CircleAlert,
  Eye,
  Gauge,
  Lock,
  Scale,
  Server,
  Shield,
  TimerReset,
  TriangleAlert,
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

interface ThreatScenario {
  id: string;
  label: string;
  detail: string;
  category: string;
  releaseThreshold: number;
  observableSignal: string;
}

interface DefenseStack {
  id: string;
  label: string;
  detail: string;
  hasDifferentialPrivacy: boolean;
  utilityPenaltyPct: number;
  accountingPressureAt50Rounds: number;
  computeOverheadPct: number;
  protections: string[];
  limitation: string;
  residualRisk: Record<string, number>;
}

interface PrivacyLabData {
  title: string;
  description: string;
  defaults: {
    threatId: string;
    stackId: string;
    rounds: number;
  };
  threats: ThreatScenario[];
  defenseStacks: DefenseStack[];
}

const BLOCK_ID = 'ml-systems/federated-learning-privacy-lab';

function isPrivacyLabData(value: unknown): value is PrivacyLabData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PrivacyLabData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.threats)
      && candidate.threats.length > 0
      && Array.isArray(candidate.defenseStacks)
      && candidate.defenseStacks.length > 0,
  );
}

export default function FederatedLearningPrivacyLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<PrivacyLabData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No threat-model data was supplied.');
      return;
    }

    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isPrivacyLabData(payload)) throw new Error('Threat-model data is incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the threat model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabState title="Threat lab unavailable" detail={loadError} />;
  if (!data) return <LabState title="Loading threat model" detail="Preparing defense stacks and release criteria." />;

  return <PrivacyLabContent data={data} />;
}

function PrivacyLabContent({ data }: { data: PrivacyLabData }) {
  const [threatId, setThreatId] = useState(data.defaults.threatId);
  const [stackId, setStackId] = useState(data.defaults.stackId);
  const [rounds, setRounds] = useState(data.defaults.rounds);

  const threat = data.threats.find((item) => item.id === threatId) ?? data.threats[0];
  const stack = data.defenseStacks.find((item) => item.id === stackId) ?? data.defenseStacks[0];
  const result = useMemo(() => {
    const residualRisk = stack.residualRisk[threat.id] ?? 100;
    const accountingPressure = stack.hasDifferentialPrivacy
      ? Math.min(100, stack.accountingPressureAt50Rounds * Math.sqrt(rounds / 50))
      : null;
    const repeatedReleasePenalty = stack.hasDifferentialPrivacy ? Math.max(0, rounds - 50) * 0.025 : 0;
    const utilityRetention = Math.max(50, 100 - stack.utilityPenaltyPct - repeatedReleasePenalty);
    const budgetHealthy = accountingPressure === null || accountingPressure < 85;
    const threatControlled = residualRisk <= threat.releaseThreshold;

    return {
      accountingPressure,
      budgetHealthy,
      releaseReady: budgetHealthy && threatControlled,
      residualRisk,
      threatControlled,
      utilityRetention,
    };
  }, [rounds, stack, threat]);

  const reset = () => {
    setThreatId(data.defaults.threatId);
    setStackId(data.defaults.stackId);
    setRounds(data.defaults.rounds);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Threat-model lab"
          title={data.title}
          description={data.description}
          icon={Shield}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Threat to control
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.threats.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === threat.id}
                      label={item.label}
                      detail={item.detail}
                      icon={threatIcon(item.category)}
                      accent="rose"
                      onClick={() => setThreatId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Defense stack
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.defenseStacks.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === stack.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.hasDifferentialPrivacy ? Lock : Shield}
                      accent={item.id === 'hardened-release' ? 'emerald' : 'blue'}
                      onClick={() => setStackId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Cumulative releases"
                value={rounds}
                output={`${rounds} rounds`}
                min={10}
                max={300}
                step={10}
                accent="amber"
                lowLabel="Early training"
                highLabel="More composition"
                onChange={setRounds}
              />
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.releaseReady ? healthyClass : warningClass}`}>
              <div className="flex items-start gap-3">
                {result.releaseReady ? (
                  <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Threat-specific verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {result.releaseReady ? 'The selected stack clears this modeled gate' : 'Do not release with this configuration'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {!result.threatControlled
                      ? `${stack.label} leaves too much residual ${threat.category} risk for ${threat.label.toLowerCase()}. Add a control aimed at this attacker rather than relying on data locality.`
                      : !result.budgetHealthy
                        ? 'The defense controls this threat, but repeated differentially private releases have exhausted the illustrative accounting envelope. Stop, reduce releases, or approve a new budget.'
                        : `The modeled controls address ${threat.label.toLowerCase()}, but the stated limitation and operational evidence still belong in release review.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Residual threat risk"
                value={`${result.residualRisk}/100`}
                detail={`Modeled gate: at most ${threat.releaseThreshold}`}
                icon={Gauge}
                tone={result.threatControlled ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Privacy accounting"
                value={result.accountingPressure === null ? 'No formal bound' : `${result.accountingPressure.toFixed(0)}/100`}
                detail={result.accountingPressure === null ? 'This stack does not include differential privacy' : 'Illustrative composition pressure, not epsilon'}
                icon={TimerReset}
                tone={result.accountingPressure === null || !result.budgetHealthy ? 'amber' : 'cyan'}
              />
              <LabMetric
                label="Utility retained"
                value={`${result.utilityRetention.toFixed(1)}%`}
                detail="Illustrative quality envelope before measurement"
                icon={Scale}
                tone="violet"
              />
              <LabMetric
                label="Compute overhead"
                value={`+${stack.computeOverheadPct}%`}
                detail="Modeled cryptography, validation, and accounting"
                icon={Activity}
                tone="blue"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                  <Shield aria-hidden="true" className="h-4 w-4" />
                  Controls present
                </div>
                <ul className="mt-3 space-y-2 text-sm leading-6">
                  {stack.protections.map((protection) => (
                    <li key={protection} className="flex gap-2">
                      <BadgeCheck aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
                      <span>{protection}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                  <CircleAlert aria-hidden="true" className="h-4 w-4" />
                  Remaining limitation
                </div>
                <p className="mt-3 text-sm leading-6">{stack.limitation}</p>
                <div className="mt-4 border-t border-current/20 pt-4">
                  <p className="text-xs font-semibold uppercase opacity-75">Evidence to monitor</p>
                  <p className="mt-2 text-sm leading-6">{threat.observableSignal}</p>
                </div>
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Scores compare control coverage for teaching; they are not a privacy proof, attack
              probability, or substitute for an accountant. Production differential privacy must
              define adjacency, clipping, sampling, noise, delta, composition, and the release unit.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function threatIcon(category: string) {
  if (category === 'confidentiality') return Eye;
  if (category === 'integrity') return Server;
  if (category === 'availability') return Users;
  return Shield;
}

function LabState({ title, detail }: { title: string; detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{detail}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const healthyClass =
  'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass =
  'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
