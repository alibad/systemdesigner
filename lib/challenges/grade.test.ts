/**
 * Golden tests for the deterministic graders — the load-bearing piece every challenge
 * rides on. These exercise the real tldraw-records → graph extractor + rubric scoring
 * with no browser and no server, so they run in milliseconds in CI. One test per
 * challenge type, plus coverage of both tldraw arrow-binding formats.
 */
import { describe, it, expect } from 'vitest';
import { gradeDesign, gradeTradeoff, gradeCapacity } from '@/lib/challenges/grade';
import { extractSystemGraph, classifyLabel } from '@/lib/challenges/system-graph';
import { getRubric, listRubricIds } from '@/lib/rubrics';
import urlShortener from '@/lib/rubrics/url-shortener.json';
import likeCounter from '@/lib/rubrics/consistency-like-counter.json';
import type { Rubric } from '@/lib/challenges/types';

const designRubric = urlShortener as unknown as Rubric;
const tradeoffRubric = likeCounter as unknown as Rubric;

// ---- helpers to build synthetic tldraw store records --------------------------------

function geo(id: string, text: string) {
  return { id, typeName: 'shape', type: 'geo', props: { text } };
}

/** Standalone-binding format (tldraw v2): arrow shape + two binding records. */
function arrowBindings(arrowId: string, fromId: string, toId: string) {
  return [
    { id: arrowId, typeName: 'shape', type: 'arrow', props: {} },
    { id: `${arrowId}:s`, typeName: 'binding', type: 'arrow', fromId: arrowId, toId: fromId, props: { terminal: 'start' } },
    { id: `${arrowId}:e`, typeName: 'binding', type: 'arrow', fromId: arrowId, toId: toId, props: { terminal: 'end' } },
  ];
}

/** Inline-binding format: endpoints embedded in the arrow's own props. */
function arrowInline(arrowId: string, fromId: string, toId: string) {
  return {
    id: arrowId,
    typeName: 'shape',
    type: 'arrow',
    props: { start: { boundShapeId: fromId }, end: { boundShapeId: toId } },
  };
}

const N = { user: 'shape:user', lb: 'shape:lb', svc: 'shape:svc', cache: 'shape:cache', db: 'shape:db' };

describe('classifyLabel', () => {
  it('maps palette labels (with emoji) to node types', () => {
    expect(classifyLabel('👤 User/Client')).toBe('user');
    expect(classifyLabel('⚖️ Load Balancer')).toBe('balancer'); // not "server"
    expect(classifyLabel('🗄️ Database')).toBe('database');
    expect(classifyLabel('⚡ Cache')).toBe('cache');
    expect(classifyLabel('🖥️ Server')).toBe('server');
    expect(classifyLabel('something random')).toBe('unknown');
  });
});

describe('extractSystemGraph', () => {
  it('reconstructs nodes and edges from standalone bindings', () => {
    const records = [
      geo(N.user, '👤 User/Client'),
      geo(N.svc, '🖥️ Server'),
      ...arrowBindings('shape:a1', N.user, N.svc),
    ];
    const graph = extractSystemGraph(records);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ from: N.user, to: N.svc });
  });

  it('reconstructs edges from the inline-binding format too', () => {
    const records = [geo(N.svc, '🖥️ Server'), geo(N.db, '🗄️ Database'), arrowInline('shape:a2', N.svc, N.db)];
    const graph = extractSystemGraph(records);
    expect(graph.edges).toHaveLength(1);
  });

  it('accepts both array and {records} shapes', () => {
    const arr = [geo(N.user, '👤 User')];
    expect(extractSystemGraph(arr).nodes).toHaveLength(1);
    expect(extractSystemGraph({ records: arr }).nodes).toHaveLength(1);
  });
});

describe('gradeDesign (url-shortener)', () => {
  it('passes a complete read path (client → LB → service → cache + DB)', () => {
    const records = [
      geo(N.user, '👤 User/Client'),
      geo(N.lb, '⚖️ Load Balancer'),
      geo(N.svc, '🖥️ Server'),
      geo(N.cache, '⚡ Cache'),
      geo(N.db, '🗄️ Database'),
      ...arrowBindings('shape:a1', N.user, N.lb),
      ...arrowBindings('shape:a2', N.lb, N.svc),
      ...arrowBindings('shape:a3', N.svc, N.cache),
      ...arrowBindings('shape:a4', N.svc, N.db),
    ];
    const res = gradeDesign(records, designRubric);
    expect(res.passed).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(0.6);
    // The cache-wired and db-wired criteria depend on edges, not just presence:
    expect(res.perCriterion.find((c) => c.id === 'cache-wired')?.met).toBe(true);
    expect(res.perCriterion.find((c) => c.id === 'db-wired')?.met).toBe(true);
  });

  it('fails a bare diagram with a single component', () => {
    const res = gradeDesign([geo(N.user, '👤 User/Client')], designRubric);
    expect(res.passed).toBe(false);
    expect(res.score).toBeLessThan(0.6);
  });

  it('does not credit a cache that is present but unwired', () => {
    const records = [
      geo(N.user, '👤 User/Client'),
      geo(N.svc, '🖥️ Server'),
      geo(N.cache, '⚡ Cache'),
      geo(N.db, '🗄️ Database'),
      // service connects to DB but NOT to the cache
      ...arrowBindings('shape:a1', N.svc, N.db),
    ];
    const res = gradeDesign(records, designRubric);
    expect(res.perCriterion.find((c) => c.id === 'cache-wired')?.met).toBe(false);
    expect(res.perCriterion.find((c) => c.id === 'db-wired')?.met).toBe(true);
  });
});

