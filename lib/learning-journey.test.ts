import { describe, expect, it } from "vitest";
import {
  FIRST_MONTH,
  currentJourneyDay,
  journeyDayDone,
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

describe("first-month learning journey", () => {
  it("finishes all 30 days through real prerequisite gates, with explicit reviews and a final build", () => {
    let data = emptyDailyLearning();
    let reviewTasks = 0;
    for (const day of FIRST_MONTH.days) {
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
    expect(reviewTasks).toBe(8);
    expect(
      currentJourneyDay(dailyProgress(data), data.journey),
    ).toBeUndefined();
    expect(Object.keys(dailyProgress(data).completed)).toHaveLength(26);
    expect(FIRST_MONTH.days.at(-1)?.stepIds).toEqual(["code-link-service"]);
  });
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
