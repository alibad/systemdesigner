#!/usr/bin/env node
// Verifies the guided journey continues past the first month: a learner who has
// completed all 30 opening days lands on part two, and the first chapter of part two
// (days 31-38) completes through real grading, a coding task, a review day, and a
// checkpoint milestone. Month-one completion is seeded as data, never graded answers.
import fs from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { solveSkillPractice } from "./learning-browser-helpers.mjs";

const base = process.env.LEARNING_QA_BASE_URL || "http://localhost:3101";
const output = ".artifacts/learning-journey";
const read = async (path) => JSON.parse(await fs.readFile(path, "utf8"));
const journey = await read("content/learning/journey.json");
const sessions = await read("content/learning/sessions.json");
const bank = await read("lib/quiz-bank/all-quizzes.json");
const key = "sd:daily-learning:v2:guest";
const days = journey.parts.flatMap((part) => part.days);
const totalDays = days.length;
const firstMonth = journey.parts[0].days;
const secondPart = journey.parts[1];
const chapter = secondPart.days.slice(
  0,
  secondPart.days.findIndex((day) => day.milestone) + 1,
);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  colorScheme: "light",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const saved = () =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
const completed = (data) => new Set(Object.values(data.practice).flat()).size;
const back = () =>
  page.getByRole("button", { name: "Back to my day", exact: true }).click();
