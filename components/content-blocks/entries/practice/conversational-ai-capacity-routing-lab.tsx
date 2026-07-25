'use client';

import { useMemo, useState } from 'react';
import { Clock3, Gauge, Layers3, MessageSquareText, Sparkles, Zap } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type RequestClass = 'quick-answer' | 'account-question' | 'complex-case';
type ModelTier = 'compact' | 'balanced' | 'reasoning';

const requestClasses: Array<{
  id: RequestClass;
  label: string;
  detail: string;
  p95Budget: number;
  qualityFloor: number;
  baseTokens: number;
}> = [
  {
    id: 'quick-answer',
    label: 'Quick policy answer',
    detail: 'Short, low-risk factual response',
    p95Budget: 450,
    qualityFloor: 72,
    baseTokens: 650,
  },
  {
    id: 'account-question',
    label: 'Account question',
    detail: 'Scoped read with a concise explanation',
    p95Budget: 700,
    qualityFloor: 80,
    baseTokens: 1200,
  },
  {
    id: 'complex-case',
    label: 'Complex case',
    detail: 'Multi-turn investigation that can be deferred',
    p95Budget: 1600,
    qualityFloor: 88,
    baseTokens: 2200,
  },
];

const modelTiers: Array<{
  id: ModelTier;
  label: string;
  detail: string;
  baseLatency: number;
  quality: number;
  turnsPerWorker: number;
}> = [
  {
    id: 'compact',
    label: 'Compact tier',
    detail: 'Classification and short grounded answers',
    baseLatency: 135,
    quality: 76,
    turnsPerWorker: 58,
  },
  {
    id: 'balanced',
    label: 'Balanced tier',
    detail: 'Routine support synthesis and summaries',
    baseLatency: 280,
    quality: 85,
    turnsPerWorker: 26,
  },
  {
    id: 'reasoning',
    label: 'Reasoning tier',
    detail: 'Complex cases with an explicit wait budget',
    baseLatency: 690,
    quality: 93,
    turnsPerWorker: 9,
  },
];

export default function ConversationalAiCapacityRoutingLab() {
  const [requestClassId, setRequestClassId] = useState<RequestClass>('account-question');
  const [modelTierId, setModelTierId] = useState<ModelTier>('balanced');
  const [contextTokens, setContextTokens] = useState(1200);

  const result = useMemo(() => {
    const requestClass = requestClasses.find((item) => item.id === requestClassId) ?? requestClasses[1];
    const modelTier = modelTiers.find((item) => item.id === modelTierId) ?? modelTiers[1];
    const retrievalMs = 70 + Math.round(contextTokens / 24);
    const generationMs = modelTier.baseLatency + Math.round(contextTokens / 18);
    const policyAndNetworkMs = requestClass.id === 'account-question' ? 165 : 115;
    const p95Latency = retrievalMs + generationMs + policyAndNetworkMs;
    const quality = Math.min(98, modelTier.quality + (contextTokens >= requestClass.baseTokens ? 2 : -6));
    const latencyPass = p95Latency <= requestClass.p95Budget;
    const qualityPass = quality >= requestClass.qualityFloor;
    const workersAtPeak = Math.ceil(12000 / modelTier.turnsPerWorker / 0.7);
    const action = latencyPass && qualityPass
      ? 'Serve this route'
      : !latencyPass
        ? 'Reduce context or defer the case'
        : 'Choose a stronger model or narrow the claim';

    return {
      action,
      generationMs,
      latencyPass,
      p95Latency,
      quality,
      qualityPass,
      requestClass,
      retrievalMs,
      workersAtPeak,
    };
  }, [contextTokens, modelTierId, requestClassId]);

  const reset = () => {
    setRequestClassId('account-question');
    setModelTierId('balanced');
    setContextTokens(1200);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Capacity routing lab"
        title="Choose a route that can meet its promise"
        description="Change the request class, model tier, and context size. The outcome combines p95 latency, answer quality, and worker headroom for a 12K-turn-per-second peak."
        icon={Gauge}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Request class
              </legend>
              <div className="mt-3 space-y-2">
                {requestClasses.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === requestClassId}
                    label={item.label}
                    detail={`${item.detail}. ${item.p95Budget} ms p95, quality ${item.qualityFloor}+.`}
                    icon={MessageSquareText}
                    accent="cyan"
                    onClick={() => setRequestClassId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Model tier
              </legend>
              <div className="mt-3 space-y-2">
                {modelTiers.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === modelTierId}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'compact' ? Zap : item.id === 'balanced' ? Sparkles : Layers3}
                    accent="violet"
                    onClick={() => setModelTierId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
            <LabRange
              label="Prompt context"
              value={contextTokens}
              output={`${contextTokens.toLocaleString()} tokens`}
              min={400}
              max={3200}
              step={200}
              accent="amber"
              lowLabel="Focused evidence"
              highLabel="Broad context"
              onChange={setContextTokens}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <div className={`rounded-md border p-4 ${result.latencyPass && result.qualityPass ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'}`}>
            <p className="text-xs font-semibold uppercase opacity-75">Routing decision</p>
            <p className="mt-2 text-xl font-semibold">{result.action}</p>
            <p className="mt-2 text-sm leading-6 opacity-80">
              {result.requestClass.p95Budget} ms and quality {result.requestClass.qualityFloor}+ are the contract for this request class.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="p95 estimate" value={`${result.p95Latency} ms`} detail={`${result.latencyPass ? 'Within' : 'Over'} budget`} icon={Clock3} tone={result.latencyPass ? 'emerald' : 'rose'} />
            <LabMetric label="Quality" value={`${result.quality}%`} detail={`${result.qualityPass ? 'Meets' : 'Misses'} floor`} icon={Sparkles} tone={result.qualityPass ? 'violet' : 'rose'} />
            <LabMetric label="Retrieve" value={`${result.retrievalMs} ms`} detail="Permission-filtered evidence" icon={Layers3} tone="cyan" />
            <LabMetric label="Peak workers" value={result.workersAtPeak.toLocaleString()} detail="Includes 30% headroom" icon={Gauge} tone="amber" />
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300">
            Generation contributes {result.generationMs} ms in this route. If the estimate misses p95, compact the evidence set before removing policy or tenant checks.
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
