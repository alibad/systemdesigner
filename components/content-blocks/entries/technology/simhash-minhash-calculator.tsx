'use client';

import { useState } from 'react';
import { Binary, Database, Fingerprint, Ruler, Sigma } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Algorithm = 'simhash' | 'minhash';

const SIMHASH_BITS = [64, 128, 256] as const;
const MINHASH_ROWS = [64, 128, 256, 512] as const;

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KiB`;
  return `${bytes.toFixed(0)} B`;
}

export default function SimHashMinHashCalculator() {
  const [algorithm, setAlgorithm] = useState<Algorithm>('simhash');
  const [documentCount, setDocumentCount] = useState(1_000_000);
  const [simhashBits, setSimhashBits] = useState<(typeof SIMHASH_BITS)[number]>(64);
  const [hammingDistance, setHammingDistance] = useState(3);
  const [minhashRows, setMinhashRows] = useState<(typeof MINHASH_ROWS)[number]>(128);
  const [matchingRows, setMatchingRows] = useState(96);

  const reset = () => {
    setAlgorithm('simhash');
    setDocumentCount(1_000_000);
    setSimhashBits(64);
    setHammingDistance(3);
    setMinhashRows(128);
    setMatchingRows(96);
  };

  const isSimhash = algorithm === 'simhash';
  const signatureBytes = isSimhash ? simhashBits / 8 : minhashRows * 4;
  const collectionBytes = signatureBytes * documentCount;
  const hammingRate = hammingDistance / simhashBits;
  const bitAgreement = 1 - hammingRate;
  const cosineEstimate = Math.cos(Math.PI * hammingRate);
  const jaccardEstimate = matchingRows / minhashRows;
  const standardError = Math.sqrt(
    (jaccardEstimate * (1 - jaccardEstimate)) / minhashRows
  );
  const lowerBound = Math.max(0, jaccardEstimate - 1.96 * standardError);
  const upperBound = Math.min(1, jaccardEstimate + 1.96 * standardError);
  const activeFraction = isSimhash ? bitAgreement : jaccardEstimate;
  const activeCells = Math.round(activeFraction * 32);

  const changeSimhashBits = (bits: (typeof SIMHASH_BITS)[number]) => {
    setSimhashBits(bits);
    setHammingDistance((current) => Math.min(current, bits));
  };

  const changeMinhashRows = (rows: (typeof MINHASH_ROWS)[number]) => {
    setMinhashRows(rows);
    setMatchingRows((current) => Math.round((current / minhashRows) * rows));
  };

  return (
    <div data-content-block="technology/simhash-minhash-calculator">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Signature evidence lab"
          title="Interpret what two compact signatures actually prove"
          description="Choose the estimator, change the observed agreement, and inspect only quantities derived from the signature. The lab does not invent an accuracy or throughput claim."
          icon={Fingerprint}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Similarity model
                </p>
                <div className="mt-3 space-y-2">
                  <LabChoice
                    selected={isSimhash}
                    label="SimHash"
                    detail="Weighted features, random hyperplanes, and Hamming distance."
                    icon={Binary}
                    accent="blue"
                    onClick={() => setAlgorithm('simhash')}
                  />
                  <LabChoice
                    selected={!isSimhash}
                    label="MinHash"
                    detail="Sets of shingles, signature agreement, and Jaccard similarity."
                    icon={Sigma}
                    accent="emerald"
                    onClick={() => setAlgorithm('minhash')}
                  />
                </div>
              </div>

              <LabRange
                label="Collection size"
                value={documentCount}
                output={documentCount.toLocaleString()}
                min={100_000}
                max={10_000_000}
                step={100_000}
                lowLabel="100K items"
                highLabel="10M items"
                accent="violet"
                onChange={setDocumentCount}
              />

              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  {isSimhash ? 'Fingerprint width' : 'Signature rows'}
                </p>
                <div
                  className={`mt-3 grid gap-2 ${isSimhash ? 'grid-cols-3' : 'grid-cols-4'}`}
                  role="group"
                  aria-label="Signature size"
                >
                  {(isSimhash ? SIMHASH_BITS : MINHASH_ROWS).map((size) => {
                    const selected = isSimhash ? size === simhashBits : size === minhashRows;
                    return (
                      <button
                        key={size}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          isSimhash
                            ? changeSimhashBits(size as (typeof SIMHASH_BITS)[number])
                            : changeMinhashRows(size as (typeof MINHASH_ROWS)[number])
                        }
                        className={`min-h-10 rounded-md border px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                          selected
                            ? 'border-cyan-600 bg-cyan-50 text-cyan-950 dark:border-cyan-400 dark:bg-cyan-950/60 dark:text-cyan-100'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isSimhash ? (
                <LabRange
                  label="Hamming distance"
                  value={hammingDistance}
                  output={`${hammingDistance} bits`}
                  min={0}
                  max={simhashBits}
                  step={1}
                  lowLabel="Identical fingerprint"
                  highLabel="Every bit differs"
                  accent="blue"
                  onChange={setHammingDistance}
                />
              ) : (
                <LabRange
                  label="Matching rows"
                  value={matchingRows}
                  output={`${matchingRows} / ${minhashRows}`}
                  min={0}
                  max={minhashRows}
                  step={1}
                  lowLabel="No matches"
                  highLabel="All rows match"
                  accent="emerald"
                  onChange={setMatchingRows}
                />
              )}
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <LabMetric
              label={isSimhash ? 'Bit agreement' : 'Jaccard estimate'}
              value={`${(activeFraction * 100).toFixed(1)}%`}
              detail={
                isSimhash
                  ? `${simhashBits - hammingDistance} of ${simhashBits} bits agree.`
                  : `${matchingRows} of ${minhashRows} independent rows agree.`
              }
              icon={Ruler}
              tone={isSimhash ? 'blue' : 'emerald'}
            />
            <LabMetric
              label={isSimhash ? 'Cosine estimate' : 'Approx. 95% interval'}
              value={
                isSimhash
                  ? cosineEstimate.toFixed(3)
                  : `${(lowerBound * 100).toFixed(1)}-${(upperBound * 100).toFixed(1)}%`
              }
              detail={
                isSimhash
                  ? 'cos(pi x Hamming distance / bit count) under random-hyperplane SimHash.'
                  : 'Normal approximation assuming independent MinHash rows.'
              }
              icon={Sigma}
              tone="violet"
            />
            <LabMetric
              label="Signature storage"
              value={formatBytes(collectionBytes)}
              detail={`${formatBytes(signatureBytes)} per item; excludes index and object overhead.`}
              icon={Database}
              tone="amber"
            />
          </div>

          <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  {isSimhash ? 'Fingerprint agreement' : 'Signature-row agreement'}
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  A 32-cell visual sample of the ratio above, not the stored signature.
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                {(activeFraction * 100).toFixed(1)}%
              </span>
            </div>
            <div
              className="mt-4 grid gap-1 [grid-template-columns:repeat(16,minmax(0,1fr))]"
              aria-hidden="true"
            >
              {Array.from({ length: 32 }, (_, index) => (
                <span
                  key={index}
                  className={`h-7 rounded-sm ${
                    index < activeCells
                      ? isSimhash
                        ? 'bg-blue-500 dark:bg-blue-400'
                        : 'bg-emerald-500 dark:bg-emerald-400'
                      : 'bg-neutral-200 dark:bg-neutral-700'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 border-l-4 border-cyan-500 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-950 dark:bg-cyan-950/40 dark:text-cyan-100">
            {isSimhash
              ? 'Interpret the result only after fixing feature extraction, feature weights, bit width, and a threshold measured on labeled pairs. A small Hamming distance is evidence from the sketch, not proof that two documents are duplicates.'
              : 'More rows reduce estimator variance but increase signature and index cost. LSH banding changes which pairs become candidates; exact Jaccard verification still owns the final duplicate decision.'}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
