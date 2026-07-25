'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  GitCommitHorizontal,
  Hash,
  LockKeyhole,
  RefreshCw,
  Split,
  Tags,
  TriangleAlert,
  UnlockKeyhole,
  type LucideIcon,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/training-data-management-manifest-lab';
const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/training-data-management/data/dataset-manifest-lab.json';

type Accent = 'cyan' | 'violet' | 'emerald' | 'amber';
type ManifestOption = {
  id: string;
  label: string;
  detail: string;
  reference: string;
  stable: boolean;
};
type ManifestDimension = {
  id: string;
  label: string;
  question: string;
  risk: string;
  accent: Accent;
  options: ManifestOption[];
};
type ManifestLabData = {
  title: string;
  description: string;
  dimensions: ManifestDimension[];
  defaults: Record<string, string>;
};

const dimensionIcons: Record<string, LucideIcon> = {
  source: Archive,
  transform: GitCommitHorizontal,
  labels: Tags,
  split: Split,
};

function isManifestLabData(value: unknown): value is ManifestLabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ManifestLabData>;
  const accents: Accent[] = ['cyan', 'violet', 'emerald', 'amber'];

  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      data.defaults &&
      typeof data.defaults === 'object' &&
      Array.isArray(data.dimensions) &&
      data.dimensions.length >= 3 &&
      data.dimensions.every(
        (dimension) =>
          dimension &&
          typeof dimension.id === 'string' &&
          typeof dimension.label === 'string' &&
          typeof dimension.question === 'string' &&
          typeof dimension.risk === 'string' &&
          accents.includes(dimension.accent) &&
          Array.isArray(dimension.options) &&
          dimension.options.length >= 2 &&
          dimension.options.every(
            (option) =>
              option &&
              typeof option.id === 'string' &&
              typeof option.label === 'string' &&
              typeof option.detail === 'string' &&
              typeof option.reference === 'string' &&
              typeof option.stable === 'boolean',
          ),
      ),
  );
}

function shortFingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export default function TrainingDataManagementManifestLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ManifestLabData | null>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load manifest lab data (${response.status}).`);
        }
        return response.json();
      })
      .then((value: unknown) => {
        if (!isManifestLabData(value)) {
          throw new Error('The manifest lab data does not match the expected contract.');
        }
        setData(value);
        setSelection(value.defaults);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(
            fetchError instanceof Error ? fetchError.message : 'Could not load manifest lab data.',
          );
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;

    const choices = data.dimensions.map((dimension) => ({
      dimension,
      option:
        dimension.options.find((option) => option.id === selection[dimension.id]) ??
        dimension.options[0],
    }));
    const pinnedCount = choices.filter(({ option }) => option.stable).length;
    const unstable = choices.filter(({ option }) => !option.stable);
    const reproducible = unstable.length === 0;
    const identity = reproducible
      ? `snapshot-${shortFingerprint(
          choices.map(({ dimension, option }) => `${dimension.id}:${option.reference}`).join('|'),
        )}`
      : 'unresolved';

    return {
      choices,
      pinnedCount,
      unstable,
      reproducible,
      identity,
      summary: reproducible
        ? 'This release can be replayed from immutable evidence.'
        : `${unstable.length} mutable input${unstable.length === 1 ? '' : 's'} can change the next training run.`,
    };
  }, [data, selection]);

  const reset = () => {
    if (data) setSelection(data.defaults);
  };

  if (error) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data || !model) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading dataset manifest lab"
      />
    );
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Reproducibility lab"
          title={data.title}
          description={data.description}
          icon={LockKeyhole}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              {data.dimensions.map((dimension, index) => {
                const Icon = dimensionIcons[dimension.id] ?? Hash;
                return (
                  <fieldset key={dimension.id}>
                    <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                      {index + 1}. {dimension.question}
                    </legend>
                    <div className="mt-3 space-y-2">
                      {dimension.options.map((option) => (
                        <LabChoice
                          key={option.id}
                          selected={selection[dimension.id] === option.id}
                          label={option.label}
                          detail={option.detail}
                          icon={Icon}
                          accent={dimension.accent}
                          onClick={() =>
                            setSelection((current) => ({
                              ...current,
                              [dimension.id]: option.id,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          }
        >
          <div
            aria-live="polite"
            className={`rounded-md border p-4 ${
              model.reproducible
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
                : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
            }`}
          >
            <div className="flex items-start gap-3">
              {model.reproducible ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300"
                />
              ) : (
                <TriangleAlert
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  {model.summary}
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  A storage path is not a dataset identity. The identity must resolve the exact source
                  state, transformation, labels, and split assignment.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Pinned inputs"
              value={`${model.pinnedCount}/${data.dimensions.length}`}
              detail="Immutable references in the manifest"
              icon={LockKeyhole}
              tone={model.reproducible ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Replay result"
              value={model.reproducible ? 'Exact evidence' : 'May drift'}
              detail="Assuming deterministic execution"
              icon={RefreshCw}
              tone={model.reproducible ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Manifest key"
              value={model.identity}
              detail="Illustrative key, not a content digest"
              icon={Hash}
              tone="violet"
            />
          </div>

          <ol className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Manifest evidence chain">
            {model.choices.map(({ dimension, option }, index) => (
              <li
                key={dimension.id}
                className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                        {dimension.label}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          option.stable
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {option.stable ? (
                          <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
                        ) : (
                          <UnlockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                        {option.stable ? 'Pinned' : 'Mutable'}
                      </span>
                    </div>
                    <p className="mt-1 break-words font-mono text-xs text-neutral-600 dark:text-neutral-400">
                      {option.reference}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {model.unstable.length > 0 ? (
            <div className="mt-6 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                Remaining replay risks
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-700 marker:text-amber-600 dark:text-neutral-300 dark:marker:text-amber-400">
                {model.unstable.map(({ dimension }) => (
                  <li key={dimension.id}>{dimension.risk}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              The manifest is eligible for signing and release. Production systems should also record
              checksums, schema, row statistics, permissions, and the validation report.
            </div>
          )}
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
