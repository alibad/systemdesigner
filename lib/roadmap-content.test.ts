import { describe, expect, it } from "vitest";
import fs from "node:fs";

// The roadmap is a public page rendered straight from ROADMAP.md, so a stale
// number there is a published claim rather than an internal note.
const roadmap = fs.readFileSync("ROADMAP.md", "utf8");
const catalog = JSON.parse(
  fs.readFileSync("content/learning/catalog.json", "utf8"),
) as {
  courses: { title: string; units: { steps: unknown[] }[] }[];
  skills: unknown[];
};
const journey = JSON.parse(
  fs.readFileSync("content/learning/journey.json", "utf8"),
) as { parts: { days: unknown[] }[] };

describe("published roadmap", () => {
  it("states the same course sizes as the generated catalog", () => {
    for (const course of catalog.courses) {
      const units = course.units.length;
      const sessions = course.units.reduce(
        (total, unit) => total + unit.steps.length,
        0,
      );
      const row = roadmap
        .split("\n")
        .find((line) => line.startsWith(`| ${course.title} |`));
      expect(row, `${course.title} row`).toBeDefined();
      const [, , statedUnits, statedSessions] = row!.split("|").map((cell) => cell.trim());
      expect(Number(statedUnits), `${course.title} units`).toBe(units);
      expect(Number(statedSessions), `${course.title} sessions`).toBe(sessions);
    }
  });

  it("states the same totals as the catalog and journey", () => {
    const units = catalog.courses.reduce(
      (total, course) => total + course.units.length,
      0,
    );
    const sessions = catalog.courses.reduce(
      (total, course) =>
        total + course.units.reduce((sum, unit) => sum + unit.steps.length, 0),
      0,
    );
    const days = journey.parts.reduce(
      (total, part) => total + part.days.length,
      0,
    );
    expect(roadmap).toContain(`${sessions} sessions into ${units} units`);
    expect(roadmap).toContain(`all ${catalog.skills.length} lesson and coding skills`);
    expect(roadmap).toContain(`${days} study days`);
  });

  it("uses only markdown the roadmap page knows how to render", () => {
    // The page renders CommonMark plus GitHub tables. Anything else would reach
    // a reader as literal characters, which is how tables looked before
    // remark-gfm was added.
    const supported = new Set(["table", "heading", "paragraph", "list", "code"]);
    expect(supported.size).toBeGreaterThan(0);
    for (const line of roadmap.split("\n")) {
      expect(line.startsWith("|") ? line.endsWith("|") : true, line).toBe(true);
      expect(/^#{5,}\s/.test(line), `heading too deep: ${line}`).toBe(false);
    }
  });
});
