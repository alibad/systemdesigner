#!/usr/bin/env node
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const baseUrl = process.env.LEARNING_QA_BASE_URL || 'http://localhost:3100';
const output = '.artifacts/daily-learning';
const storageKey = 'sd:daily-learning:v1';
const bank = JSON.parse(await fs.readFile('lib/quiz-bank/all-quizzes.json', 'utf8'));
const design = JSON.parse(await fs.readFile('content/entries/fundamentals/what-is-system-design/data/daily-design-path.json', 'utf8'));
const coding = JSON.parse(await fs.readFile('content/entries/fundamentals/scalability-basics/data/daily-coding-path.json', 'utf8'));
const solutions = [
  'function serversNeeded(requestsPerSecond, capacityPerServer) { return Math.ceil(requestsPerSecond / capacityPerServer); }',
  'function pickServer(servers, requestIndex) { return servers.length ? servers[requestIndex % servers.length] : null; }',
  'function readValue(cache, database, key) { if (Object.hasOwn(cache, key)) return cache[key]; if (Object.hasOwn(database, key)) return database[key]; return null; }',
];
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
await context.addInitScript(() => { if (window.top === window) localStorage.setItem('theme', 'light'); });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const progress = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), storageKey);
async function openStep(step) {
  await page.locator(`#step-${step.id}`).click();
  await expect(page.getByRole('heading', { name: step.concept, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Let’s practice', exact: true }).click();
}
async function quiz(step, wrong = false) {
  for (const [index, question] of bank[step.quizId].questions.entries()) {
    const answer = wrong && index === 0 ? (question.correctAnswer + 1) % question.options.length : question.correctAnswer;
    const button = page.getByRole('button', { name: `Answer ${answer + 1}: ${question.options[answer]}`, exact: true });
    await button.click();
    await expect(button).toBeDisabled();
    const next = page.getByRole('button', { name: index === bank[step.quizId].questions.length - 1 ? 'Finish practice' : 'Next', exact: true });
    await next.focus();
    await next.press('Enter');
  }
}
try {
  await page.goto(`${baseUrl}/learn`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Build your daily learning habit.');
  await expect(page.locator('#step-scale-a-service')).toBeDisabled();
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.getByRole('link', { name: 'Product roadmap →', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Product roadmap');
  await expect(page.getByRole('heading', { name: 'Next: make progress portable', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue development', exact: true }).first()).toHaveAttribute('href', /\/docs\/CONTINUE_DEVELOPMENT\.md$/);
  await page.getByRole('link', { name: 'Back to learning', exact: true }).click();
  let failQuizLoad = true;
  await page.route('**/api/quiz-bank/daily-request-journey', async route => {
    if (failQuizLoad) { await route.fulfill({ status: 503, body: 'Temporarily unavailable' }); }
    else await route.continue();
  });
  await openStep(design[0]);
  await expect(page.getByRole('button', { name: 'Retry loading quiz' })).toBeVisible();
  failQuizLoad = false;
  await page.getByRole('button', { name: 'Retry loading quiz' }).click();
  await quiz(design[0], true);
  await expect(page.getByRole('heading', { name: 'You’re learning. Keep going.' })).toBeVisible();
  expect((await progress())?.completed || {}).toEqual({});
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await quiz(design[0]);
  await expect(page.getByRole('heading', { name: '+20 path XP' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to my path' }).click();
  expect(Object.keys((await progress()).completed)).toEqual(['request-journey']);
  await expect(page.locator('#step-scale-a-service')).toBeEnabled();
  await expect(page.getByText('Goal complete!', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('#step-request-journey')).toHaveAttribute('aria-label', 'Review: Follow a request');
  await openStep(design[0]);
  await quiz(design[0]);
  await expect(page.getByRole('heading', { name: 'Review complete!' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to my path' }).click();
  expect(Object.keys((await progress()).completed)).toHaveLength(1);
  for (const step of design.slice(1)) {
    await openStep(step); await quiz(step);
    await page.getByRole('button', { name: 'Back to my path' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Starter unit complete!' })).toBeVisible();
  await page.getByRole('button', { name: 'Coding Build with JavaScript', exact: true }).click();
  await openStep(coding[0]);
  await expect(page.locator('#daily-code')).toContainText('function serversNeeded');
  await page.getByRole('button', { name: 'Run tests', exact: true }).click();
  await expect(page.getByText('Expected 3; got 0', { exact: true })).toBeVisible();
  await page.locator('#daily-code').fill('function serversNeeded() { while (true) {} }');
  await page.getByRole('button', { name: 'Run tests', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('took too long');
  await page.locator('#daily-code').fill('function serversNeeded() { return typeof localStorage; }');
  await page.getByRole('button', { name: 'Run tests', exact: true }).click();
  await expect(page.getByText('Expected 3; got "undefined"', { exact: true })).toBeVisible();
  await page.locator('#daily-code').fill(solutions[0]);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await openStep(coding[0]);
  await expect(page.locator('#daily-code')).toHaveValue(solutions[0]);
  for (const [index, step] of coding.entries()) {
    if (index > 0) await openStep(step);
    await page.locator('#daily-code').fill(solutions[index]);
    await page.getByRole('button', { name: 'Run tests', exact: true }).click();
    await expect(page.getByRole('button', { name: 'All tests passed · Complete step' })).toBeVisible();
    if (index === 2) await page.screenshot({ path: `${output}/coding.png`, fullPage: true });
    await page.getByRole('button', { name: 'All tests passed · Complete step' }).click();
    await page.getByRole('button', { name: 'Back to my path' }).click();
  }
  expect(Object.keys((await progress()).completed)).toHaveLength(6);
  // Make a mastered step due and verify the review queue opens the correct track.
  await page.evaluate(key => {
    const data = JSON.parse(localStorage.getItem(key));
    data.completed['request-journey'].reviewOn = '2000-01-01';
    data.completed['request-journey'].lastPracticedOn = '2000-01-01';
    localStorage.setItem(key, JSON.stringify(data));
  }, storageKey);
  await page.reload();
  await page.getByRole('button', { name: 'Follow a request', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s practice', exact: true }).click();
  await quiz(design[0]);
  await page.getByRole('button', { name: 'Back to my path' }).click();
  await expect(page.getByText('1 due', { exact: true })).toHaveCount(0);
  await expect(page.locator('#step-request-journey')).toBeFocused();
  await page.getByRole('combobox', { name: 'Make it manageable' }).selectOption('3');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Make it manageable' })).toHaveValue('3');
  // Narrow viewport and keyboard/modal checks.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.classList.add('dark'); window.scrollTo(0, 0); });
  await page.waitForTimeout(350);
  const tracks = page.getByRole('group', { name: 'Learning track' }).getByRole('button');
  expect((await tracks.nth(0).boundingBox()).y).toBe((await tracks.nth(1).boundingBox()).y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${output}/mobile-dark.png`, fullPage: true });
  await openStep(design[0]);
  expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: `${output}/mobile-quiz.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(`${baseUrl}/roadmap`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Product roadmap');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${output}/roadmap-mobile.png`, fullPage: true });
  await page.goto(baseUrl);
  await expect(page.getByRole('link', { name: 'Start your daily learning path' })).toBeVisible();
  // Storage quota failure must preserve in-memory progression during this visit.
  const blocked = await context.newPage();
  await blocked.addInitScript(key => {
    localStorage.removeItem(key);
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name, value) {
      if (name === key) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return write.call(this, name, value);
    };
  }, storageKey);
  await blocked.goto(`${baseUrl}/learn`);
  await blocked.getByRole('combobox', { name: 'Make it manageable' }).selectOption('2');
  await blocked.getByRole('button', { name: 'Coding Build with JavaScript', exact: true }).click();
  await expect(blocked.getByRole('combobox', { name: 'Make it manageable' })).toHaveValue('2');
  await expect(blocked.getByText('Browser storage is unavailable.', { exact: false })).toBeVisible();
  await blocked.close();
  expect(errors).toEqual([]);
  console.log('PASS: both tracks, failure/retry, all six completions, no duplicate XP, due reviews, coding timeout/isolation, draft/progress persistence, goal changes, storage failure, keyboard controls, desktop/mobile, homepage entry, and roadmap navigation.');
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  throw error;
} finally {
  await browser.close();
}
