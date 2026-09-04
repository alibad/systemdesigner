#!/usr/bin/env node
import fs from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { solveSkillPractice } from "./learning-browser-helpers.mjs";
const read = async (path) => JSON.parse(await fs.readFile(path, "utf8"));
const { courses } = await read("content/learning/catalog.json");
const sessions = await read("content/learning/sessions.json");
const base = process.env.LEARNING_QA_BASE_URL || "http://localhost:3101";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const dir = ".artifacts/learning-curriculum";
await fs.mkdir(dir, { recursive: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
// Isolated test-only prerequisite seed; every target exercise is still completed
// through learner controls, including grading, feedback, and completion.
await context.addInitScript(
  ({ courses }) => {
    if (
      window.top !== window ||
      localStorage.getItem("sd:daily-learning:v2:guest")
    )
      return;
    localStorage.setItem(
      "sd:daily-learning:v2:guest",
      JSON.stringify({
        version: 4,
        practice: {},
        drafts: {},
        evidence: {},
        track: { value: "design", updatedAt: 1 },
        dailyGoal: { value: 1, updatedAt: 1 },
        journey: { enrollment: { value: "courses", updatedAt: 1 }, tasks: {} },
        placements: Object.fromEntries(
          courses
            .flatMap((c) => c.units)
            .map((u) => [
              u.id,
              { revision: u.revision, day: "2026-09-03", at: 1 },
            ]),
        ),
      }),
    );
  },
  { courses },
);
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let total = 0;
try {
  await page.goto(`${base}/learn`);
  await page.getByRole("tab", { name: "Courses", exact: true }).click();
  for (const course of courses.filter((c) => c.id !== "coding")) {
    await page
      .getByRole("button", { name: "Choose course", exact: true })
      .click();
    await page
      .getByRole("menuitemradio", { name: new RegExp(`^${course.title}`) })
      .click();
    for (const unit of course.units) {
      const toggle = page.locator(`[aria-controls="unit-content-${unit.id}"]`);
      if ((await toggle.getAttribute("aria-expanded")) !== "true")
        await toggle.click();
      for (const meta of unit.steps.filter((s) => !s.isCheckpoint)) {
        const step = sessions[meta.id];
        await page.locator(`#step-${step.id}`).click();
        await page
          .getByRole("button", { name: "Let’s practice", exact: true })
          .click();
        await solveSkillPractice(page, step, { wrong: total % 25 === 0 });
        await expect(
          page.getByRole("heading", {
            name: "One step stronger.",
            exact: true,
          }),
        ).toBeVisible();
        if (total % 25 === 0)
          await page.screenshot({ path: `${dir}/${step.id}.png` });
        await page
          .getByRole("button", { name: "Back to my path", exact: true })
          .click();
        total++;
        if (total % 10 === 0)
          console.log(
            `Completed ${total}/202 lesson sessions through the browser.`,
          );
      }
    }
  }
  expect(total).toBe(202);
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("sd:daily-learning:v2:guest")),
  );
  expect(new Set(Object.values(data.practice).flat()).size).toBe(202);
  expect(Object.values(data.sessions).every((s) => s.value === null)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  console.log(
    "PASS all 202 lesson sessions, graded practice, completion persistence, and representative wrong-answer retries; no uncaught errors.",
  );
} catch (error) {
  await page.screenshot({ path: `${dir}/failure.png`, fullPage: true });
  await fs.writeFile(
    `${dir}/failure.txt`,
    await page.locator("body").innerText(),
  );
  throw error;
} finally {
  await browser.close();
}
