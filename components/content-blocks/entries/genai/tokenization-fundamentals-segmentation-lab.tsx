'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Braces,
  CircleAlert,
  Code2,
  FileText,
  Globe2,
  Hash,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type TokenPiece = {
  piece: string;
  id: number;
  start: number;
  end: number;
  reason: string;
};

type ControlToken = {
  piece: string;
  id: number;
};

type Profile = {
  id: string;
  label: string;
  detail: string;
  method: string;
  startToken: ControlToken;
  endToken: ControlToken;
};

type Variant = {
  id: string;
  label: string;
  normalizedText: string;
  explanation: string;
  segmentations: Record<string, TokenPiece[]>;
};

type Sample = {
  id: string;
  label: string;
  detail: string;
  input: string;
  variants: Variant[];
};

type SegmentationModel = {
  title: string;
  description: string;
  disclaimer: string;
  offsetUnit: string;
  defaults: {
    sampleId: string;
    variantId: string;
    profileId: string;
    addTrustedWrapper: boolean;
  };
  profiles: Profile[];
  samples: Sample[];
};

type DisplayToken = {
  piece: string;
  id: number;
  start: number | null;
  end: number | null;
  reason: string;
  special: boolean;
};

const BLOCK_ID = 'genai/tokenization-fundamentals-segmentation-lab';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isTokenPiece(value: unknown): value is TokenPiece {
  if (!isRecord(value)) return false;
  return (
    typeof value.piece === 'string'
    && typeof value.id === 'number'
    && typeof value.start === 'number'
    && typeof value.end === 'number'
    && typeof value.reason === 'string'
  );
}

function isSegmentationModel(value: unknown): value is SegmentationModel {
  if (!isRecord(value) || !isRecord(value.defaults)) return false;
  return (
    typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof value.disclaimer === 'string'
    && typeof value.offsetUnit === 'string'
    && typeof value.defaults.sampleId === 'string'
    && typeof value.defaults.variantId === 'string'
    && typeof value.defaults.profileId === 'string'
    && typeof value.defaults.addTrustedWrapper === 'boolean'
    && Array.isArray(value.profiles)
    && value.profiles.length > 0
    && value.profiles.every((profile) => (
      isRecord(profile)
      && typeof profile.id === 'string'
      && typeof profile.label === 'string'
      && typeof profile.detail === 'string'
      && typeof profile.method === 'string'
      && isRecord(profile.startToken)
      && typeof profile.startToken.piece === 'string'
      && typeof profile.startToken.id === 'number'
      && isRecord(profile.endToken)
      && typeof profile.endToken.piece === 'string'
      && typeof profile.endToken.id === 'number'
    ))
    && Array.isArray(value.samples)
    && value.samples.length > 0
    && value.samples.every((sample) => (
      isRecord(sample)
      && typeof sample.id === 'string'
      && typeof sample.label === 'string'
      && typeof sample.detail === 'string'
      && typeof sample.input === 'string'
      && Array.isArray(sample.variants)
      && sample.variants.length > 0
      && sample.variants.every((variant) => (
        isRecord(variant)
        && typeof variant.id === 'string'
        && typeof variant.label === 'string'
        && typeof variant.normalizedText === 'string'
        && typeof variant.explanation === 'string'
        && isRecord(variant.segmentations)
        && Object.values(variant.segmentations).every(
          (tokens) => Array.isArray(tokens) && tokens.every(isTokenPiece),
        )
      ))
    ))
  );
}

export default function TokenizationFundamentalsSegmentationLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<SegmentationModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No segmentation fixture was supplied.');
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
        if (!isSegmentationModel(payload)) {
          throw new Error('Segmentation fixture data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load segmentation data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? <LoadError detail={error} /> : data ? <SegmentationLab data={data} /> : <LoadState />}
    </div>
  );
}

