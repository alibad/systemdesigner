#!/usr/bin/env node
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const {courses}=await read('content/learning/catalog.json'),sessions=await read('content/learning/sessions.json');
const base=process.env.LEARNING_QA_BASE_URL||'http://localhost:3101',dir='.artifacts/learning-models';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'light'}),page=await context.newPage();page.setDefaultTimeout(30000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await context.addInitScript(courses=>{if(window.top!==window||localStorage.getItem('sd:daily-learning:v2:guest'))return;localStorage.setItem('sd:daily-learning:v2:guest',JSON.stringify({version:4,practice:{},drafts:{},evidence:{},track:{value:'design',updatedAt:1},dailyGoal:{value:1,updatedAt:1},journey:{enrollment:{value:'courses',updatedAt:1},tasks:{}},placements:Object.fromEntries(courses.flatMap(c=>c.units).map(u=>[u.id,{revision:u.revision,day:'2026-09-03',at:1}]))}));},courses);
async function open(step) {
 await page.getByRole('tab',{name:'Courses',exact:true}).click();await page.getByRole('button',{name:'Choose course',exact:true}).click();
 await page.getByRole('menuitemradio',{name:new RegExp(`^${courses.find(c=>c.id===step.courseId).title}`)}).click();
 const toggle=page.locator(`[aria-controls="unit-content-${step.unitId}"]`);if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
 await page.locator(`#step-${step.id}`).click();await page.getByRole('button',{name:'Let’s practice',exact:true}).waitFor();
}
try {
 await page.goto(`${base}/learn`);
 for(const id of ['lesson-redis','lesson-llm-intro','lesson-model-evaluation']) {
  const step=sessions[id];await open(step);
  for(const [index,model] of step.models.entries()) {
   await page.getByRole('button',{name:model.title,exact:true}).click();
   const root=page.locator('.learning-source-model');
   await expect(root.locator('input,button').first()).toBeVisible();
   const before=await root.innerText();
   const sliders=root.getByRole('slider');
   if(await sliders.count()) {
    const slider=sliders.first(),value=await slider.inputValue(),max=await slider.getAttribute('max');
    await slider.press(value===max?'Home':'End');
   } else {
    const option=root.locator('button[aria-pressed="false"]').first();await option.click();
   }
   await expect.poll(()=>root.innerText()).not.toBe(before);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);
   await page.screenshot({path:`${dir}/${id}-${index}-mobile.png`});
   await page.setViewportSize({width:1440,height:1000});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);
   await page.screenshot({path:`${dir}/${id}-${index}-desktop.png`});
   await page.setViewportSize({width:390,height:844});
   console.log(`PASS ${id}: ${model.title} changes the model at phone and desktop sizes.`);
  }
  await page.keyboard.press('Escape');
 }
 if(process.env.LEARNING_QA_OFFLINE==='1') {
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(async()=>Boolean(await caches.match('/learn')))).toBe(true);
  await context.setOffline(true);await page.reload();
  const step=sessions['lesson-model-evaluation'];await open(step);await page.getByRole('button',{name:step.models[0].title,exact:true}).click();
  await expect(page.locator('.learning-source-model').getByRole('slider').first()).toBeVisible();
  await page.screenshot({path:`${dir}/offline-model.png`});
  console.log('PASS visited source model loads after an offline reload.');
 }
 expect(errors).toEqual([]);
} catch(e){await page.screenshot({path:`${dir}/failure.png`,fullPage:true});await fs.writeFile(`${dir}/failure.txt`,await page.locator('body').innerText());throw e;}finally{await browser.close();}
