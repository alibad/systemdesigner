/**
 * Gradeable-challenge core types — the contract every interactive lesson block
 * speaks. A challenge takes a learner-produced artifact (a diagram, a capacity
 * estimate, a trade-off justification) and returns a uniform {@link GradeResult}.
 *
 * This is the single source of truth that the canvas grader (lib/challenges/grade.ts),
 * the /api/grade route, the React blocks (components/challenges/*), the useChallenge
 * hook, and the gamification rewire all import. Keep it dependency-free.
 */

export type ChallengeKind = 'design' | 'capacity' | 'tradeoff' | 'staged';

/** A single rubric line item, evaluated deterministically and shown to the learner. */
export interface GradeCriterion {
  id: string;
  label: string;
  met: boolean;
  /** Relative weight within the rubric (need not sum to 1). */
  weight: number;
  /** Learner-facing explanation — why it's met, or what to add if not. */
  why: string;
  phase?: DesignPhase;
}

/**
 * The uniform result every gradeable block emits. `score` is 0..1, `passed` is
 * the only thing that grants XP / advances mastery (see lib/gamification.ts
 * trackChallengeCompletion). `feedback` is optional LLM narrative and never
 * affects the score — grading is deterministic.
 */
export interface GradeResult {
  challengeId: string;
  kind: ChallengeKind;
  score: number;
  passed: boolean;
  /** Point value of this challenge when passed (echoed so the client can request the right XP). Not secret. */
  xpWeight?: number;
  perCriterion: GradeCriterion[];
  feedback?: string;
  timeMs: number;
  attempt: number;
}

// ---------------------------------------------------------------------------
// System graph — extracted from raw tldraw store records (NOT a tldraw concept).
// The whiteboard exports `editor.store.serialize() -> { records, pageId }`, a flat
// bag of shape/binding records. lib/challenges/system-graph.ts turns that into the
// topology below so a rubric can ask "is there an edge between a service and a cache?".
// ---------------------------------------------------------------------------

/** Mirrors the 9-item whiteboard palette (app/whiteboard/page.tsx) + a fallback. */
export type NodeType =
  | 'user'
  | 'server'
  | 'database'
  | 'cache'
  | 'queue'
  | 'cdn'
  | 'balancer'
  | 'api'
  | 'monitor'
  | 'unknown';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
}

export interface GraphEdge {
  id: string;
  from: string; // GraphNode id
  to: string; // GraphNode id
}

export interface SystemGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ---------------------------------------------------------------------------
// Rubrics — server-side only. These live in lib/rubrics/<challengeId>.json and are
// read by /api/grade; their answer bands and expected topology are NEVER shipped to
// the client, so learners can't read the answer key from page source.
// ---------------------------------------------------------------------------

export type DesignPhase = 'requirements' | 'capacity' | 'high-level' | 'deep-dive';

export interface DesignRubricCriterion {
  id: string;
  label: string;
  weight: number;
  phase?: DesignPhase;
  /** ALL of these node types must be present. */
  requireNodeTypes?: NodeType[];
  /** At least ONE of these node types must be present. */
  anyNodeTypes?: NodeType[];
  /** For each pair, an edge must connect a node of type A to one of type B (either direction). */
  requireEdgeBetween?: [NodeType, NodeType][];
  /** Minimum total node count. */
  minNodes?: number;
  /** Shown when the criterion is met. */
  metWhy: string;
  /** Shown when not met — actionable guidance, never a golden answer. */
  why: string;
}

export interface CapacityBand {
  id: string;
  label: string;
  weight: number;
  /** Which answer field this band checks (e.g. 'qps', 'storageGB'). */
  field: string;
  min: number;
  max: number;
  metWhy: string;
  why: string;
}

export interface TradeoffOption {
  id: string;
  /** Whether this option is acceptable *given the stated constraint*. Multiple may be. */
  accepted: boolean;
  weight: number; // fit-to-constraint quality, 0..1
  why: string;
}

export interface Rubric {
  challengeId: string;
  kind: ChallengeKind;
  title: string;
  prompt: string;
  /** score >= passThreshold => passed. */
  passThreshold: number;
  /** XP weight when passed; final XP = round(xpWeight * score). */
  xpWeight: number;
  /** Allowed palette for design challenges (constrains the canvas). */
  palette?: NodeType[];
  criteria?: DesignRubricCriterion[];
  bands?: CapacityBand[];
  options?: TradeoffOption[];
  /** The stated constraint that decides which trade-off options are acceptable. */
  constraint?: string;
}

/** Request body for POST /api/grade. */
export interface GradeRequest {
  challengeId: string;
  kind: ChallengeKind;
  attempt: number;
  /** Raw tldraw records for a design challenge (we extract the graph server-side). */
  records?: unknown;
  /** Answers for capacity/tradeoff challenges (e.g. { qps: 58000 } or { choice: 'eventual' }). */
  answers?: Record<string, unknown>;
  /** Optional learner narration, used only for non-scoring LLM feedback. */
  narration?: string;
}
