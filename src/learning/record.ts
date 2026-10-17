// Apply one finished problem to Progress: rating, FSRS, mastery state transitions, history,
// XP, daily count, mistake log. Returns the state-change events so the UI can celebrate them.

import type { Problem } from '../engine/types';
import { dateKey, emptySkill, HISTORY_CAP, MISTAKE_CAP, type MistakeEntry, type Progress } from '../storage/progress';
import { nextLevel, updateRating, type Help } from './mastery';
import { gradeFor, reviewCard } from './scheduler';
import { countsTowardMastery, xpFor } from './scoring';
import { addDays, MASTERY_LEVEL, RETENTION_DELAY_DAYS, skillState } from './states';

export interface AttemptResult {
  problem: Problem;
  /** Final answer correct (in guided mode: the learner entered the last step themselves). */
  correct: boolean;
  help: Help;
  hintsUsed: number;
  input?: string;
  misconception?: string;
  /** Step keys the learner missed, asked "Show me" on, or revealed with hints. */
  missedSteps: string[];
  /** This problem was a scheduled cold retention check. */
  retentionCheck?: boolean;
}

export type SkillEvent =
  | { type: 'level-up'; skillId: string; level: number }
  | { type: 'practiced'; skillId: string }
  | { type: 'check-scheduled'; skillId: string; due: string }
  | { type: 'mastered'; skillId: string }
  | { type: 'check-failed'; skillId: string; retryOn: string }
  | { type: 'rusty'; skillId: string }
  | { type: 'recovered'; skillId: string };

export function recordAttempt(prev: Progress, r: AttemptResult, now = new Date()): { progress: Progress; xp: number; events: SkillEvent[] } {
  const p: Progress = structuredClone(prev);
  const today = dateKey(now);
  const { problem } = r;
  const id = problem.skillId;
  const skill = p.skills[id] ?? emptySkill();
  const events: SkillEvent[] = [];
  const solo = countsTowardMastery(r.correct, r.help);

  const firstOfDay = skill.lastPracticed !== today;
  const stateBefore = skillState(skill);
  const levelBefore = nextLevel(skill.rating);
  skill.rating = updateRating(skill.rating, skill.attempts, problem.level, r.correct, r.help);
  skill.attempts += 1;
  if (solo) skill.correctUnassisted += 1;
  skill.lastPracticed = today;
  skill.history.push({ ts: now.getTime(), problemId: problem.id, level: problem.level, correct: r.correct, help: r.help, hintsUsed: r.hintsUsed, firstOfDay });
  if (skill.history.length > HISTORY_CAP) skill.history.splice(0, skill.history.length - HISTORY_CAP);

  // Spaced repetition: only the first attempt of the day is a real memory test.
  if (firstOfDay) skill.fsrs = reviewCard(skill.fsrs, now, gradeFor(r.correct, r.help));

  // Mastery state machine.
  if (r.retentionCheck && firstOfDay && skill.readyAt && !skill.masteredAt) {
    if (solo) {
      skill.masteredAt = today;
      skill.rusty = false;
      events.push({ type: 'mastered', skillId: id });
    } else {
      skill.retentionDue = addDays(today, RETENTION_DELAY_DAYS);
      skill.retentionFails = (skill.retentionFails ?? 0) + 1;
      events.push({ type: 'check-failed', skillId: id, retryOn: skill.retentionDue });
    }
  } else if (!skill.readyAt && solo && problem.level >= MASTERY_LEVEL) {
    skill.readyAt = today;
    skill.retentionDue = addDays(today, RETENTION_DELAY_DAYS);
    events.push({ type: 'check-scheduled', skillId: id, due: skill.retentionDue });
  } else if (skill.masteredAt && firstOfDay) {
    if (!solo && !skill.rusty) {
      skill.rusty = true;
      events.push({ type: 'rusty', skillId: id });
    } else if (solo && skill.rusty) {
      skill.rusty = false;
      events.push({ type: 'recovered', skillId: id });
    }
  }
  if (stateBefore === 'learning' && skillState(skill) === 'practiced') events.push({ type: 'practiced', skillId: id });
  const levelAfter = nextLevel(skill.rating);
  if (levelAfter > levelBefore) events.push({ type: 'level-up', skillId: id, level: levelAfter });
  p.skills[id] = skill;

  const xp = xpFor(problem.level, r.correct, r.help);
  p.xp += xp;
  const day = (p.days[today] ??= { problems: 0, xp: 0 });
  day.problems += 1; // every finished problem counts toward the daily goal, help or not
  day.xp += xp;

  const kind: MistakeEntry['kind'] | null = r.help === 'guided' || r.help === 'reveal' ? r.help : !r.correct ? 'wrong' : r.help === 'hint' ? 'hint' : null;
  if (kind) {
    p.mistakes.push({
      ts: now.getTime(),
      skillId: id,
      problemId: problem.id,
      level: problem.level,
      kind,
      input: r.correct ? undefined : r.input,
      misconception: r.misconception,
      missedSteps: r.missedSteps,
    });
    if (p.mistakes.length > MISTAKE_CAP) p.mistakes.splice(0, p.mistakes.length - MISTAKE_CAP);
  }
  if (r.misconception) {
    const key = `${id}/${r.misconception}`;
    p.misconceptionCounts[key] = (p.misconceptionCounts[key] ?? 0) + 1;
  }
  for (const step of new Set(r.missedSteps)) {
    const key = `${id}/${step}`;
    p.stepMisses[key] = (p.stepMisses[key] ?? 0) + 1;
  }
  return { progress: p, xp, events };
}

export function recordInterpretation(prev: Progress, problem: Problem, correct: boolean, now = new Date()): Progress {
  const p: Progress = structuredClone(prev);
  const skill = p.skills[problem.skillId] ?? emptySkill();
  skill.interpretation.total += 1;
  if (correct) skill.interpretation.correct += 1;
  p.skills[problem.skillId] = skill;
  if (!correct) {
    p.mistakes.push({ ts: now.getTime(), skillId: problem.skillId, problemId: problem.id, level: problem.level, kind: 'interpretation', missedSteps: [] });
  }
  return p;
}
