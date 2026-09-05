#!/usr/bin/env node
// Walks the LATER variants of every authored practice group in a real browser.
//
// The curriculum sweep only ever sees variant one, because it completes each
// lesson from scratch. A learner meets variants two and three on their second
// and third review, so those exercises ship unrendered and ungraded unless this
// runs. Prior completions are seeded as data; every target exercise is still
// answered through learner controls with real grading.
//
//   LEARNING_QA_VARIANT=1  second variant (one prior completion)
//   LEARNING_QA_VARIANT=2  third variant  (two prior completions)
//   LEARNING_QA_VARIANT_LIMIT=n  stop after n lessons (smoke run)
//   LEARNING_QA_VARIANT_ONLY=id  walk a single lesson (debugging one failure)
import fs from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { solveSkillPractice } from "./learning-browser-helpers.mjs";

const read = async (path) => JSON.parse(await fs.readFile(path, "utf8"));
const { courses } = await read("content/learning/catalog.json");
const sessions = await read("content/learning/sessions.json");
const base = process.env.LEARNING_QA_BASE_URL || "http://localhost:3101";
const review = Number(process.env.LEARNING_QA_VARIANT || 1);
const limit = Number(process.env.LEARNING_QA_VARIANT_LIMIT || 0);
const only = process.env.LEARNING_QA_VARIANT_ONLY;
if (!Number.isInteger(review) || review < 1)
  throw new Error("LEARNING_QA_VARIANT must be a positive integer");

const lessons = courses
  .filter((course) => course.id !== "coding")
  .flatMap((course) =>
    course.units.flatMap((unit) =>
      unit.steps.filter((step) => !step.isCheckpoint).map((step) => step.id),
    ),
  );
const targets = only ? lessons.filter((id) => id === only) : limit ? lessons.slice(0, limit) : lessons;
// `sessionReview` is `completed[step].reviews + 1`, and `reviews` counts prior
// practice days beyond the first, so N seeded days open the lesson at review N.
const seedDays = Object.fromEntries(
  Array.from({ length: review }, (_, index) => [
    `2026-08-${String(index + 1).padStart(2, "0")}`,
    lessons,
  ]),
);

const dir = ".artifacts/practice-variants";
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(
  ({ courses, seedDays }) => {
    if (window.top !== window || localStorage.getItem("sd:daily-learning:v2:guest")) return;
    localStorage.setItem(
      "sd:daily-learning:v2:guest",
      JSON.stringify({
        version: 4,
        practice: seedDays,
        drafts: {},
        evidence: {},
        track: { value: "design", updatedAt: 1 },
        dailyGoal: { value: 1, updatedAt: 1 },
        journey: { enrollment: { value: "courses", updatedAt: 1 }, tasks: {} },
        placements: Object.fromEntries(
          courses
            .flatMap((course) => course.units)
            .map((unit) => [unit.id, { revision: unit.revision, day: "2026-09-03", at: 1 }]),
        ),
      }),
    );
  },
  { courses, seedDays },
);
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let total = 0;
let checkedVariants = 0;

// Once a course is fully complete the course page renders a completion panel and
// can re-collapse its unit accordions, so re-assert the accordion and the opened
// session before each step instead of assuming the page is unchanged.
async function expandUnit(unitId) {
  const toggle = page.locator(`[aria-controls="unit-content-${unitId}"]`);
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

// Opening a lesson can fail once the course page is in its completion state, and
// a half-opened session leaves a modal that swallows later clicks. Recover by
// reloading to a known page rather than retrying against the broken DOM.
async function openCourses() {
  await page.goto(`${base}/learn`);
  await page.getByRole("tab", { name: "Courses", exact: true }).click();
}

async function selectCourse(course) {
  await page.getByRole("button", { name: "Choose course", exact: true }).click();
  await page
    .getByRole("menuitemradio", { name: new RegExp(`^${course.title}`) })
    .click();
}

async function openStep(course, unitId, stepId, firstTitle) {
  const practice = page.getByRole("button", { name: "Let’s practice", exact: true });
  const heading = page.getByRole("heading", { name: firstTitle, exact: true });
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await openCourses();
      await selectCourse(course);
    }
    await expandUnit(unitId);
    // The step button is disabled until progress has loaded, so a click placed
    // during hydration is silently dropped.
    const trigger = page.locator(`#step-${stepId}`);
    await expect(trigger).toBeEnabled({ timeout: 15000 });
    await trigger.click();
    // isVisible() does not wait, so use waitFor to give the view time to render.
    const shown = (locator) =>
      locator.waitFor({ state: "visible", timeout: 15000 }).then(
        () => true,
        () => false,
      );
    if (!(await shown(practice))) continue;
    await practice.click();
    if (await shown(heading)) return;
  }
  throw new Error(`Could not open practice for ${stepId}`);
}

try {
  await page.goto(`${base}/learn`);
  await page.getByRole("tab", { name: "Courses", exact: true }).click();
  for (const course of courses.filter((c) => c.id !== "coding")) {
    if (!course.units.some((u) => u.steps.some((s) => targets.includes(s.id)))) continue;
    await page.getByRole("button", { name: "Choose course", exact: true }).click();
    await page
      .getByRole("menuitemradio", { name: new RegExp(`^${course.title}`) })
      .click();
    for (const unit of course.units) {
      if (!unit.steps.some((s) => targets.includes(s.id))) continue;
      for (const meta of unit.steps.filter((s) => !s.isCheckpoint)) {
        if (!targets.includes(meta.id)) continue;
        const step = sessions[meta.id];
        const pack = await read(
          step.exercisesFile.replace("/api/content/", "content/entries/"),
        );
        const first = pack.groups[0].variants[review % pack.groups[0].variants.length];
        await openStep(course, unit.id, step.id, first.title);
        await solveSkillPractice(page, step, { review });
        await expect(
          page.getByRole("heading", { name: "One step stronger.", exact: true }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Back to my path", exact: true }).click();
        total++;
        checkedVariants += pack.groups.length;
        if (total % 10 === 0)
          console.log(`Completed ${total}/${targets.length} lessons at review ${review}.`);
      }
    }
  }
  expect(total).toBe(targets.length);
  expect(errors).toEqual([]);
  console.log(
    `PASS ${total} lessons graded at review ${review}; ${checkedVariants} variant-${review + 1} exercises rendered and answered through the UI.`,
  );
} catch (error) {
  await page.screenshot({ path: `${dir}/failure-review-${review}.png`, fullPage: true });
  await fs.writeFile(`${dir}/failure-review-${review}.txt`, await page.locator("body").innerText());
  throw error;
} finally {
  await browser.close();
}
