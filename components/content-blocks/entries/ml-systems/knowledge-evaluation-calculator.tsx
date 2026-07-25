'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  Boxes,
  CheckCircle2,
  Grid3X3,
  Scale,
  ShieldCheck,
  Target,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type OperationId = 'recall' | 'explain' | 'apply' | 'source';

interface Operation {
  id: OperationId;
  label: string;
  detail: string;
}

interface Domain {
  id: string;
  label: string;
  weight: number;
}

interface KnowledgeClaim {
  id: string;
  label: string;
  detail: string;
  operationWeights: Record<OperationId, number>;
  domains: Domain[];
  criticalCells: string[];
}

interface PortfolioPolicy {
  id: string;
  label: string;
  detail: string;
  operationMultipliers: Record<OperationId, number>;
}

interface BlueprintData {
  title: string;
  description: string;
  defaults: {
    claimId: string;
    policyId: string;
    itemBudget: number;
  };
  minimums: {
    standardCellItems: number;
    criticalCellItems: number;
  };
  operations: Operation[];
  policies: PortfolioPolicy[];
  claims: KnowledgeClaim[];
}

interface MatrixCell {
  id: string;
  operation: Operation;
  items: number;
  critical: boolean;
  ready: boolean;
  minimum: number;
}

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/knowledge-evaluation/data/evaluation-blueprint-model.json';
const BLOCK_ID = 'ml-systems/knowledge-evaluation-calculator';

const operationBar: Record<OperationId, string> = {
  recall: 'bg-blue-500',
  explain: 'bg-violet-500',
  apply: 'bg-emerald-500',
  source: 'bg-amber-500',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasOperationNumbers(value: unknown): value is Record<OperationId, number> {
  if (!isRecord(value)) return false;
  return ['recall', 'explain', 'apply', 'source'].every(
    (key) => typeof value[key] === 'number',
  );
}

function isBlueprintData(value: unknown): value is BlueprintData {
  if (!isRecord(value) || !isRecord(value.defaults) || !isRecord(value.minimums)) {
    return false;
  }

  return Boolean(
    typeof value.title === 'string'
      && typeof value.description === 'string'
      && typeof value.defaults.claimId === 'string'
      && typeof value.defaults.policyId === 'string'
      && typeof value.defaults.itemBudget === 'number'
      && typeof value.minimums.standardCellItems === 'number'
      && typeof value.minimums.criticalCellItems === 'number'
      && Array.isArray(value.operations)
      && value.operations.length === 4
      && value.operations.every(
        (operation) => isRecord(operation)
          && typeof operation.id === 'string'
          && typeof operation.label === 'string'
          && typeof operation.detail === 'string',
      )
      && Array.isArray(value.policies)
      && value.policies.length > 0
      && value.policies.every(
        (policy) => isRecord(policy)
          && typeof policy.id === 'string'
          && typeof policy.label === 'string'
          && typeof policy.detail === 'string'
          && hasOperationNumbers(policy.operationMultipliers),
      )
      && Array.isArray(value.claims)
      && value.claims.length > 0
      && value.claims.every(
        (claim) => isRecord(claim)
          && typeof claim.id === 'string'
          && typeof claim.label === 'string'
          && typeof claim.detail === 'string'
          && hasOperationNumbers(claim.operationWeights)
          && Array.isArray(claim.domains)
          && claim.domains.length > 0
          && claim.domains.every(
            (domain) => isRecord(domain)
              && typeof domain.id === 'string'
              && typeof domain.label === 'string'
              && typeof domain.weight === 'number',
          )
          && Array.isArray(claim.criticalCells)
          && claim.criticalCells.every((cell) => typeof cell === 'string'),
      ),
  );
}

function allocateExactly(budget: number, weights: number[]) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const raw = weights.map((weight) => budget * weight / totalWeight);
  const result = raw.map(Math.floor);
  let remainder = budget - result.reduce((sum, items) => sum + items, 0);
  const order = raw
    .map((items, index) => ({ index, fraction: items - Math.floor(items) }))
    .sort((left, right) => right.fraction - left.fraction);

  for (const item of order) {
    if (remainder === 0) break;
    result[item.index] += 1;
    remainder -= 1;
  }

  return result;
}

