'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Binary,
  CheckCircle2,
  CircleAlert,
  Fingerprint,
  GitCompare,
  Languages,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  ScanText,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type NormalizationFixture = {
  id: string;
  label: string;
  detail: string;
};

type SampleFixture = {
  id: string;
  label: string;
  text: string;
  expectedBundleId: string;
  expectedNormalizationId: string;
  lesson: string;
};

type BundleFixture = {
  id: string;
  label: string;
  detail: string;
  tokenIdOffset: number;
  merges: [string, string][];
};

type EncodingContractModel = {
  blockId: string;
  title: string;
  description: string;
  baseAlphabet: string;
  endOfWordToken: string;
  defaults: {
    sampleId: string;
    bundleId: string;
    normalizationId: string;
  };
  normalizations: NormalizationFixture[];
  samples: SampleFixture[];
  bundles: BundleFixture[];
};

type EncodedToken = {
  piece: string;
  id: number;
  fallback: boolean;
};

const BLOCK_ID = 'genai/bpe-algorithm-encoding-contract-lab';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isEncodingModel(value: unknown): value is EncodingContractModel {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<EncodingContractModel>;
  return Boolean(
    data.blockId === BLOCK_ID
      && typeof data.title === 'string'
      && typeof data.description === 'string'
      && typeof data.baseAlphabet === 'string'
      && typeof data.endOfWordToken === 'string'
      && typeof data.defaults?.sampleId === 'string'
      && typeof data.defaults?.bundleId === 'string'
      && typeof data.defaults?.normalizationId === 'string'
      && Array.isArray(data.normalizations)
      && data.normalizations.length >= 2
      && data.normalizations.every((normalization) => (
        typeof normalization.id === 'string'
          && typeof normalization.label === 'string'
          && typeof normalization.detail === 'string'
      ))
      && Array.isArray(data.samples)
      && data.samples.length >= 2
      && data.samples.every((sample) => (
        typeof sample.id === 'string'
          && typeof sample.label === 'string'
          && typeof sample.text === 'string'
          && typeof sample.expectedBundleId === 'string'
          && typeof sample.expectedNormalizationId === 'string'
          && typeof sample.lesson === 'string'
      ))
      && Array.isArray(data.bundles)
      && data.bundles.length >= 2
      && data.bundles.every((bundle) => (
        typeof bundle.id === 'string'
          && typeof bundle.label === 'string'
          && typeof bundle.detail === 'string'
          && isFiniteNumber(bundle.tokenIdOffset)
          && Array.isArray(bundle.merges)
          && bundle.merges.length > 0
          && bundle.merges.every((merge) => (
            Array.isArray(merge)
              && merge.length === 2
              && merge.every((part) => typeof part === 'string')
          ))
      )),
  );
}

function normalize(text: string, normalizationId: string) {
  const canonical = text.normalize('NFC').replace(/\s+/g, ' ').trim();
  return normalizationId === 'lowercase' ? canonical.toLowerCase() : canonical;
}

function applyMerge(symbols: string[], pair: [string, string]) {
  const next: string[] = [];
  for (let index = 0; index < symbols.length;) {
    if (symbols[index] === pair[0] && symbols[index + 1] === pair[1]) {
      next.push(pair[0] + pair[1]);
      index += 2;
    } else {
      next.push(symbols[index]);
      index += 1;
    }
  }
  return next;
}

