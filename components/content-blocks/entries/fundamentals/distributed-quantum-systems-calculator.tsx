'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Atom,
  CheckCircle2,
  Clock3,
  Gauge,
  GitBranch,
  Radio,
  RefreshCw,
  Sparkles,
  TimerReset,
  TriangleAlert,
  Waves,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ScheduleId = 'same-round' | 'buffered';
type PurificationId = 'none' | 'bbpssw';

type LinkProfile = {
  id: string;
  label: string;
  detail: string;
  linkDistanceKm: number;
  elementarySuccessProbability: number;
  elementaryFidelity: number;
  attemptsPerSecond: number;
  swapSuccessProbability: number;
  swapOperationFidelity: number;
  memoryLifetimeMs: number;
};

type EntanglementBudgetModel = {
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    profileId: string;
    hops: number;
    scheduleId: ScheduleId;
    purificationId: PurificationId;
    targetFidelityPercent: number;
  };
  bounds: {
    hops: { min: number; max: number; step: number };
    targetFidelityPercent: { min: number; max: number; step: number };
  };
  schedules: Array<{
    id: ScheduleId;
    label: string;
    detail: string;
  }>;
  purificationModes: Array<{
    id: PurificationId;
    label: string;
    detail: string;
  }>;
  profiles: LinkProfile[];
};

const BLOCK_ID = 'fundamentals/distributed-quantum-systems-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/distributed-quantum-systems/data/entanglement-budget-model.json';

function isBudgetModel(value: unknown): value is EntanglementBudgetModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<EntanglementBudgetModel>;

  return Boolean(
    model.title
      && model.description
      && model.modelNote
      && model.defaults?.profileId
      && model.defaults.scheduleId
      && model.defaults.purificationId
      && typeof model.defaults.hops === 'number'
      && typeof model.defaults.targetFidelityPercent === 'number'
      && model.bounds?.hops
      && model.bounds.targetFidelityPercent
      && Array.isArray(model.schedules)
      && model.schedules.length === 2
      && Array.isArray(model.purificationModes)
      && model.purificationModes.length === 2
      && Array.isArray(model.profiles)
      && model.profiles.length >= 3
      && model.profiles.every((profile) => (
        typeof profile.id === 'string'
        && typeof profile.linkDistanceKm === 'number'
        && typeof profile.elementarySuccessProbability === 'number'
        && typeof profile.elementaryFidelity === 'number'
        && typeof profile.attemptsPerSecond === 'number'
        && typeof profile.swapSuccessProbability === 'number'
        && typeof profile.swapOperationFidelity === 'number'
        && typeof profile.memoryLifetimeMs === 'number'
      )),
  );
}

function expectedMaximumGeometricRounds(linkCount: number, probability: number) {
  let expected = 0;

  for (let completedRounds = 0; completedRounds < 100_000; completedRounds += 1) {
    const oneLinkDone = 1 - Math.pow(1 - probability, completedRounds);
    const tail = 1 - Math.pow(oneLinkDone, linkCount);
    expected += tail;
    if (tail < 1e-10) break;
  }

  return expected;
}

function wernerVisibility(fidelity: number) {
  return Math.max(0, Math.min(1, (4 * fidelity - 1) / 3));
}

function fidelityFromVisibility(visibility: number) {
  return (1 + 3 * Math.max(0, Math.min(1, visibility))) / 4;
}

function purifyWernerPair(fidelity: number) {
  const errorState = (1 - fidelity) / 3;
  const successProbability =
    fidelity ** 2
    + 2 * fidelity * errorState
    + 5 * errorState ** 2;
  const outputFidelity =
    successProbability === 0
      ? fidelity
      : (fidelity ** 2 + errorState ** 2) / successProbability;

  return { outputFidelity, successProbability };
}

