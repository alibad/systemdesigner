import { describe, it, expect } from 'vitest';
import { initialSrs, schedule, isDue } from '@/lib/spaced-repetition';

const DAY = 24 * 60 * 60 * 1000;

describe('spaced-repetition scheduler', () => {
  it('starts due immediately', () => {
    const s = initialSrs(0);
    expect(isDue(s, 0)).toBe(true);
    expect(s.reps).toBe(0);
  });

  it('expands the interval on successful reviews', () => {
    const first = schedule({ intervalDays: 0, ease: 2.5, reps: 0 }, 'good', 0);
    expect(first.reps).toBe(1);
    expect(first.dueAt).toBe(1 * DAY);

    const second = schedule(first, 'good', first.dueAt);
    expect(second.reps).toBe(2);
    expect(second.dueAt).toBe(first.dueAt + 4 * DAY);

    const third = schedule(second, 'good', second.dueAt);
    expect(third.intervalDays).toBeGreaterThan(second.intervalDays);
  });

  it('resets and lowers ease on "again"', () => {
    const learned = schedule({ intervalDays: 7, ease: 2.5, reps: 3 }, 'again', 1000);
    expect(learned.reps).toBe(0);
    expect(learned.intervalDays).toBe(0);
    expect(learned.ease).toBeLessThan(2.5);
    expect(learned.dueAt).toBe(1000 + 10 * 60 * 1000);
  });

  it('bumps ease and interval faster on "easy"', () => {
    const good = schedule({ intervalDays: 0, ease: 2.5, reps: 0 }, 'good', 0);
    const easy = schedule({ intervalDays: 0, ease: 2.5, reps: 0 }, 'easy', 0);
    expect(easy.ease).toBeGreaterThan(good.ease);
    expect(easy.dueAt).toBeGreaterThan(good.dueAt);
  });

  it('never lets ease fall below 1.3', () => {
    let state = { intervalDays: 1, ease: 1.4, reps: 1 };
    for (let i = 0; i < 5; i++) state = schedule(state, 'again', 0);
    expect(state.ease).toBeGreaterThanOrEqual(1.3);
  });
});
