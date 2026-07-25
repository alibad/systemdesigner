'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, Image, Layers3, RefreshCw, Route, ShieldAlert, SlidersHorizontal, TriangleAlert, type LucideIcon } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ComponentOption = {
  id: string;
  label: string;
  detail: string;
  capability: string;
  latency?: string;
  risk?: string;
};

type FailureOption = {
  id: 'healthy' | 'decode' | 'vision' | 'projector' | 'language';
  label: string;
  detail: string;
};

type RoutingModel = {
  title: string;
  description: string;
  visionOptions: ComponentOption[];
  projectorOptions: ComponentOption[];
  languageOptions: ComponentOption[];
  failureOptions: FailureOption[];
};

type NodeState = 'active' | 'degraded' | 'failed' | 'bypassed';

type PathNode = {
  label: string;
  detail: string;
  state: NodeState;
};

const BLOCK_ID = 'genai/internvl3-architecture-architecture-routing-lab';

export default function Internvl3ArchitectureArchitectureRoutingLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RoutingModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No architecture-routing model was supplied.');
      return;
    }
    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<RoutingModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the architecture-routing model.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <ArchitectureRoutingLab data={data} />;
}

function ArchitectureRoutingLab({ data }: { data: RoutingModel }) {
  const [visionId, setVisionId] = useState(data.visionOptions[0]?.id ?? 'full');
  const [projectorId, setProjectorId] = useState(data.projectorOptions[0]?.id ?? 'aligned');
  const [languageId, setLanguageId] = useState(data.languageOptions[0]?.id ?? 'reasoning');
  const [dynamicResolution, setDynamicResolution] = useState(true);
  const [failureId, setFailureId] = useState<FailureOption['id']>('healthy');

  const selectedVision = data.visionOptions.find((option) => option.id === visionId) ?? data.visionOptions[0];
  const selectedProjector = data.projectorOptions.find((option) => option.id === projectorId) ?? data.projectorOptions[0];
  const selectedLanguage = data.languageOptions.find((option) => option.id === languageId) ?? data.languageOptions[0];

  const result = useMemo(() => getRoute({
    vision: selectedVision,
    projector: selectedProjector,
    language: selectedLanguage,
    dynamicResolution,
    failureId,
  }), [dynamicResolution, failureId, selectedLanguage, selectedProjector, selectedVision]);

  const reset = () => {
    setVisionId(data.visionOptions[0]?.id ?? 'full');
    setProjectorId(data.projectorOptions[0]?.id ?? 'aligned');
    setLanguageId(data.languageOptions[0]?.id ?? 'reasoning');
    setDynamicResolution(true);
    setFailureId('healthy');
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Architecture routing and ablation lab" title={data.title} description={data.description} icon={Route} accent="violet" onReset={reset} />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <OptionGroup title="1. Choose the vision boundary" options={data.visionOptions} selectedId={visionId} icon={Image} accent="cyan" onSelect={setVisionId} />
              <OptionGroup title="2. Choose the projector" options={data.projectorOptions} selectedId={projectorId} icon={SlidersHorizontal} accent="violet" onSelect={setProjectorId} />
              <OptionGroup title="3. Choose the language model" options={data.languageOptions} selectedId={languageId} icon={Bot} accent="amber" onSelect={setLanguageId} />
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">4. Pick resolution behavior</legend>
                <div className="mt-3 space-y-2">
                  <LabChoice selected={dynamicResolution} label="Dynamic resolution" detail="Tile higher-detail inputs within a request budget." icon={Layers3} accent="emerald" onClick={() => setDynamicResolution(true)} />
                  <LabChoice selected={!dynamicResolution} label="Fixed resized input" detail="Predictable cost with less local evidence." icon={Image} accent="emerald" onClick={() => setDynamicResolution(false)} />
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">5. Inject one failure</legend>
                <div className="mt-3 space-y-2">
                  {data.failureOptions.map((option) => <LabChoice key={option.id} selected={failureId === option.id} label={option.label} detail={option.detail} icon={option.id === 'healthy' ? CheckCircle2 : TriangleAlert} accent={option.id === 'healthy' ? 'emerald' : 'rose'} onClick={() => setFailureId(option.id)} />)}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite" className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Active route" value={result.routeLabel} detail={result.routeDetail} icon={Route} tone={result.healthy ? 'emerald' : 'rose'} />
              <LabMetric label="Current bottleneck" value={result.bottleneck} detail={result.bottleneckDetail} icon={result.healthy ? SlidersHorizontal : ShieldAlert} tone={result.healthy ? 'amber' : 'rose'} />
              <LabMetric label="Capability retained" value={result.capability} detail={result.capabilityDetail} icon={result.healthy ? CheckCircle2 : TriangleAlert} tone={result.healthy ? 'cyan' : 'violet'} />
              <LabMetric label="Recovery action" value={result.recovery} detail={result.recoveryDetail} icon={RefreshCw} tone="blue" />
            </div>

            <section className="mt-5">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Visible request path</p>
              <ol className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {result.nodes.map((node, index) => <PathNodeCard key={`${node.label}-${index}`} node={node} index={index} />)}
              </ol>
            </section>

            <section className={`mt-5 rounded-md border p-4 ${result.healthy ? 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'}`}>
              <p className="text-xs font-semibold uppercase opacity-75">Trade-off and recovery consequence</p>
              <p className="mt-2 text-sm leading-6 opacity-90">{result.tradeoff}</p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function OptionGroup({ title, options, selectedId, icon, accent, onSelect }: { title: string; options: ComponentOption[]; selectedId: string; icon: LucideIcon; accent: 'cyan' | 'violet' | 'amber'; onSelect: (id: string) => void }) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{title}</legend>
      <div className="mt-3 space-y-2">
        {options.map((option) => <LabChoice key={option.id} selected={selectedId === option.id} label={option.label} detail={option.detail} icon={icon} accent={accent} onClick={() => onSelect(option.id)} />)}
      </div>
    </fieldset>
  );
}

