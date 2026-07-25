'use client';

import { useMemo, useState } from 'react';
import { Binary, CalendarClock, CheckCircle2, CircleAlert, Cpu, Network, TimerReset } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ProfileId = 'balanced' | 'fleet' | 'burst';

const profiles: Array<{ id: ProfileId; label: string; detail: string; timestampBits: number; generatorBits: number; sequenceBits: number }> = [
  { id: 'balanced', label: 'Balanced 1 / 41 / 10 / 12', detail: 'The familiar format: long life, 1,024 identities, generous local burst.', timestampBits: 41, generatorBits: 10, sequenceBits: 12 },
  { id: 'fleet', label: 'Large fleet 1 / 39 / 14 / 10', detail: 'More concurrently leased generators, with a shorter epoch horizon and lower per-node burst.', timestampBits: 39, generatorBits: 14, sequenceBits: 10 },
  { id: 'burst', label: 'Burst-heavy 1 / 39 / 8 / 16', detail: 'Much higher local burst capacity, but fewer live identities and a shorter epoch horizon.', timestampBits: 39, generatorBits: 8, sequenceBits: 16 },
];

const requiredGenerators = 1_000;
const requiredRps = 50_000;
const requiredYears = 30;

function capacityLabel(value: number) {
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M` : value.toLocaleString();
}

export default function UniqueIdGeneratorBitBudgetLab() {
  const [profileId, setProfileId] = useState<ProfileId>('balanced');
  const [trafficPerGenerator, setTrafficPerGenerator] = useState(requiredRps);

  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
  const model = useMemo(() => {
    const lifetimeYears = (2 ** profile.timestampBits) / 1_000 / 60 / 60 / 24 / 365.25;
    const generatorCapacity = 2 ** profile.generatorBits;
    const perMillisecond = 2 ** profile.sequenceBits;
    const perSecond = perMillisecond * 1_000;
    const sequenceUtilization = (trafficPerGenerator / perSecond) * 100;
    const fitsFleet = generatorCapacity >= requiredGenerators;
    const fitsBurst = trafficPerGenerator <= perSecond;
    const fitsLifetime = lifetimeYears >= requiredYears;
    const viable = fitsFleet && fitsBurst && fitsLifetime;

    let verdict = 'This format clears the stated operating envelope.';
    let explanation = 'It has enough timestamp range, separately leased identities, and per-generator sequence headroom.';
    if (!fitsLifetime) {
      verdict = 'The epoch ends before the required lifetime.';
      explanation = 'Move bits from another field, choose a format version, or plan a migration before timestamp range is exhausted.';
    } else if (!fitsFleet) {
      verdict = 'There are not enough generator identities.';
      explanation = 'More than one live process would need to share an identity, which invalidates the uniqueness invariant.';
    } else if (!fitsBurst) {
      verdict = 'The sequence field wraps inside one millisecond.';
      explanation = 'Add sequence bits, spread the traffic across more identities, or wait for the next millisecond. Never wrap the counter.';
    }

    return { lifetimeYears, generatorCapacity, perMillisecond, perSecond, sequenceUtilization, fitsFleet, fitsBurst, fitsLifetime, viable, verdict, explanation };
  }, [profile, trafficPerGenerator]);

  const reset = () => {
    setProfileId('balanced');
    setTrafficPerGenerator(requiredRps);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Bit budget and capacity lab"
        title="Make 63 usable bits cover time, fleet size, and burst rate"
        description="Select a field allocation and change per-generator traffic. The model shows which requirement fails when one field claims too much of the integer."
        icon={Binary}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">64-bit field allocation</legend>
              <div className="mt-3 space-y-2">
                {profiles.map((item) => (
                  <LabChoice key={item.id} selected={profileId === item.id} label={item.label} detail={item.detail} icon={item.id === 'balanced' ? CheckCircle2 : item.id === 'fleet' ? Network : Cpu} accent="violet" onClick={() => setProfileId(item.id)} />
                ))}
              </div>
            </fieldset>
            <LabRange label="Per-generator burst" value={trafficPerGenerator} output={`${capacityLabel(trafficPerGenerator)} IDs/s`} min={25_000} max={8_000_000} step={25_000} accent="cyan" lowLabel="Normal burst" highLabel="Sequence pressure" onChange={setTrafficPerGenerator} />
            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">Requirements: at least {requiredYears} years, {requiredGenerators.toLocaleString()} generator identities, and {capacityLabel(requiredRps)} IDs/s per generator.</p>
          </div>
        }
      >
        <div data-content-block="case-studies/unique-id-generator-bit-budget-lab" className="min-w-0">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <LabMetric label="Timestamp range" value={`${model.lifetimeYears.toFixed(1)} years`} detail={`Need ${requiredYears}+ years`} icon={CalendarClock} tone={model.fitsLifetime ? 'emerald' : 'rose'} />
            <LabMetric label="Live identities" value={model.generatorCapacity.toLocaleString()} detail={`Need ${requiredGenerators.toLocaleString()} leases`} icon={Network} tone={model.fitsFleet ? 'emerald' : 'rose'} />
            <LabMetric label="Sequence capacity" value={`${capacityLabel(model.perSecond)} IDs/s`} detail={`${model.perMillisecond.toLocaleString()} each ms`} icon={TimerReset} tone={model.fitsBurst ? 'cyan' : 'rose'} />
            <LabMetric label="Sequence pressure" value={`${model.sequenceUtilization.toFixed(1)}%`} detail="At the selected burst" icon={Cpu} tone={model.sequenceUtilization <= 80 ? 'violet' : 'rose'} />
          </div>
          <div className={`mt-5 rounded-md border p-4 ${model.viable ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'}`}>
            <div className="flex items-start gap-3">
              {model.viable ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div className="min-w-0"><p className="text-sm font-semibold">{model.verdict}</p><p className="mt-1 text-sm leading-6 opacity-80">{model.explanation}</p></div>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-4" aria-label="Selected bit layout">
            {[['Sign', 1, 'Reserved positive integer'], ['Time', profile.timestampBits, 'Milliseconds since epoch'], ['Generator', profile.generatorBits, 'One fenced live owner'], ['Sequence', profile.sequenceBits, 'Requests in one millisecond']].map(([label, bits, detail]) => <div key={String(label)} className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50"><p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">{bits} bits</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p></div>)}
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
