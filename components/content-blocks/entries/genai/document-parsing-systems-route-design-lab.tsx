'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Gauge,
  Layers,
  LoaderCircle,
  Route,
  ScanLine,
  Search,
  ShieldAlert,
  Table2,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Weights = { text: number; layout: number; table: number };

type DocumentProfile = {
  id: string;
  label: string;
  detail: string;
  pages: number;
  textLayerPct: number;
  scanQualityPct: number;
  layoutComplexityPct: number;
  tableComplexityPct: number;
  weights: Weights;
  targetEvidencePct: number;
  latencyBudgetSec: number;
  defaultRouteId: string;
  defaultOcrCoveragePct: number;
  consequence: string;
};

type ParsingRoute = {
  id: string;
  label: string;
  detail: string;
  transcription: string;
  layout: string;
  structure: string;
  ocrRecoveryPct: number;
  layoutCoveragePct: number;
  tableCoveragePct: number;
  layoutPenaltyFactor: number;
  tablePenaltyFactor: number;
  baseLatencyMsPerPage: number;
  ocrLatencyMsPerPage: number;
  fixedSetupSec: number;
};

type RouteData = {
  title: string;
  description: string;
  defaults: { documentId: string };
  documents: DocumentProfile[];
  routes: ParsingRoute[];
};

const BLOCK_ID = 'genai/document-parsing-systems-route-design-lab';

const isNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

function isRouteData(value: unknown): value is RouteData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RouteData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.documentId
      && Array.isArray(candidate.documents)
      && candidate.documents.length > 0
      && candidate.documents.every((document) => (
        typeof document.id === 'string'
        && typeof document.label === 'string'
        && typeof document.detail === 'string'
        && isNumber(document.pages)
        && isNumber(document.textLayerPct)
        && isNumber(document.scanQualityPct)
        && isNumber(document.layoutComplexityPct)
        && isNumber(document.tableComplexityPct)
        && isNumber(document.weights?.text)
        && isNumber(document.weights?.layout)
        && isNumber(document.weights?.table)
        && isNumber(document.targetEvidencePct)
        && isNumber(document.latencyBudgetSec)
        && typeof document.defaultRouteId === 'string'
        && isNumber(document.defaultOcrCoveragePct)
        && typeof document.consequence === 'string'
      ))
      && Array.isArray(candidate.routes)
      && candidate.routes.length > 0
      && candidate.routes.every((route) => (
        typeof route.id === 'string'
        && typeof route.label === 'string'
        && typeof route.detail === 'string'
        && typeof route.transcription === 'string'
        && typeof route.layout === 'string'
        && typeof route.structure === 'string'
        && isNumber(route.ocrRecoveryPct)
        && isNumber(route.layoutCoveragePct)
        && isNumber(route.tableCoveragePct)
        && isNumber(route.layoutPenaltyFactor)
        && isNumber(route.tablePenaltyFactor)
        && isNumber(route.baseLatencyMsPerPage)
        && isNumber(route.ocrLatencyMsPerPage)
        && isNumber(route.fixedSetupSec)
      )),
  );
}

const clamp = (value: number, minimum = 0, maximum = 100) => (
  Math.min(maximum, Math.max(minimum, value))
);

export default function DocumentParsingSystemsRouteDesignLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RouteData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No parsing-route model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRouteData(payload)) throw new Error('Parsing-route data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load parsing-route data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <RouteDesignLab data={data} />;
}

