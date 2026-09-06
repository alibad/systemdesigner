#!/usr/bin/env node
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { solveSkillPractice } from './learning-browser-helpers.mjs';

const baseUrl = process.env.LEARNING_QA_BASE_URL || 'http://localhost:3100';
const output = '.artifacts/daily-learning';
const storageKey = 'sd:daily-learning:v2:guest';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const bank = await read('lib/quiz-bank/all-quizzes.json');
const sessions = await read('content/learning/sessions.json');
const { courses } = await read('content/learning/catalog.json');
// Derived so adding coding exercises does not require editing this suite.
const codingStepCount = courses.find(course => course.id === 'coding').units.flatMap(unit => unit.steps).length;
const originals = {
  'code-capacity': 'function serversNeeded(r, c) { return Math.ceil(r / c); }',
  'code-routing': 'function pickServer(s, i) { return s.length ? s[i % s.length] : null; }',
  'code-cache': 'function readValue(c, d, k) { return Object.hasOwn(c,k) ? c[k] : Object.hasOwn(d,k) ? d[k] : null; }',
};
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
async function learningContext(options = {}) {
  const context = await browser.newContext(options);
  // These suites exercise network failure handling independently of offline caching.
  // Guard the top frame: opaque coding sandboxes cannot access serviceWorker.
  await context.addInitScript(() => {
    if (window.top === window) {
      try { navigator.serviceWorker.register = () => Promise.reject(new Error('Offline cache disabled for this network-failure test')); } catch {}
    }
  });
  return context;
}

