#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const routes = process.argv.slice(2).filter((arg) => arg.startsWith('/'));
const baseUrl = process.env.CONTENT_QA_BASE_URL || 'http://localhost:3100';
const expectedBlocks = Number.parseInt(
  process.env.CONTENT_QA_EXPECTED_BLOCKS || '2',
  10,
);
const requireQuiz = process.env.CONTENT_QA_REQUIRE_QUIZ !== 'false';
const outputRoot = path.resolve(
  process.env.CONTENT_QA_OUTPUT || '.artifacts/content-page-qa',
);

if (routes.length === 0) {
  console.error('Pass one or more content routes, for example /practice/url-shortener.');
  process.exit(2);
}

const profiles = [
  { name: 'desktop-light', viewport: { width: 1440, height: 900 }, theme: 'light' },
  { name: 'mobile-dark', viewport: { width: 390, height: 844 }, theme: 'dark' },
];

const routeName = (route) => route.replace(/^\/+|\/+$/g, '').replaceAll('/', '--');

async function exerciseBlock(block) {
  if (!(await block.isVisible())) return null;

  await block.scrollIntoViewIfNeeded();
  const interactiveControl = block.locator(
    'input[type="range"]:visible, select:visible, input[type="checkbox"], button:visible',
  ).first();
  try {
    await interactiveControl.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    return false;
  }
  const before = await block.innerText();
  const ranges = block.locator('input[type="range"]:visible');
  const selects = block.locator('select:visible');
  const checkboxes = block.locator('input[type="checkbox"]');
  const buttons = block.locator('button:visible');

  if ((await ranges.count()) > 0) {
    const control = ranges.first();
    const previous = await control.inputValue();
    await control.press('End');
    if ((await control.inputValue()) === previous) await control.press('Home');
  } else if ((await selects.count()) > 0) {
    const control = selects.first();
    const optionCount = await control.locator('option').count();
    if (optionCount > 1) await control.selectOption({ index: optionCount - 1 });
  } else if ((await checkboxes.count()) > 0) {
    const control = checkboxes.first();
    await control.evaluate((element) => element.click());
  } else {
    let selectedButton = null;
    for (let index = 0; index < (await buttons.count()); index += 1) {
      const candidate = buttons.nth(index);
      const label = (
        (await candidate.innerText()) ||
        (await candidate.getAttribute('aria-label')) ||
        ''
      ).toLowerCase();
      const disabled = await candidate.getAttribute('disabled');
      const pressed = await candidate.getAttribute('aria-pressed');
      const checked = await candidate.getAttribute('aria-checked');
      const selected = await candidate.getAttribute('aria-selected');
      if (
        !label.includes('reset') &&
        disabled === null &&
        pressed !== 'true' &&
        checked !== 'true' &&
        selected !== 'true'
      ) {
        selectedButton = candidate;
        break;
      }
    }
    if (selectedButton) await selectedButton.click();
  }

  await block.page().waitForTimeout(250);
  return (await block.innerText()) !== before;
}