function formatRate(rate: number) {
  if (rate >= 100) return `${rate.toFixed(0)}/s`;
  if (rate >= 1) return `${rate.toFixed(1)}/s`;
  if (rate >= 0.01) return `${rate.toFixed(2)}/s`;
  if (rate > 0) return `1 / ${(1 / rate).toFixed(0)}s`;
  return 'No delivery';
}

export default function DistributedQuantumSystemsCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<EntanglementBudgetModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [hops, setHops] = useState(3);
  const [scheduleId, setScheduleId] = useState<ScheduleId>('buffered');
  const [purificationId, setPurificationId] = useState<PurificationId>('none');
  const [targetFidelityPercent, setTargetFidelityPercent] = useState(80);

  function reset(model: EntanglementBudgetModel) {
    setProfileId(model.defaults.profileId);
    setHops(model.defaults.hops);
    setScheduleId(model.defaults.scheduleId);
    setPurificationId(model.defaults.purificationId);
    setTargetFidelityPercent(model.defaults.targetFidelityPercent);
  }

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isBudgetModel(payload)) {
          throw new Error('The entanglement budget model is incomplete.');
        }
        setData(payload);
        reset(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load budget data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const view = useMemo(() => {
    if (!data) return null;
    const profile =
      data.profiles.find((candidate) => candidate.id === profileId)
      ?? data.profiles[0];
    const totalDistanceKm = profile.linkDistanceKm * hops;
    const classicalRoundTripMs = totalDistanceKm / 100;
    const collectionRounds = scheduleId === 'same-round'
      ? 1
      : expectedMaximumGeometricRounds(hops, profile.elementarySuccessProbability);
    const generationRate = scheduleId === 'same-round'
      ? profile.attemptsPerSecond * profile.elementarySuccessProbability ** hops
      : profile.attemptsPerSecond / collectionRounds;
    const swapYield = profile.swapSuccessProbability ** Math.max(0, hops - 1);
    const rawRate = generationRate * swapYield;
    const oldestPairWaitMs = scheduleId === 'same-round'
      ? classicalRoundTripMs
      : Math.max(
          classicalRoundTripMs,
          ((collectionRounds - 1) / profile.attemptsPerSecond) * 1_000
            + classicalRoundTripMs,
        );
    const memorySurvival = Math.exp(-oldestPairWaitMs / profile.memoryLifetimeMs);
    const linkVisibility = wernerVisibility(profile.elementaryFidelity);
    const swapVisibility = wernerVisibility(profile.swapOperationFidelity);
    const rawVisibility =
      linkVisibility ** hops
      * swapVisibility ** Math.max(0, hops - 1)
      * memorySurvival;
    const rawFidelity = fidelityFromVisibility(rawVisibility);
    const purification = purifyWernerPair(rawFidelity);
    const deliveredFidelity = purificationId === 'bbpssw'
      ? purification.outputFidelity
      : rawFidelity;
    const deliveredRate = purificationId === 'bbpssw'
      ? rawRate * purification.successProbability / 2
      : rawRate;
    const memoryMarginMs = profile.memoryLifetimeMs - oldestPairWaitMs;
    const targetFidelity = targetFidelityPercent / 100;

    let status = 'Modeled target is reachable';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let verdict =
      'The illustrative path clears the selected fidelity and memory gates. A hardware-specific simulation is still required.';

    if (memoryMarginMs < 0) {
      status = 'Memory deadline is missed';
      tone = 'rose';
      verdict =
        'The oldest stored pair outlives the modeled memory window before the route can finish. Shorten the path, improve scheduling, or change hardware assumptions.';
    } else if (deliveredFidelity < targetFidelity) {
      status = 'Fidelity target is missed';
      tone = 'rose';
      verdict =
        'Generation succeeds in the model, but swapping and decoherence leave the delivered pair below the application contract.';
    } else if (deliveredRate < 0.01) {
      status = 'Quality clears at a very low yield';
      tone = 'amber';
      verdict =
        'The pair meets the selected quality gate, but probabilistic generation and swapping make delivery rare. Rate is part of correctness for a real workload.';
    } else if (purificationId === 'bbpssw') {
      status = 'Higher fidelity, lower yield';
      tone = 'amber';
      verdict =
        'Purification improves the modeled pair quality by consuming two pairs and sometimes discarding both. It is not a free repair step.';
    }

    return {
      profile,
      totalDistanceKm,
      classicalRoundTripMs,
      collectionRounds,
      swapYield,
      rawFidelity,
      deliveredFidelity,
      deliveredRate,
      oldestPairWaitMs,
      memoryMarginMs,
      status,
      tone,
      verdict,
    };
  }, [
    data,
    hops,
    profileId,
    purificationId,
    scheduleId,
    targetFidelityPercent,
  ]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Entanglement path lab"
          title="Budget a Bell pair before the memory forgets it"
          description="Choose an illustrative link profile, repeater count, generation schedule, and purification policy. The model exposes how probability, fidelity, classical delay, and memory lifetime constrain one another."
          icon={Atom}
          accent="violet"
          onReset={data ? () => reset(data) : undefined}
        />

        {!data || !view ? (
          <LoadState
            error={error}
            onRetry={() => setReloadKey((current) => current + 1)}
          />
        ) : (
          <LearningLabBody
            controls={
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Illustrative link profile
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.profiles.map((profile) => (
                      <LabChoice
                        key={profile.id}
                        selected={profile.id === view.profile.id}
                        label={profile.label}
                        detail={profile.detail}
                        icon={Radio}
                        accent="violet"
                        onClick={() => setProfileId(profile.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Elementary links"
                  value={hops}
                  output={`${hops} ${hops === 1 ? 'link' : 'links'}`}
                  {...data.bounds.hops}
                  accent="violet"
                  lowLabel="direct"
                  highLabel="repeater chain"
                  onChange={setHops}
                />

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Generation schedule
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.schedules.map((schedule) => (
                      <LabChoice
                        key={schedule.id}
                        selected={schedule.id === scheduleId}
                        label={schedule.label}
                        detail={schedule.detail}
                        icon={schedule.id === 'buffered' ? Clock3 : Waves}
                        accent="blue"
                        onClick={() => setScheduleId(schedule.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Error management
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.purificationModes.map((mode) => (
                      <LabChoice
                        key={mode.id}
                        selected={mode.id === purificationId}
                        label={mode.label}
                        detail={mode.detail}
                        icon={mode.id === 'bbpssw' ? Sparkles : GitBranch}
                        accent={mode.id === 'bbpssw' ? 'amber' : 'cyan'}
                        onClick={() => setPurificationId(mode.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Application fidelity target"
                  value={targetFidelityPercent}
                  output={`${targetFidelityPercent}%`}
                  {...data.bounds.targetFidelityPercent}
                  accent="emerald"
                  lowLabel="tolerant experiment"
                  highLabel="strict contract"
                  onChange={setTargetFidelityPercent}
                />
              </div>
            }
          >
            <div aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Route distance"
                  value={`${view.totalDistanceKm} km`}
                  detail={`${hops} x ${view.profile.linkDistanceKm} km elementary links.`}
                  icon={GitBranch}
                  tone="blue"
                />
                <LabMetric
                  label="Delivered fidelity"
                  value={`${(view.deliveredFidelity * 100).toFixed(1)}%`}
                  detail={`Raw path before purification: ${(view.rawFidelity * 100).toFixed(1)}%.`}
                  icon={Gauge}
                  tone={view.deliveredFidelity >= targetFidelityPercent / 100 ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Modeled pair yield"
                  value={formatRate(view.deliveredRate)}
                  detail={`Swap-stage yield: ${(view.swapYield * 100).toFixed(1)}%.`}
                  icon={Activity}
                  tone={view.deliveredRate >= 0.01 ? 'violet' : 'amber'}
                />
                <LabMetric
                  label="Oldest memory hold"
                  value={`${view.oldestPairWaitMs.toFixed(1)} ms`}
                  detail={`${view.profile.memoryLifetimeMs} ms illustrative memory lifetime.`}
                  icon={TimerReset}
                  tone={view.memoryMarginMs >= 0 ? 'cyan' : 'rose'}
                />
              </div>

              <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                      Repeater chain
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                      A repeater consumes two adjacent pairs in each swap; it does not amplify or copy a qubit.
                    </p>
                  </div>
                  <span className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                    {view.classicalRoundTripMs.toFixed(1)} ms classical RTT floor
                  </span>
                </div>

                <div className="mt-5 overflow-x-auto pb-2">
                  <div className="flex min-w-[620px] items-center">
                    {Array.from({ length: hops + 1 }, (_, index) => (
                      <div key={index} className="contents">
                        <div className={`w-24 shrink-0 rounded-md border p-3 text-center ${
                          index === 0 || index === hops
                            ? 'border-violet-300 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/40'
                            : 'border-cyan-300 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/40'
                        }`}>
                          <Atom aria-hidden="true" className="mx-auto h-5 w-5 text-violet-600 dark:text-violet-300" />
                          <p className="mt-2 text-xs font-semibold text-neutral-950 dark:text-white">
                            {index === 0 ? 'Endpoint A' : index === hops ? 'Endpoint B' : `Repeater ${index}`}
                          </p>
                        </div>
                        {index < hops ? (
                          <div className="min-w-10 flex-1 px-2">
                            <div className="h-1 rounded-sm bg-gradient-to-r from-violet-500 via-cyan-400 to-violet-500" />
                            <p className="mt-1 text-center text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                              {view.profile.linkDistanceKm} km
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <PathStage number="1" title="Generate" detail={`${(view.profile.elementarySuccessProbability * 100).toFixed(0)}% success per link attempt`} />
                  <PathStage number="2" title="Herald" detail="Classical messages identify which memories share a usable pair" />
                  <PathStage number="3" title="Swap" detail={`${hops - 1} Bell-state ${hops - 1 === 1 ? 'measurement' : 'measurements'} consume link pairs`} />
                  <PathStage number="4" title="Deliver" detail="Pair ID, fidelity estimate, and expiry reach the application" />
                </div>
              </section>

              <section className="mt-5 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  <span>Modeled memory window consumed</span>
                  <span className="tabular-nums">
                    {view.oldestPairWaitMs.toFixed(1)} / {view.profile.memoryLifetimeMs} ms
                  </span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${
                      view.memoryMarginMs < 0
                        ? 'bg-rose-500'
                        : view.oldestPairWaitMs / view.profile.memoryLifetimeMs > 0.75
                          ? 'bg-amber-500'
                          : 'bg-cyan-500'
                    }`}
                    style={{
                      width: `${Math.min(100, view.oldestPairWaitMs / view.profile.memoryLifetimeMs * 100)}%`,
                    }}
                  />
                </div>
              </section>

              <section className={`mt-5 rounded-md border p-4 ${
                view.tone === 'rose'
                  ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                  : view.tone === 'amber'
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                    : 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
              }`}>
                <div className="flex items-start gap-3">
                  {view.tone === 'emerald' ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <TriangleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${
                      view.tone === 'rose'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`} />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                      {view.status}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                      {view.verdict}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      {data.modelNote}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function PathStage({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
        {number}
      </span>
      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <div className="min-h-[420px] p-6">
        <div className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
          <TriangleAlert aria-hidden="true" className="h-5 w-5" />
          <p className="mt-3 font-semibold">Entanglement budget data could not be loaded</p>
          <p className="mt-1 leading-6">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-rose-400 px-3 font-semibold hover:border-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[420px] items-center justify-center p-6" role="status">
      <div className="text-center text-sm text-neutral-600 dark:text-neutral-300">
        <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-violet-500 motion-reduce:animate-none" />
        <p className="mt-3">Loading entanglement budget...</p>
      </div>
    </div>
  );
}
