export type LearningLabKind = "request" | "capacity" | "cache";

export function capacitySummary(
  servers: number,
  perServer: number,
  traffic: number,
  failed = 0,
) {
  const surviving = Math.max(0, Math.floor(servers) - Math.floor(failed));
  const capacity = surviving * perServer;
  return {
    surviving,
    capacity,
    served: Math.min(traffic, capacity),
    waiting: Math.max(0, traffic - capacity),
  };
}

export type CacheLabState = {
  database: number;
  cache: number | null;
  reads: number;
  databaseReads: number;
  returned: number | null;
  source: "cache" | "database" | null;
};
export const initialCacheLab = (): CacheLabState => ({
  database: 1,
  cache: null,
  reads: 0,
  databaseReads: 0,
  returned: null,
  source: null,
});
export function applyCacheAction(
  state: CacheLabState,
  action: "read" | "update" | "invalidate",
): CacheLabState {
  if (action === "update")
    return {
      ...state,
      database: state.database + 1,
      returned: null,
      source: null,
    };
  if (action === "invalidate")
    return { ...state, cache: null, returned: null, source: null };
  const hit = state.cache !== null;
  return {
    ...state,
    reads: state.reads + 1,
    databaseReads: state.databaseReads + (hit ? 0 : 1),
    cache: hit ? state.cache : state.database,
    returned: hit ? state.cache : state.database,
    source: hit ? "cache" : "database",
  };
}
