#!/usr/bin/env node
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { solveSkillPractice } from './learning-browser-helpers.mjs';
const base=process.env.LEARNING_QA_BASE_URL || 'http://localhost:3100';
const output='.artifacts/adaptive-learning';
const key='sd:daily-learning:v2:guest';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const {courses,skills}=await read('content/learning/catalog.json');
const sessions=await read('content/learning/sessions.json');
const bank=await read('lib/quiz-bank/all-quizzes.json');
const originals={
  'code-capacity':'function serversNeeded(r,c){return Math.ceil(r/c);}',
  'code-routing':'function pickServer(s,i){return s.length?s[i%s.length]:null;}',
  'code-cache':'function readValue(c,d,k){return Object.hasOwn(c,k)?c[k]:Object.hasOwn(d,k)?d[k]:null;}',
};
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({...process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}});
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

const context=await learningContext({viewport:{width:1440,height:1000}});
const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const saved=(target=page)=>target.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const close=()=>page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
async function course(id,target=page){await target.getByRole('tab',{name:'Courses',exact:true}).click();await target.getByRole('button',{name:'Choose course'}).click();await target.getByRole('menuitemradio',{name:new RegExp(`^${courses.find(c=>c.id===id).title} `)}).click();}
async function startPlacement(target=page){await target.getByRole('tab',{name:'Courses',exact:true}).click();await target.getByRole('button',{name:'Take placement test',exact:true}).click();await target.getByRole('button',{name:'Start placement',exact:true}).click();}
async function quiz(step,wrong=false){
 const source=step.quizId?bank[step.quizId]:await read(step.questionsFile.replace('/api/content/','content/entries/'));
 const questions=source.questions||source;
 for(const [i,q] of questions.entries()){
  const n=wrong&&i===0?(q.correctAnswer+1)%q.options.length:q.correctAnswer;
  await page.getByRole('button',{name:`Answer ${n+1}: ${q.options[n]}`,exact:true}).click();
  // Placement preserves selection but withholds correctness and explanations.
  await expect(page.getByText('Explanation:',{exact:false})).toHaveCount(0);
  await page.getByRole('button',{name:i===questions.length-1?'Finish practice':'Next',exact:true}).click();
 }
}
try{
 await page.goto(`${base}/learn`);
 const first=courses[0].units[0];
 // A cancelled assessment leaves no placement; a failed assessment recommends practice.
 await startPlacement(); await expect(page.getByRole('heading',{name:'Unit assessment',exact:false})).toBeVisible();
 await close(); expect((await saved()).placements).toEqual({});
 let fail=true;
 await page.route(`**/api/learning/sessions/${first.placementStepIds[0]}*`,r=>fail?r.fulfill({status:503}):r.continue());
 await startPlacement();await page.getByRole('button',{name:'Retry placement',exact:true}).waitFor();fail=false;await page.getByRole('button',{name:'Retry placement',exact:true}).click();
 await quiz(sessions[first.placementStepIds[0]],true);
 await expect(page.getByRole('heading',{name:'A good place to start.',exact:true})).toBeVisible();
 expect((await saved()).placements).toEqual({});expect((await saved()).practice).toEqual({});
 await page.getByRole('button',{name:'Learn this unit',exact:true}).click();
 await page.getByRole('button',{name:'Let’s practice',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Trace the request',exact:true})).toBeVisible();
 await page.screenshot({path:`${output}/sequence-exercise.png`,fullPage:false});
 await solveSkillPractice(page,sessions['request-journey'],{review:1,wrong:true,hint:true});
 await page.getByRole('button',{name:'Back to my path',exact:true}).click();
 let data=await saved();const record=Object.values(data.evidence).find(e=>e.skillId==='skill-request-journey');
 expect(record).toMatchObject({mistake:true,hinted:true,passed:true,correct:true});
 expect(Object.values(data.practice).flat()).toContain('request-journey');
 // Passing placement skips the unit, without new XP or fabricated practice dates.
 const beforePractice=JSON.stringify(data.practice);
 await startPlacement();await quiz(sessions[first.placementStepIds[0]]);
 await expect(page.getByRole('heading',{name:'You can move forward.',exact:true})).toBeVisible();
 expect((await saved()).placements[first.id].revision).toBe(first.revision);
 expect(JSON.stringify((await saved()).practice)).toBe(beforePractice);
 await page.screenshot({path:`${output}/placement-result.png`,fullPage:false});
 await page.getByRole('button',{name:`Start: ${courses[0].units[1].title}`,exact:true}).click();
 await expect(page.getByRole('heading',{name:sessions[courses[0].units[1].steps[0].id].concept,exact:true})).toBeVisible();await close();
 await page.reload(); await page.getByRole('tab',{name:'Courses',exact:true}).click(); await expect(page.getByText(/Placed out/).first()).toBeVisible();
 // Coding placement requires all four executable tasks, including the unit project.
 await course('coding');await startPlacement();const coding=courses.find(c=>c.id==='coding').units[0];
 for(const [index,id] of coding.placementStepIds.entries()){
  const step=sessions[id];await expect(page.locator('#daily-code')).toBeVisible();
  await expect(page.getByRole('button',{name:'Need a hint?',exact:true})).toHaveCount(0);
  const solution=originals[id]||await fs.readFile(step.starterFile.replace('/api/content/','content/entries/').replace(/\.js$/,'.solution.js'),'utf8');
  await page.locator('#daily-code').fill(solution);await page.getByRole('button',{name:'Run tests',exact:true}).click();
  await page.getByRole('button',{name:'All tests passed · Complete step',exact:true}).click();
  if(index<coding.placementStepIds.length-1)expect((await saved()).placements[coding.id]).toBeUndefined();
 }
 await expect(page.getByRole('heading',{name:'You can move forward.',exact:true})).toBeVisible();await close();
 expect((await saved()).placements[coding.id]).toBeDefined();expect(JSON.stringify((await saved()).practice)).toBe(beforePractice);
 for(const id of ['genai','ml']){
  await course(id);await startPlacement();const unit=courses.find(c=>c.id===id).units[0];await quiz(sessions[unit.placementStepIds[0]]);
  await expect(page.getByRole('heading',{name:'You can move forward.',exact:true})).toBeVisible();await close();expect((await saved()).placements[unit.id]).toBeDefined();
 }
 // Make one skill weak now and another due after two successful delayed checks.
 await page.evaluate(({key,skills})=>{
  const data=JSON.parse(localStorage.getItem(key));const date=new Date();
  const day=n=>{const d=new Date(date.getFullYear(),date.getMonth(),date.getDate()+n,12);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  for(const [id,e]of Object.entries(data.evidence))if(['skill-request-journey','skill-code-capacity'].includes(e.skillId))delete data.evidence[id];
  const add=(skillId,offset,correct,mistake,at)=>{const value={skillId,revision:skills.find(s=>s.id===skillId).revision,day:day(offset),at,correct,mistake,hinted:false,passed:correct};data.evidence[`${skillId}:${value.day}`]=value;};
  add('skill-request-journey',0,false,true,Date.now());add('skill-code-capacity',-10,true,false,1);add('skill-code-capacity',-7,true,false,2);
  localStorage.setItem(key,JSON.stringify(data));
 },{key,skills});
 await page.reload();await page.getByRole('tab',{name:/^Practice/}).click();
 const review=page.getByRole('tabpanel');
 await expect(review.getByRole('button').first()).toContainText('How a web request works');
 await expect(review.getByText('Your last attempt needs another try.',{exact:true})).toBeVisible();
 await expect(review.getByRole('button',{name:/Calculate server capacity/})).toBeVisible();
 await page.screenshot({path:`${output}/adaptive-review.png`,fullPage:false});
 await review.getByRole('button').first().click();await page.getByRole('button',{name:'Let’s practice',exact:true}).click();
 await solveSkillPractice(page,sessions['request-journey'],{review:1});await page.getByRole('button',{name:'Back to my path',exact:true}).click();
 await expect(review.getByRole('button',{name:/^How a web request works/})).toHaveCount(0);
 // Placement and recall records survive export/import into another browser.
 await page.getByRole('button',{name:'Learning settings',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup',exact:true}).click();await(await download).saveAs(`${output}/backup.json`);await close();
 const backup=await fs.readFile(`${output}/backup.json`);const freshContext=await learningContext({});const fresh=await freshContext.newPage();await fresh.goto(`${base}/learn`);
 await fresh.getByRole('button',{name:'Learning settings',exact:true}).click();await fresh.getByLabel('Progress backup file').setInputFiles({name:'progress.json',mimeType:'application/json',buffer:backup});
 await expect(fresh.getByRole('dialog')).toContainText('4 placed units');await fresh.getByRole('button',{name:'Confirm import',exact:true}).click();await fresh.reload();
 expect(Object.keys((await saved(fresh)).placements)).toHaveLength(4);expect(Object.keys((await saved(fresh)).evidence).length).toBeGreaterThan(4);
 await course('design',fresh);await expect(fresh.getByText(/Placed out/).first()).toBeVisible();await freshContext.close();
 // v2 migration preserves the old award and does not manufacture evidence.
 const legacyContext=await learningContext({});await legacyContext.addInitScript(key=>localStorage.setItem(key,JSON.stringify({version:2,practice:{'2026-09-01':['request-journey']},track:{value:'design',updatedAt:1},dailyGoal:{value:2,updatedAt:1},drafts:{}})),key);
 const legacy=await legacyContext.newPage();await legacy.goto(`${base}/learn`);await legacy.getByRole('tab',{name:'Courses',exact:true}).click();await expect(legacy.getByRole('button',{name:'Choose course'})).toBeEnabled();
 expect((await saved(legacy)).version).toBe(5);expect((await saved(legacy)).practice['2026-09-01']).toEqual(['request-journey']);expect((await saved(legacy)).evidence).toEqual({});await legacyContext.close();
 await course('design');await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.documentElement.classList.add('dark');window.scrollTo(0,0);});
 await startPlacement();await expect(page.getByRole('heading',{name:'Unit assessment',exact:false})).toBeVisible();
 expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.screenshot({path:`${output}/mobile-placement.png`,fullPage:false});await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
 console.log('PASS: authored exercise feedback/variants/hints, placement cancel/load retry/failure/pass across four courses, executable coding placement, no invented XP, next-unit navigation, adaptive priority/recovery, backup/restore, v2 migration, and mobile placement.');
}catch(error){await page.screenshot({path:`${output}/failure.png`,fullPage:true});throw error;}finally{await browser.close();}
