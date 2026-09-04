import { describe, expect, it } from 'vitest';
import { ALL_SKILLS, LEARNING_TRACKS, emptyPathProgress, stepIsUnlocked, unitIsPlaced } from './learning-path';
import { adaptiveReviewQueue, deriveSkillReviews, evidenceKey, mergeEvidence, type SkillEvidence } from './learning-evidence';
import { dailyProgress, emptyDailyLearning, exportDailyLearning, importDailyLearning, mergeDailyLearning, parseDailyLearning, recordDailyAttempt, recordUnitPlacement } from './daily-learning-data';
import { SkillExercisePackSchema, selectSkillExercises } from './skill-exercise-schema';
import fs from 'node:fs';

const skill = ALL_SKILLS.find(skill => skill.stepId === 'request-journey')!;
const evidence = (day: string, extra: Partial<SkillEvidence> = {}): SkillEvidence => ({ skillId:skill.id, revision:skill.revision, day, at:Date.parse(day), correct:true, mistake:false, hinted:false, passed:true, ...extra });
const records = (...items: SkillEvidence[]) => Object.fromEntries(items.map(item=>[evidenceKey(item),item]));

describe('adaptive skill evidence', () => {
  it('never promotes partial practice, even when several days contain correct answers', () => {
    const state=deriveSkillReviews(records(evidence('2026-09-01',{passed:false}),evidence('2026-09-04',{passed:false}),evidence('2026-09-11',{passed:false})))[skill.id];
    expect(state.interval).toBe(0);expect(state.status).toBe('building');
    expect(state.reason).toContain('Finish the practice');
  });
  it('spaces delayed clean recall further apart and brings misses and hints back sooner', () => {
    const first = deriveSkillReviews(records(evidence('2026-09-01')))[skill.id];
    expect(first.reviewOn).toBe('2026-09-04');
    const strong = deriveSkillReviews(records(evidence('2026-09-01'),evidence('2026-09-04')))[skill.id];
    expect(strong.interval).toBe(7); expect(strong.status).toBe('strong');
    const missed = deriveSkillReviews(records(evidence('2026-09-01'),evidence('2026-09-04'),evidence('2026-09-11',{correct:false,mistake:true})))[skill.id];
    expect(missed.reviewOn).toBe('2026-09-11');
    const helped = deriveSkillReviews(records(evidence('2026-09-01',{hinted:true})))[skill.id];
    expect(helped.interval).toBe(1); expect(helped.status).toBe('needs-practice');
    const early = deriveSkillReviews(records(evidence('2026-09-01'),evidence('2026-09-02')))[skill.id];
    expect(early.interval).toBe(3);
  });
  it('does not erase a same-day mistake or inflate recall through retries and duplicate merges', () => {
    const failed = records(evidence('2026-09-01',{at:10,correct:false,mistake:true}));
    const recovered = records(evidence('2026-09-01',{at:11,correct:true}));
    const merged = mergeEvidence(failed,recovered);
    expect(mergeEvidence(recovered,failed)).toEqual(merged);
    expect(mergeEvidence(merged,merged)).toEqual(merged);
    expect(deriveSkillReviews(merged)[skill.id]).toMatchObject({ interval:1, practiceDays:1, status:'needs-practice' });
    const tied = mergeEvidence(failed,records(evidence('2026-09-01',{at:10,correct:true})));
    expect(deriveSkillReviews(tied)[skill.id].interval).toBe(0);
  });
  it('keeps four recent dates per skill, converges across offline merges, and ignores superseded revisions', () => {
    const a = records(evidence('2026-09-01'),evidence('2026-09-03'),evidence('2026-09-05'));
    const b = records(evidence('2026-09-02'),evidence('2026-09-04'),evidence('2026-09-06'));
    const c = records(evidence('2026-09-07'));
    expect(mergeEvidence(mergeEvidence(a,b),c)).toEqual(mergeEvidence(a,mergeEvidence(b,c)));
    expect(Object.values(mergeEvidence(a,b)).map(item=>item.day).sort()).toEqual(['2026-09-03','2026-09-04','2026-09-05','2026-09-06']);
    expect(deriveSkillReviews(records(evidence('2026-09-07',{revision:'000000000000'})))).toEqual({});
  });
  it('queues an unfinished unlocked skill after failure and clears it after recovery until tomorrow', () => {
    let data = recordDailyAttempt(emptyDailyLearning(),{skillId:skill.id,revision:skill.revision,day:'2026-09-01',correct:false,at:1});
    expect(adaptiveReviewQueue(dailyProgress(data),'2026-09-01').map(item=>item.step.id)).toEqual(['request-journey']);
    data = recordDailyAttempt(data,{skillId:skill.id,revision:skill.revision,day:'2026-09-01',correct:true,passed:true,at:2});
    expect(adaptiveReviewQueue(dailyProgress(data),'2026-09-01')).toHaveLength(0);
    expect(adaptiveReviewQueue(dailyProgress(data),'2026-09-02')[0].reason).toContain('mistake');
  });
});

