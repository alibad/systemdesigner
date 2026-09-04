import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_STEPS, ALL_UNITS, PracticeStepSchema, completePathStep, duePathSteps, emptyPathProgress, LEARNING_TRACKS, localDay, pathStreak, readPathProgress, shiftDay, stepIsUnlocked, unitIsComplete, unitIsUnlocked } from './learning-path';
import { getContentByPath } from './content-registry';
import { QuizSchema } from './quiz-bank/quiz-schema';
import bank from './quiz-bank/all-quizzes.json';
import sessions from '../content/learning/sessions.json';
import { QuizQuestionSchema } from './quiz-bank/quiz-schema';

describe('daily learning progress', () => {
  it('unlocks only the next step and keeps the two tracks independent', () => {
    const empty = emptyPathProgress();
    expect(stepIsUnlocked(empty, 'request-journey')).toBe(true);
    expect(stepIsUnlocked(empty, 'code-capacity')).toBe(true);
    expect(stepIsUnlocked(empty, 'scale-a-service')).toBe(false);
    expect(completePathStep(empty, 'cache-a-read')).toBe(empty);
    const completed = completePathStep(empty, 'request-journey', '2026-09-02');
    expect(stepIsUnlocked(completed, 'scale-a-service')).toBe(true);
    expect(stepIsUnlocked(completed, 'code-routing')).toBe(false);
  });

  it('does not duplicate XP or daily activity for repeat completions', () => {
    const first = completePathStep(emptyPathProgress(), 'request-journey', '2026-09-02');
    expect(completePathStep(first, 'request-journey', '2026-09-02')).toBe(first);
    const reviewed = completePathStep(first, 'request-journey', '2026-09-03');
    expect(Object.keys(reviewed.completed)).toHaveLength(1);
    expect(reviewed.activity['2026-09-03']).toEqual(['request-journey']);
    expect(reviewed.completed['request-journey'].completedOn).toBe('2026-09-02');
    expect(reviewed.completed['request-journey'].reviewOn).toBe('2026-09-06');
  });

  it('preserves yesterday’s streak until today ends and breaks it after a missed day', () => {
    let progress = completePathStep(emptyPathProgress(), 'request-journey', '2026-09-01');
    progress = completePathStep(progress, 'request-journey', '2026-09-02');
    expect(pathStreak(progress, '2026-09-02')).toBe(2);
    expect(pathStreak(progress, '2026-09-03')).toBe(2);
    expect(pathStreak(progress, '2026-09-04')).toBe(0);
    expect(pathStreak(emptyPathProgress(), '2026-09-02')).toBe(0);
  });

  it('schedules reviews by local calendar day and removes them after practice', () => {
    const first = completePathStep(emptyPathProgress(), 'request-journey', '2026-03-07');
    expect(duePathSteps(first, '2026-03-07')).toHaveLength(0);
    expect(duePathSteps(first, '2026-03-08').map(step => step.id)).toEqual(['request-journey']);
    expect(shiftDay('2026-03-08', 1)).toBe('2026-03-09');
    expect(shiftDay('2026-11-01', 1)).toBe('2026-11-02');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(localDay(new Date(2026, 8, 2, 23, 59))).toBe('2026-09-02');
    expect(duePathSteps(completePathStep(first, 'request-journey', '2026-03-08'), '2026-03-08')).toHaveLength(0);
  });

  it('recovers from corrupt storage and ignores obsolete step IDs', () => {
    expect(readPathProgress('{broken')).toEqual(emptyPathProgress());
    expect(readPathProgress(JSON.stringify({ ...emptyPathProgress(), dailyGoal: 999 }))).toEqual(emptyPathProgress());
    const progress = completePathStep(emptyPathProgress(), 'request-journey', '2026-09-02');
    progress.completed.removed = progress.completed['request-journey'];
    progress.activity['2026-09-02'].push('removed', 'request-journey');
    const restored = readPathProgress(JSON.stringify(progress));
    expect(Object.keys(restored.completed)).toEqual(['request-journey']);
    expect(restored.activity['2026-09-02']).toEqual(['request-journey']);
  });
});

describe('daily learning curriculum', () => {
  it('has unique steps backed by active lessons and valid assessment assets', () => {
    expect(new Set(ALL_STEPS.map(step => step.id)).size).toBe(ALL_STEPS.length);
    expect(LEARNING_TRACKS.every(track => track.steps.length > 0)).toBe(true);
    expect(Object.keys(sessions)).toHaveLength(ALL_STEPS.length);
    for (const metadata of ALL_STEPS) {
      const step = PracticeStepSchema.parse((sessions as Record<string, unknown>)[metadata.id]);
      expect(step.id).toBe(metadata.id);
      expect(step.lessonPath).toBe(metadata.lessonPath);
      expect(getContentByPath(step.lessonPath)?.status).toBe('active');
      if (step.kind === 'quiz') {
        const data = step.quizId ? (bank as Record<string, unknown>)[step.quizId] : JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content/entries', step.questionsFile!.replace('/api/content/', '')), 'utf8'));
        if (Array.isArray(data)) expect(data.every(question => QuizQuestionSchema.safeParse(question).success)).toBe(true);
        else expect(QuizSchema.safeParse(data).success).toBe(true);
      } else {
        const file = path.join(process.cwd(), 'content/entries', step.starterFile.replace('/api/content/', ''));
        expect(fs.existsSync(file)).toBe(true);
        expect(fs.readFileSync(file, 'utf8')).toContain(`function ${step.functionName}(`);
      }
    }
  });

  it('can complete every course sequentially, requiring each checkpoint before the next unit', () => {
    expect(new Set(ALL_UNITS.map(unit => unit.id)).size).toBe(ALL_UNITS.length);
    for (const course of LEARNING_TRACKS) {
      let progress = emptyPathProgress();
      for (const [index, unit] of course.units.entries()) {
        expect(unitIsUnlocked(progress, unit)).toBe(true);
        expect(unit.steps.at(-1)?.isCheckpoint).toBe(true);
        for (const step of unit.steps) {
          const following = course.units[index + 1];
          if (following) expect(unitIsUnlocked(progress, following)).toBe(false);
          expect(stepIsUnlocked(progress, step.id)).toBe(true);
          progress = completePathStep(progress, step.id, '2026-09-02');
        }
        expect(unitIsComplete(progress, unit)).toBe(true);
      }
      expect(Object.keys(progress.completed)).toHaveLength(course.steps.length);
      expect(LEARNING_TRACKS.filter(other => other.id !== course.id).every(other => stepIsUnlocked(progress, other.steps[0].id))).toBe(true);
    }
  });

  it('keeps old completions reviewable if newly added prerequisites are incomplete', () => {
    const progress = completePathStep(emptyPathProgress(), 'request-journey', '2026-09-01');
    const later = LEARNING_TRACKS[0].units[1].steps[0].id;
    progress.completed[later] = progress.completed['request-journey'];
    expect(stepIsUnlocked(progress, later)).toBe(true);
    expect(completePathStep(progress, later, '2026-09-02').completed[later].reviews).toBe(1);
  });
});
