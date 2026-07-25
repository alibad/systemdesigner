'use client';

import { useEffect, useState } from 'react';
import {
  Braces,
  CheckCircle2,
  CircleAlert,
  FileCode2,
  GitCompareArrows,
  Layers3,
  LoaderCircle,
  PackageCheck,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type TreeNode = {
  id: string;
  label: string;
  depth: number;
};

type ParserChoice = {
  id: string;
  label: string;
  dependency: string;
  serialized: string;
  behavior: string;
  tree: TreeNode[];
};

type ConsumerContract = {
  id: string;
  label: string;
  detail: string;
  acceptedParserIds: string[];
  success: string;
  failure: string;
};

type ParserLabData = {
  title: string;
  description: string;
  malformedMarkup: string;
  defaults: {
    parserId: string;
    contractId: string;
  };
  parsers: ParserChoice[];
  contracts: ConsumerContract[];
};

const BLOCK_ID = 'technology/beautiful-soup-parser-lab';

function isParserLabData(value: unknown): value is ParserLabData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ParserLabData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.malformedMarkup
      && candidate.defaults?.parserId
      && candidate.defaults.contractId
      && Array.isArray(candidate.parsers)
      && candidate.parsers.length === 3
      && candidate.parsers.every((parser) => (
        typeof parser.id === 'string'
        && typeof parser.label === 'string'
        && typeof parser.dependency === 'string'
        && typeof parser.serialized === 'string'
        && typeof parser.behavior === 'string'
        && Array.isArray(parser.tree)
        && parser.tree.length > 0
        && parser.tree.every((node) => (
          typeof node.id === 'string'
          && typeof node.label === 'string'
          && typeof node.depth === 'number'
          && node.depth >= 0
          && node.depth <= 3
        ))
      ))
      && Array.isArray(candidate.contracts)
      && candidate.contracts.length >= 2
      && candidate.contracts.every((contract) => (
        typeof contract.id === 'string'
        && typeof contract.label === 'string'
        && typeof contract.detail === 'string'
        && Array.isArray(contract.acceptedParserIds)
        && contract.acceptedParserIds.every((id) => typeof id === 'string')
        && typeof contract.success === 'string'
        && typeof contract.failure === 'string'
      )),
  );
}

export default function BeautifulSoupParserLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ParserLabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No parser recovery scenarios were supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isParserLabData(payload)) throw new Error('The parser recovery data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the parser lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <ParserWorkbench data={data} />;
}

function ParserWorkbench({ data }: { data: ParserLabData }) {
  const initialParser = data.parsers.find((parser) => parser.id === data.defaults.parserId)
    ?? data.parsers[0];
  const initialContract = data.contracts.find((contract) => contract.id === data.defaults.contractId)
    ?? data.contracts[0];
  const [parserId, setParserId] = useState(initialParser.id);
  const [contractId, setContractId] = useState(initialContract.id);
  const parser = data.parsers.find((item) => item.id === parserId) ?? data.parsers[0];
  const contract = data.contracts.find((item) => item.id === contractId) ?? data.contracts[0];
  const contractPasses = contract.acceptedParserIds.includes(parser.id);
  const topLevelNodes = parser.tree.filter((node) => node.depth === 0).length;

  function reset() {
    setParserId(initialParser.id);
    setContractId(initialContract.id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Parser recovery lab"
          title={data.title}
          description={data.description}
          icon={GitCompareArrows}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Downstream contract
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.contracts.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === contract.id}
                      label={item.label}
                      detail={item.detail}
                      icon={ShieldCheck}
                      accent="blue"
                      onClick={() => setContractId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Parser
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.parsers.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === parser.id}
                      label={item.label}
                      detail={item.dependency}
                      icon={PackageCheck}
                      accent="violet"
                      onClick={() => setParserId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Malformed input
              </p>
              <code className="mt-2 block break-all rounded bg-neutral-950 px-3 py-2 text-sm text-amber-200">
                {data.malformedMarkup}
              </code>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Parser"
                value={parser.label}
                detail={parser.dependency}
                icon={FileCode2}
                tone="violet"
              />
              <LabMetric
                label="Tree nodes"
                value={`${parser.tree.length}`}
                detail={`${topLevelNodes} top-level node${topLevelNodes === 1 ? '' : 's'} in this sample`}
                icon={Layers3}
                tone="blue"
              />
              <LabMetric
                label="Contract"
                value={contractPasses ? 'Pass' : 'Fail'}
                detail={contract.label}
                icon={contractPasses ? CheckCircle2 : CircleAlert}
                tone={contractPasses ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Input"
                value="Invalid HTML"
                detail="One dangling closing tag"
                icon={Braces}
                tone="amber"
              />
            </div>

            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <section className="min-w-0 overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
                <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Recovered tree
                  </p>
                </div>
                <div className="space-y-1 p-4 font-mono text-sm">
                  {parser.tree.map((node) => {
                    const depthClass = ['pl-0', 'pl-5', 'pl-10', 'pl-14'][node.depth] ?? 'pl-0';
                    return (
                      <div key={node.id} className={`${depthClass} flex min-w-0 items-center gap-2 py-1.5`}>
                        <span className="h-px w-3 shrink-0 bg-neutral-300 dark:bg-neutral-700" />
                        <span className="min-w-0 break-all rounded border border-violet-200 bg-violet-50 px-2 py-1 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">
                          {node.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="min-w-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Serialized result
                  </p>
                </div>
                <div className="space-y-4 p-4">
                  <code className="block break-all rounded bg-neutral-950 px-3 py-3 text-xs leading-5 text-cyan-200">
                    {parser.serialized}
                  </code>
                  <p className="text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {parser.behavior}
                  </p>
                </div>
              </section>
            </div>

            <section className={`rounded-md border p-5 ${contractPasses
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
              : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'}`}
            >
              <div className="flex items-start gap-3">
                {contractPasses
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />}
                <div>
                  <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                    {contractPasses ? 'The recovered tree satisfies this sample contract' : 'The recovered tree breaks this sample contract'}
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {contractPasses ? contract.success : contract.failure}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Parser recovery lab"
          title="Loading parser outcomes"
          description="The lab validates each parser tree and downstream contract before rendering."
          icon={GitCompareArrows}
          accent="violet"
        />
        <LearningLabBody>
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
            {error
              ? <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-600 dark:text-rose-300" />
              : <LoaderCircle aria-hidden="true" className="h-7 w-7 animate-spin text-violet-600 motion-reduce:animate-none dark:text-violet-300" />}
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {error ?? 'Loading parser data...'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
              >
                Retry
              </button>
            ) : null}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
