'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CircleAlert,
  Clock3,
  Database,
  Gauge,
  HardDrive,
  LockKeyhole,
  ShieldCheck,
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

const BLOCK_ID = 'technology/sqlite-performance';

const profiles = [
  { id: 'mobile', label: 'Offline mobile store', detail: 'Many local reads, short user-driven writes, and one application-owned database file.', writesPerSecond: 8, writeHoldMs: 12, readers: 4, busyTimeoutMs: 1000 },
  { id: 'desktop', label: 'Desktop application file', detail: 'A local catalog with background indexing and interactive edits.', writesPerSecond: 25, writeHoldMs: 18, readers: 8, busyTimeoutMs: 2000 },
  { id: 'server', label: 'Serialized service store', detail: 'One service owns the file and funnels requests through a bounded write path.', writesPerSecond: 120, writeHoldMs: 6, readers: 40, busyTimeoutMs: 1500 },
] as const;

export default function SQLitePerformance() {
  const [profileId, setProfileId] = useState<(typeof profiles)[number]['id']>('mobile');
  const [writesPerSecond, setWritesPerSecond] = useState<number>(profiles[0].writesPerSecond);
  const [writeHoldMs, setWriteHoldMs] = useState<number>(profiles[0].writeHoldMs);
  const [readers, setReaders] = useState<number>(profiles[0].readers);
  const [busyTimeoutMs, setBusyTimeoutMs] = useState<number>(profiles[0].busyTimeoutMs);
  const [walMode, setWalMode] = useState(true);

  const model = useMemo(() => {
    const writerBusyMsPerSecond = writesPerSecond * writeHoldMs;
    const writerPressurePct = (writerBusyMsPerSecond / 1000) * 100;
    const theoreticalWriteCeiling = 1000 / writeHoldMs;
    const saturated = writerPressurePct >= 85;
    const readContract = walMode
      ? 'Readers can continue from a stable WAL snapshot while one writer appends.'
      : 'A rollback-mode writer may wait for readers and eventually needs exclusive access to commit.';
    const timeoutRisk = saturated || (writeHoldMs * 2 > busyTimeoutMs);
    return { writerBusyMsPerSecond, writerPressurePct, theoreticalWriteCeiling, saturated, readContract, timeoutRisk };
  }, [busyTimeoutMs, walMode, writeHoldMs, writesPerSecond]);

  const applyProfile = (id: (typeof profiles)[number]['id']) => {
    const profile = profiles.find((item) => item.id === id) ?? profiles[0];
    setProfileId(profile.id);
    setWritesPerSecond(profile.writesPerSecond);
    setWriteHoldMs(profile.writeHoldMs);
    setReaders(profile.readers);
    setBusyTimeoutMs(profile.busyTimeoutMs);
  };

  const reset = () => {
    applyProfile('mobile');
    setWalMode(true);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Writer-serialization lab"
          title="Keep the write lock short and the ownership boundary local"
          description="SQLite serializes writes to one database file. Change arrival rate and transaction duration to see how quickly one writer becomes the limiting resource."
          icon={Database}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Workload shape</p>
                <div className="mt-3 space-y-2">
                  {profiles.map((profile) => (
                    <LabChoice key={profile.id} selected={profile.id === profileId} label={profile.label} detail={profile.detail} icon={HardDrive} accent="cyan" onClick={() => applyProfile(profile.id)} />
                  ))}
                </div>
              </div>
              <LabRange label="Write transactions" value={writesPerSecond} output={`${writesPerSecond}/s`} min={1} max={300} step={1} lowLabel="occasional" highLabel="write-heavy" accent="blue" onChange={setWritesPerSecond} />
              <LabRange label="Writer lock duration" value={writeHoldMs} output={`${writeHoldMs} ms`} min={1} max={100} step={1} lowLabel="short transaction" highLabel="long transaction" accent="rose" onChange={setWriteHoldMs} />
              <LabRange label="Concurrent readers" value={readers} output={String(readers)} min={1} max={100} step={1} lowLabel="few" highLabel="many" accent="violet" onChange={setReaders} />
              <LabRange label="Busy timeout" value={busyTimeoutMs} output={`${busyTimeoutMs} ms`} min={0} max={5000} step={100} lowLabel="fail fast" highLabel="bounded wait" accent="amber" onChange={setBusyTimeoutMs} />
              <button
                type="button"
                aria-pressed={walMode}
                onClick={() => setWalMode((value) => !value)}
                className={`w-full rounded-md border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                  walMode
                    ? 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100'
                    : 'border-neutral-300 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                }`}
              >
                <span className="flex items-center gap-2 font-semibold"><Activity aria-hidden="true" className="h-4 w-4" />{walMode ? 'WAL mode' : 'Rollback journal mode'}</span>
                <span className="mt-1 block text-xs leading-5 opacity-75">WAL changes reader/writer overlap; it does not create multiple simultaneous writers.</span>
              </button>
            </div>
          )}
        >
          <div className={`rounded-md border p-5 ${
            model.saturated
              ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
              : 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
          }`}>
            <div className="flex items-start gap-3">
              {model.saturated
                ? <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
                : <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />}
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">Write-path verdict</p>
                <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                  {model.saturated ? 'Write arrivals consume the serialized budget' : 'The modeled writer has headroom'}
                </h4>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {writesPerSecond} writes per second holding the writer for {writeHoldMs} ms require {model.writerBusyMsPerSecond.toLocaleString()} ms of writer time each second. {model.saturated ? 'Queueing and SQLITE_BUSY outcomes become likely before average CPU or disk metrics look alarming.' : 'Keep transactions short and measure lock wait under representative bursts.'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Writer pressure" value={`${model.writerPressurePct.toFixed(0)}%`} detail="required serialized writer time" icon={Gauge} tone={model.saturated ? 'rose' : 'emerald'} />
            <LabMetric label="Teaching ceiling" value={`${model.theoreticalWriteCeiling.toFixed(0)}/s`} detail="1,000 ms divided by lock duration, before overhead" icon={LockKeyhole} tone="amber" />
            <LabMetric label="Readers" value={readers.toLocaleString()} detail={model.readContract} icon={Users} tone="violet" />
            <LabMetric label="Busy timeout" value={`${busyTimeoutMs} ms`} detail={model.timeoutRisk ? 'may expire under this pressure' : 'bounded contention wait'} icon={Clock3} tone={model.timeoutRisk ? 'rose' : 'blue'} />
          </div>

          <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            <strong className="text-neutral-950 dark:text-white">Model boundary:</strong>{' '}
            this is serialization arithmetic, not a device benchmark. Real lock duration includes SQL work, page writes, fsync behavior, checkpoints, competing processes, storage latency, and transaction scope. Measure those on the target platform.
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
