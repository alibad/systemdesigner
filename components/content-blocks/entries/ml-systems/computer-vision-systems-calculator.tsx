'use client';

import { useEffect, useState } from 'react';
import ComputerVisionCapacityLab, {
  isComputerVisionCapacityLabData,
  type ComputerVisionCapacityLabData,
} from './computer-vision-systems-capacity-lab';
import ComputerVisionDecisionPolicyLab, {
  isComputerVisionDecisionPolicyLabData,
  type ComputerVisionDecisionPolicyLabData,
} from './computer-vision-systems-decision-policy-lab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/computer-vision-systems/data/capacity-planning-lab.json';

type LabData = ComputerVisionCapacityLabData | ComputerVisionDecisionPolicyLabData;

function fallbackBlockId(dataFile: string) {
  return dataFile.includes('decision-policy')
    ? 'ml-systems/computer-vision-systems-decision-policy-lab'
    : 'ml-systems/computer-vision-systems-capacity-lab';
}

export default function ComputerVisionSystemsCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load the vision lab (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        if (
          !isComputerVisionCapacityLabData(value) &&
          !isComputerVisionDecisionPolicyLabData(value)
        ) {
          throw new Error('Vision lab data does not match a supported contract.');
        }
        setData(value);
      })
      .catch((cause: unknown) => {
        if ((cause as { name?: string }).name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Could not load the vision lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) {
    return (
      <div
        data-content-block={fallbackBlockId(dataFile)}
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        <p className="font-semibold">The interactive lab could not be loaded.</p>
        <p className="mt-2 opacity-80">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div data-content-block={fallbackBlockId(dataFile)}>
        <div
          className="not-prose my-7 min-h-80 animate-pulse rounded-md border border-neutral-200 bg-neutral-100 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
          aria-label="Loading computer vision learning lab"
        />
      </div>
    );
  }

  return data.kind === 'capacity' ? (
    <ComputerVisionCapacityLab data={data} />
  ) : (
    <ComputerVisionDecisionPolicyLab data={data} />
  );
}