async function verifyRoute(context, profile, route) {
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console:${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page:${error.message}`));

  const response = await page.goto(`${baseUrl}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(1_000);

  if (requireQuiz) {
    try {
      await page.locator('#quiz-section').waitFor({ state: 'attached', timeout: 30_000 });
      await page.waitForFunction(
        () => {
          const text = document.querySelector('#quiz-section')?.textContent || '';
          const normalized = text.trim().toLowerCase();
          return Boolean(normalized) && normalized !== 'loading quiz...';
        },
        undefined,
        { timeout: 30_000 },
      );
    } catch (error) {
      throw new Error(
        `Quiz readiness failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const hasAccordion =
    (await page.locator('button[id^="content-accordion-trigger-"]').count()) > 0;
  if (!hasAccordion && expectedBlocks > 0) {
    try {
      await page.waitForFunction(
        (minimum) =>
          Array.from(document.querySelectorAll('[data-content-block]')).filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden'
            );
          }).length >= minimum,
        expectedBlocks,
        { timeout: 30_000 },
      );
    } catch (error) {
      throw new Error(
        `Interaction readiness failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const discovered = new Set();
  const exercised = new Map();
  const blockScreenshots = [];
  const collectAndExercise = async () => {
    const blocks = page.locator('[data-content-block]');
    for (let index = 0; index < (await blocks.count()); index += 1) {
      const block = blocks.nth(index);
      const id = await block.getAttribute('data-content-block');
      if (!id) continue;
      discovered.add(id);
      if (exercised.has(id) || !(await block.isVisible())) continue;

      const changed = await exerciseBlock(block);
      exercised.set(id, changed === true);
      const screenshotPath = path.join(
        outputRoot,
        `${profile.name}-${routeName(route)}-${id.replaceAll('/', '--')}.png`,
      );
      await block.screenshot({ path: screenshotPath });
      blockScreenshots.push(screenshotPath);
    }
  };

  await collectAndExercise();
  const triggers = page.locator('button[id^="content-accordion-trigger-"]');
  for (let sweep = 0; sweep < 2; sweep += 1) {
    for (let index = 0; index < (await triggers.count()); index += 1) {
      const trigger = triggers.nth(index);
      if (!(await trigger.isVisible())) continue;
      await trigger.click();
      await page.waitForTimeout(1_000);
      await collectAndExercise();
    }
    if (discovered.size >= expectedBlocks) break;
  }

  const metrics = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    return {
      pageOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      quizCount: document.querySelectorAll('#quiz-section').length,
      quizText: document.querySelector('#quiz-section')?.textContent || '',
      unregistered: bodyText.includes('is not registered'),
      renderedEditorialScaffolding: /<!--[\s\S]*?-->/.test(bodyText),
      htmlDark: document.documentElement.classList.contains('dark'),
    };
  });
  const screenshotPath = path.join(
    outputRoot,
    `${profile.name}-${routeName(route)}-page.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const result = {
    route,
    profile: profile.name,
    status: response?.status() || null,
    blocks: [...discovered],
    exercised: Object.fromEntries(exercised),
    pageOverflow: metrics.pageOverflow,
    quizCount: metrics.quizCount,
    quizLoaded:
      !requireQuiz ||
      (Boolean(metrics.quizText.trim()) &&
        metrics.quizText.trim().toLowerCase() !== 'loading quiz...'),
    unregistered: metrics.unregistered,
    renderedEditorialScaffolding: metrics.renderedEditorialScaffolding,
    themeCorrect: metrics.htmlDark === (profile.theme === 'dark'),
    errors,
    screenshot: screenshotPath,
    blockScreenshots,
  };
  result.pass =
    result.status === 200 &&
    result.blocks.length >= expectedBlocks &&
    Object.keys(result.exercised).length >= expectedBlocks &&
    Object.values(result.exercised).every(Boolean) &&
    result.pageOverflow <= 1 &&
    (!requireQuiz || result.quizCount === 1) &&
    result.quizLoaded &&
    !result.unregistered &&
    !result.renderedEditorialScaffolding &&
    result.themeCorrect &&
    result.errors.length === 0;

  await page.close();
  return result;
}

await fs.mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: profile.viewport,
      colorScheme: profile.theme,
    });
    await context.addCookies([
      { name: 'theme', value: profile.theme, url: baseUrl },
    ]);
    await context.addInitScript((theme) => localStorage.setItem('theme', theme), profile.theme);

    for (const route of routes) {
      console.log(`Verifying ${profile.name} ${route}`);
      try {
        results.push(await verifyRoute(context, profile, route));
      } catch (error) {
        results.push({
          route,
          profile: profile.name,
          pass: false,
          fatalError: error instanceof Error ? error.message : String(error),
        });
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const reportPath = path.join(outputRoot, 'results.json');
await fs.writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`);

const failures = results.filter((result) => !result.pass);
console.log(
  JSON.stringify(
    {
      routes: routes.length,
      browserStates: results.length,
      passing: results.length - failures.length,
      failing: failures.length,
      report: reportPath,
      failures,
    },
    null,
    2,
  ),
);

if (failures.length > 0) process.exit(1);
