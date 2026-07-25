'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CloudDownload,
  Database,
  Gauge,
  Network,
  RadioTower,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type SessionProfile = {
  id: string;
  label: string;
  detail: string;
  activeEditors: number;
  editsPerEditorMinute: number;
  operationBytes: number;
  presenceUpdatesSecond: number;
  presenceBytes: number;
};

type SessionModel = {
  title: string;
  description: string;
  defaults: { profileId: string; offlineMinutes: number };
  profiles: SessionProfile[];
};

const BLOCK_ID = 'fundamentals/real-time-collaborative-systems-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/real-time-collaborative-systems/data/session-fanout-model.json';

function isSessionModel(value: unknown): value is SessionModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<SessionModel>;
  return Boolean(
    typeof model.title === 'string'
      && typeof model.description === 'string'
      && typeof model.defaults?.profileId === 'string'
      && typeof model.defaults.offlineMinutes === 'number'
      && Array.isArray(model.profiles)
      && model.profiles.length >= 3
      && model.profiles.every((profile) => (
        typeof profile.id === 'string'
          && typeof profile.label === 'string'
          && typeof profile.detail === 'string'
          && typeof profile.activeEditors === 'number'
          && profile.activeEditors >= 2
          && typeof profile.editsPerEditorMinute === 'number'
          && typeof profile.operationBytes === 'number'
          && typeof profile.presenceUpdatesSecond === 'number'
          && typeof profile.presenceBytes === 'number'
      )),
  );
}