function PathNodeCard({ node, index }: { node: PathNode; index: number }) {
  const classes: Record<NodeState, string> = {
    active: 'border-neutral-200 bg-white text-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white',
    degraded: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
    failed: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
    bypassed: 'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200',
  };
  return (
    <li className={`min-w-0 rounded-md border p-3 ${classes[node.state]}`}>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase opacity-75"><span>Step {index + 1}</span><span>{node.state}</span></div>
      <p className="mt-2 text-sm font-semibold">{node.label}</p>
      <p className="mt-1 text-xs leading-5 opacity-80">{node.detail}</p>
    </li>
  );
}

function getRoute({ vision, projector, language, dynamicResolution, failureId }: { vision: ComponentOption; projector: ComponentOption; language: ComponentOption; dynamicResolution: boolean; failureId: FailureOption['id'] }) {
  const baseNodes: PathNode[] = [
    { label: 'Decode and policy', detail: 'Validate media and request limits.', state: 'active' },
    { label: 'Vision encoder', detail: vision.label, state: vision.id === 'compact' ? 'degraded' : 'active' },
    { label: 'Projector', detail: projector.label, state: projector.id === 'pooled' ? 'degraded' : 'active' },
    { label: 'Language model', detail: language.label, state: language.id === 'fast' ? 'degraded' : 'active' },
    { label: 'Output gate', detail: 'Label evidence limits and enforce response policy.', state: 'active' },
  ];

  if (failureId === 'decode') {
    return {
      healthy: false,
      routeLabel: 'Rejected before GPU',
      routeDetail: 'The media boundary stops an invalid request.',
      bottleneck: 'Media validation',
      bottleneckDetail: 'No visual tokens should be created from untrusted or malformed input.',
      capability: 'Safe error handling',
      capabilityDetail: 'No visual claim is made.',
      recovery: 'Repair and resubmit',
      recoveryDetail: 'Return the failed upload constraint to the caller.',
      nodes: [{ label: 'Decode and policy', detail: 'Rejected by file, dimension, or quota validation.', state: 'failed' as NodeState }, ...baseNodes.slice(1).map((node) => ({ ...node, state: 'bypassed' as NodeState }))],
      tradeoff: 'Rejecting early costs a retry but protects accelerator capacity and prevents ambiguous preprocessing. Capture the validation reason without retaining unnecessary media.',
    };
  }
  if (failureId === 'vision') {
    return {
      healthy: false,
      routeLabel: 'Text-only fallback',
      routeDetail: 'The visual path is unavailable; only text can continue.',
      bottleneck: 'Missing visual modality',
      bottleneckDetail: 'No encoder means no grounded claim about the image.',
      capability: 'Text-only subset',
      capabilityDetail: 'Useful only for tasks whose contract does not require visual verification.',
      recovery: 'Defer or reroute',
      recoveryDetail: 'Queue the visual task or send it to a healthy vision pool.',
      nodes: [baseNodes[0], { ...baseNodes[1], detail: 'Worker unavailable.', state: 'failed' as NodeState }, { ...baseNodes[2], detail: 'No visual features to project.', state: 'bypassed' as NodeState }, { ...baseNodes[3], detail: 'Receives text-only context.', state: 'degraded' as NodeState }, { ...baseNodes[4], detail: 'Must disclose missing visual evidence.', state: 'degraded' as NodeState }],
      tradeoff: 'A text-only fallback preserves a small safe subset of requests. For inspection, OCR, and GUI grounding, defer rather than produce a fluent response that implies the image was checked.',
    };
  }
  if (failureId === 'projector') {
    return {
      healthy: false,
      routeLabel: 'Stopped at compatibility gate',
      routeDetail: 'Visual features cannot safely enter the language model.',
      bottleneck: 'Alignment boundary',
      bottleneckDetail: 'Shape or version compatibility is a necessary but insufficient semantic contract.',
      capability: 'Validated preprocessing only',
      capabilityDetail: 'No multimodal output should be emitted.',
      recovery: 'Restore matched versions',
      recoveryDetail: 'Pin and verify the encoder, projector, and decoder compatibility set.',
      nodes: [baseNodes[0], baseNodes[1], { ...baseNodes[2], detail: 'Compatibility validation failed.', state: 'failed' as NodeState }, ...baseNodes.slice(3).map((node) => ({ ...node, state: 'bypassed' as NodeState }))],
      tradeoff: 'Failing closed loses availability but avoids producing language from misaligned visual features. Treat the projector as a versioned model boundary with its own canary and rollback.',
    };
  }
  if (failureId === 'language') {
    return {
      healthy: false,
      routeLabel: 'Deadline cancellation',
      routeDetail: 'The decoder cannot finish inside the response budget.',
      bottleneck: 'Language-model latency',
      bottleneckDetail: 'Completed vision work cannot justify an unbounded decode wait.',
      capability: 'Preprocessing telemetry',
      capabilityDetail: 'The system can record route and evidence metadata for retry analysis.',
      recovery: 'Cancel and retry safely',
      recoveryDetail: 'Use deadlines; retry only idempotent requests or a smaller approved route.',
      nodes: [...baseNodes.slice(0, 3), { ...baseNodes[3], detail: 'Deadline exceeded.', state: 'failed' as NodeState }, { ...baseNodes[4], detail: 'Return a clear timeout state.', state: 'degraded' as NodeState }],
      tradeoff: 'A timeout policy protects queues and tail latency. Do not convert it into an unbounded retry loop, especially when the request can trigger an external action.',
    };
  }

  const bottleneck = projector.id === 'pooled'
    ? 'Projector information loss'
    : vision.id === 'compact'
      ? 'Fine visual detail'
      : language.id === 'reasoning'
        ? 'Language-model decode'
        : dynamicResolution
          ? 'Visual token budget'
          : 'Fixed-resolution evidence';
  const bottleneckDetail = projector.id === 'pooled'
    ? projector.risk ?? 'Aggressive pooling reduces region-level evidence.'
    : vision.id === 'compact'
      ? vision.latency ?? 'Compact features trade detail for speed.'
      : language.id === 'reasoning'
        ? language.risk ?? 'Reasoning budget increases tail latency.'
        : dynamicResolution
          ? 'Higher-detail inputs need admission control before they reach the decoder.'
          : 'Predictable cost can hide detail required by dense visual tasks.';
  const capability = `${vision.id === 'full' && dynamicResolution ? 'Fine-detail aware' : 'Bounded'} multimodal route`;
  const capabilityDetail = `${vision.capability}. ${projector.capability}. ${language.capability}.`;
  const recovery = 'Canary and observe';
  const recoveryDetail = 'Compare grounding, token count, p95 latency, peak memory, and fallback rate by visual slice before promotion.';

  return {
    healthy: true,
    routeLabel: 'Multimodal request',
    routeDetail: dynamicResolution ? 'Resolution adapts within an explicit token budget.' : 'One predictable resized view enters the vision path.',
    bottleneck,
    bottleneckDetail,
    capability,
    capabilityDetail,
    recovery,
    recoveryDetail,
    nodes: baseNodes,
    tradeoff: dynamicResolution
      ? `Dynamic resolution preserves more evidence when the task needs it, but it makes visual-token count and memory request-dependent. ${projector.risk ?? language.risk ?? 'Measure the selected route against task-owned slices.'}`
      : `Fixed resizing makes serving more predictable, but it can remove the small regions that the task needs. ${vision.latency ?? language.risk ?? 'Use a task-owned evaluation to decide where this route is safe.'}`,
  };
}

function LabLoading() {
  return <div data-content-block={BLOCK_ID} className="min-h-[600px] rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading architecture routing and ablation lab" />;
}

function LabError({ detail }: { detail: string }) {
  return <div data-content-block={BLOCK_ID} className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert"><p className="font-semibold">Architecture routing and ablation lab unavailable</p><p className="mt-2 opacity-80">{detail}</p></div>;
}