const context = await learningContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
await context.addInitScript(() => { if (window.top === window) localStorage.setItem('theme', 'light'); });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const completed = (target = page) => target.evaluate(key => [...new Set(Object.values(JSON.parse(localStorage.getItem(key) || '{"practice":{}}').practice).flat())], storageKey);
async function chooseCourse(id, target = page) {
  await target.getByRole('tab', {name:'Courses', exact:true}).click();
  await target.getByRole('button', { name: 'Choose course', exact: true }).click();
  await target.getByRole('menuitemradio', { name: new RegExp(`^${courses.find(course => course.id === id).title} `) }).click();
}
async function chooseGoal(goal, target = page) {
  await target.getByRole('tab', {name:'Courses', exact:true}).click();
  await target.getByRole('button', { name: 'Change daily goal', exact: true }).click();
  await target.getByRole('menuitemradio', { name: new RegExp(`^${goal} session`) }).click();
}
async function openStep(step, target = page) {
  await target.getByRole('tab', {name:'Courses', exact:true}).click();
  const unit = courses.flatMap(course => course.units).find(unit => unit.steps.some(item => item.id === step.id));
  const toggle = target.locator(`[aria-controls="unit-content-${unit.id}"]`);
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await target.locator(`#step-${step.id}`).click();
  const resumed = await target.evaluate(({key,id,revision})=>{const value=JSON.parse(localStorage.getItem(key))?.sessions?.[id]?.value;return value?.revision===revision&&value.phase==='practice';},{key:storageKey,id:step.id,revision:step.revision});
  if(resumed) { await expect(target.locator('.learning-session')).toBeVisible(); return; }
  await expect(target.getByRole('heading', { name: step.concept, exact: true })).toBeVisible();
  await target.getByRole('button', { name: 'Let’s practice', exact: true }).click();
}
async function quiz(step, { wrong = false, review = 0, target = page } = {}) {
  if(step.exercisesFile) return solveSkillPractice(target,step,{wrong,review});
  const data = step.quizId ? bank[step.quizId] : await read(step.questionsFile.replace('/api/content/', 'content/entries/'));
  let questions = data.questions || data;
  if (step.questionCount && questions.length > step.questionCount) {
    const source = questions;
    questions = Array.from({ length: step.questionCount }, (_, i) => source[(review * step.questionCount + i) % source.length]);
  }
  for (const [index, question] of questions.entries()) {
    const answer = wrong && index === 0 ? (question.correctAnswer + 1) % question.options.length : question.correctAnswer;
    const button = target.getByRole('button', { name: `Answer ${answer + 1}: ${question.options[answer]}`, exact: true });
    await button.click();
    await expect(button).toBeDisabled();
    const next = target.getByRole('button', { name: index === questions.length - 1 ? 'Finish practice' : 'Next', exact: true });
    await next.focus(); await next.press('Enter');
  }
}
async function back(target = page) { await target.getByRole('button', { name: 'Back to my path', exact: true }).click(); }
async function settings(target = page) { await target.getByRole('button', { name: 'Learning settings', exact: true }).click(); }
async function closeSettings(target = page) { await target.getByRole('dialog', { name: 'Learning settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click(); }
try {
  await page.goto(`${baseUrl}/learn`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Build your first system');
  await page.getByRole('tab',{name:'Courses',exact:true}).click();
  await expect(page.getByRole('button', { name: 'Choose course' })).toBeEnabled();
  await expect(page.locator('select')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export backup' })).toHaveCount(0);
  await expect(page.getByText('Keep it fresh', { exact: true })).toHaveCount(0);
  await expect(page.locator('#step-scale-a-service')).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'System design units' }).locator(':scope > li')).toHaveCount(12);
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  // Both selectors are keyboard-operable popup menus, with focus restored on Escape.
  const courseButton = page.getByRole('button', { name: 'Choose course' });
  await courseButton.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitemradio')).toHaveCount(4);
  await page.screenshot({ path: `${output}/course-menu.png`, fullPage: false, animations: 'disabled' });
  await page.keyboard.press('Escape'); await expect(courseButton).toBeFocused();
  const goalButton = page.getByRole('button', { name: 'Change daily goal' });
  await goalButton.click(); await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await expect(goalButton).toContainText('3 sessions a day');
  await page.getByRole('tab', { name: 'Courses', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Practice', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  // Session details are fetched on demand and recover from failures.
  let sessionFailed = true;
  await page.route('**/api/learning/sessions/request-journey*', route => sessionFailed ? route.fulfill({ status: 503 }) : route.continue());
  await page.getByRole('button', { name: 'Start learning', exact: true }).click();
  await page.getByRole('button', { name: 'Retry loading lesson' }).waitFor();
  sessionFailed = false;
  await page.getByRole('button', { name: 'Retry loading lesson' }).click();
  await page.getByRole('heading', { name: sessions['request-journey'].concept, exact: true }).waitFor();
  let practiceFailed = true;
  await page.route(`**${sessions['request-journey'].exercisesFile}*`, route => practiceFailed ? route.fulfill({ status: 503 }) : route.continue());
  await page.getByRole('button', { name: 'Let’s practice', exact: true }).click();
  await page.getByRole('button', { name: 'Retry loading practice' }).waitFor();
  practiceFailed = false; await page.getByRole('button', { name: 'Retry loading practice' }).click();
  await quiz(sessions['request-journey'], { wrong: true });
  await expect(page.getByRole('heading', { name: '+20 path XP' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Continue learning', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s practice', exact: true }).click();
  await quiz(sessions['scale-a-service']); await back();
  await openStep(sessions['cache-a-read']); await quiz(sessions['cache-a-read']); await back();
  const design = courses.find(course => course.id === 'design');
  const checkpoint = sessions[design.units[0].steps.at(-1).id];
  await expect(page.getByRole('button', { name: 'Continue learning', exact: true })).toBeVisible();
  await openStep(checkpoint); await quiz(checkpoint); await back();
  await page.locator(`[aria-controls="unit-content-${design.units[1].id}"]`).click();
  await expect(page.locator(`#step-${design.units[1].steps[0].id}`)).toBeEnabled();
  await page.reload(); await page.getByRole('tab', {name:'Courses', exact:true}).click();
  await expect(goalButton).toContainText('3 sessions a day');
  await openStep(sessions['request-journey']); await quiz(sessions['request-journey'], { review: 1 });
  await expect(page.getByRole('heading', { name: 'Review complete!' })).toBeVisible(); await back();
  expect(await completed()).toHaveLength(4);
  // Every coding session executes its reference solution in the real isolated worker.
  await chooseCourse('coding');
  const coding = courses.find(course => course.id === 'coding').units.flatMap(unit => unit.steps);
  await openStep(sessions[coding[0].id]);
  await page.getByRole('button', { name: 'Run tests', exact: true }).click();
  await expect(page.getByText('Expected 3; got 0', { exact: true })).toBeVisible();
  await page.locator('#daily-code').fill('function serversNeeded() { while (true) {} }');
  await page.getByRole('button', { name: 'Run tests', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('took too long');
  await page.locator('#daily-code').fill('function serversNeeded() { return typeof localStorage; }');
  await page.getByRole('button', { name: 'Run tests', exact: true }).click();
  await expect(page.getByText('Expected 3; got "undefined"', { exact: true })).toBeVisible();
  await page.locator('#daily-code').fill(originals['code-capacity']);
  await page.getByRole('button', { name: 'Close', exact: true }).click(); await page.reload(); await page.getByRole('tab', {name:'Courses', exact:true}).click();
  await openStep(sessions[coding[0].id]);
  await expect(page.locator('#daily-code')).toHaveValue(originals['code-capacity']);
  for (const [index, metadata] of coding.entries()) {
    const step = sessions[metadata.id];
    if (index) await openStep(step);
    if (step.id === 'code-fixed-window') {
      await page.locator('#daily-code').fill('function fixedWindow(state, window, limit) { if(state.window !== window) { state.window=window; state.count=0; } const allowed=state.count<limit; if(allowed) state.count++; return {state,allowed}; }');
      await page.getByRole('button', { name: 'Run tests', exact: true }).click();
      await expect(page.getByText('Input arguments were changed.', { exact: false }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'All tests passed · Complete step' })).toHaveCount(0);
    }
    const solution = originals[step.id] || await fs.readFile(step.starterFile.replace('/api/content/', 'content/entries/').replace(/\.js$/, '.solution.js'), 'utf8');
    await page.locator('#daily-code').fill(solution);
    await page.getByRole('button', { name: 'Run tests', exact: true }).click();
    await expect(page.getByRole('button', { name: 'All tests passed · Complete step' })).toBeVisible();
    if (step.id === 'code-admit-batch') await page.screenshot({ path: `${output}/coding-project.png`, fullPage: true });
    await page.getByRole('button', { name: 'All tests passed · Complete step' }).click(); await back();
  }
  await expect(page.getByRole('heading', { name: 'You completed Coding.' })).toBeVisible();
  console.log(`PASS: design unit and checkpoint, all ${codingStepCount} coding sessions, timeout/isolation, immutable inputs, drafts, unlocks, and course completion.`);
  for (const id of ['genai', 'ml']) {
    await chooseCourse(id);
    const course = courses.find(course => course.id === id);
    await expect(page.getByRole('list', { name: `${course.title} units` }).locator(':scope > li')).toHaveCount(course.units.length);
    const step = sessions[course.units[0].steps[0].id];
    await openStep(step); await quiz(step); await back();
    await page.screenshot({ path: `${output}/${id}-course.png`, fullPage: false });
  }
  // Delayed reviews rotate source questions and do not add completion XP.
  const reviewed = courses.find(course => course.id === 'genai').units[0].steps[0].id;
  await page.evaluate(({ key, id }) => {
    const data = JSON.parse(localStorage.getItem(key));
    for (const day of Object.keys(data.practice)) data.practice[day] = data.practice[day].filter(step => step !== id);
    data.practice['2000-01-01'] = [id]; for (const name of Object.keys(data.evidence)) { if (data.evidence[name].skillId === `skill-${id}`) delete data.evidence[name]; } localStorage.setItem(key, JSON.stringify(data));
  }, { key: storageKey, id: reviewed });
  await page.reload(); await page.getByRole('tab', {name:'Courses', exact:true}).click(); await page.getByRole('tab', { name: /^Practice/ }).click();
  await page.getByRole('button', { name: new RegExp(`^${sessions[reviewed].title}`) }).click();
  await page.getByRole('button', { name: 'Let’s practice', exact: true }).click();
  await quiz(sessions[reviewed], { review: 1 }); await back();
  await expect(page.getByText('You’re up to date.', { exact: true })).toBeVisible();
  expect(await completed()).toHaveLength(codingStepCount + 6);
  await chooseCourse('design');
  // Backups are available inside settings and restore a fresh browser only after confirmation.
  await settings();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloadPromise; const backupPath = `${output}/progress-backup.json`;
  await download.saveAs(backupPath); const backup = await fs.readFile(backupPath); await closeSettings();
  const freshContext = await learningContext({}); const fresh = await freshContext.newPage();
  fresh.on('pageerror', error => errors.push(error.message)); await fresh.goto(`${baseUrl}/learn`);
  await settings(fresh);
  const upload = () => fresh.getByLabel('Progress backup file').setInputFiles({ name: 'progress.json', mimeType: 'application/json', buffer: backup });
  await upload(); await expect(fresh.getByRole('dialog')).toContainText(`${codingStepCount + 6} completed steps`);
  await fresh.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await completed(fresh)).toHaveLength(0);
  await upload(); await fresh.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await closeSettings(fresh); await fresh.reload(); await fresh.getByRole('tab', {name:'Courses', exact:true}).click();
  expect(await completed(fresh)).toHaveLength(codingStepCount + 6);
  await expect(fresh.getByRole('button', { name: 'Change daily goal' })).toContainText('3 sessions a day');
  await settings(fresh); await upload();
  await expect(fresh.getByRole('dialog')).toContainText('Adds 0 new completed steps (0 path XP)');
  await fresh.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await fresh.getByLabel('Progress backup file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await expect(fresh.getByRole('region', { name: 'Save and restore progress' }).getByRole('alert')).toContainText('Nothing was imported');
  await closeSettings(fresh); await chooseCourse('coding', fresh);
  await openStep(sessions['code-capacity'], fresh); await expect(fresh.locator('#daily-code')).toHaveValue(originals['code-capacity']);
  await fresh.getByRole('button', { name: 'Close', exact: true }).click();
  await freshContext.setOffline(true); await chooseGoal(2, fresh); await freshContext.setOffline(false); await fresh.reload(); await fresh.getByRole('tab', {name:'Courses', exact:true}).click();
  await expect(fresh.getByRole('button', { name: 'Change daily goal' })).toContainText('2 sessions a day');
  await freshContext.close();
  // Narrow screens, dark mode, menus, keyboard dismissal, and failure persistence.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.classList.add('dark'); window.scrollTo(0, 0); });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${output}/mobile-dark.png`, fullPage: true });
  await courseButton.click();
  const bounds = await page.getByRole('menu').boundingBox(); expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: `${output}/mobile-course-menu.png`, fullPage: false, animations: 'disabled' });
  await page.keyboard.press('Escape'); await goalButton.click();
  const goalBounds = await page.getByRole('menu').boundingBox(); expect(goalBounds.x).toBeGreaterThanOrEqual(0); expect(goalBounds.x + goalBounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: `${output}/mobile-goal-menu.png`, fullPage: false, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await openStep(sessions['request-journey']);
  expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.getByRole('heading', { name: 'Trace the request', exact: true })).toBeVisible();
  await page.screenshot({ path: `${output}/mobile-quiz.png`, fullPage: false });
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(`${baseUrl}/roadmap`); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Product roadmap');
  await page.goto(baseUrl); await expect(page.getByRole('link', { name: 'Start your daily learning path' })).toBeVisible();
  const blocked = await context.newPage();
  await blocked.addInitScript(key => {
    localStorage.removeItem(key); const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name, value) { if (name === key) throw new DOMException('Quota exceeded', 'QuotaExceededError'); return write.call(this, name, value); };
  }, storageKey);
  await blocked.goto(`${baseUrl}/learn`); await chooseGoal(2, blocked); await chooseCourse('coding', blocked);
  await expect(blocked.getByRole('button', { name: 'Change daily goal' })).toContainText('2 sessions a day');
  await expect(blocked.getByRole('alert').filter({ hasText: 'Browser storage is unavailable' })).toBeVisible(); await blocked.close();
  expect((await page.request.get(`${baseUrl}/api/learning/sessions/nonexistent`)).status()).toBe(404);
  expect(errors).toEqual([]);
  console.log('PASS: all four courses, on-demand session/quiz retries, checkpoint gating, review rotation, menus, keyboard navigation, mobile dark mode, backup preview/restore, offline saves, storage failure, homepage and roadmap.');
} catch (error) {
  console.error(error);
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }); throw error;
} finally { await context.close(); await browser.close(); }
// All assertions, artifact writes, and browser shutdown are awaited above.
// End this standalone CLI even if an automation-library handle remains open.
process.exit(0);
