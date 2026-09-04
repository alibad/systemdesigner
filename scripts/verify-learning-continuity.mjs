#!/usr/bin/env node
import fs from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { solveSkillPractice } from "./learning-browser-helpers.mjs";
const base = process.env.LEARNING_QA_BASE_URL || "http://localhost:3101";
const dir = ".artifacts/learning-continuity";
const key = "sd:daily-learning:v2:guest";
const read = async (path) => JSON.parse(await fs.readFile(path, "utf8"));
const sessions = await read("content/learning/sessions.json");
const { courses } = await read("content/learning/catalog.json");
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
await fs.mkdir(dir, { recursive: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  colorScheme: "light",
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const saved = () =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
const click = (name) => page.getByRole("button", { name, exact: true }).click();
const packFor = (step) =>
  read(step.exercisesFile.replace("/api/content/", "content/entries/"));
async function reopen(id) {
  await page.reload();
  if (id === "request-journey") await click("Resume lesson");
  else {
    await page.getByRole("tab", { name: "Courses", exact: true }).click();
    const step = sessions[id],
      unit = courses.flatMap((c) => c.units).find((u) => u.id === step.unitId);
    const toggle = page.locator(`[aria-controls="unit-content-${unit.id}"]`);
    if ((await toggle.getAttribute("aria-expanded")) !== "true")
      await toggle.click();
    await page.locator(`#step-${id}`).click();
  }
}
async function seed(data) {
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key, data },
  );
  await page.reload();
}
try {
  await page.goto(`${base}/learn`);
  await click("Start lesson");
  await click("Let’s practice");
  const first = sessions["request-journey"],
    pack = await packFor(first),
    exercise = pack.groups[0].variants[0];
  await click(exercise.items.find((i) => i.id === exercise.answer[0]).text);
  await click("Need a hint?");
  await page.keyboard.press("Escape");
  await reopen(first.id);
  await expect(
    page.getByRole("button", { name: "Remove action 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(exercise.hint, { exact: true })).toBeVisible();
  for (const id of exercise.answer.slice(1))
    await click(exercise.items.find((i) => i.id === id).text);
  await click("Check sequence");
  await page.keyboard.press("Escape");
  await reopen(first.id);
  await expect(
    page.getByRole("heading", { name: "That works.", exact: true }),
  ).toBeVisible();
  await click("Next exercise");
  const second = pack.groups[1].variants[0];
  for (const id of second.answer)
    await click(second.items.find((i) => i.id === id).text);
  await click("Check sequence");
  await click("Next exercise");
  const choice = pack.groups[2].variants[0],
    wrong = (choice.correctAnswer + 1) % choice.options.length;
  await click(`Answer ${wrong + 1}: ${choice.options[wrong]}`);
  await page.keyboard.press("Escape");
  await reopen(first.id);
  await expect(
    page.getByRole("button", {
      name: `Answer ${wrong + 1}: ${choice.options[wrong]}`,
      exact: true,
    }),
  ).toBeDisabled();
  await page.screenshot({ path: `${dir}/resumed-feedback.png` });
  await click("Try this exercise again");
  await click(
    `Answer ${choice.correctAnswer + 1}: ${choice.options[choice.correctAnswer]}`,
  );
  await click("Complete practice");
  await expect(
    page.getByRole("heading", { name: "+20 path XP", exact: true }),
  ).toBeVisible();
  expect((await saved()).sessions[first.id].value).toBeNull();
  expect(Object.values((await saved()).practice).flat()).toEqual([first.id]);
  console.log(
    "PASS partial sequence, hints, feedback, completed groups and choice retry survive reload; one completion.",
  );
  await click("Back to my day");
  // Seed prerequisite coverage, not assessment answers, to reach a later matching
  // session through the same course UI without repeating earlier test coverage.
  const data = await saved();
  data.journey.enrollment = { value: "courses", updatedAt: Date.now() };
  data.placements = Object.fromEntries(
    courses
      .flatMap((c) => c.units)
      .map((u) => [
        u.id,
        { revision: u.revision, day: "2026-09-03", at: Date.now() },
      ]),
  );
  data.track = { value: "design", updatedAt: Date.now() };
  await seed(data);
  const matching = Object.values(sessions).find(
    (s) =>
      s.kind === "quiz" &&
      !s.isCheckpoint &&
      s.exercisesFile?.endsWith("daily-practice.generated.json"),
  );
  await reopen(matching.id);
  await click("Let’s practice");
  const mp = await packFor(matching),
    m = mp.groups[0].variants[0];
  expect(m.kind).toBe("match");
  await expect(page.getByRole("button", { name: m.pairs[0].detail, exact: true })).toBeVisible();
  await page.screenshot({ path: `${dir}/matching-ready-mobile.png` });
  await click(m.pairs[0].detail);
  await page.keyboard.press("Escape");
  await reopen(matching.id);
  await page.getByText("Your matches (1)", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Change match 1", exact: true }),
  ).toBeVisible();
  for (const pair of m.pairs.slice(1)) await click(pair.detail);
  await click("Check matches");
  await page.screenshot({ path: `${dir}/matching-mobile.png` });
  await click("Next exercise");
  for (const g of mp.groups.slice(1)) {
    const e = g.variants[0];
    await click(`Answer ${e.correctAnswer + 1}: ${e.options[e.correctAnswer]}`);
    await click(g === mp.groups.at(-1) ? "Complete practice" : "Next exercise");
  }
  await expect(
    page.getByRole("heading", { name: "One step stronger.", exact: true }),
  ).toBeVisible();
  await click("Back to my path");
  console.log(
    "PASS matching task and its partial input, real feedback and source decisions.",
  );
  // Raw mixed checkpoints retain their cursor and locked answers as well.
  const cp = sessions["checkpoint-design-first-system"];
  await reopen(cp.id);
  await click("Let’s practice");
  const quiz = await read(
    cp.questionsFile.replace("/api/content/", "content/entries/"),
  );
  const q = quiz.questions[0];
  await click(`Answer ${q.correctAnswer + 1}: ${q.options[q.correctAnswer]}`);
  await click("Next");
  await page.keyboard.press("Escape");
  await reopen(cp.id);
  await expect(
    page.getByRole("heading", {
      name: quiz.questions[1].question,
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  console.log("PASS mixed checkpoint restores its next question.");
  // Recover a displaced coding draft through the visible history control.
  const code = sessions["code-capacity"];
  const before = await saved();
  before.track = { value: "coding", updatedAt: Date.now() };
  await seed(before);
  await reopen(code.id);
  await click("Let’s practice");
  const editor = page.getByRole("textbox", { name: /JavaScript/ });
  await editor.fill("function serversNeeded(r,c){return 11;}");
  await editor.fill("function serversNeeded(r,c){return 22;}");
  await page.getByText("Recent code versions", { exact: true }).click();
  await click("Restore this version");
  await expect(editor).toHaveValue("function serversNeeded(r,c){return 11;}");
  await page.keyboard.press("Escape");
  await reopen(code.id);
  await expect(editor).toHaveValue("function serversNeeded(r,c){return 11;}");
  console.log("PASS displaced coding draft restores and survives reload.");
  expect(errors).toEqual([]);
  console.log("Continuity walkthrough passed with no uncaught page errors.");
} catch (error) {
  console.error(error);
  await page.screenshot({ path: `${dir}/failure.png`, fullPage: true });
  await fs.writeFile(
    `${dir}/failure.txt`,
    await page.locator("body").innerText(),
  );
  throw error;
} finally {
  await context.close();
  await browser.close();
}
