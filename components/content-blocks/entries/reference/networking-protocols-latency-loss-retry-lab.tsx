'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  CornerDownRight,
  Gauge,
  GitBranch,
  RefreshCw,
  ShieldAlert,
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

type Transport = 'tcp' | 'quic' | 'udp';

const transports: Array<{ id: Transport; label: string; detail: string }> = [
  { id: 'tcp', label: 'TCP', detail: 'Reliable ordered bytes; a loss can delay later bytes in the same stream.' },
  { id: 'quic', label: 'QUIC', detail: 'Reliable streams over UDP; loss on one stream need not block another stream.' },
  { id: 'udp', label: 'UDP', detail: 'Datagrams arrive, arrive late, or disappear; recovery belongs to the application.' },
];

function percent(value: number) {
  return `${value.toFixed(value >= 99 ? 2 : 1)}%`;
}

export default function NetworkingProtocolsLatencyLossRetryLab() {
  const [transport, setTransport] = useState<Transport>('quic');
  const [rtt, setRtt] = useState(80);
  const [loss, setLoss] = useState(2);
  const [retries, setRetries] = useState(1);
  const [idempotent, setIdempotent] = useState(true);

  const model = useMemo(() => {
    const oneWaySuccess = 1 - loss / 100;
    const cleanRoundTrip = oneWaySuccess * oneWaySuccess;
    const attempts = retries + 1;
    const responseWithinBudget = 1 - Math.pow(1 - cleanRoundTrip, attempts);
    const timeout = Math.max(150, rtt * 2);
    const serviceTime = 30;
    const recoveryPenalty = transport === 'udp' ? 0 : Math.round(rtt * (loss / 100) * (transport === 'tcp' ? 2 : 1.4));
    const firstResponse = rtt + serviceTime + recoveryPenalty;
    const ceiling = firstResponse + retries * timeout;
    const duplicateRisk = retries > 0 && loss > 0 && !idempotent;

    return { cleanRoundTrip, responseWithinBudget, timeout, firstResponse, ceiling, duplicateRisk };
  }, [idempotent, loss, retries, rtt, transport]);

  const transportConsequence = {
    tcp: 'TCP retransmits lost bytes and preserves byte order. One lost byte can hold later bytes in that connection until recovery completes.',
    quic: 'QUIC retransmits reliable stream data, but an unrelated stream can continue while the lost stream waits for recovery.',
    udp: 'UDP does not retransmit or order datagrams. Define acknowledgement, ordering, expiration, and resynchronization above it when needed.',
  }[transport];

  return (
    <div data-content-block="reference/networking-protocols-latency-loss-retry-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Loss and retry path"
          title="See why a timeout is not a failed command"
          description="Adjust the network and retry budget for one request-response exchange. The model distinguishes a clean round trip, transport recovery, and the duplicate risk created by an application retry."
          icon={GitBranch}
          accent="amber"
          onReset={() => {
            setTransport('quic');
            setRtt(80);
            setLoss(2);
            setRetries(1);
            setIdempotent(true);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Transport behavior</legend>
                <div className="mt-3 space-y-2">
                  {transports.map((option) => (
                    <LabChoice key={option.id} selected={transport === option.id} label={option.label} detail={option.detail} icon={option.id === 'udp' ? Gauge : GitBranch} accent={option.id === 'udp' ? 'amber' : option.id === 'quic' ? 'violet' : 'blue'} onClick={() => setTransport(option.id)} />
                  ))}
                </div>
              </fieldset>
              <LabRange label="Network round-trip time" value={rtt} output={`${rtt} ms`} min={20} max={300} step={10} accent="blue" lowLabel="nearby" highLabel="long-haul" onChange={setRtt} />
              <LabRange label="Independent packet loss" value={loss} output={`${loss}%`} min={0} max={20} step={1} accent="amber" lowLabel="clean path" highLabel="lossy path" onChange={setLoss} />
              <LabRange label="Application retries after a timeout" value={retries} output={`${retries}`} min={0} max={3} step={1} accent="rose" lowLabel="no replay" highLabel="three retries" onChange={setRetries} />
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-950">
                <input type="checkbox" checked={idempotent} onChange={(event) => setIdempotent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
                <span>
                  <span className="block font-semibold text-neutral-900 dark:text-white">The operation is idempotent</span>
                  <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">Repeating the same request produces one intended result, or the server accepts an idempotency key.</span>
                </span>
              </label>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric label="Clean request + reply" value={percent(model.cleanRoundTrip * 100)} detail="Both directions cross once without loss." icon={CheckCircle2} tone="emerald" />
            <LabMetric label="Reply within retry budget" value={percent(model.responseWithinBudget * 100)} detail={`${retries + 1} application attempt${retries === 0 ? '' : 's'} in this simplified model.`} icon={RefreshCw} tone="blue" />
            <LabMetric label="Worst-case wait" value={`${model.ceiling} ms`} detail={`Each failed attempt waits up to ${model.timeout} ms before the next one.`} icon={Clock3} tone="amber" />
          </div>

          <div className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <div className="grid gap-0 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
              <PathNode title="Client" detail="starts request" tone="blue" />
              <PathArrow label={`${rtt / 2} ms`} />
              <PathNode title={transport.toUpperCase()} detail={transport === 'udp' ? 'datagram path' : 'recovery path'} tone={transport === 'udp' ? 'amber' : 'violet'} />
              <PathArrow label={`${rtt / 2} ms`} />
              <PathNode title="Server" detail="may commit work" tone={model.duplicateRisk ? 'rose' : 'emerald'} />
            </div>
            <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300">
              First response estimate: about <strong>{model.firstResponse} ms</strong> including 30 ms of server work and a simplified recovery penalty. {transportConsequence}
            </div>
          </div>

          <div className={`mt-5 rounded-md border p-4 ${model.duplicateRisk ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50' : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'}`}>
            <div className="flex items-start gap-3">
              {model.duplicateRisk ? <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <p className="font-semibold">{model.duplicateRisk ? 'Retry can duplicate a completed write' : 'Retry has a named safety condition'}</p>
                <p className="mt-1 text-sm leading-6 opacity-85">
                  {model.duplicateRisk
                    ? 'The server can finish a charge, enqueue, or state change while its reply is lost. Retrying without an idempotency key can create a second side effect. Query status or use a stable operation key instead.'
                    : retries === 0
                      ? 'No application replay is attempted. This bounds duplicate work but may surface a transient timeout to the caller.'
                      : 'The client can retry because the operation is read-only, naturally idempotent, or protected by a stable idempotency key that the server persists and reuses.'}
                </p>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Model assumption: request and reply each cross a path with the selected independent loss rate. TCP and QUIC can recover lost packets below the application, so their real timing also depends on congestion control, retransmission timers, stream layout, and the configured deadline.
          </p>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PathArrow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 sm:flex-col">
      <CornerDownRight aria-hidden="true" className="h-4 w-4 rotate-[-45deg] sm:rotate-0" />
      <span>{label}</span>
    </div>
  );
}

function PathNode({ title, detail, tone }: { title: string; detail: string; tone: 'blue' | 'violet' | 'amber' | 'emerald' | 'rose' }) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-50',
    amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50',
  }[tone];

  return (
    <div className={`m-3 min-w-0 rounded-md border p-4 ${styles}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}
