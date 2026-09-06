import { describe, expect, it } from "vitest";
import {
  FIRST_MONTH,
  JOURNEY,
  JOURNEY_DAYS,
  currentJourneyDay,
  journeyDayDone,
  journeyPartFor,
  mergeJourney,
} from "./learning-journey";
import {
  applyDailyProgress,
  dailyProgress,
  emptyDailyLearning,
  exportDailyLearning,
  importDailyLearning,
  parseDailyLearning,
  recordJourneyTask,
  recordUnitPlacement,
} from "./daily-learning-data";
import {
  ALL_STEPS,
  LEARNING_TRACKS,
  completePathStep,
  localDay,
  stepIsUnlocked,
} from "./learning-path";

describe("guided learning journey", () => {
  it("covers every noncoding and coding session exactly once, in course order, across all parts", () => {
    const practiced = JOURNEY_DAYS.filter((day) => day.kind !== "review").flatMap(
      (day) => day.stepIds,
    );
    expect(new Set(practiced).size).toBe(practiced.length);
    const expected = LEARNING_TRACKS.flatMap((course) =>
      course.steps.map((step) => step.id),
    );
    expect([...practiced].sort()).toEqual([...expected].sort());
    for (const day of JOURNEY_DAYS.filter((day) => day.kind === "review"))
      for (const id of day.stepIds)
        expect(
          JOURNEY_DAYS.find(
            (earlier) => earlier.number < day.number && earlier.stepIds.includes(id),
          ),
          `${day.id} reviews ${id}`,
        ).toBeDefined();
    expect(JOURNEY.parts).toHaveLength(15);
    expect(FIRST_MONTH.days).toHaveLength(30);
    for (const part of JOURNEY.parts) {
      expect(part.days.at(-1)?.milestone).toBeTruthy();
      if (part.id !== "build-what-you-learned")
        expect(part.days.filter((day) => day.kind === "review").length).toBeGreaterThanOrEqual(2);
      for (const day of part.days) expect(journeyPartFor(day).id).toBe(part.id);
    }
    expect(JOURNEY_DAYS.map((day) => day.number)).toEqual(
      JOURNEY_DAYS.map((_, index) => index + 1),
    );
  });
  it("finishes all study days through real prerequisite gates, with explicit reviews and project builds", () => {
    let data = emptyDailyLearning();
    let reviewTasks = 0;
    for (const day of JOURNEY_DAYS) {
      if (day.number === 31) {
        expect(Object.keys(dailyProgress(data).completed)).toHaveLength(26);
        expect(reviewTasks).toBe(8);
      }
      expect(currentJourneyDay(dailyProgress(data), data.journey)?.id).toBe(
        day.id,
      );
      for (const id of day.stepIds) {
        expect(
          stepIsUnlocked(dailyProgress(data), id),
          `${day.id}: ${id}`,
        ).toBe(true);
        const count = Object.keys(dailyProgress(data).completed).length;
        data = applyDailyProgress(data, (progress) =>
          completePathStep(progress, id),
        );
        if (day.kind === "review") {
          expect(journeyDayDone(dailyProgress(data), data.journey, day)).toBe(
            false,
          );
          expect(Object.keys(dailyProgress(data).completed)).toHaveLength(
            count,
          );
          reviewTasks++;
        }
        data = recordJourneyTask(data, day.id, id);
        data = importDailyLearning(exportDailyLearning(data));
      }
      expect(journeyDayDone(dailyProgress(data), data.journey, day)).toBe(true);
    }
    expect(reviewTasks).toBe(106);
    expect(
      currentJourneyDay(dailyProgress(data), data.journey),
    ).toBeUndefined();
    expect(Object.keys(dailyProgress(data).completed)).toHaveLength(272);
    expect(FIRST_MONTH.days.at(-1)?.stepIds).toEqual(["code-link-service"]);
    for (const day of JOURNEY_DAYS.filter((day) => day.kind === "project"))
      expect(ALL_STEPS.find((step) => step.id === day.stepIds[0])?.kind).toBe(
        "coding",
      );
    // The walk now covers all 317 study days with an export/import round trip per
    // step, so it needs more than the default per-test budget.
  }, 60000);
  it("rejects jumping ahead, unknown tasks, and uncompleted practice", () => {
    const data = emptyDailyLearning();
    expect(() => recordJourneyTask(data, "day-01", "request-journey")).toThrow(
      "Finish this practice",
    );
    expect(() => recordJourneyTask(data, "day-09", "request-journey")).toThrow(
      "earlier study days",
    );
    expect(() => recordJourneyTask(data, "day-01", "code-capacity")).toThrow();
    expect(() =>
      recordJourneyTask(data, "day-99", "request-journey"),
    ).toThrow();
  });
  it("placement covers familiar lessons but never supplies recall-day completion", () => {
    let data = emptyDailyLearning();
    for (const course of LEARNING_TRACKS.filter((course) =>
      ["design", "coding"].includes(course.id),
    )) {
      for (const unit of course.units.slice(0, 3))
        data = recordUnitPlacement(
          data,
          unit.id,
          unit.placementStepIds,
          unit.revision,
        );
    }
    expect(currentJourneyDay(dailyProgress(data), data.journey)?.number).toBe(
      9,
    );
    expect(data.practice).toEqual({});
    expect(data.journey.tasks).toEqual({});
  });
  it("merges partial review days from two devices and prefers current content evidence", () => {
    const day = FIRST_MONTH.days[8],
      [first, second] = day.stepIds;
    const task = (
      id: string,
      revision = ALL_STEPS.find((step) => step.id === id)!.revision,
    ) => ({ day: localDay(), revision, at: 3 });
    const a = {
      ...emptyDailyLearning().journey,
      tasks: { [`${day.id}:${first}`]: task(first) },
    };
    const b = {
      ...emptyDailyLearning().journey,
      enrollment: { value: "guided" as const, updatedAt: 4 },
      tasks: { [`${day.id}:${second}`]: task(second) },
    };
    const merged = mergeJourney(a, b);
    expect(mergeJourney(b, a)).toEqual(merged);
    expect(mergeJourney(merged, a)).toEqual(merged);
    expect(
      journeyDayDone(dailyProgress(emptyDailyLearning()), merged, day),
    ).toBe(true);
    const stale = {
      ...a,
      tasks: { [`${day.id}:${first}`]: { ...task(first, "old"), at: 999 } },
    };
    expect(mergeJourney(merged, stale)).toEqual(merged);
    expect(
      journeyDayDone(dailyProgress(emptyDailyLearning()), stale, day),
    ).toBe(false);
  });
  it("migrates v3 progress without losing placement, drafts, or existing practice", () => {
    const { journey: _, sessions: _s, draftHistory: _h, ...legacy } = emptyDailyLearning();
    const input = {
      ...legacy,
      version: 3,
      practice: { "2026-09-01": ["request-journey"] },
      drafts: { "code-capacity": { value: "return 3;", updatedAt: 1 } },
    };
    const migrated = parseDailyLearning(input);
    expect(migrated.version).toBe(5);
    expect(migrated.practice).toEqual(input.practice);
    expect(migrated.drafts).toEqual(input.drafts);
    expect(migrated.journey).toEqual(emptyDailyLearning().journey);
    expect(() =>
      parseDailyLearning({
        ...migrated,
        journey: {
          ...migrated.journey,
          tasks: {
            "day-99:unknown": { day: "2026-02-30", revision: "x", at: 1 },
          },
        },
      }),
    ).toThrow();
  });
});
