'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Gauge,
  Server,
  ShieldAlert,
} from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

const valuesPerShardPerSecond = 4_500_000;
const freshnessSlaSeconds = 60;

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function FeatureStoreFreshnessCapacityLab() {
  const [predictionQps, setPredictionQps] = useState(600_000);
  const [featuresPerRequest, setFeaturesPerRequest] = useState(80);
  const [shards, setShards] = useState(16);
  const [streamLagSeconds, setStreamLagSeconds] = useState(25);
  const [zoneUnavailable, setZoneUnavailable] = useState(false);

  const model = useMemo(() => {
    const availableShards = zoneUnavailable ? Math.max(1, Math.floor(shards * (2 / 3))) : shards;
    const valuesPerSecond = predictionQps * featuresPerRequest;
    const capacity = availableShards * valuesPerShardPerSecond;
    const utilization = valuesPerSecond / capacity;
    const queuePenalty = utilization <= 0.7
      ? 0
      : Math.round(Math.min(38, Math.pow((utilization - 0.7) * 3.8, 2) * 24));
    const p99Ms = 4 + queuePenalty;
    const targetShards = Math.ceil(valuesPerSecond / (valuesPerShardPerSecond * 0.7));
    const freshnessPass = streamLagSeconds <= freshnessSlaSeconds;
    const capacityPass = utilization <= 0.7;
    const latencyPass = p99Ms <= 10;

    return {
      availableShards,
      valuesPerSecond,
      capacity,
      utilization,
      p99Ms,
      targetShards,
      freshnessPass,
      capacityPass,
      latencyPass,
      ready: freshnessPass && capacityPass && latencyPass,
    };
  }, [featuresPerRequest, predictionQps, shards, streamLagSeconds, zoneUnavailable]);

  const reset = () => {
    setPredictionQps(600_000);
    setFeaturesPerRequest(80);
    setShards(16);
    setStreamLagSeconds(25);
    setZoneUnavailable(false);
  };

  const recommendation = model.ready
    ? 'Serve the current feature bundle'
    : !model.freshnessPass
      ? 'Stop promotion and investigate the delayed materialization'
      : !model.capacityPass
        ? 'Add shards or reduce online feature fan-out'
        : 'Restore latency headroom before accepting traffic';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Freshness and capacity lab"
        title="Keep a fast feature lookup fresh enough to trust"
        description="Change prediction demand, feature fan-out, serving shards, stream lag, and a zone loss. A healthy online path needs less than 70% utilization, modeled p99 under 10 ms, and materialized values no more than 60 seconds old."
        icon={Database}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <LabRange
              label="Peak prediction requests"
              value={predictionQps}
              output={`${(predictionQps / 1_000_000).toFixed(1)}M QPS`}
              min={100_000}
              max={1_600_000}
              step={100_000}
              accent="cyan"
              lowLabel="0.1M QPS"
              highLabel="1.6M QPS"
              onChange={setPredictionQps}
            />
            <LabRange
              label="Online features per prediction"
              value={featuresPerRequest}
              output={featuresPerRequest.toLocaleString()}
              min={20}
              max={180}
              step={10}
              accent="violet"
              lowLabel="Small bundle"
              highLabel="Wide bundle"
              onChange={setFeaturesPerRequest}
            />
            <LabRange
              label="Serving shards provisioned"
              value={shards}
              output={shards.toLocaleString()}
              min={6}
              max={36}
              step={1}
              accent="emerald"
              lowLabel="6 shards"
              highLabel="36 shards"
              onChange={setShards}
            />
            <LabRange
              label="Streaming materialization lag"
              value={streamLagSeconds}
              output={`${streamLagSeconds} s`}
              min={5}
              max={180}
              step={5}
              accent="amber"
              lowLabel="Near real time"
              highLabel="Three minutes behind"
              onChange={setStreamLagSeconds}
            />
            <button
              type="button"
              aria-pressed={zoneUnavailable}
              onClick={() => setZoneUnavailable((value) => !value)}
              className={`flex w-full items-center justify-between gap-4 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${zoneUnavailable
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
                : 'border-neutral-200 bg-white text-neutral-800 hover:border-rose-300 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-rose-800'}`}
            >
              <span>
                <span className="block text-sm font-semibold">One serving zone unavailable</span>
                <span className="mt-1 block text-xs leading-5 opacity-75">Remove one third of serving shards while traffic remains unchanged.</span>
              </span>
              <ShieldAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
            </button>
          </div>
        )}
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric
            label="Feature values read"
            value={`${(model.valuesPerSecond / 1_000_000).toFixed(1)}M/s`}
            detail="Prediction QPS x features per request"
            icon={Activity}
            tone="blue"
          />
          <LabMetric
            label="Live capacity"
            value={`${(model.capacity / 1_000_000).toFixed(1)}M/s`}
            detail={`${model.availableShards} shards available`}
            icon={Server}
            tone={model.capacityPass ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Modeled p99"
            value={`${model.p99Ms} ms`}
            detail="10 ms online lookup budget"
            icon={Clock3}
            tone={model.latencyPass ? 'cyan' : 'rose'}
          />
          <LabMetric
            label="Freshness lag"
            value={`${streamLagSeconds} s`}
            detail="60 s materialization SLA"
            icon={Gauge}
            tone={model.freshnessPass ? 'violet' : 'amber'}
          />
        </div>

        <div className={`mt-5 rounded-md border p-4 ${model.ready
          ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
          : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'}`} aria-live="polite">
          <div className="flex items-start gap-3">
            {model.ready ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
            <div>
              <p className="font-semibold">{recommendation}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">
                Utilization is {percent(model.utilization)}. At this feature fan-out, provision {model.targetShards} shards for 70% steady-state utilization; this scenario has {model.availableShards} available.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            { label: 'Freshness gate', pass: model.freshnessPass, text: model.freshnessPass ? 'The online value is inside the published 60-second contract.' : 'A fast response can still be wrong when the materializer is late.' },
            { label: 'Capacity gate', pass: model.capacityPass, text: model.capacityPass ? 'Serving retains room for bursts and a small failure.' : 'Feature fan-out has exhausted the operational buffer.' },
            { label: 'Latency gate', pass: model.latencyPass, text: model.latencyPass ? 'The modeled queue stays inside the lookup deadline.' : 'Queueing has consumed the inference latency budget.' },
          ].map((gate) => (
            <div key={gate.label} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                {gate.pass ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> : <CircleAlert aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />}
                {gate.label}
              </p>
              <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{gate.text}</p>
            </div>
          ))}
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
