'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Database,
  Gauge,
  HardDrive,
  RadioTower,
  RefreshCw,
  Search,
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

type Scenario = {
  id: string;
  label: string;
  description: string;
  dailyActiveUsers: number;
  actionsPerUser: number;
  readPercent: number;
  payloadKiB: number;
  retentionDays: number;
  peakFactor: number;
  sloMs: number;
  invariant: string;
  missingQuestions: string[];
};

type FramingData = { scenarios: Scenario[] };

const BLOCK_ID = 'fundamentals/system-design-framework-framing-lab';
const DEFAULT_DATA_FILE = '/api/content/fundamentals/system-design-framework/data/requirements-scale-scenarios.json';

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatStorage(gibibytes: number) {
  if (gibibytes >= 1024) return `${(gibibytes / 1024).toFixed(1)} TiB`;
  return `${Math.max(1, gibibytes).toFixed(gibibytes < 10 ? 1 : 0)} GiB`;
}

export default function SystemDesignFrameworkFramingLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<FramingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [peakFactor, setPeakFactor] = useState(1);
  const [retentionDays, setRetentionDays] = useState(1);
  const [sloMs, setSloMs] = useState(500);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as FramingData;
        if (!Array.isArray(payload.scenarios) || payload.scenarios.length === 0) {
          throw new Error('The framing lab has no product scenarios.');
        }

        if (active) {
          const first = payload.scenarios[0];
          setData(payload);
          setScenarioId(first.id);
          setPeakFactor(first.peakFactor);
          setRetentionDays(first.retentionDays);
          setSloMs(first.sloMs);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load framing data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId) ?? data?.scenarios[0];
  const model = useMemo(() => {
    if (!scenario) return null;

    const dailyActions = scenario.dailyActiveUsers * scenario.actionsPerUser;
    const peakQps = (dailyActions / 86_400) * peakFactor;
    const readQps = peakQps * (scenario.readPercent / 100);
    const writeQps = peakQps - readQps;
    const storageGiB = (dailyActions * (1 - scenario.readPercent / 100) * scenario.payloadKiB * retentionDays) / (1024 * 1024);
    const bandwidthMiB = (peakQps * scenario.payloadKiB) / 1024;
    const bottleneck = scenario.payloadKiB >= 10
      ? 'Payload delivery and media storage'
      : writeQps >= 400 && sloMs <= 300
        ? 'Contention on the correctness-critical write'
        : peakQps >= 2_000
          ? 'Read fan-out and hot-key pressure'
          : 'Freshness of the derived customer view';
    const extraQuestion = sloMs <= 300
      ? `Which path must stay below ${sloMs} ms p95, and which work can happen after the response?`
      : `Can the user see a labeled pending or stale result within ${sloMs} ms when a dependency slows down?`;

    return { bandwidthMiB, bottleneck, dailyActions, extraQuestion, peakQps, readQps, storageGiB, writeQps };
  }, [peakFactor, retentionDays, scenario, sloMs]);

  function chooseScenario(nextScenario: Scenario) {
    setScenarioId(nextScenario.id);
    setPeakFactor(nextScenario.peakFactor);
    setRetentionDays(nextScenario.retentionDays);
    setSloMs(nextScenario.sloMs);
  }

  const reset = data ? () => chooseScenario(data.scenarios[0]) : undefined;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Requirements and scale lab"
          title="Make the product brief constrain the design"
          description="Choose a product scenario, then change its peak, retention, and user-facing target. The derived pressure shows what to clarify before drawing boxes."
          icon={Search}
          accent="cyan"
          onReset={reset}
        />

        {!data || !scenario || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((current) => current + 1)} />
        ) : (
          <LearningLabBody
            controls={
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Product scenario</legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((option) => (
                      <LabChoice
                        key={option.id}
                        selected={scenario.id === option.id}
                        label={option.label}
                        detail={option.description}
                        icon={Users}
                        accent="cyan"
                        onClick={() => chooseScenario(option)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Peak multiplier"
                  value={peakFactor}
                  output={`${peakFactor}x average`}
                  min={2}
                  max={50}
                  step={1}
                  accent="violet"
                  lowLabel="Steady demand"
                  highLabel="Short burst"
                  onChange={setPeakFactor}
                />

                <LabRange
                  label="Retention"
                  value={retentionDays}
                  output={`${formatCount(retentionDays)} days`}
                  min={30}
                  max={3650}
                  step={30}
                  accent="amber"
                  lowLabel="30 days"
                  highLabel="10 years"
                  onChange={setRetentionDays}
                />

                <LabRange
                  label="p95 response target"
                  value={sloMs}
                  output={`${sloMs} ms`}
                  min={100}
                  max={1000}
                  step={50}
                  accent="emerald"
                  lowLabel="100 ms"
                  highLabel="1 s"
                  onChange={setSloMs}
                />
              </div>
            }
          >
            <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900 dark:bg-cyan-950/40">
              <p className="text-xs font-semibold uppercase text-cyan-800 dark:text-cyan-200">Problem statement</p>
              <p className="mt-2 text-sm leading-6 text-cyan-950 dark:text-cyan-50">
                Design {scenario.label.toLowerCase()} for {formatCount(scenario.dailyActiveUsers)} daily active users, with a {peakFactor}x peak and {sloMs} ms p95 target. Protect this invariant: {scenario.invariant}
              </p>
            </div>

            <div className="mt-5 grid gap-3 grid-cols-2 xl:grid-cols-4">
              <BriefFact label="Users" value={`${formatCount(scenario.dailyActiveUsers)} daily`} />
              <BriefFact label="Actions" value={`${scenario.actionsPerUser} per user/day`} />
              <BriefFact label="Read / write mix" value={`${scenario.readPercent}% / ${100 - scenario.readPercent}%`} />
              <BriefFact label="Payload" value={`${scenario.payloadKiB} KiB/action`} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Peak QPS" value={formatCount(model.peakQps)} detail={`${formatCount(model.dailyActions)} actions/day`} icon={Gauge} tone="cyan" />
              <LabMetric label="Read / write" value={`${formatCount(model.readQps)} / ${formatCount(model.writeQps)}`} detail={`${scenario.readPercent}% reads`} icon={Activity} tone="violet" />
              <LabMetric label="Retained writes" value={formatStorage(model.storageGiB)} detail={`${formatCount(retentionDays)} days at ${scenario.payloadKiB} KiB`} icon={HardDrive} tone="amber" />
              <LabMetric label="Peak bandwidth" value={`${model.bandwidthMiB.toFixed(1)} MiB/s`} detail="Payloads at peak QPS" icon={RadioTower} tone="blue" />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
                <p className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-200">Likely first bottleneck</p>
                <p className="mt-2 text-sm font-semibold text-amber-950 dark:text-amber-50">{model.bottleneck}</p>
                <p className="mt-1 text-sm leading-6 text-amber-900 dark:text-amber-100">This is a starting hypothesis, not a component choice. Ask for the path and measurement that could disprove it.</p>
              </div>
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Questions still missing</p>
                <ul className="mt-2 space-y-2 pl-5 text-sm leading-6 text-neutral-700 marker:text-neutral-500 dark:text-neutral-200 dark:marker:text-neutral-400">
                  {[...scenario.missingQuestions.slice(0, 2), model.extraQuestion].map((question) => <li key={question}>{question}</li>)}
                </ul>
              </div>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function BriefFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-neutral-950 dark:text-white">{value}</p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (error) {
    return <div className="min-h-[420px] p-6"><div className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert"><TriangleAlert aria-hidden="true" className="h-5 w-5" /><p className="mt-3 font-semibold">Requirements data could not be loaded</p><p className="mt-1 leading-6">{error}</p><button type="button" onClick={onRetry} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-rose-400 px-3 font-semibold hover:border-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"><RefreshCw aria-hidden="true" className="h-4 w-4" />Try again</button></div></div>;
  }

  return <div className="flex min-h-[420px] items-center justify-center p-6" role="status"><div className="text-center text-sm text-neutral-600 dark:text-neutral-300"><Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-cyan-500 motion-reduce:animate-none" /><p className="mt-3">Loading product constraints...</p></div></div>;
}
