'use client';

import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleAlert,
  FileCode2,
  Fingerprint,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type AssetStateId = 'published' | 'tampered';

type Algorithm = {
  id: string;
  label: string;
  detail: string;
  webCryptoName: 'SHA-1' | 'SHA-256' | 'SHA-384';
  sriName: string;
  securityApproved: boolean;
};

type ExpectedSource = {
  id: string;
  label: string;
  detail: string;
  trusted: boolean;
};

type IntegrityLabData = {
  title: string;
  description: string;
  assetName: string;
  defaultAssetState: AssetStateId;
  defaultAlgorithmId: string;
  defaultExpectedSourceId: string;
  publishedContent: string;
  tamperedContent: string;
  algorithms: Algorithm[];
  expectedSources: ExpectedSource[];
};

type DigestState = {
  delivered: string;
  expected: string;
};

type Decision = {
  label: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'rose';
  icon: LucideIcon;
};

function isIntegrityLabData(value: unknown): value is IntegrityLabData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<IntegrityLabData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.assetName
      && (candidate.defaultAssetState === 'published' || candidate.defaultAssetState === 'tampered')
      && candidate.defaultAlgorithmId
      && candidate.defaultExpectedSourceId
      && typeof candidate.publishedContent === 'string'
      && typeof candidate.tamperedContent === 'string'
      && candidate.publishedContent !== candidate.tamperedContent
      && Array.isArray(candidate.algorithms)
      && candidate.algorithms.length >= 2
      && candidate.algorithms.every((algorithm) => (
        typeof algorithm.id === 'string'
        && typeof algorithm.label === 'string'
        && typeof algorithm.detail === 'string'
        && ['SHA-1', 'SHA-256', 'SHA-384'].includes(algorithm.webCryptoName)
        && typeof algorithm.sriName === 'string'
        && typeof algorithm.securityApproved === 'boolean'
      ))
      && Array.isArray(candidate.expectedSources)
      && candidate.expectedSources.length >= 2
      && candidate.expectedSources.every((source) => (
        typeof source.id === 'string'
        && typeof source.label === 'string'
        && typeof source.detail === 'string'
        && typeof source.trusted === 'boolean'
      )),
  );
}

async function digest(content: string, algorithm: Algorithm): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digestBuffer = await crypto.subtle.digest(algorithm.webCryptoName, bytes);
  const digestBytes = new Uint8Array(digestBuffer);
  const binary = Array.from(digestBytes, (byte) => String.fromCharCode(byte)).join('');
  return `${algorithm.sriName}-${btoa(binary)}`;
}

function compactDigest(value: string) {
  if (value.length <= 30) return value;
  return `${value.slice(0, 20)}...${value.slice(-8)}`;
}