describe('gradeTradeoff (consistency-like-counter)', () => {
  it('accepts the staleness-tolerant choice', () => {
    const res = gradeTradeoff({ choice: 'eventual' }, tradeoffRubric);
    expect(res.passed).toBe(true);
    expect(res.score).toBe(1);
  });

  it('rejects strong consistency for a staleness-tolerant counter', () => {
    const res = gradeTradeoff({ choice: 'strong' }, tradeoffRubric);
    expect(res.passed).toBe(false);
    expect(res.score).toBe(0);
  });

  it('gives partial credit to a defensible-but-heavier option', () => {
    const res = gradeTradeoff({ choice: 'causal' }, tradeoffRubric);
    expect(res.score).toBeCloseTo(0.6, 5);
  });
});

describe('gradeCapacity', () => {
  const capacityRubric: Rubric = {
    challengeId: 'test-capacity',
    kind: 'capacity',
    title: 'BoE',
    prompt: 'estimate',
    passThreshold: 0.6,
    xpWeight: 15,
    bands: [
      { id: 'qps', label: 'Peak QPS', weight: 1, field: 'qps', min: 250000, max: 350000, metWhy: 'ok', why: 'off' },
      { id: 'storage', label: 'Daily storage GB', weight: 1, field: 'storageGB', min: 40, max: 60, metWhy: 'ok', why: 'off' },
    ],
  };

  it('passes figures inside the acceptable bands', () => {
    const res = gradeCapacity({ qps: 300000, storageGB: 50 }, capacityRubric);
    expect(res.passed).toBe(true);
    expect(res.score).toBe(1);
  });

  it('fails figures outside the bands', () => {
    const res = gradeCapacity({ qps: 10, storageGB: 5 }, capacityRubric);
    expect(res.passed).toBe(false);
  });
});

describe('every registered design rubric is satisfiable', () => {
  // A "kitchen-sink" diagram: all 9 component types plus every common wiring. This must
  // pass every design rubric — if one fails, that rubric demands something no canvas can
  // produce (a typo'd node type, an impossible edge pair, an unreachable minNodes).
  const LABELS: Record<string, string> = {
    user: '👤 User/Client',
    balancer: '⚖️ Load Balancer',
    api: '🔌 API Gateway',
    server: '🖥️ Server',
    cache: '⚡ Cache',
    database: '🗄️ Database',
    queue: '📮 Message Queue',
    cdn: '🌐 CDN',
    monitor: '📊 Monitoring',
  };
  const nodeRecords = Object.entries(LABELS).map(([k, label]) => geo(`shape:${k}`, label));
  const PAIRS: [string, string][] = [
    ['user', 'balancer'], ['user', 'api'], ['user', 'server'], ['user', 'cdn'],
    ['server', 'cache'], ['server', 'database'], ['server', 'queue'], ['server', 'cdn'],
    ['api', 'cache'], ['api', 'database'], ['api', 'queue'], ['api', 'cdn'],
    ['balancer', 'cache'], ['cache', 'database'],
  ];
  const edgeRecords = PAIRS.flatMap(([a, b], i) => arrowBindings(`shape:e${i}`, `shape:${a}`, `shape:${b}`));
  const maximal = [...nodeRecords, ...edgeRecords];

  const designIds = listRubricIds().filter((id) => getRubric(id)?.kind === 'design');

  it('covers more than just the seed rubric', () => {
    expect(designIds.length).toBeGreaterThanOrEqual(8);
  });

  for (const id of designIds) {
    it(`${id}: a complete design passes (score 1.0)`, () => {
      const res = gradeDesign(maximal, getRubric(id)!);
      expect(res.passed).toBe(true);
      expect(res.score).toBe(1);
    });
  }
});

describe('every registered tradeoff rubric grades correctly', () => {
  const tradeoffIds = listRubricIds().filter((id) => getRubric(id)?.kind === 'tradeoff');

  it('covers the ML/GenAI practice problems', () => {
    expect(tradeoffIds.length).toBeGreaterThanOrEqual(20);
  });

  for (const id of tradeoffIds) {
    it(`${id}: an accepted option passes and a rejected option fails`, () => {
      const rubric = getRubric(id)!;
      const opts = rubric.options ?? [];
      // structural invariants the content validator also enforces
      expect(opts.some((o) => o.accepted)).toBe(true);
      const best = opts.find((o) => o.accepted && o.weight >= rubric.passThreshold);
      const rejected = opts.find((o) => !o.accepted);
      expect(best, `${id} needs an accepted option at/above passThreshold`).toBeTruthy();
      expect(rejected, `${id} needs at least one rejected option`).toBeTruthy();
      expect(gradeTradeoff({ choice: best!.id }, rubric).passed).toBe(true);
      expect(gradeTradeoff({ choice: rejected!.id }, rubric).passed).toBe(false);
    });
  }
});

describe('rag-token-budget capacity rubric', () => {
  it('passes an in-band estimate and fails a wild one', () => {
    const r = getRubric('rag-token-budget')!;
    expect(gradeCapacity({ tokensPerQuery: 3600, costPer1k: 18 }, r).passed).toBe(true);
    expect(gradeCapacity({ tokensPerQuery: 50, costPer1k: 1 }, r).passed).toBe(false);
  });
});
