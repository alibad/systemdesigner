/**
 * Deterministic graders. The LLM (in /api/grade) only ever adds non-scoring
 * narrative on top of these — the score and pass/fail are 100% deterministic so
 * progression never sits on a flaky/expensive model call.
 *
 * Each grader returns the scored fields of a GradeResult; the API route stamps
 * challengeId / kind / timeMs / attempt and optional feedback.
 */

import type {
  Rubric,
  SystemGraph,
  GradeCriterion,
  DesignRubricCriterion,
} from './types';
import { extractSystemGraph, hasEdgeBetween, hasNodeType } from './system-graph';

interface ScoredResult {
  score: number;
  passed: boolean;
  perCriterion: GradeCriterion[];
}

function finalize(perCriterion: GradeCriterion[], passThreshold: number): ScoredResult {
  const totalWeight = perCriterion.reduce((s, c) => s + c.weight, 0) || 1;
  const metWeight = perCriterion.reduce((s, c) => s + (c.met ? c.weight : 0), 0);
  const score = Math.max(0, Math.min(1, metWeight / totalWeight));
  return { score, passed: score >= passThreshold, perCriterion };
}

// ---------------------------------------------------------------------------
// Design — grade a topology against a rubric. Multiple valid architectures pass;
// we check for the *presence and wiring of forcing components*, never a single
// golden answer (the #1 thing 2026 interviewers reject is memorized solutions).
// ---------------------------------------------------------------------------

function evalDesignCriterion(graph: SystemGraph, c: DesignRubricCriterion): boolean {
  const checks: boolean[] = [];

  if (c.requireNodeTypes?.length) {
    checks.push(c.requireNodeTypes.every((t) => hasNodeType(graph, t)));
  }
  if (c.anyNodeTypes?.length) {
    checks.push(c.anyNodeTypes.some((t) => hasNodeType(graph, t)));
  }
  if (c.requireEdgeBetween?.length) {
    // The listed pairs are ALTERNATIVE acceptable wirings (e.g. server↔cache OR api↔cache),
    // so the criterion is met if ANY of them is present — not all of them.
    checks.push(c.requireEdgeBetween.some(([a, b]) => hasEdgeBetween(graph, a, b)));
  }
  if (typeof c.minNodes === 'number') {
    checks.push(graph.nodes.length >= c.minNodes);
  }

  // A criterion with no checks is vacuously met (lets authors add prose-only lines).
  return checks.length === 0 ? true : checks.every(Boolean);
}

export function gradeDesign(records: unknown, rubric: Rubric): ScoredResult & { graph: SystemGraph } {
  const graph = extractSystemGraph(records);
  const criteria = rubric.criteria ?? [];
  const perCriterion: GradeCriterion[] = criteria.map((c) => {
    const met = evalDesignCriterion(graph, c);
    return {
      id: c.id,
      label: c.label,
      met,
      weight: c.weight,
      phase: c.phase,
      why: met ? c.metWhy : c.why,
    };
  });
  return { ...finalize(perCriterion, rubric.passThreshold), graph };
}

// ---------------------------------------------------------------------------
// Capacity — grade the reasoning chain (assumption -> number -> implication) by
// checking each derived figure lands in an acceptable band. Bands live server-side.
// ---------------------------------------------------------------------------

export function gradeCapacity(answers: Record<string, unknown>, rubric: Rubric): ScoredResult {
  const bands = rubric.bands ?? [];
  const perCriterion: GradeCriterion[] = bands.map((b) => {
    const raw = answers?.[b.field];
    const value = typeof raw === 'number' ? raw : Number(raw);
    const met = Number.isFinite(value) && value >= b.min && value <= b.max;
    return {
      id: b.id,
      label: b.label,
      met,
      weight: b.weight,
      why: met ? b.metWhy : b.why,
    };
  });
  return finalize(perCriterion, rubric.passThreshold);
}

// ---------------------------------------------------------------------------
// Trade-off — reward fit-to-constraint, not the canonical answer. Several options
// may be acceptable depending on the stated constraint.
// ---------------------------------------------------------------------------

export function gradeTradeoff(answers: Record<string, unknown>, rubric: Rubric): ScoredResult {
  const options = rubric.options ?? [];
  const choice = String(answers?.choice ?? '');
  const chosen = options.find((o) => o.id === choice);

  const perCriterion: GradeCriterion[] = [
    {
      id: 'fit-to-constraint',
      label: rubric.constraint ? `Fit to constraint: ${rubric.constraint}` : 'Fit to stated constraint',
      met: !!chosen?.accepted,
      weight: 1,
      why: chosen
        ? chosen.why
        : 'Pick the option that best fits the stated constraint, then justify it.',
    },
  ];

  // Score reflects the *quality* of fit (an accepted-but-weaker option scores partial).
  const score = chosen?.accepted ? Math.max(0, Math.min(1, chosen.weight)) : 0;
  return {
    score,
    passed: score >= rubric.passThreshold,
    perCriterion,
  };
}

/** Dispatch on rubric.kind. Returns scored fields + (for design) the extracted graph. */
export function grade(
  rubric: Rubric,
  input: { records?: unknown; answers?: Record<string, unknown> }
): ScoredResult & { graph?: SystemGraph } {
  switch (rubric.kind) {
    case 'design':
    case 'staged':
      return gradeDesign(input.records, rubric);
    case 'capacity':
      return gradeCapacity(input.answers ?? {}, rubric);
    case 'tradeoff':
      return gradeTradeoff(input.answers ?? {}, rubric);
    default:
      return { score: 0, passed: false, perCriterion: [] };
  }
}