export default function ChecksumSecurityCDNCalculator({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<IntegrityLabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No integrity-lab data file was supplied.');
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
        if (!isIntegrityLabData(payload)) throw new Error('Integrity-lab data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (error) {
    return <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />;
  }
  if (!data) return <LoadState error={null} onRetry={() => setReloadKey((key) => key + 1)} />;
  return <IntegrityBoundaryLab data={data} />;
}

function IntegrityBoundaryLab({ data }: { data: IntegrityLabData }) {
  const initialAlgorithm = data.algorithms.find((item) => item.id === data.defaultAlgorithmId)
    ?? data.algorithms[0];
  const initialSource = data.expectedSources.find((item) => item.id === data.defaultExpectedSourceId)
    ?? data.expectedSources[0];
  const [assetState, setAssetState] = useState<AssetStateId>(data.defaultAssetState);
  const [algorithmId, setAlgorithmId] = useState(initialAlgorithm.id);
  const [sourceId, setSourceId] = useState(initialSource.id);
  const [digests, setDigests] = useState<DigestState | null>(null);
  const [digestError, setDigestError] = useState(false);

  const algorithm = data.algorithms.find((item) => item.id === algorithmId) ?? data.algorithms[0];
  const source = data.expectedSources.find((item) => item.id === sourceId) ?? data.expectedSources[0];
  const deliveredContent = assetState === 'published' ? data.publishedContent : data.tamperedContent;
  const expectedContent = source.trusted ? data.publishedContent : deliveredContent;

  useEffect(() => {
    let active = true;
    setDigests(null);
    setDigestError(false);

    Promise.all([
      digest(deliveredContent, algorithm),
      digest(expectedContent, algorithm),
    ])
      .then(([delivered, expected]) => {
        if (active) setDigests({ delivered, expected });
      })
      .catch(() => {
        if (active) setDigestError(true);
      });

    return () => {
      active = false;
    };
  }, [algorithm, deliveredContent, expectedContent]);

  const hashesMatch = digests ? digests.delivered === digests.expected : null;
  const decision = decide(algorithm, source, hashesMatch, digestError);
  const DecisionIcon = decision.icon;

  function reset() {
    setAssetState(data.defaultAssetState);
    setAlgorithmId(initialAlgorithm.id);
    setSourceId(initialSource.id);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Integrity boundary lab"
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
                1. Delivered bytes
              </legend>
              <div className="mt-3 space-y-2">
                <LabChoice
                  selected={assetState === 'published'}
                  label="Published release"
                  detail="The edge returns the exact bytes produced by the release job."
                  icon={FileCode2}
                  accent="emerald"
                  onClick={() => setAssetState('published')}
                />
                <LabChoice
                  selected={assetState === 'tampered'}
                  label="One changed instruction"
                  detail="The edge returns a modified asset under the same URL."
                  icon={CircleAlert}
                  accent="rose"
                  onClick={() => setAssetState('tampered')}
                />
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Digest algorithm
              </legend>
              <div className="mt-3 space-y-2">
                {data.algorithms.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === algorithm.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.securityApproved ? ShieldCheck : CircleAlert}
                    accent={item.securityApproved ? 'blue' : 'amber'}
                    onClick={() => setAlgorithmId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Expected digest source
              </legend>
              <div className="mt-3 space-y-2">
                {data.expectedSources.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === source.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.trusted ? KeyRound : CircleAlert}
                    accent={item.trusted ? 'violet' : 'rose'}
                    onClick={() => setSourceId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div aria-live="polite" className="min-w-0">
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Byte comparison"
              value={digestError ? 'Unavailable' : hashesMatch === null ? 'Computing' : hashesMatch ? 'Match' : 'Mismatch'}
              detail={digestError
                ? 'The digest operation failed and produced no comparison evidence.'
                : hashesMatch === null
                  ? 'The verifier has not produced both digests yet.'
                : hashesMatch
                  ? 'The delivered bytes match the selected expected value.'
                  : 'Different bytes produce a different digest.'}
              icon={digestError ? CircleAlert : hashesMatch === null ? Fingerprint : hashesMatch ? BadgeCheck : Ban}
              tone={digestError ? 'rose' : hashesMatch === null ? 'neutral' : hashesMatch ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Reference trust"
              value={source.trusted ? 'Independent' : 'Coupled'}
              detail={source.trusted
                ? 'The expected value remains outside the asset delivery boundary.'
                : 'The same compromised edge can replace the asset and its claimed digest.'}
              icon={source.trusted ? LockKeyhole : CircleAlert}
              tone={source.trusted ? 'violet' : 'rose'}
            />
            <LabMetric
              label="Release decision"
              value={decision.label}
              detail={decision.detail}
              icon={decision.icon}
              tone={decision.tone}
            />
          </div>

          <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Computed evidence
                </p>
                <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">{data.assetName}</h4>
              </div>
              <span className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                {algorithm.sriName}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <DigestRow
                label="Delivered digest"
                value={digests ? compactDigest(digests.delivered) : digestError ? 'Unavailable' : 'Computing...'}
              />
              <DigestRow
                label="Expected digest"
                value={digests ? compactDigest(digests.expected) : digestError ? 'Unavailable' : 'Computing...'}
              />
            </dl>
          </section>

          <div className={`mt-5 rounded-md border p-5 ${
            decision.tone === 'emerald'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
              : decision.tone === 'amber'
                ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
                : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
          }`}>
            <div className="flex items-start gap-3">
              <DecisionIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{decision.label}</p>
                <p className="mt-1 text-sm leading-6 opacity-85">{decision.detail}</p>
              </div>
            </div>
          </div>

          <p className="mt-5 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            A matching digest is useful only when the algorithm resists deliberate substitution and the expected value comes from a boundary the asset attacker cannot rewrite.
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function decide(
  algorithm: Algorithm,
  source: ExpectedSource,
  hashesMatch: boolean | null,
  digestError: boolean,
): Decision {
  if (digestError) {
    return {
      label: 'Fail closed',
      detail: 'Verification did not complete, so the asset must not execute.',
      tone: 'rose',
      icon: Ban,
    };
  }
  if (hashesMatch === null) {
    return {
      label: 'Verify first',
      detail: 'Keep the asset from executing until both digests are available for comparison.',
      tone: 'amber',
      icon: Fingerprint,
    };
  }
  if (!algorithm.securityApproved) {
    return {
      label: 'Reject algorithm',
      detail: 'A match under a collision-broken algorithm is not sufficient adversarial integrity evidence.',
      tone: 'amber',
      icon: CircleAlert,
    };
  }
  if (!source.trusted) {
    return {
      label: 'Reject trust model',
      detail: 'The check can match while an attacker replaces both the bytes and their claimed digest.',
      tone: 'rose',
      icon: Ban,
    };
  }
  if (!hashesMatch) {
    return {
      label: 'Block asset',
      detail: 'Keep the changed bytes from executing, report the mismatch, and use a separately verified fallback.',
      tone: 'rose',
      icon: Ban,
    };
  }
  return {
    label: 'Execute asset',
    detail: 'The bytes match an independently trusted digest under a suitable cryptographic algorithm.',
    tone: 'emerald',
    icon: CheckCircle2,
  };
}

function DigestRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 rounded-md border border-neutral-200 bg-white p-3 sm:grid-cols-[130px_minmax(0,1fr)] sm:items-center dark:border-neutral-800 dark:bg-neutral-950">
      <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="min-w-0 break-all font-mono text-xs text-neutral-800 dark:text-neutral-200">{value}</dd>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="not-prose my-7 rounded-lg border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start gap-3">
        {error ? (
          <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
        ) : (
          <LoaderCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-cyan-600 dark:text-cyan-400" />
        )}
        <div>
          <p className="font-semibold text-neutral-950 dark:text-white">
            {error ? 'The integrity lab could not be loaded' : 'Loading integrity lab'}
          </p>
          {error ? <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{error}</p> : null}
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
