'use client';

import { useMemo, useState } from 'react';
import {
  Binary,
  CircleAlert,
  Database,
  Fingerprint,
  Gauge,
  Images,
  Search,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/perceptual-hashing-calculator';

const algorithms = [
  { id: 'dhash', label: 'dHash, 64 bits', detail: 'Adjacent brightness gradients; fast baseline for near-duplicate screening.', bits: 64, defaultDistance: 6 },
  { id: 'phash', label: 'DCT pHash, 64 bits', detail: 'Low-frequency image structure; measure robustness on your own transformations.', bits: 64, defaultDistance: 8 },
  { id: 'phash256', label: 'DCT pHash, 256 bits', detail: 'Larger signature with a larger absolute distance scale and more storage.', bits: 256, defaultDistance: 22 },
] as const;

function probabilityWithinHammingRadius(bits: number, radius: number) {
  let combination = 1;
  let sum = 1;
  for (let distance = 1; distance <= radius; distance += 1) {
    combination *= (bits - distance + 1) / distance;
    sum += combination;
  }
  return sum * 2 ** -bits;
}

function formatProbability(value: number) {
  if (value === 0) return 'below numeric range';
  if (value < 0.001) return value.toExponential(2);
  return `${(value * 100).toFixed(3)}%`;
}

export default function PerceptualHashingCalculator() {
  const [algorithmId, setAlgorithmId] = useState<(typeof algorithms)[number]['id']>('phash');
  const [corpusSize, setCorpusSize] = useState(1000000);
  const algorithm = algorithms.find((item) => item.id === algorithmId) ?? algorithms[1];
  const [threshold, setThreshold] = useState(10);
  const [observedDistance, setObservedDistance] = useState(8);

  const model = useMemo(() => {
    const boundedThreshold = Math.min(threshold, Math.floor(algorithm.bits / 2));
    const randomMatchProbability = probabilityWithinHammingRadius(algorithm.bits, boundedThreshold);
    const expectedRandomCandidates = Math.max(0, corpusSize - 1) * randomMatchProbability;
    const storageMiB = (corpusSize * algorithm.bits) / 8 / 1024 / 1024;
    const normalizedThreshold = boundedThreshold / algorithm.bits;
    return {
      boundedThreshold,
      randomMatchProbability,
      expectedRandomCandidates,
      storageMiB,
      normalizedThreshold,
      classifiedAsMatch: observedDistance <= boundedThreshold,
    };
  }, [algorithm.bits, corpusSize, observedDistance, threshold]);

  const chooseAlgorithm = (id: (typeof algorithms)[number]['id']) => {
    const next = algorithms.find((item) => item.id === id) ?? algorithms[1];
    setAlgorithmId(id);
    setThreshold(next.bits === 256 ? 28 : 10);
    setObservedDistance(next.defaultDistance);
  };

  const reset = () => {
    setCorpusSize(1000000);
    chooseAlgorithm('phash');
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Hamming threshold lab"
          title="Tune a candidate boundary, then validate it with labeled pairs"
          description="Choose a hash width, corpus size, threshold, and observed distance. The model computes exact random-bit collision odds but never pretends those odds are real-world accuracy."
          icon={Fingerprint}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Signature model</p>
                <div className="mt-3 space-y-2">
                  {algorithms.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === algorithmId}
                      label={item.label}
                      detail={item.detail}
                      icon={Binary}
                      accent="violet"
                      onClick={() => chooseAlgorithm(item.id)}
                    />
                  ))}
                </div>
              </div>
              <LabRange
                label="Indexed images"
                value={corpusSize}
                output={corpusSize.toLocaleString()}
                min={1000}
                max={10000000}
                step={1000}
                lowLabel="small library"
                highLabel="large corpus"
                accent="blue"
                onChange={setCorpusSize}
              />
              <LabRange
                label="Match threshold"
                value={threshold}
                output={`≤ ${threshold} bits`}
                min={0}
                max={algorithm.bits === 256 ? 64 : 24}
                lowLabel="strict"
                highLabel="more candidates"
                accent="rose"
                onChange={setThreshold}
              />
              <LabRange
                label="Observed pair distance"
                value={observedDistance}
                output={`${observedDistance} bits`}
                min={0}
                max={algorithm.bits === 256 ? 100 : 40}
                lowLabel="identical hash"
                highLabel="different hash"
                accent="cyan"
                onChange={setObservedDistance}
              />
            </div>
          )}
        >
          <div className={`rounded-md border p-5 ${
            model.classifiedAsMatch
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
              : 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35'
          }`}>
            <div className="flex items-start gap-3">
              {model.classifiedAsMatch
                ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />}
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">Candidate decision</p>
                <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                  {model.classifiedAsMatch ? 'Send this pair to verification' : 'This threshold rejects the pair'}
                </h4>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  The pair differs in {observedDistance} of {algorithm.bits} bits. A threshold of {model.boundedThreshold} is a retrieval rule, not proof that two files depict the same source image.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Normalized radius" value={`${(model.normalizedThreshold * 100).toFixed(1)}%`} detail="threshold divided by hash width" icon={Gauge} tone="violet" />
            <LabMetric label="Hash storage" value={`${model.storageMiB.toFixed(1)} MiB`} detail="signatures only, before index overhead" icon={Database} tone="blue" />
            <LabMetric label="Random match odds" value={formatProbability(model.randomMatchProbability)} detail="ideal independent-bit assumption" icon={Search} tone="cyan" />
            <LabMetric label="Expected random candidates" value={model.expectedRandomCandidates < 0.01 ? model.expectedRandomCandidates.toExponential(2) : model.expectedRandomCandidates.toFixed(2)} detail={`per query across ${corpusSize.toLocaleString()} hashes`} icon={Images} tone={model.expectedRandomCandidates < 1 ? 'emerald' : 'rose'} />
          </div>

          <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            <strong className="text-neutral-950 dark:text-white">What the math does not know:</strong>{' '}
            real perceptual bits are correlated, transformations do not produce random hashes, and some unrelated images share visual structure. Select a production threshold from labeled positives and negatives for your own algorithm, preprocessing, and content domain.
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
