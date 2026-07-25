'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CircleGauge,
  CopyCheck,
  Database,
  HardDrive,
  Server,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface CapacityData {
  title: string;
  description: string;
  overheadPct: number;
  safetyHeadroomPct: number;
  defaults: {
    members: number;
    primaryDataGiB: number;
    backupCount: number;
    heapGiBPerMember: number;
    backupMode: 'sync' | 'async';
  };
}

const BLOCK_ID = 'technology/hazelcast-cluster';

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityData>;
  return Boolean(
    candidate.title &&
      candidate.description &&
      candidate.defaults &&
      Number.isFinite(candidate.overheadPct) &&
      Number.isFinite(candidate.safetyHeadroomPct),
  );
}

export default function HazelcastCluster({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No capacity assumptions were supplied.');
      return;
    }

    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityData(payload)) throw new Error('Capacity assumptions are incomplete.');
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Unable to load capacity assumptions.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <State title="Capacity lab unavailable" detail={error} />;
  if (!data) return <State title="Loading capacity lab" detail="Preparing the cluster envelope..." />;
  return <CapacityLab data={data} />;
}

function CapacityLab({ data }: { data: CapacityData }) {
  const [members, setMembers] = useState(data.defaults.members);
  const [primaryDataGiB, setPrimaryDataGiB] = useState(data.defaults.primaryDataGiB);
  const [backupCount, setBackupCount] = useState(data.defaults.backupCount);
  const [heapGiBPerMember, setHeapGiBPerMember] = useState(data.defaults.heapGiBPerMember);
  const [backupMode, setBackupMode] = useState<'sync' | 'async'>(data.defaults.backupMode);

  const result = useMemo(() => {
    const copies = backupCount + 1;
    const storedGiB = primaryDataGiB * copies;
    const withOverheadGiB = storedGiB * (1 + data.overheadPct / 100);
    const requiredGiB = withOverheadGiB / (1 - data.safetyHeadroomPct / 100);
    const availableGiB = members * heapGiBPerMember;
    const utilizationPct = (requiredGiB / availableGiB) * 100;
    const memberCopySafe = members > backupCount;
    const healthy = utilizationPct <= 100 && memberCopySafe;
    const writeAcks = backupMode === 'sync' ? copies : 1;

    return {
      availableGiB,
      copies,
      healthy,
      memberCopySafe,
      requiredGiB,
      storedGiB,
      utilizationPct,
      writeAcks,
    };
  }, [backupCount, backupMode, data.overheadPct, data.safetyHeadroomPct, heapGiBPerMember, members, primaryDataGiB]);

  const reset = () => {
    setMembers(data.defaults.members);
    setPrimaryDataGiB(data.defaults.primaryDataGiB);
    setBackupCount(data.defaults.backupCount);
    setHeapGiBPerMember(data.defaults.heapGiBPerMember);
    setBackupMode(data.defaults.backupMode);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Partition capacity lab"
          title={data.title}
          description={data.description}
          icon={Boxes}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <LabRange label="Cluster members" value={members} output={`${members}`} min={2} max={9} accent="blue" lowLabel="Small" highLabel="Wider cluster" onChange={setMembers} />
              <LabRange label="Primary map data" value={primaryDataGiB} output={`${primaryDataGiB} GiB`} min={8} max={256} step={8} accent="cyan" lowLabel="8 GiB" highLabel="256 GiB" onChange={setPrimaryDataGiB} />
              <LabRange label="Backups per partition" value={backupCount} output={`${backupCount}`} min={0} max={3} accent="violet" lowLabel="No copy" highLabel="Three copies" onChange={setBackupCount} />
              <LabRange label="Usable heap per member" value={heapGiBPerMember} output={`${heapGiBPerMember} GiB`} min={8} max={128} step={8} accent="emerald" lowLabel="8 GiB" highLabel="128 GiB" onChange={setHeapGiBPerMember} />
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Backup acknowledgement</legend>
                <div className="mt-3 grid gap-2">
                  <LabChoice selected={backupMode === 'sync'} label="Synchronous backups" detail="A mutation waits for the configured backup copies before completing." icon={ShieldCheck} accent="emerald" onClick={() => setBackupMode('sync')} />
                  <LabChoice selected={backupMode === 'async'} label="Asynchronous backups" detail="A mutation returns after the primary update while backup copies catch up." icon={CircleGauge} accent="amber" onClick={() => setBackupMode('async')} />
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.healthy ? healthyClass : warningClass}`}>
              <div className="flex items-start gap-3">
                {result.healthy ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Capacity verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {result.healthy
                      ? 'The selected cluster has room for primaries, backups, and recovery headroom'
                      : !result.memberCopySafe
                        ? 'There are not enough members to separate every configured copy'
                        : 'The protected data set exceeds the selected usable heap'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    The model adds {data.overheadPct}% object and platform overhead, then reserves {data.safetyHeadroomPct}% of cluster heap for skew, migration, and recovery. Validate those assumptions with real serialized values and failure tests.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Protected footprint" value={`${result.requiredGiB.toFixed(0)} GiB`} detail={`${result.copies} total copies including the primary`} icon={Database} tone={result.healthy ? 'cyan' : 'rose'} />
              <LabMetric label="Cluster heap" value={`${result.availableGiB} GiB`} detail={`${members} members x ${heapGiBPerMember} GiB`} icon={Server} tone="blue" />
              <LabMetric label="Planned utilization" value={`${result.utilizationPct.toFixed(0)}%`} detail="After overhead and recovery reserve" icon={CircleGauge} tone={result.utilizationPct <= 100 ? 'emerald' : 'rose'} />
              <LabMetric label="Write acknowledgements" value={`${result.writeAcks}`} detail={backupMode === 'sync' ? 'Primary plus synchronous copies' : 'Primary now; backups later'} icon={CopyCheck} tone={backupMode === 'sync' ? 'violet' : 'amber'} />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Copy placement envelope</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Each partition needs one primary and {backupCount} backup{backupCount === 1 ? '' : 's'} on different members.</p>
                </div>
                <HardDrive aria-hidden="true" className="h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-300" />
              </div>
              <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(members, 6)}, minmax(0, 1fr))` }}>
                {Array.from({ length: Math.min(members, 6) }, (_, index) => (
                  <div key={index} className="min-w-0 rounded-md border border-neutral-200 bg-white px-2 py-3 text-center dark:border-neutral-700 dark:bg-neutral-950">
                    <Server aria-hidden="true" className="mx-auto h-4 w-4 text-neutral-500" />
                    <p className="mt-1 truncate text-xs font-semibold text-neutral-700 dark:text-neutral-200">M{index + 1}</p>
                  </div>
                ))}
              </div>
              {members > 6 ? <p className="mt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">+ {members - 6} additional members</p> : null}
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function State({ title, detail }: { title: string; detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{detail}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
