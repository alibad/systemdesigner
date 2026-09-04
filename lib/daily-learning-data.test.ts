import { describe, expect, it } from "vitest";
import {
  applyDailyProgress,
  dailyProgress,
  emptyDailyLearning,
  exportDailyLearning,
  importDailyLearning,
  mergeDailyLearning,
  migrateDailyLearning,
  parseDailyLearning,
} from "./daily-learning-data";
import {
  completePathStep,
  emptyPathProgress,
  pathStreak,
} from "./learning-path";

const complete = (
  data = emptyDailyLearning(),
  id = "request-journey",
  day = "2026-09-02",
) => applyDailyProgress(data, (p) => completePathStep(p, id, day));

describe("portable learning data", () => {
  it("migrates legacy completions, days, review scheduling, preferences and empty drafts", () => {
    let legacy = completePathStep(
      emptyPathProgress(),
      "request-journey",
      "2026-08-31",
    );
    legacy = completePathStep(legacy, "request-journey", "2026-09-01");
    legacy = completePathStep(legacy, "request-journey", "2026-09-02");
    legacy.track = "coding";
    legacy.dailyGoal = 3;
    const migrated = migrateDailyLearning(JSON.stringify(legacy), {
      "code-capacity": "",
    });
    expect(dailyProgress(migrated)).toEqual(legacy);
    expect(migrated.drafts["code-capacity"].value).toBe("");
  });

  it("merges offline practice without duplicate rewards and converges in any order", () => {
    const a = complete(complete(), "request-journey", "2026-09-03");
    const b = complete(complete(), "request-journey", "2026-09-04");
    const merged = mergeDailyLearning(a, b);
    expect(mergeDailyLearning(b, a)).toEqual(merged);
    expect(mergeDailyLearning(merged, a)).toEqual(merged);
    expect(mergeDailyLearning(merged, merged)).toEqual(merged);
    expect(Object.keys(dailyProgress(merged).completed)).toHaveLength(1);
    expect(dailyProgress(merged).completed["request-journey"]).toEqual({
      completedOn: "2026-09-02",
      lastPracticedOn: "2026-09-04",
      reviews: 2,
      reviewOn: "2026-09-11",
    });
    expect(pathStreak(dailyProgress(merged), "2026-09-05")).toBe(3);
  });

  it("merges different fields independently and resolves simultaneous draft edits deterministically", () => {
    const a = {
      ...complete(),
      dailyGoal: { value: 3 as const, updatedAt: 9 },
      drafts: { "code-capacity": { value: "return 1", updatedAt: 10 } },
    };
    const b = {
      ...complete(),
      track: { value: "coding" as const, updatedAt: 11 },
      drafts: { "code-capacity": { value: "return 2", updatedAt: 10 } },
    };
    const merged = mergeDailyLearning(a, b);
    expect(merged.dailyGoal.value).toBe(3);
    expect(merged.track.value).toBe("coding");
    expect(mergeDailyLearning(b, a)).toEqual(merged);
    const changed = applyDailyProgress(merged, (p) => ({
      ...p,
      track: "design",
    }));
    expect(mergeDailyLearning(b, changed).track.value).toBe("design");
  });

  it("exports only learning data and restores it idempotently", () => {
    const data = complete();
    expect(importDailyLearning(exportDailyLearning(data))).toEqual(data);
    expect(
      mergeDailyLearning(data, importDailyLearning(exportDailyLearning(data))),
    ).toEqual(data);
    expect(Object.keys(JSON.parse(exportDailyLearning(data)))).toEqual([
      "format",
      "version",
      "exportedAt",
      "data",
    ]);
  });

  it("round-trips the expanded courses, their practice, and later coding drafts", () => {
    const data = {
      ...emptyDailyLearning(),
      track: { value: "genai" as const, updatedAt: 20 },
      practice: { "2026-09-02": ["code-worker-plan", "lesson-llm-intro"] },
      drafts: { "code-worker-plan": { value: "function planWorkers() {}", updatedAt: 21 } },
    };
    expect(importDailyLearning(exportDailyLearning(data))).toEqual(data);
    expect(dailyProgress(data).track).toBe("genai");
    expect(Object.keys(dailyProgress(data).completed)).toHaveLength(2);
    const changed = applyDailyProgress(data, progress => ({ ...progress, track: "ml" }));
    expect(dailyProgress(mergeDailyLearning(data, changed)).track).toBe("ml");
  });

  it("rejects malformed, oversized, unknown, impossible-date and future-schema imports", () => {
    for (const raw of [
      "{broken",
      "{}",
      " ".repeat(750_001),
      exportDailyLearning(complete()).replace('"version":5', '"version":99'),
    ])
      expect(() => importDailyLearning(raw)).toThrow();
    for (const extra of [
      { practice: { "2026-02-30": ["request-journey"] } },
      { practice: { "2026-09-02": ["unknown-step"] } },
      { drafts: { "request-journey": { value: "bad", updatedAt: 1 } } },
      {
        drafts: {
          "code-capacity": { value: "x".repeat(20_001), updatedAt: 1 },
        },
      },
      { auth: "unrelated account data" },
    ])
      expect(() =>
        parseDailyLearning({ ...emptyDailyLearning(), ...extra }),
      ).toThrow();
  });
});
