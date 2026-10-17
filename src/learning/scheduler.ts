// FSRS review scheduling (ts-fsrs). One card per skill. Only the FIRST attempt of the day on a
// skill is graded, so in-session repetition can't inflate the memory estimate:
//   unassisted correct → Good, correct with hints → Hard, wrong / guided / reveal → Again.
// Day-granular: short-term (minutes) learning steps are disabled.

import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs';
import type { Help } from './mastery';

/** JSON-safe Card (dates as ISO strings) for localStorage / progress.json. */
export interface StoredCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}

const scheduler = fsrs(generatorParameters({ enable_fuzz: false, enable_short_term: false, request_retention: 0.9 }));

const toStored = (c: Card): StoredCard => ({
  ...c,
  due: c.due.toISOString(),
  last_review: c.last_review ? c.last_review.toISOString() : undefined,
  state: c.state as number,
});

const fromStored = (s: StoredCard): Card => ({
  ...s,
  due: new Date(s.due),
  last_review: s.last_review ? new Date(s.last_review) : undefined,
  state: s.state,
});

export function gradeFor(correct: boolean, help: Help): Grade {
  if (correct && help === 'none') return Rating.Good;
  if (correct && help === 'hint') return Rating.Hard;
  return Rating.Again;
}

export function reviewCard(card: StoredCard | undefined, now: Date, grade: Grade): StoredCard {
  const current = card ? fromStored(card) : createEmptyCard(now);
  return toStored(scheduler.next(current, now, grade).card);
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

/** Due if its due time falls on or before the end of today (reviews are a once-a-day thing). */
export function isDue(card: StoredCard | undefined, now: Date): boolean {
  return !!card && new Date(card.due) <= endOfDay(now);
}

/** Predicted probability of recall right now (0..1). Lower = more urgent review. */
export function retrievability(card: StoredCard, now: Date): number {
  return scheduler.get_retrievability(fromStored(card), now, false);
}
