import { describe, expect, it } from "vitest";
import fs from "node:fs";
import vm from "node:vm";
const sessions: Record<string, unknown> = JSON.parse(
  fs.readFileSync("content/learning/sessions.json", "utf8"),
);

import { PracticeStepSchema } from "./learning-path";
import { codeValuesEqual } from "./coding-runner";
import { selectSessionQuestions } from "./learning-quiz";

const originalSolutions: Record<string, string> = {
  "code-capacity": "function serversNeeded(r, c) { return Math.ceil(r / c); }",
  "code-routing":
    "function pickServer(s, i) { return s.length ? s[i % s.length] : null; }",
  "code-cache":
    "function readValue(c, d, k) { return Object.hasOwn(c,k) ? c[k] : Object.hasOwn(d,k) ? d[k] : null; }",
};

describe("coding exercise contracts", () => {
  for (const raw of Object.values(sessions)) {
    const step = PracticeStepSchema.parse(raw);
    if (step.kind !== "coding") continue;
    it(`${step.id}: reference solution passes every fixture without changing inputs`, () => {
      const source =
        originalSolutions[step.id] ||
        fs.readFileSync(
          step.starterFile
            .replace("/api/content/", "content/entries/")
            .replace(/\.js$/, ".solution.js"),
          "utf8",
        );
      for (const test of step.tests) {
        const calls = test.calls || [
          { fn: step.functionName, args: test.args! },
        ];
        const context = vm.createContext({
          calls: calls.map((call) => ({
            fn: call.fn,
            args: structuredClone(call.args),
          })),
        });
        const returned = vm.runInContext(
          `${source}\nconst api = { ${(step.exports || [step.functionName]).join(", ")} };\ncalls.map((call) => api[call.fn](...call.args));`,
          context,
          { timeout: 500 },
        );
        const actual = test.calls ? returned : returned[0];
        expect(codeValuesEqual(actual, test.expected), test.label).toBe(true);
        expect(
          codeValuesEqual(
            context.calls.map((call: { args: unknown[] }) => call.args),
            calls.map((call) => call.args),
          ),
          `${test.label}: input mutation`,
        ).toBe(true);
      }
    });
  }
  it("compares object contents independently of key order while preserving types and array order", () => {
    expect(
      codeValuesEqual(
        { state: { count: 1, window: 2 }, allowed: true },
        { allowed: true, state: { window: 2, count: 1 } },
      ),
    ).toBe(true);
    expect(codeValuesEqual([2, 1], [1, 2])).toBe(false);
    expect(codeValuesEqual("1", 1)).toBe(false);
    expect(codeValuesEqual(NaN, null)).toBe(false);
    expect(codeValuesEqual({}, [])).toBe(false);
    expect(codeValuesEqual(new Array(2), [])).toBe(false);
    expect(codeValuesEqual({ x: undefined }, {})).toBe(false);
    expect(codeValuesEqual(JSON.parse('{"__proto__":1}'), {})).toBe(false);
  });
});

describe("session assessment selection", () => {
  it("limits short sessions and rotates delayed reviews through the full source assessment", () => {
    const questions = [0, 1, 2, 3, 4, 5, 6];
    expect(selectSessionQuestions(questions, 4)).toEqual([0, 1, 2, 3]);
    expect(selectSessionQuestions(questions, 4, 4)).toEqual([4, 5, 6, 0]);
    expect(selectSessionQuestions(questions, 4, 8)).toEqual([1, 2, 3, 4]);
    expect(selectSessionQuestions(questions, 8)).toEqual(questions);
    expect(selectSessionQuestions(questions)).toEqual(questions);
    expect(selectSessionQuestions([], 4)).toEqual([]);
    expect(questions).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
