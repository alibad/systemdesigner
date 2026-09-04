import fs from 'node:fs/promises';
import { expect } from '@playwright/test';
export async function solveSkillPractice(page, step, { review = 0, wrong = false, hint = false } = {}) {
  const pack = JSON.parse(await fs.readFile(step.exercisesFile.replace('/api/content/','content/entries/'),'utf8'));
  for (const [index,group] of pack.groups.entries()) {
    const exercise=group.variants[review % group.variants.length];
    await expect(page.getByRole('heading',{name:exercise.title,exact:true})).toBeVisible();
    if(hint && index===0) await page.getByRole('button',{name:'Need a hint?',exact:true}).click();
    async function answer(incorrect) {
      if(exercise.kind==='sequence') {
        const order=incorrect ? [...exercise.answer].reverse() : exercise.answer;
        for(const id of order) await page.getByRole('button',{name:exercise.items.find(item=>item.id===id).text,exact:true}).click();
        await page.getByRole('button',{name:'Check sequence',exact:true}).click();
      } else if(exercise.kind==='match') {
        const pairs=incorrect ? [...exercise.pairs].reverse() : exercise.pairs;
        for(const pair of pairs) await page.getByRole('button',{name:pair.detail,exact:true}).click();
        await page.getByRole('button',{name:'Check matches',exact:true}).click();
      } else if(exercise.kind==='number') {
        await page.getByRole('spinbutton',{name:'Your answer',exact:true}).fill(String(exercise.answer+(incorrect?1:0)));
        await page.getByRole('button',{name:'Check answer',exact:true}).click();
      } else {
        const answer=incorrect ? (exercise.correctAnswer+1)%exercise.options.length : exercise.correctAnswer;
        await page.getByRole('button',{name:`Answer ${answer+1}: ${exercise.options[answer]}`,exact:true}).click();
      }
    }
    if(wrong && index===0) {
      await answer(true);
      if(exercise.kind !== 'choice') await expect(page.getByRole('heading',{name:'Look at the consequence.',exact:true})).toBeVisible();
      await expect(page.getByRole('button',{name:'Complete practice',exact:true})).toHaveCount(0);
      await page.getByRole('button',{name:'Try this exercise again',exact:true}).click();
      if(exercise.kind==='match') {
        await page.getByRole('button',{name:'Change match 1',exact:true}).click();
      }
      if(exercise.kind==='sequence') {
        while(await page.getByRole('button',{name:/^Remove action/}).count())await page.getByRole('button',{name:/^Remove action/}).first().click();
      }
    }
    await answer(false);
    await page.getByRole('button',{name:index===pack.groups.length-1?'Complete practice':'Next exercise',exact:true}).click();
  }
}