function encode(
  text: string,
  normalizationId: string,
  bundle: BundleFixture,
  data: EncodingContractModel,
) {
  const normalized = normalize(text, normalizationId);
  const baseSymbols = [...data.baseAlphabet];
  const baseIds = new Map(baseSymbols.map((symbol, index) => [
    symbol,
    bundle.tokenIdOffset + index,
  ]));
  baseIds.set(data.endOfWordToken, bundle.tokenIdOffset + baseSymbols.length);
  const mergeIds = new Map(bundle.merges.map((pair, index) => [
    pair[0] + pair[1],
    bundle.tokenIdOffset + baseSymbols.length + index + 1,
  ]));

  const tokens = normalized.split(' ').filter(Boolean).flatMap((word) => {
    let symbols = [...word, data.endOfWordToken];
    bundle.merges.forEach((pair) => {
      symbols = applyMerge(symbols, pair);
    });
    return symbols.map<EncodedToken>((piece) => {
      const knownId = mergeIds.get(piece) ?? baseIds.get(piece);
      const firstCodePoint = piece.codePointAt(0) ?? 0;
      return {
        piece,
        id: knownId ?? bundle.tokenIdOffset + 500 + firstCodePoint,
        fallback: knownId === undefined,
      };
    });
  });

  return { normalized, tokens };
}

function sameIds(left: EncodedToken[], right: EncodedToken[]) {
  return left.length === right.length && left.every((token, index) => token.id === right[index].id);
}

export default function BpeAlgorithmEncodingContractLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<EncodingContractModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No encoding-contract model was supplied.');
      return;
    }
    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isEncodingModel(payload)) throw new Error('The encoding-contract model is incomplete.');
        setData(payload);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the contract lab.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LoadState status="error" detail={loadError} />;
  if (!data) return <LoadState status="loading" detail="Loading tokenizer bundle fixtures..." />;
  return <ContractLab data={data} />;
}