async function footer(name) {
  const action = page.getByRole("button", { name, exact: true });
  await expect(action).toBeVisible();
  const box = await action.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
}
async function open(day, step) {
  await expect(
    page.getByText(`Study day ${day.number} of ${totalDays}`, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("tabpanel")
    .getByRole("button", {
      name:
        day.stepIds.length === 1
          ? /^(Start lesson|Start coding|Resume lesson)/
          : new RegExp(`^${step.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    })
    .first()
    .click();
  await footer("Let’s practice");
  return page;
}
async function quiz(step) {
  const source = step.quizId
    ? bank[step.quizId]
    : await read(step.questionsFile.replace("/api/content/", "content/entries/"));
  const questions = source.questions || source;
  for (const [i, q] of questions.entries()) {
    await page
      .getByRole("button", {
        name: `Answer ${q.correctAnswer + 1}: ${q.options[q.correctAnswer]}`,
        exact: true,
      })
      .click();
    const label = i === questions.length - 1 ? "Finish practice" : "Next";
    await footer(label);
    await page.getByRole("button", { name: label, exact: true }).click();
  }
}
try {
  // Seed a complete first month: every practiced session plus the eight review tasks.
  const seedDay = "2026-09-01";
  const practiced = [
    ...new Set(
      firstMonth
        .filter((day) => day.kind !== "review")
        .flatMap((day) => day.stepIds),
    ),
  ];
  const tasks = Object.fromEntries(
    firstMonth
      .filter((day) => day.kind === "review")
      .flatMap((day) =>
        day.stepIds.map((id, index) => [
          `${day.id}:${id}`,
          { day: seedDay, revision: sessions[id].revision, at: 10 + index },
        ]),
      ),
  );
  await page.goto(`${base}/learn`);
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, JSON.stringify(value)),
    [
      key,
      {
        version: 5,
        practice: { [seedDay]: practiced },
        track: { value: "design", updatedAt: 1 },
        dailyGoal: { value: 1, updatedAt: 1 },
        drafts: {},
        evidence: {},
        placements: {},
        journey: { enrollment: { value: "guided", updatedAt: 1 }, tasks },
        sessions: {},
        draftHistory: {},
      },
    ],
  );
  await page.reload();
  await expect(
    page.getByText(`Study day 31 of ${totalDays}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: secondPart.title, exact: true }),
  ).toBeVisible();
  await expect(page.getByText(secondPart.description, { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(`30 of ${totalDays} study days complete`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Part 2 progress", exact: true }),
  ).toHaveAttribute("aria-valuenow", "0");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({ path: `${output}/phone-part-two-start.png` });
  // The full path lists every part; part one is complete and part two is current.
  await page.getByText("Explore the full path", { exact: true }).click();
  await expect(page.locator("summary", { hasText: /^Part 1 · / })).toContainText("30/30");
  await expect(
    page.getByRole("list", { name: "Part 2 study days" }).getByRole("button", {
      name: new RegExp(chapter[0].title),
    }),
  ).toBeEnabled();
  await expect(
    page.getByRole("list", { name: "Part 2 study days" }).getByRole("button", {
      name: new RegExp(chapter[1].title),
    }),
  ).toBeDisabled();
  await page.screenshot({ path: `${output}/phone-full-path.png`, fullPage: true });
  await page.reload();

  for (const day of chapter) {
    for (const [part, id] of day.stepIds.entries()) {
      const step = sessions[id];
      const before = await saved();
      const reviewed = Object.values(before.practice).some((ids) => ids.includes(id));
      await open(day, step);
      if (day.number === chapter[0].number) {
        // Prerequisite links and the full lesson are one disclosure away.
        await page.getByText("Go a little deeper", { exact: true }).click();
        await expect(
          page.getByRole("link", { name: "Explore the full lesson", exact: true }),
        ).toBeVisible();
        if (step.prerequisites?.length)
          for (const item of step.prerequisites)
            await expect(page.getByRole("link", { name: item.title, exact: true })).toBeVisible();
        await page.screenshot({ path: `${output}/phone-lesson-intro.png` });
      }
      await page.getByRole("button", { name: "Let’s practice", exact: true }).click();
      if (step.kind === "coding") {
        const source = await fs.readFile(
          step.starterFile
            .replace("/api/content/", "content/entries/")
            .replace(/\.js$/, ".solution.js"),
          "utf8",
        );
        await expect(page.locator("#daily-code")).toBeVisible();
        await page.locator("#daily-code").fill(source);
        await footer("Run tests");
        await page.getByRole("button", { name: "Run tests", exact: true }).click();
        await footer("All tests passed · Complete step");
        await page
          .getByRole("button", { name: "All tests passed · Complete step", exact: true })
          .click();
      } else if (step.exercisesFile) {
        await solveSkillPractice(page, step, {
          review: reviewed ? 1 : 0,
          wrong: day.number === chapter[0].number,
          hint: day.number === chapter[1].number,
        });
        if (day.number === chapter[0].number)
          await page.screenshot({ path: `${output}/phone-practice-complete.png` });
      } else await quiz(step);
      await expect(
        page.getByRole("heading", { name: "One step stronger.", exact: true }),
      ).toBeVisible();
      if (day.kind === "review") expect(completed(await saved())).toBe(completed(before));
      else expect(completed(await saved())).toBe(completed(before) + 1);
      await back();
      if (part === 0 && day.number === chapter[0].number) {
        // The trail shows the habit signal once today has practice.
        await expect(page.getByText(/1\/1 today/)).toBeVisible();
      }
    }
    await expect(
      page.getByRole("progressbar", { name: "Part 2 progress", exact: true }),
    ).toHaveAttribute("aria-valuenow", String(day.number - 30));
    console.log(`PASS day ${day.number}: ${day.title}`);
  }
  const milestone = chapter.at(-1);
  expect(milestone.milestone).toBeTruthy();
  await page.reload();
  await expect(
    page.getByText(`Study day ${milestone.number + 1} of ${totalDays}`, { exact: true }),
  ).toBeVisible();
  // The next chapter takes its heading from the milestone it leads to.
  const nextMilestone = days.find((day) => day.number > milestone.number && day.milestone);
  await expect(
    page.getByRole("heading", { name: nextMilestone.milestone, exact: true }),
  ).toBeVisible();
  expect(completed(await saved())).toBe(
    practiced.length + chapter.filter((day) => day.kind !== "review").length,
  );
  await page.screenshot({ path: `${output}/phone-chapter-complete.png` });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${output}/desktop-chapter-complete.png` });
  expect(errors).toEqual([]);
  console.log(
    `PASS: journey continues into ${secondPart.title}; chapter “${milestone.milestone}” completed with authored practice, coding, a review day, and a checkpoint.`,
  );
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