function SegmentationLab({ data }: { data: SegmentationModel }) {
  const initialSample = data.samples.find((sample) => sample.id === data.defaults.sampleId)
    ?? data.samples[0];
  const initialVariant = initialSample.variants.find(
    (variant) => variant.id === data.defaults.variantId,
  ) ?? initialSample.variants[0];
  const initialProfile = data.profiles.find((profile) => profile.id === data.defaults.profileId)
    ?? data.profiles[0];

  const [sampleId, setSampleId] = useState(initialSample.id);
  const [variantId, setVariantId] = useState(initialVariant.id);
  const [profileId, setProfileId] = useState(initialProfile.id);
  const [addTrustedWrapper, setAddTrustedWrapper] = useState(
    data.defaults.addTrustedWrapper,
  );

  const sample = data.samples.find((item) => item.id === sampleId) ?? data.samples[0];
  const variant = sample.variants.find((item) => item.id === variantId) ?? sample.variants[0];
  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const contentTokens = useMemo(
    () => variant.segmentations[profile.id] ?? [],
    [profile.id, variant.segmentations],
  );

  const bytes = useMemo(
    () => Array.from(new TextEncoder().encode(variant.normalizedText)),
    [variant.normalizedText],
  );
  const displayTokens = useMemo<DisplayToken[]>(() => {
    const content = contentTokens.map((token) => ({
      ...token,
      special: false,
    }));
    if (!addTrustedWrapper) return content;
    return [
      {
        ...profile.startToken,
        start: null,
        end: null,
        reason: 'trusted template',
        special: true,
      },
      ...content,
      {
        ...profile.endToken,
        start: null,
        end: null,
        reason: 'trusted template',
        special: true,
      },
    ];
  }, [addTrustedWrapper, contentTokens, profile.endToken, profile.startToken]);

  const chooseSample = (nextSample: Sample) => {
    setSampleId(nextSample.id);
    setVariantId(nextSample.variants[0].id);
  };

  const reset = () => {
    setSampleId(initialSample.id);
    setVariantId(initialVariant.id);
    setProfileId(initialProfile.id);
    setAddTrustedWrapper(data.defaults.addTrustedWrapper);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Segmentation pipeline lab"
        title={data.title}
        description={data.description}
        icon={Braces}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Input slice
              </legend>
              <div className="mt-3 grid gap-2">
                {data.samples.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === sample.id}
                    label={item.label}
                    detail={item.detail}
                    icon={sampleIcon(item.id)}
                    accent="blue"
                    onClick={() => chooseSample(item)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Normalization result
              </legend>
              <div className="mt-3 grid gap-2">
                {sample.variants.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === variant.id}
                    label={item.label}
                    detail={item.explanation}
                    icon={Layers3}
                    accent="cyan"
                    onClick={() => setVariantId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Segmentation model
              </legend>
              <div className="mt-3 grid gap-2">
                {data.profiles.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === profile.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Hash}
                    accent="violet"
                    onClick={() => setProfileId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                4. Sequence structure
              </legend>
              <div className="mt-3 grid gap-2">
                <LabChoice
                  selected={!addTrustedWrapper}
                  label="Content IDs only"
                  detail="No role or turn IDs are inserted."
                  icon={FileText}
                  accent="blue"
                  onClick={() => setAddTrustedWrapper(false)}
                />
                <LabChoice
                  selected={addTrustedWrapper}
                  label="Trusted user-turn wrapper"
                  detail="The application inserts control IDs outside the source offsets."
                  icon={LockKeyhole}
                  accent="emerald"
                  onClick={() => setAddTrustedWrapper(true)}
                />
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <section aria-labelledby="normalization-trace-title">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Stage 1
            </p>
            <h4
              id="normalization-trace-title"
              className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white"
            >
              Source and normalized text
            </h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextSurface label="Original source" value={sample.input} />
              <TextSurface label="Tokenizer input" value={variant.normalizedText} />
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {variant.explanation}
            </p>
          </section>

          <section aria-labelledby="utf8-byte-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Stage 2
                </p>
                <h4
                  id="utf8-byte-title"
                  className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white"
                >
                  UTF-8 bytes
                </h4>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Hexadecimal, left to right
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 rounded-md border border-neutral-200 bg-neutral-950 p-3 font-mono text-xs text-cyan-200 dark:border-neutral-800">
              {bytes.map((byte, index) => (
                <span
                  key={`${byte}-${index}`}
                  className="inline-flex h-7 min-w-8 items-center justify-center rounded border border-neutral-700 bg-neutral-900 px-1.5"
                >
                  {byte.toString(16).padStart(2, '0').toUpperCase()}
                </span>
              ))}
            </div>
          </section>

          <section aria-labelledby="token-sequence-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Stages 3 and 4
                </p>
                <h4
                  id="token-sequence-title"
                  className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white"
                >
                  Pieces become IDs
                </h4>
              </div>
              <p className="max-w-sm text-right text-xs text-neutral-500 dark:text-neutral-400">
                {profile.method}
              </p>
            </div>
            <div className="mt-3 flex min-h-16 flex-wrap content-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
              {displayTokens.map((token, index) => (
                <div
                  key={`${token.id}-${index}`}
                  className={`min-w-0 rounded-md border px-3 py-2 ${
                    token.special
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                      : 'border-cyan-300 bg-white text-neutral-950 dark:border-cyan-900 dark:bg-neutral-950 dark:text-neutral-100'
                  }`}
                >
                  <p className="max-w-full break-all font-mono text-sm font-semibold">
                    {visiblePiece(token.piece)}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] opacity-70">ID {token.id}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="UTF-8 bytes"
              value={bytes.length.toLocaleString()}
              detail={`${variant.normalizedText.length} UTF-16 code units`}
              icon={Code2}
              tone="cyan"
            />
            <LabMetric
              label="Content tokens"
              value={contentTokens.length.toLocaleString()}
              detail={`${(bytes.length / Math.max(1, contentTokens.length)).toFixed(1)} bytes per token`}
              icon={Hash}
              tone="violet"
            />
            <LabMetric
              label="Final sequence"
              value={displayTokens.length.toLocaleString()}
              detail={addTrustedWrapper ? 'Includes 2 trusted control IDs' : 'No control IDs added'}
              icon={addTrustedWrapper ? ShieldCheck : FileText}
              tone={addTrustedWrapper ? 'emerald' : 'neutral'}
            />
          </div>

          <section aria-labelledby="offset-map-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Alignment
                </p>
                <h4
                  id="offset-map-title"
                  className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white"
                >
                  Offset map
                </h4>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {data.offsetUnit}
              </p>
            </div>
            <div className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {displayTokens.map((token, index) => (
                <div
                  key={`offset-${token.id}-${index}`}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 bg-white px-3 py-3 dark:bg-neutral-950"
                >
                  <p className="min-w-0 break-all font-mono text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {visiblePiece(token.piece)}
                  </p>
                  <p className="font-mono text-xs tabular-nums text-neutral-600 dark:text-neutral-300">
                    {token.special ? 'template' : `[${token.start}, ${token.end})`}
                  </p>
                  <p className="col-span-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    ID {token.id} · {token.reason}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Teaching fixture, not a compatibility test</p>
                <p className="mt-1 text-xs leading-5 opacity-80">
                  {data.disclaimer} Use the exact production artifact to count tokens or assert IDs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function sampleIcon(sampleId: string) {
  if (sampleId === 'source-code') return Code2;
  if (sampleId === 'arabic') return Globe2;
  if (sampleId === 'control-looking') return ShieldCheck;
  return Braces;
}

function visiblePiece(piece: string) {
  return piece.replaceAll(' ', '·').replaceAll('\n', '↵');
}

function TextSurface({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-2 break-all font-mono text-sm leading-6 text-neutral-900 dark:text-neutral-100">
        {visiblePiece(value)}
      </p>
    </div>
  );
}

function LoadState() {
  return (
    <div className="flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading segmentation fixtures...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div className="rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Segmentation lab unavailable</p>
          <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