function RouteDesignLab({ data }: { data: RouteData }) {
  const initialDocument = data.documents.find((item) => item.id === data.defaults.documentId)
    ?? data.documents[0];
  const [documentId, setDocumentId] = useState(initialDocument.id);
  const [routeId, setRouteId] = useState(initialDocument.defaultRouteId);
  const [ocrCoveragePct, setOcrCoveragePct] = useState(initialDocument.defaultOcrCoveragePct);

  const document = data.documents.find((item) => item.id === documentId) ?? data.documents[0];
  const route = data.routes.find((item) => item.id === routeId) ?? data.routes[0];

  const result = useMemo(() => {
    const missingTextPct = 100 - document.textLayerPct;
    const effectiveOcrRecoveryPct = clamp(
      route.ocrRecoveryPct - (100 - document.scanQualityPct) * 0.35,
    );
    const recoveredTextPct = missingTextPct
      * (ocrCoveragePct / 100)
      * (effectiveOcrRecoveryPct / 100);
    const textEvidencePct = clamp(document.textLayerPct + recoveredTextPct);
    const scanPenalty = (100 - document.scanQualityPct) * 0.08;
    const layoutEvidencePct = clamp(
      route.layoutCoveragePct
        - document.layoutComplexityPct * route.layoutPenaltyFactor
        - scanPenalty,
    );
    const tableEvidencePct = clamp(
      route.tableCoveragePct
        - document.tableComplexityPct * route.tablePenaltyFactor
        - scanPenalty,
    );
    const evidencePct = (
      textEvidencePct * document.weights.text
      + layoutEvidencePct * document.weights.layout
      + tableEvidencePct * document.weights.table
    );
    const latencySec = route.fixedSetupSec + document.pages * (
      route.baseLatencyMsPerPage + route.ocrLatencyMsPerPage * ocrCoveragePct / 100
    ) / 1000;
    const evidenceGap = Math.max(0, document.targetEvidencePct - evidencePct);
    const reviewPct = clamp(evidenceGap * 3 + (100 - document.scanQualityPct) * 0.18, 0, 85);
    const evidencePasses = evidencePct >= document.targetEvidencePct;
    const latencyPasses = latencySec <= document.latencyBudgetSec;
    const routeMatches = route.id === document.defaultRouteId;
    const ocrMatches = Math.abs(ocrCoveragePct - document.defaultOcrCoveragePct) <= 15;

    const state = evidencePasses && latencyPasses
      ? { label: 'Route fits the declared contract', tone: 'emerald' as const, icon: CheckCircle2 }
      : !evidencePasses
        ? { label: 'Evidence coverage misses the target', tone: 'rose' as const, icon: ShieldAlert }
        : { label: 'Evidence fits, but latency exceeds budget', tone: 'amber' as const, icon: Clock3 };

    return {
      evidencePct,
      latencyPasses,
      latencySec,
      layoutEvidencePct,
      ocrMatches,
      reviewPct,
      routeMatches,
      state,
      tableEvidencePct,
      textEvidencePct,
    };
  }, [document, ocrCoveragePct, route]);

  function chooseDocument(next: DocumentProfile) {
    setDocumentId(next.id);
    setRouteId(next.defaultRouteId);
    setOcrCoveragePct(next.defaultOcrCoveragePct);
  }

  function reset() {
    chooseDocument(initialDocument);
  }

  const StateIcon = result.state.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Parsing route lab"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Document family
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.documents.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === document.id}
                      label={item.label}
                      detail={item.detail}
                      icon={FileText}
                      accent={item.textLayerPct < 20 ? 'amber' : item.layoutComplexityPct > 80 ? 'violet' : 'blue'}
                      onClick={() => chooseDocument(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Parsing route
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.routes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === route.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'vision-first' ? ScanLine : item.id === 'hybrid-layout' ? Layers : Search}
                      accent={item.id === 'vision-first' ? 'amber' : item.id === 'hybrid-layout' ? 'violet' : 'cyan'}
                      onClick={() => setRouteId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="3. Pages sent through OCR"
                value={ocrCoveragePct}
                output={`${ocrCoveragePct}%`}
                min={0}
                max={100}
                step={5}
                accent="amber"
                lowLabel="Native only"
                highLabel="Every page"
                onChange={setOcrCoveragePct}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Evidence coverage"
                value={`${result.evidencePct.toFixed(1)}%`}
                detail={`Declared target: ${document.targetEvidencePct}%`}
                icon={Gauge}
                tone={result.evidencePct >= document.targetEvidencePct ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Modeled latency"
                value={`${result.latencySec.toFixed(1)} s`}
                detail={`Budget: ${document.latencyBudgetSec} s for ${document.pages} pages`}
                icon={Clock3}
                tone={result.latencyPasses ? 'cyan' : 'amber'}
              />
              <LabMetric
                label="Review pressure"
                value={`${result.reviewPct.toFixed(0)}%`}
                detail="Illustrative share requiring human verification"
                icon={Search}
                tone={result.reviewPct <= 10 ? 'blue' : 'amber'}
              />
              <LabMetric
                label="Route judgment"
                value={result.routeMatches && result.ocrMatches ? 'Well matched' : 'Challenge it'}
                detail="Compare the choice with the document's dominant evidence risk"
                icon={Route}
                tone={result.routeMatches && result.ocrMatches ? 'emerald' : 'violet'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Active evidence path</p>
                  <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">{route.label}</h4>
                </div>
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{document.pages} pages</p>
              </div>
              <ol className="mt-4 grid gap-3 lg:grid-cols-3">
                <PathStep number="1" icon={ScanLine} label="Transcribe" detail={route.transcription} score={result.textEvidencePct} />
                <PathStep number="2" icon={Layers} label="Recover layout" detail={route.layout} score={result.layoutEvidencePct} />
                <PathStep number="3" icon={Table2} label="Build structure" detail={route.structure} score={result.tableEvidencePct} />
              </ol>
            </section>

            <section className={`rounded-md border p-4 ${
              result.state.tone === 'emerald'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                : result.state.tone === 'rose'
                  ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
                  : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
            }`}>
              <div className="flex items-start gap-3">
                <StateIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h4 className="font-semibold">{result.state.label}</h4>
                  <p className="mt-1 text-sm leading-6 opacity-90">{document.consequence}</p>
                  {!result.routeMatches || !result.ocrMatches ? (
                    <p className="mt-2 text-sm font-medium">
                      Reference route: {data.routes.find((item) => item.id === document.defaultRouteId)?.label}; OCR about {document.defaultOcrCoveragePct}% of pages.
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PathStep({
  number,
  icon: Icon,
  label,
  detail,
  score,
}: {
  number: string;
  icon: typeof Search;
  label: string;
  detail: string;
  score: number;
}) {
  return (
    <li className="min-w-0 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">{number}</span>
          {label}
        </span>
        <Icon aria-hidden="true" className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
      </div>
      <p className="mt-3 text-sm font-medium leading-6 text-neutral-800 dark:text-neutral-100">{detail}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
        <div className="h-full rounded-full bg-cyan-600 dark:bg-cyan-400" style={{ width: `${score}%` }} />
      </div>
      <p className="mt-2 text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">{score.toFixed(0)}% modeled coverage</p>
    </li>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading parsing-route model...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Parsing-route lab unavailable</p>
          <p className="mt-1 opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
