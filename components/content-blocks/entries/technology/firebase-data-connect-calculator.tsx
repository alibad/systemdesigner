'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle } from 'lucide-react';

import FirebaseDataConnectAuthorizationDeploymentLab from './firebase-data-connect-authorization-deployment-lab';
import FirebaseDataConnectQuerySchemaLab from './firebase-data-connect-query-schema-lab';

type LabModel =
  | { kind: 'query-schema'; [key: string]: unknown }
  | { kind: 'authorization-deployment'; [key: string]: unknown };

function isLabModel(value: unknown): value is LabModel {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'query-schema' || kind === 'authorization-deployment';
}

export default function FirebaseDataConnectCalculator({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<LabModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No Firebase Data Connect learning model was supplied.');
      return;
    }

    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabModel(payload)) throw new Error('The learning model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the learning model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) {
    return (
      <div className="rounded-md border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
        <div className="flex items-start gap-3">
          <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">The learning lab could not load</p>
            <p className="mt-1 text-sm opacity-80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
        Loading Firebase Data Connect decision model...
      </div>
    );
  }

  return model.kind === 'query-schema' ? (
    <FirebaseDataConnectQuerySchemaLab model={model} />
  ) : (
    <FirebaseDataConnectAuthorizationDeploymentLab model={model} />
  );
}
