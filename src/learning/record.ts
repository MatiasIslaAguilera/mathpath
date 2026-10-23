// Learning events → Progress. Every finished problem is an immutable event (storage/events.ts);
// Progress is what you get by applying events in time order. The apply* functions MUTATE the
// Progress they're given (fast replay); record* wrap them for live use: clone, apply, and also
// return the event to store and sync.

import type { Problem } from '../engine/types';
import { newEventId, type AttemptEvent, type InterpretationEvent } from '../storage/events';
import { dateKey, emptySkill, HISTORY_CAP, MISTAKE_CAP, type MistakeEntry, type Progress } from '../storage/progress';
import { heldLevel, pCorrect, TARGET_P, updateRating, type Help } from './mastery';
import { gradeFor, reviewCard } from './scheduler';
import { countsTowardMastery, xpFor } from './scoring';
import { addDays, CHECK_START_LEVEL, MASTERY_LEVEL, RETENTION_DELAY_DAYS, skillState, strongRecentRecord } from './states';

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
  /** Lines of working from the working pad (mathjs syntax), and the first line that went wrong. */
  working?: { lines: string[]; firstWrong: number | null };
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

export function attemptEvent(r: AttemptResult, now = new Date()): AttemptEvent {
  return {
    id: newEventId(),
    ts: now.getTime(),
    type: 'attempt',
    skillId: r.problem.skillId,
    problemId: r.problem.id,
    level: r.problem.level,
    correct: r.correct,
    help: r.help,
    hintsUsed: r.hintsUsed,
    input: r.correct ? undefined : r.input,
    misconception: r.misconception,
    missedSteps: r.missedSteps,
    retentionCheck: r.retentionCheck || undefined,
    workingLines: r.working?.lines.length || undefined,
    working: r.correct ? undefined : r.working?.lines,
    workingFirstWrong: r.correct ? undefined : (r.working?.firstWrong ?? undefined),
  };
}

/** Apply one attempt (mutates `p`). Returns XP earned and state-change events for the UI. */
export function applyAttemptEvent(p: Progress, e: AttemptEvent): { xp: number; events: SkillEvent[] } {
  const now = new Date(e.ts);
  const today = dateKey(now);
  const id = e.skillId;
  const skill = p.skills[id] ?? emptySkill();
  const events: SkillEvent[] = [];
  const solo = countsTowardMastery(e.correct, e.help);

  const firstOfDay = skill.lastPracticed !== today;
  const stateBefore = skillState(skill);
  const levelBefore = heldLevel(skill.rating, skill.held);
  skill.rating = updateRating(skill.rating, skill.attempts, e.level, e.correct, e.help);
  skill.held = heldLevel(skill.rating, skill.held);
  skill.attempts += 1;
  if (solo) skill.correctUnassisted += 1;
  skill.lastPracticed = today;
  skill.history.push({ ts: e.ts, problemId: e.problemId, level: e.level, correct: e.correct, help: e.help, hintsUsed: e.hintsUsed, firstOfDay });
  if (skill.history.length > HISTORY_CAP) skill.history.splice(0, skill.history.length - HISTORY_CAP);

  // Spaced repetition: only the first attempt of the day is a real memory test.
  if (firstOfDay) skill.fsrs = reviewCard(skill.fsrs, now, gradeFor(e.correct, e.help));

  // A level-3 start also needs the app's own "practiced" bar and a strong recent solo record:
  // 90%+ over the last 25 unassisted attempts (states.ts). Otherwise level 4 stays the gate.
  const readyByRecord =
    e.level === CHECK_START_LEVEL && pCorrect(skill.rating, CHECK_START_LEVEL) >= TARGET_P && strongRecentRecord(skill);

  // Mastery state machine.
  if (e.retentionCheck && firstOfDay && skill.readyAt && !skill.masteredAt) {
    if (solo) {
      skill.masteredAt = today;
      skill.rusty = false;
      events.push({ type: 'mastered', skillId: id });
    } else {
      skill.retentionDue = addDays(today, RETENTION_DELAY_DAYS);
      skill.retentionFails = (skill.retentionFails ?? 0) + 1;
      events.push({ type: 'check-failed', skillId: id, retryOn: skill.retentionDue });
    }
  } else if (!skill.readyAt && solo && (e.level >= MASTERY_LEVEL || readyByRecord)) {
    skill.readyAt = today;
    skill.readyLevel = e.level;
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
  const levelAfter = skill.held;
  if (levelAfter > levelBefore) events.push({ type: 'level-up', skillId: id, level: levelAfter });
  p.skills[id] = skill;

  const xp = xpFor(e.level, e.correct, e.help);
  p.xp += xp;
  const day = (p.days[today] ??= { problems: 0, xp: 0 });
  day.problems += 1; // every finished problem counts toward the daily goal, help or not
  day.xp += xp;

  const kind: MistakeEntry['kind'] | null = e.help === 'guided' || e.help === 'reveal' ? e.help : !e.correct ? 'wrong' : e.help === 'hint' ? 'hint' : null;
  if (kind) {
    p.mistakes.push({
      ts: e.ts,
      skillId: id,
      problemId: e.problemId,
      level: e.level,
      kind,
      input: e.correct ? undefined : e.input,
      misconception: e.misconception,
      missedSteps: e.missedSteps,
      working: e.working,
      workingFirstWrong: e.workingFirstWrong,
    });
    if (p.mistakes.length > MISTAKE_CAP) p.mistakes.splice(0, p.mistakes.length - MISTAKE_CAP);
  }
  if (e.misconception) {
    const key = `${id}/${e.misconception}`;
    p.misconceptionCounts[key] = (p.misconceptionCounts[key] ?? 0) + 1;
  }
  for (const step of new Set(e.missedSteps)) {
    const key = `${id}/${step}`;
    p.stepMisses[key] = (p.stepMisses[key] ?? 0) + 1;
  }
  return { xp, events };
}

export function recordAttempt(
  prev: Progress,
  r: AttemptResult,
  now = new Date(),
): { progress: Progress; xp: number; events: SkillEvent[]; logged: AttemptEvent } {
  const progress: Progress = structuredClone(prev);
  const logged = attemptEvent(r, now);
  const { xp, events } = applyAttemptEvent(progress, logged);
  return { progress, xp, events, logged };
}

export function applyInterpretationEvent(p: Progress, e: InterpretationEvent): void {
  const skill = p.skills[e.skillId] ?? emptySkill();
  skill.interpretation.total += 1;
  if (e.correct) skill.interpretation.correct += 1;
  p.skills[e.skillId] = skill;
  if (!e.correct) {
    p.mistakes.push({
      ts: e.ts,
      skillId: e.skillId,
      problemId: e.problemId,
      level: e.level,
      kind: 'interpretation',
      ...(e.input !== undefined && { input: e.input }),
      ...(e.question !== undefined && { question: e.question }),
      missedSteps: [],
    });
  }
}

export function recordInterpretation(
  prev: Progress,
  problem: Problem,
  correct: boolean,
  now = new Date(),
  pick?: { input: string; question: number },
): { progress: Progress; logged: InterpretationEvent } {
  const progress: Progress = structuredClone(prev);
  const logged: InterpretationEvent = {
    id: newEventId(),
    ts: now.getTime(),
    type: 'interpretation',
    skillId: problem.skillId,
    problemId: problem.id,
    level: problem.level,
    correct,
    ...pick,
  };
  applyInterpretationEvent(progress, logged);
  return { progress, logged };
}