function ContractLab({ data }: { data: EncodingContractModel }) {
  const [sampleId, setSampleId] = useState(data.defaults.sampleId);
  const [bundleId, setBundleId] = useState(data.defaults.bundleId);
  const [normalizationId, setNormalizationId] = useState(data.defaults.normalizationId);
  const sample = data.samples.find((item) => item.id === sampleId) ?? data.samples[0];
  const bundle = data.bundles.find((item) => item.id === bundleId) ?? data.bundles[0];
  const normalization = data.normalizations.find((item) => item.id === normalizationId)
    ?? data.normalizations[0];
  const expectedBundle = data.bundles.find((item) => item.id === sample.expectedBundleId)
    ?? data.bundles[0];

  const result = useMemo(() => {
    const actual = encode(sample.text, normalization.id, bundle, data);
    const expected = encode(
      sample.text,
      sample.expectedNormalizationId,
      expectedBundle,
      data,
    );
    const exactMatch = sameIds(actual.tokens, expected.tokens);
    const fallbackCount = actual.tokens.filter((token) => token.fallback).length;
    const characterCount = [...actual.normalized.replaceAll(' ', '')].length;
    return {
      actual,
      exactMatch,
      expected,
      fallbackCount,
      charactersPerToken: characterCount / Math.max(1, actual.tokens.length),
    };
  }, [bundle, data, expectedBundle, normalization.id, sample]);

  function reset() {
    setSampleId(data.defaults.sampleId);
    setBundleId(data.defaults.bundleId);
    setNormalizationId(data.defaults.normalizationId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Encoding contract lab"
          title={data.title}
          description={data.description}
          icon={Fingerprint}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Protected input
                </legend>
                <div className="mt-3 space-y-2">
                  {data.samples.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === sample.id}
                      label={item.label}
                      detail={item.text}
                      icon={ScanText}
                      accent={item.id === 'support-request' ? 'amber' : item.id === 'word-family' ? 'violet' : 'cyan'}
                      onClick={() => setSampleId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Tokenizer bundle
                </legend>
                <div className="mt-3 space-y-2">
                  {data.bundles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === bundle.id}
                      label={item.label}
                      detail={item.detail}
                      icon={PackageCheck}
                      accent={item.id === 'support-v3' ? 'amber' : item.id === 'general-v1' ? 'violet' : 'cyan'}
                      onClick={() => setBundleId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Normalization
                </legend>
                <div className="mt-3 space-y-2">
                  {data.normalizations.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === normalization.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Languages}
                      accent={item.id === 'lowercase' ? 'emerald' : 'rose'}
                      onClick={() => setNormalizationId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Output tokens"
              value={`${result.actual.tokens.length}`}
              detail={`${result.actual.normalized.length} normalized characters`}
              icon={Binary}
              tone="blue"
            />
            <LabMetric
              label="Characters/token"
              value={result.charactersPerToken.toFixed(2)}
              detail="spaces excluded"
              icon={GitCompare}
              tone="violet"
            />
            <LabMetric
              label="Fallback pieces"
              value={`${result.fallbackCount}`}
              detail={result.fallbackCount ? 'outside base alphabet' : 'all pieces covered'}
              icon={CircleAlert}
              tone={result.fallbackCount ? 'amber' : 'emerald'}
            />
            <LabMetric
              label="Golden IDs"
              value={result.exactMatch ? 'Match' : 'Changed'}
              detail={`expected ${expectedBundle.label}`}
              icon={result.exactMatch ? CheckCircle2 : Fingerprint}
              tone={result.exactMatch ? 'emerald' : 'rose'}
            />
          </div>

          <section className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Encoding path
            </p>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-stretch">
              <PipelineStage label="Source" value={sample.text} />
              <ArrowRight aria-hidden="true" className="mx-auto h-5 w-5 shrink-0 rotate-90 text-neutral-400 md:my-auto md:rotate-0" />
              <PipelineStage label="Normalized" value={result.actual.normalized} />
              <ArrowRight aria-hidden="true" className="mx-auto h-5 w-5 shrink-0 rotate-90 text-neutral-400 md:my-auto md:rotate-0" />
              <PipelineStage label="Bundle" value={bundle.label} />
            </div>
          </section>

          <section className="mt-6">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Actual model-facing sequence
            </p>
            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
              {result.actual.tokens.map((token, index) => (
                <div
                  key={`${token.piece}-${token.id}-${index}`}
                  className={`min-w-16 max-w-full rounded-md border p-2 text-center ${
                    token.fallback
                      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
                      : 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100'
                  }`}
                >
                  <div className="break-all font-mono text-xs font-semibold">
                    {displayToken(token.piece, data.endOfWordToken)}
                  </div>
                  <div className="mt-1 text-[11px] tabular-nums opacity-70">ID {token.id}</div>
                </div>
              ))}
            </div>
          </section>

          {!result.exactMatch ? (
            <section className="mt-6">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Approved golden sequence
              </p>
              <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                {result.expected.tokens.map((token, index) => (
                  <div
                    key={`${token.piece}-${token.id}-${index}`}
                    className="min-w-16 max-w-full rounded-md border border-neutral-200 bg-white p-2 text-center text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  >
                    <div className="break-all font-mono text-xs font-semibold">
                      {displayToken(token.piece, data.endOfWordToken)}
                    </div>
                    <div className="mt-1 text-[11px] tabular-nums opacity-70">ID {token.id}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className={`mt-6 flex items-start gap-3 rounded-md border p-4 text-sm leading-6 ${
            result.exactMatch
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
              : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
          }`}>
            {result.exactMatch ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {result.exactMatch
                  ? 'The candidate reproduces the approved token IDs.'
                  : 'Block this bundle for the existing checkpoint.'}
              </p>
              <p className="mt-1">
                {result.exactMatch
                  ? sample.lesson
                  : `This input expects ${expectedBundle.label} with ${sample.expectedNormalizationId} normalization. Different pieces or IDs select a different learned representation.`}
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PipelineStage({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
      <p className="text-[11px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-neutral-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function displayToken(token: string, endOfWordToken: string) {
  return token.replaceAll(endOfWordToken, '<end>');
}

function LoadState({ status, detail }: { status: 'loading' | 'error'; detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 flex min-h-56 items-center justify-center rounded-lg border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div>
        {status === 'loading' ? (
          <LoaderCircle aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-cyan-500" />
        ) : (
          <RefreshCw aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
        )}
        <p className="mt-3 text-sm font-semibold text-neutral-700 dark:text-neutral-200">{detail}</p>
      </div>
    </div>
  );
}