export default function KnowledgeEvaluationCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<BlueprintData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [claimId, setClaimId] = useState('');
  const [policyId, setPolicyId] = useState('');
  const [itemBudget, setItemBudget] = useState(800);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isBlueprintData(payload)) {
          throw new Error('The evaluation blueprint data is incomplete.');
        }

        setData(payload);
        setClaimId(payload.defaults.claimId);
        setPolicyId(payload.defaults.policyId);
        setItemBudget(payload.defaults.itemBudget);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the blueprint.');
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const claim = data?.claims.find((item) => item.id === claimId) ?? data?.claims[0];
  const policy = data?.policies.find((item) => item.id === policyId) ?? data?.policies[0];

  const model = useMemo(() => {
    if (!data || !claim || !policy) return null;

    const definitions = claim.domains.flatMap((domain) =>
      data.operations.map((operation) => {
        const weight = domain.weight
          * claim.operationWeights[operation.id]
          * policy.operationMultipliers[operation.id];
        return { domain, operation, weight };
      }),
    );
    const allocations = allocateExactly(
      itemBudget,
      definitions.map((definition) => definition.weight),
    );
    const criticalSet = new Set(claim.criticalCells);
    const rows = claim.domains.map((domain) => {
      const cells: MatrixCell[] = definitions
        .map((definition, index) => ({ definition, index }))
        .filter(({ definition }) => definition.domain.id === domain.id)
        .map(({ definition, index }) => {
          const id = `${domain.id}:${definition.operation.id}`;
          const critical = criticalSet.has(id);
          const minimum = critical
            ? data.minimums.criticalCellItems
            : data.minimums.standardCellItems;
          const items = allocations[index];
          return {
            id,
            operation: definition.operation,
            items,
            critical,
            ready: items >= minimum,
            minimum,
          };
        });
      return { ...domain, cells };
    });
    const cells = rows.flatMap((row) => row.cells);
    const criticalCells = cells.filter((cell) => cell.critical);
    const weakCell = [...cells].sort(
      (left, right) => left.items / left.minimum - right.items / right.minimum,
    )[0];
    const weakDomain = rows.find((row) => row.cells.some((cell) => cell.id === weakCell.id));
    const operationTotals = data.operations.map((operation) => ({
      ...operation,
      items: cells
        .filter((cell) => cell.operation.id === operation.id)
        .reduce((sum, cell) => sum + cell.items, 0),
    }));

    return {
      rows,
      cells,
      criticalCells,
      weakCell,
      weakDomain,
      operationTotals,
      readyCells: cells.filter((cell) => cell.ready).length,
      readyCriticalCells: criticalCells.filter((cell) => cell.ready).length,
    };
  }, [claim, data, itemBudget, policy]);

  function reset() {
    if (!data) return;
    setClaimId(data.defaults.claimId);
    setPolicyId(data.defaults.policyId);
    setItemBudget(data.defaults.itemBudget);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evaluation blueprint lab"
          title={data?.title ?? 'Build a knowledge evidence blueprint'}
          description={data?.description ?? 'Loading the evaluation blueprint...'}
          icon={Grid3X3}
          accent="blue"
          onReset={data ? reset : undefined}
        />

        {!data || !claim || !policy || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Intended claim
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.claims.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === claim.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'policy-assistant' ? ShieldCheck : item.id === 'support-copilot' ? Boxes : BookOpenCheck}
                        accent={item.id === 'policy-assistant' ? 'rose' : item.id === 'support-copilot' ? 'violet' : 'blue'}
                        onClick={() => setClaimId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Portfolio strategy
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.policies.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === policy.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'claim-aligned' ? Target : item.id === 'recall-heavy' ? BookOpenCheck : Scale}
                        accent={item.id === 'claim-aligned' ? 'emerald' : item.id === 'recall-heavy' ? 'blue' : 'amber'}
                        onClick={() => setPolicyId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="3. Protected item budget"
                  value={itemBudget}
                  output={`${itemBudget.toLocaleString()} items`}
                  min={200}
                  max={2400}
                  step={100}
                  accent="violet"
                  lowLabel="Thin evidence"
                  highLabel="Dense evidence"
                  onChange={setItemBudget}
                />
              </div>
            )}
          >
            <div className="min-h-[760px] min-w-0">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Budget preserved"
                  value={model.cells.reduce((sum, cell) => sum + cell.items, 0).toLocaleString()}
                  detail="Allocated items sum exactly to the selected budget"
                  icon={Target}
                  tone="blue"
                />
                <LabMetric
                  label="Cells ready"
                  value={`${model.readyCells} / ${model.cells.length}`}
                  detail="Every domain and operation needs enough examples"
                  icon={CheckCircle2}
                  tone={model.readyCells === model.cells.length ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Critical evidence"
                  value={`${model.readyCriticalCells} / ${model.criticalCells.length}`}
                  detail="Critical cells use the higher evidence minimum"
                  icon={ShieldCheck}
                  tone={model.readyCriticalCells === model.criticalCells.length ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Weakest cell"
                  value={`${model.weakCell.items} items`}
                  detail={`${model.weakDomain?.label}: ${model.weakCell.operation.label}; needs ${model.weakCell.minimum}`}
                  icon={AlertTriangle}
                  tone={model.weakCell.ready ? 'emerald' : 'rose'}
                />
              </div>

              <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-semibold text-neutral-950 dark:text-white">
                      Operation mix
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                      Strategy changes what the suite can claim even when the item count stays fixed.
                    </p>
                  </div>
                  <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    {policy.label}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {model.operationTotals.map((operation) => (
                    <div key={operation.id}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                          {operation.label}
                        </span>
                        <span className="font-semibold tabular-nums text-neutral-950 dark:text-white">
                          {operation.items} items
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                        <div
                          className={`h-full rounded-full ${operationBar[operation.id]}`}
                          style={{ width: `${operation.items / itemBudget * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h4 className="font-semibold text-neutral-950 dark:text-white">
                      Domain-by-operation evidence matrix
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                      A shield marks cells that directly constrain the intended use.
                    </p>
                  </div>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Minimums: {data.minimums.standardCellItems} standard / {data.minimums.criticalCellItems} critical
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {model.rows.map((row) => (
                    <article
                      key={row.id}
                      className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h5 className="font-semibold text-neutral-950 dark:text-white">
                          {row.label}
                        </h5>
                        <span className="text-xs font-medium tabular-nums text-neutral-500 dark:text-neutral-400">
                          {row.cells.reduce((sum, cell) => sum + cell.items, 0)} items
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {row.cells.map((cell) => (
                          <div
                            key={cell.id}
                            className={`rounded-md border p-3 ${
                              cell.ready
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                                : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold uppercase">
                                {cell.operation.label}
                              </span>
                              {cell.critical ? (
                                <ShieldCheck aria-label="Critical evidence cell" className="h-4 w-4 shrink-0" />
                              ) : null}
                            </div>
                            <p className="mt-2 text-xl font-semibold tabular-nums">
                              {cell.items}
                            </p>
                            <p className="mt-1 text-xs opacity-75">
                              {cell.ready ? 'Evidence minimum met' : `${cell.minimum - cell.items} more needed`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-6">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
        <p className="font-semibold">
          {error ? 'The blueprint could not load.' : 'Loading the blueprint...'}
        </p>
        {error ? (
          <>
            <p className="mt-2 leading-6">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md bg-neutral-950 px-3 py-2 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-white dark:text-neutral-950"
            >
              Retry
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
