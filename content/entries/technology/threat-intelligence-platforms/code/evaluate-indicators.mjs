import { readFile } from 'node:fs/promises';

const modelPath = process.argv[2];
const delayDays = Number(process.argv[3] ?? 0);

if (!modelPath || !Number.isFinite(delayDays) || delayDays < 0) {
  console.error('Usage: node evaluate-indicators.mjs <triage-model.json> [additional-delay-days]');
  process.exit(1);
}

const model = JSON.parse(await readFile(modelPath, 'utf8'));

if (!Array.isArray(model.indicators) || !Array.isArray(model.actions)) {
  throw new Error('Triage model must contain indicators and actions arrays.');
}

function evaluate(indicator, action) {
  const ageDays = indicator.lastSeenDaysAgo + delayDays;
  const decayPeriods = Math.floor(ageDays / indicator.decayEveryDays);
  const confidence = Math.max(0, indicator.baseConfidence - decayPeriods * indicator.decayPoints);
  const gates = {
    fresh: !action.requiresFresh || ageDays <= indicator.validForDays,
    confidence: confidence >= action.minConfidence,
    falsePositive: indicator.falsePositiveRisk <= action.maxFalsePositiveRisk,
    context: indicator.contextCompleteness >= action.minContextCompleteness,
    sightings: indicator.sightings >= action.minSightings
  };
  const failed = Object.entries(gates).filter(([, pass]) => !pass).map(([name]) => name);

  return {
    indicator: indicator.label,
    action: action.label,
    ageDays,
    confidence,
    decision: failed.length === 0 ? 'eligible' : `hold: ${failed.join(', ')}`
  };
}

const rows = model.indicators.flatMap((indicator) =>
  model.actions.map((action) => evaluate(indicator, action))
);

console.table(rows);
