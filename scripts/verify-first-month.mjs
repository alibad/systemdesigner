#!/usr/bin/env node
import fs from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { solveSkillPractice } from "./learning-browser-helpers.mjs";

const base = process.env.LEARNING_QA_BASE_URL || "http://localhost:3101";
const output = ".artifacts/first-month";
const read = async (path) => JSON.parse(await fs.readFile(path, "utf8"));
const month = await read("content/learning/first-month.json");
const sessions = await read("content/learning/sessions.json");
const bank = await read("lib/quiz-bank/all-quizzes.json");
const key = "sd:daily-learning:v2:guest";
const originals = {
  "code-capacity": "function serversNeeded(r,c){return Math.ceil(r/c);}",
  "code-routing":
    "function pickServer(s,i){return s.length?s[i%s.length]:null;}",
  "code-cache":
    "function readValue(c,d,k){return Object.hasOwn(c,k)?c[k]:Object.hasOwn(d,k)?d[k]:null;}",
};
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
const exploredLabs = new Set();
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
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
}
async function open(day, step) {
  await expect(
    page.getByText(`Study day ${day.number} of 30`, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("tabpanel")
    .getByRole("button", {
      name:
        day.stepIds.length === 1
          ? /^(Start lesson|Start coding|Resume lesson|Practice again)/
          : new RegExp(`^${step.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    })
    .first()
    .click();
  const resumed = (await saved()).sessions?.[step.id]?.value;
  if (resumed?.revision === step.revision && resumed.phase === "practice") {
    await expect(page.locator(".learning-session")).toBeVisible();
    return;
  }
  await footer("Let’s practice");
  await expect(page.getByRole("dialog")).toHaveCSS("animation-name", "none");
  if (step.lab && !exploredLabs.has(step.lab)) {
    const example = page.getByRole("region", { name: "Interactive example" });
    await expect
      .poll(() =>
        example
          .locator("img")
          .evaluateAll(
            (images) =>
              images.length > 0 &&
              images.every((image) => image.complete && image.naturalWidth > 0),
          ),
      )
      .toBe(true);
    await page.screenshot({
      path: `${output}/phone-lab-${step.lab}.png`,
      fullPage: false,
    });
    if (step.lab === "request") {
      await example.getByRole("button", { name: "Send a request" }).click();
      await expect(example.getByRole("status")).toContainText(
        "service receives",
      );
      for (let i = 0; i < 3; i++)
        await example.getByRole("button", { name: "Next hop" }).click();
      await expect(example.getByRole("status")).toContainText(
        "browser opens the destination",
      );
      await example.getByRole("button", { name: "Replay request" }).click();
      await expect(
        example.getByRole("button", { name: "Send a request" }),
      ).toBeVisible();
    } else if (step.lab === "capacity") {
      const meter = example.getByRole("meter", { name: "Traffic served" });
      await expect(meter).toHaveAttribute("aria-valuenow", "100");
      for (let i = 0; i < 2; i++)
        await example.getByRole("button", { name: "Add one server" }).click();
      await expect(meter).toHaveAttribute("aria-valuenow", "250");
      await example
        .getByRole("button", { name: "Take one server offline" })
        .click();
      await expect(meter).toHaveAttribute("aria-valuenow", "200");
      await example.getByRole("button", { name: "Add one server" }).click();
      await expect(meter).toHaveAttribute("aria-valuenow", "250");
    } else {
      await example.getByRole("button", { name: "Read the link" }).click();
      await expect(example.getByRole("status")).toContainText("Cache miss");
      await example.getByRole("button", { name: "Read the link" }).click();
      await expect(example.getByRole("status")).toContainText("Cache hit");
      await example.getByRole("button", { name: "Update destination" }).click();
      await example.getByRole("button", { name: "Read the link" }).click();
      await expect(example.getByRole("status")).toContainText(
        "version 1 is stale",
      );
      await example.getByRole("button", { name: "Clear cached copy" }).click();
      await example.getByRole("button", { name: "Read the link" }).click();
      await expect(example.getByRole("status")).toContainText(
        "version 2 came from the database",
      );
      await expect(example).toContainText("4 reads · 2 database reads");
    }
    exploredLabs.add(step.lab);
  }
  await page
    .getByRole("button", { name: "Let’s practice", exact: true })
    .click();
}
async function quiz(step) {
  const source = step.quizId
    ? bank[step.quizId]
    : await read(
        step.questionsFile.replace("/api/content/", "content/entries/"),
      );
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
  await page.goto(`${base}/learn`);
  await expect(
    page.getByRole("button", { name: "Start lesson", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `${output}/phone-welcome.png`,
    fullPage: false,
  });
  // The experienced route offers assessment, and a cancelled assessment adds no progress.
  await page
    .getByRole("button", {
      name: "Have experience? Find my starting point",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Find your starting point",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  expect(completed(await saved())).toBe(0);
  for (const day of month.days) {
    for (const [part, id] of day.stepIds.entries()) {
      const step = sessions[id];
      const before = await saved();
      const reviewed = Object.values(before.practice).some((steps) =>
        steps.includes(id),
      );
      await open(day, step);
      if (step.kind === "coding") {
        const source =
          originals[id] ||
          (await fs.readFile(
            step.starterFile
              .replace("/api/content/", "content/entries/")
              .replace(/\.js$/, ".solution.js"),
            "utf8",
          ));
        await expect(page.locator("#daily-code")).toBeVisible();
        if (id === "code-link-service") {
          await page
            .locator("#daily-code")
            .fill(source.replace("cache.delete(key);", ""));
          await page
            .getByRole("button", { name: "Run tests", exact: true })
            .click();
          await expect(
            page.getByText("Try again", { exact: true }).first(),
          ).toBeVisible();
          await expect(
            page.getByRole("button", {
              name: "All tests passed · Complete step",
              exact: true,
            }),
          ).toHaveCount(0);
          await page.locator("#daily-code").fill(source);
          await page
            .getByRole("button", { name: "Close", exact: true })
            .click();
          await page.reload();
          await open(day, step);
          await expect(page.locator("#daily-code")).toHaveValue(source);
        } else await page.locator("#daily-code").fill(source);
        await footer("Run tests");
        await page
          .getByRole("button", { name: "Run tests", exact: true })
          .click();
        await footer("All tests passed · Complete step");
        if (id === "code-link-service")
          await page.screenshot({
            path: `${output}/phone-project.png`,
            fullPage: false,
          });
        await page
          .getByRole("button", {
            name: "All tests passed · Complete step",
            exact: true,
          })
          .click();
      } else if (step.exercisesFile) {
        await solveSkillPractice(page, step, {
          review: reviewed ? 1 : 0,
          wrong: day.number === 1,
          hint: day.number === 2,
        });
      } else await quiz(step);
      await expect(
        page.getByRole("heading", { name: "One step stronger.", exact: true }),
      ).toBeVisible();
      if (day.kind === "review")
        expect(completed(await saved())).toBe(completed(before));
      await back();
      if (day.number === 9 && part === 0) {
        await page.reload();
        await expect(
          page.getByText("Study day 9 of 30", { exact: true }),
        ).toBeVisible();
        expect(
          (await saved()).journey.tasks["day-09:request-journey"],
        ).toBeDefined();
        expect(
          (await saved()).journey.tasks["day-09:cache-a-read"],
        ).toBeUndefined();
      }
    }
    await expect(
      page.getByRole("progressbar", {
        name: "First month progress",
        exact: true,
      }),
    ).toHaveAttribute("aria-valuenow", String(day.number));
    console.log(`PASS day ${day.number}: ${day.title}`);
  }
  await expect(
    page.getByRole("heading", {
      name: "Your first month is complete.",
      exact: true,
    }),
  ).toBeVisible();
  expect(completed(await saved())).toBe(26);
  const finished = await saved();
  for (const day of month.days.filter((day) => day.milestone)) {
    for (const id of day.stepIds)
      expect(
        Object.values(finished.practice).some((ids) => ids.includes(id)),
      ).toBe(true);
  }
  await page.reload();
  await expect(
    page.getByRole("progressbar", {
      name: "First month progress",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuenow", "30");
  await page.screenshot({
    path: `${output}/phone-complete.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `${output}/small-phone-dark.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: `${output}/desktop-complete.png`,
    fullPage: true,
  });
  if (process.env.LEARNING_QA_OFFLINE) {
    await page
      .getByRole("button", { name: "Learning settings", exact: true })
      .click();
    await expect(page.getByText(/Ready for offline visits/)).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Close", exact: true }).click();
    // Reopen a visited lesson offline, including its separately fetched exercise pack.
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByRole("progressbar", {
        name: "First month progress",
        exact: true,
      }),
    ).toHaveAttribute("aria-valuenow", "30");
    await page.getByText("Explore the 30-day path", { exact: true }).click();
    await page
      .getByRole("list", { name: "Thirty study days" })
      .getByRole("button", { name: /How a web request works/ })
      .click();
    await expect(
      page.getByRole("region", { name: "Interactive example" }),
    ).toBeVisible();
    expect(
      await page
        .getByRole("region", { name: "Interactive example" })
        .locator("img")
        .evaluateAll((images) =>
          images.every((image) => image.complete && image.naturalWidth > 0),
        ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Let’s practice", exact: true })
      .click();
    await solveSkillPractice(page, sessions["request-journey"], { review: 1 });
    await back();
    expect(completed(await saved())).toBe(26);
    await page.getByRole("tab", { name: "Courses", exact: true }).click();
    await page
      .getByRole("button", { name: "Choose course", exact: true })
      .click();
    await page.getByRole("menuitemradio", { name: /^Generative AI / }).click();
    await page
      .getByRole("button", { name: "Start learning", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Retry loading lesson", exact: true }),
    ).toBeVisible();
    await context.setOffline(false);
    await page
      .getByRole("button", { name: "Retry loading lesson", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Let’s practice", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    const cached = await page.evaluate(async () => {
      const cache = await caches.open("systemdesigner-learning-public-v1");
      return (await cache.keys()).map(
        (request) => new URL(request.url).pathname,
      );
    });
    for (const node of ["browser", "service", "database"])
      expect(cached).toContain(`/learning/${node}.png`);
    expect(
      cached.some(
        (path) =>
          path.includes("firestore") ||
          path.includes("auth") ||
          path.includes("/api/users"),
      ),
    ).toBe(false);
    expect(
      (
        await page.request.get(
          `${base}/api/learning/sessions/request-journey?learningRevision=outdated`,
        )
      ).status(),
    ).toBe(409);
    console.log(
      "PASS: offline reload, visited exercise execution, uncached lesson recovery, preserved progress, public-only cache, and stale-revision rejection.",
    );
  }
  expect(errors).toEqual([]);
  console.log(
    "PASS: 30-day mobile journey, mistakes and hints, 8 review tasks, 26 unique completions, partial-day restore, capstone failure/draft recovery, four milestones, and small-screen dark mode.",
  );
} catch (error) {
  console.error(error);
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  throw error;
} finally {
  await context.close();
  await browser.close();
}