function formatRate(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MiB/s`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB/s`;
  return `${bytes.toFixed(0)} B/s`;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes.toFixed(0)} B`;
}

export default function RealTimeCollaborativeSystemsCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<SessionModel | null>(null);
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
        if (!isSessionModel(payload)) throw new Error('The room workload model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load room workload data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Room fan-out lab"
            title="Calculate durable and ephemeral traffic"
            description="Loading lesson-owned room profiles and payload assumptions."
            icon={Network}
            accent="blue"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <SessionFanoutLab model={model} />
      )}
    </div>
  );
}

function SessionFanoutLab({ model }: { model: SessionModel }) {
  const defaultProfile = model.profiles.find((item) => item.id === model.defaults.profileId) ?? model.profiles[0];
  const [profileId, setProfileId] = useState(defaultProfile.id);
  const [activeEditors, setActiveEditors] = useState<number>(defaultProfile.activeEditors);
  const [editsPerEditorMinute, setEditsPerEditorMinute] = useState<number>(defaultProfile.editsPerEditorMinute);
  const [operationBytes, setOperationBytes] = useState<number>(defaultProfile.operationBytes);
  const [presenceUpdatesSecond, setPresenceUpdatesSecond] = useState<number>(defaultProfile.presenceUpdatesSecond);
  const [presenceBytes, setPresenceBytes] = useState<number>(defaultProfile.presenceBytes);
  const [offlineMinutes, setOfflineMinutes] = useState<number>(model.defaults.offlineMinutes);

  const result = useMemo(() => {
    const recipients = activeEditors - 1;
    const durableChangesSecond = activeEditors * editsPerEditorMinute / 60;
    const durableEgressSecond = durableChangesSecond * recipients * operationBytes;
    const presenceMessagesSecond = activeEditors * presenceUpdatesSecond;
    const presenceEgressSecond = presenceMessagesSecond * recipients * presenceBytes;
    const totalEgressSecond = durableEgressSecond + presenceEgressSecond;
    const durableShare = totalEgressSecond === 0 ? 0 : durableEgressSecond / totalEgressSecond;
    const presenceShare = 1 - durableShare;
    const catchupChanges = recipients * editsPerEditorMinute * offlineMinutes;
    const rawCatchupBytes = catchupChanges * operationBytes;
    const perEditorInbound = (
      recipients * editsPerEditorMinute / 60 * operationBytes
      + recipients * presenceUpdatesSecond * presenceBytes
    );

    return {
      catchupChanges,
      durableChangesSecond,
      durableEgressSecond,
      durableShare,
      perEditorInbound,
      presenceEgressSecond,
      presenceMessagesSecond,
      presenceShare,
      rawCatchupBytes,
      recipients,
      totalEgressSecond,
    };
  }, [activeEditors, editsPerEditorMinute, offlineMinutes, operationBytes, presenceBytes, presenceUpdatesSecond]);

  function applyProfile(id: string) {
    const profile = model.profiles.find((item) => item.id === id) ?? model.profiles[0];
    setProfileId(profile.id);
    setActiveEditors(profile.activeEditors);
    setEditsPerEditorMinute(profile.editsPerEditorMinute);
    setOperationBytes(profile.operationBytes);
    setPresenceUpdatesSecond(profile.presenceUpdatesSecond);
    setPresenceBytes(profile.presenceBytes);
  }

  function reset() {
    applyProfile(model.defaults.profileId);
    setOfflineMinutes(model.defaults.offlineMinutes);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Room fan-out lab"
        title={model.title}
        description={model.description}
        icon={Network}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Workload starting point
              </legend>
              <div className="mt-3 grid gap-2">
                {model.profiles.map((profile) => (
                  <LabChoice
                    key={profile.id}
                    selected={profile.id === profileId}
                    label={profile.label}
                    detail={profile.detail}
                    icon={Users}
                    accent="blue"
                    onClick={() => applyProfile(profile.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Active editors in one room"
              value={activeEditors}
              output={`${activeEditors} editors`}
              min={2}
              max={200}
              step={1}
              lowLabel="pair"
              highLabel="hot room"
              accent="blue"
              onChange={(value) => { setProfileId('custom'); setActiveEditors(value); }}
            />
            <LabRange
              label="Durable edits per editor"
              value={editsPerEditorMinute}
              output={`${editsPerEditorMinute}/min`}
              min={1}
              max={60}
              step={1}
              lowLabel="deliberate"
              highLabel="rapid"
              accent="violet"
              onChange={(value) => { setProfileId('custom'); setEditsPerEditorMinute(value); }}
            />
            <LabRange
              label="Encoded durable change"
              value={operationBytes}
              output={`${operationBytes} B`}
              min={50}
              max={2000}
              step={10}
              lowLabel="small delta"
              highLabel="rich update"
              accent="violet"
              onChange={(value) => { setProfileId('custom'); setOperationBytes(value); }}
            />
            <LabRange
              label="Presence updates per editor"
              value={presenceUpdatesSecond}
              output={`${presenceUpdatesSecond}/sec`}
              min={1}
              max={12}
              step={1}
              lowLabel="coalesced"
              highLabel="frequent"
              accent="cyan"
              onChange={(value) => { setProfileId('custom'); setPresenceUpdatesSecond(value); }}
            />
            <LabRange
              label="Encoded presence update"
              value={presenceBytes}
              output={`${presenceBytes} B`}
              min={40}
              max={500}
              step={8}
              lowLabel="cursor only"
              highLabel="richer awareness"
              accent="cyan"
              onChange={(value) => { setProfileId('custom'); setPresenceBytes(value); }}
            />
            <LabRange
              label="One editor offline"
              value={offlineMinutes}
              output={`${offlineMinutes} min`}
              min={0}
              max={60}
              step={1}
              lowLabel="live"
              highLabel="long gap"
              accent="amber"
              onChange={setOfflineMinutes}
            />
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Durable change rate"
              value={`${result.durableChangesSecond.toFixed(1)}/sec`}
              detail={`${activeEditors} editors x ${editsPerEditorMinute}/min divided by 60.`}
              icon={Database}
              tone="violet"
            />
            <LabMetric
              label="Room egress"
              value={formatRate(result.totalEgressSecond)}
              detail="Application payload sent to all other room participants."
              icon={Network}
              tone="blue"
            />
            <LabMetric
              label="One editor inbound"
              value={formatRate(result.perEditorInbound)}
              detail="Updates generated by the other active editors."
              icon={CloudDownload}
              tone="cyan"
            />
            <LabMetric
              label="Raw reconnect delta"
              value={formatBytes(result.rawCatchupBytes)}
              detail={`${Math.round(result.catchupChanges).toLocaleString()} durable changes missed in ${offlineMinutes} minutes.`}
              icon={Gauge}
              tone="amber"
            />
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Room broadcast shape</p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  Every modeled message is sent once to {result.recipients} other {result.recipients === 1 ? 'editor' : 'editors'}.
                </p>
              </div>
              <span className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                {activeEditors} active in one document
              </span>
            </div>

            <div className="mt-5 grid items-stretch gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
              <FlowNode icon={Users} label="Editors" value={`${activeEditors}`} detail={`${editsPerEditorMinute} durable edits/min each`} tone="blue" />
              <ArrowRight aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 text-neutral-400 sm:rotate-0" />
              <FlowNode icon={RadioTower} label="Room stream" value={`${result.durableChangesSecond.toFixed(1)} changes/s`} detail={`${result.presenceMessagesSecond.toFixed(0)} presence messages/s`} tone="violet" />
              <ArrowRight aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 text-neutral-400 sm:rotate-0" />
              <FlowNode icon={Network} label="Fan-out" value={`${result.recipients} recipients`} detail={formatRate(result.totalEgressSecond)} tone="cyan" />
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Payload mix</p>
              <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                Presence is replaceable; durable edits are not. Their independent policies should remain visible even when they share a socket.
              </p>
            </div>
            <div className="space-y-4 p-4">
              <TrafficRow
                label="Durable document updates"
                value={result.durableEgressSecond}
                share={result.durableShare}
                total={result.totalEgressSecond}
                color="bg-violet-500"
              />
              <TrafficRow
                label="Ephemeral awareness"
                value={result.presenceEgressSecond}
                share={result.presenceShare}
                total={result.totalEgressSecond}
                color="bg-cyan-500"
              />
            </div>
          </div>

          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50">
            <div className="flex items-start gap-3">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  {result.presenceShare > 0.5
                    ? 'Ephemeral awareness dominates this payload envelope.'
                    : 'Durable document changes dominate this payload envelope.'}
                </p>
                <p className="mt-1 text-sm leading-6 opacity-80">
                  {result.presenceShare > 0.5
                    ? 'Coalesce cursor movement, drop stale updates, and avoid journaling it. Reducing presence cadence changes bandwidth without changing saved work.'
                    : 'Measure encoded change size, batch safely, and compact history without weakening operation identity or reconnect correctness.'}
                </p>
                <p className="mt-2 text-xs font-semibold">
                  Model boundary: application payload only; add framing, acknowledgements, retries, compression, and replication after measuring the chosen stack.
                </p>
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function FlowNode({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'violet' | 'cyan';
}) {
  const styles = {
    blue: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50',
    violet: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50',
    cyan: 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-50',
  }[tone];

  return (
    <div className={`min-w-0 rounded-md border p-4 text-center ${styles}`}>
      <Icon aria-hidden="true" className="mx-auto h-5 w-5" />
      <p className="mt-2 text-xs font-semibold uppercase opacity-70">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function TrafficRow({
  label,
  value,
  share,
  total,
  color,
}: {
  label: string;
  value: number;
  share: number;
  total: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-semibold text-neutral-950 dark:text-white">{label}</span>
        <span className="shrink-0 tabular-nums text-neutral-600 dark:text-neutral-300">
          {formatRate(value)} / {(share * 100).toFixed(0)}%
        </span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${color}`}
          style={{ width: `${total === 0 ? 0 : Math.max(share * 100, 1)}%` }}
        />
      </div>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Room workload unavailable</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-32 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          Loading room workload...
        </div>
      )}
    </div>
  );
}
