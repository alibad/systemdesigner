import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { SkillExercisePackSchema } from "./skill-exercise-schema";
import {
  applyCacheAction,
  capacitySummary,
  initialCacheLab,
} from "./learning-lab";

describe("interactive learning models", () => {
  it("keeps the visual model parameters consistent with all authored first-unit answers", () => {
    const sources = JSON.parse(
      fs.readFileSync("content/learning/course-outline.json", "utf8"),
    ).exerciseSources;
    let variants = 0;
    for (const id of ["request-journey", "scale-a-service", "cache-a-read"]) {
      const pack = SkillExercisePackSchema.parse(
        JSON.parse(
          fs.readFileSync(
            sources[id].replace("/api/content/", "content/entries/"),
            "utf8",
          ),
        ),
      );
      for (const group of pack.groups)
        for (const exercise of group.variants) {
          variants++;
          expect(exercise.scene, exercise.id).toBeDefined();
          if (
            exercise.kind === "number" &&
            exercise.scene?.kind === "capacity"
          ) {
            const scene = exercise.scene;
            expect(exercise.answer).toBe(
              Math.ceil(scene.traffic / scene.perServer) + scene.failures,
            );
          }
          if (exercise.kind === "number" && exercise.scene?.kind === "cache") {
            expect(exercise.answer).toBe(
              (exercise.scene.traffic * (100 - exercise.scene.hitRate)) / 100,
            );
          }
        }
    }
    expect(variants).toBe(27);
  });
  it("shows unmet traffic and the capacity lost when a server fails", () => {
    expect(capacitySummary(2, 100, 250).waiting).toBe(50);
    expect(capacitySummary(3, 100, 250).waiting).toBe(0);
    expect(capacitySummary(3, 100, 250, 1).waiting).toBe(50);
    expect(capacitySummary(4, 100, 250, 1).waiting).toBe(0);
    expect(capacitySummary(1, 100, 250, 1).served).toBe(0);
  });
  it("demonstrates misses, hits, stale data and recovery without silently changing the source of truth", () => {
    const start = initialCacheLab();
    const miss = applyCacheAction(start, "read");
    const hit = applyCacheAction(miss, "read");
    expect(hit).toMatchObject({
      reads: 2,
      databaseReads: 1,
      source: "cache",
      returned: 1,
    });
    const updated = applyCacheAction(hit, "update");
    const stale = applyCacheAction(updated, "read");
    expect(stale).toMatchObject({
      database: 2,
      returned: 1,
      source: "cache",
      databaseReads: 1,
    });
    const cleared = applyCacheAction(stale, "invalidate");
    expect(cleared.database).toBe(2);
    expect(applyCacheAction(cleared, "read")).toMatchObject({
      cache: 2,
      returned: 2,
      source: "database",
      databaseReads: 2,
    });
    expect(start).toEqual(initialCacheLab());
  });
});