describe('placement and portable schema migration', () => {
  it('can assess all 43 units in order and covers every skill before granting a unit', () => {
    const sessions=JSON.parse(fs.readFileSync('content/learning/sessions.json','utf8'));
    for(const course of LEARNING_TRACKS) {
      let data=emptyDailyLearning();
      for(const unit of course.units) {
        const assessed=new Set<string>();
        for(const id of unit.placementStepIds) {
          const step=sessions[id];
          if(step.kind==='coding') for(const skillId of step.skillIds)assessed.add(skillId);
          else { const asset=JSON.parse(fs.readFileSync(step.questionsFile.replace('/api/content/','content/entries/'),'utf8'));for(const question of asset.questions)assessed.add(question.skillId); }
        }
        expect([...assessed].sort()).toEqual(ALL_SKILLS.filter(skill=>skill.unitId===unit.id).map(skill=>skill.id).sort());
        data=recordUnitPlacement(data,unit.id,unit.placementStepIds,unit.revision,new Date(2026,8,1));
      }
      expect(Object.keys(data.placements)).toHaveLength(course.units.length);expect(dailyProgress(data).completed).toEqual({});
    }
  });
  it('unlocks assessed units without fabricating lesson completions, XP, or daily activity', () => {
    const course = LEARNING_TRACKS[0], unit = course.units[0];
    const data = recordUnitPlacement(emptyDailyLearning(),unit.id,unit.placementStepIds,unit.revision,new Date(2026,8,1));
    const progress = dailyProgress(data);
    expect(unitIsPlaced(progress,unit)).toBe(true);
    expect(stepIsUnlocked(progress,course.units[1].steps[0].id)).toBe(true);
    expect(progress.completed).toEqual({}); expect(progress.activity).toEqual({});
    expect(stepIsUnlocked(progress,unit.steps[1].id)).toBe(true);
    expect(importDailyLearning(exportDailyLearning(data))).toEqual(data);
    expect(mergeDailyLearning(data,data)).toEqual(data);
  });
  it('requires all assessment parts, the current revision, and prerequisite units', () => {
    const course = LEARNING_TRACKS.find(course=>course.id==='coding')!, unit=course.units[0];
    expect(()=>recordUnitPlacement(emptyDailyLearning(),unit.id,unit.placementStepIds.slice(0,1),unit.revision)).toThrow();
    expect(()=>recordUnitPlacement(emptyDailyLearning(),unit.id,unit.placementStepIds,'000000000000')).toThrow();
    const second = course.units[1];
    expect(()=>recordUnitPlacement(emptyDailyLearning(),second.id,second.placementStepIds,second.revision)).toThrow();
    const progress = { ...emptyPathProgress(), placements:{[unit.id]:{revision:'000000000000',day:'2026-09-01',at:1}} };
    expect(unitIsPlaced(progress,unit)).toBe(false);
    expect(stepIsUnlocked(progress,second.steps[0].id)).toBe(false);
  });
  it('migrates v2 backups and documents while retaining independent evidence and placement on merge', () => {
    const {evidence:_e,placements:_p,journey:_j,sessions:_s,draftHistory:_h,...base} = emptyDailyLearning();
    const legacy = {...base,version:2,practice:{'2026-09-01':['request-journey']}};
    const restored = parseDailyLearning(legacy);
    expect(restored.version).toBe(5); expect(restored.evidence).toEqual({});
    expect(restored.practice).toEqual(legacy.practice);
    expect(importDailyLearning(JSON.stringify({format:'systemdesigner-daily-learning',version:1,exportedAt:new Date().toISOString(),data:legacy}))).toEqual(restored);
    const first = recordDailyAttempt(restored,{skillId:skill.id,revision:skill.revision,day:'2026-09-01',correct:false,at:2});
    const unit=LEARNING_TRACKS[0].units[0];
    const second=recordUnitPlacement(restored,unit.id,unit.placementStepIds,unit.revision,new Date(2026,8,1));
    expect(mergeDailyLearning(first,second)).toEqual(mergeDailyLearning(second,first));
    expect(Object.keys(mergeDailyLearning(first,second).evidence)).toHaveLength(1);
    expect(Object.keys(mergeDailyLearning(first,second).placements)).toHaveLength(1);
    expect(()=>parseDailyLearning({...legacy,version:99})).toThrow();
  });
});

describe('authored skill exercise packs', () => {
  it('validates every authored variant and rotates to a different task set for review', () => {
    const outline=JSON.parse(fs.readFileSync('content/learning/course-outline.json','utf8'));
    const ids=new Set<string>();
    for(const reference of Object.values(outline.exerciseSources) as string[]) {
      const pack=SkillExercisePackSchema.parse(JSON.parse(fs.readFileSync(reference.replace('/api/content/','content/entries/'),'utf8')));
      expect(pack.groups).toHaveLength(3);
      const initial=selectSkillExercises(pack,0), review=selectSkillExercises(pack,1);
      expect(initial.map(item=>item.id)).not.toEqual(review.map(item=>item.id));
      expect(selectSkillExercises(pack,3)).toEqual(initial);
      for(const group of pack.groups)for(const item of group.variants){expect(ids.has(item.id)).toBe(false);ids.add(item.id);}
    }
    expect(ids.size).toBe(Object.keys(outline.exerciseSources).length * 9);
  });
});
