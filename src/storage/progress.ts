// Progress schema + safe localStorage. Everything the app knows about you lives in one
// versioned object, which is also what export/import writes to progress.json.

import type { Level } from '../engine/types';
import { INITIAL_RATING, type Help } from '../learning/mastery';
import type { StoredCard } from '../learning/scheduler';

export const STORAGE_KEY = 'mathpath.progress';
export const SCHEMA_VERSION = 1;

export interface AttemptRecord {
  ts: number;
  problemId: string;
  level: Level;
  correct: boolean;
  help: Help;
  hintsUsed: number;
  /** First attempt at this skill today: the honest signal of retention (see PLAN §2.4). */
  firstOfDay: boolean;
}

export interface SkillProgress {
  rating: number;
  attempts: number;
  correctUnassisted: number;
  lastPracticed?: string; // YYYY-MM-DD
  /** Most recent attempts, newest last (capped). */
  history: AttemptRecord[];
  interpretation: { correct: number; total: number };
  /** FSRS memory state; graded on the first attempt of each day. */
  fsrs?: StoredCard;
  /** Date the first unassisted solve at level ≥ 4 (or a level-3 one with a strong solo record): the retention check is now scheduled. */
  readyAt?: string;
  /** The level that earned the check (3 or 4); the check is served at this level or the working level, whichever is higher. */
  readyLevel?: Level;
  /** Date the cold retention check becomes due. */
  retentionDue?: string;
  retentionFails?: number;
  /** Date the retention check was passed. */
  masteredAt?: string;
  /** Mastered, but a later first-of-day review failed. */
  rusty?: boolean;
  /** Date the placement test credited this skill (provisionally "practiced"). */
  placedAt?: string;
}

/** One entry per problem that went wrong or needed help: the raw material for weak-spot analysis. */
export interface MistakeEntry {
  ts: number;
  skillId: string;
  problemId: string;
  level: Level;
  kind: 'wrong' | 'hint' | 'guided' | 'reveal' | 'interpretation';
  /** What was typed (wrong answers only). */
  input?: string;
  misconception?: string;
  /** Step keys missed in guided mode (wrong attempt or "Show me"), or revealed by hints. */
  missedSteps: string[];
  /** Lines of working (mathjs syntax) and the index of the first wrong one, if the working pad was used. */
  working?: string[];
  workingFirstWrong?: number;
}

export interface DayRecord {
  problems: number;
  xp: number;
}

export interface Settings {
  dailyGoal: number;
  /** "HH:MM" local time for the daily reminder, if set. */
  reminderTime?: string;
  /** Also show a best-effort notification while the app is open. */
  inAppReminder?: boolean;
}

export interface Progress {
  version: typeof SCHEMA_VERSION;
  createdAt: string;
  xp: number;
  skills: Record<string, SkillProgress>;
  days: Record<string, DayRecord>;
  mistakes: MistakeEntry[];
  /** "skillId/misconceptionId" → count */
  misconceptionCounts: Record<string, number>;
  /** "skillId/stepKey" → count */
  stepMisses: Record<string, number>;
  settings: Settings;
  /** Onboarding choice; undefined until the learner takes or skips the placement test. */
  onboarding?: 'placed' | 'skipped';
  /** Most recent placement test, kept for the progress.json analysis workflow. */
  placement?: PlacementRecord;
  /** Date the welcome-back message was last shown (once per day at most). */
  welcomeShownOn?: string;
}

export interface PlacementRecord {
  date: string;
  results: Record<string, PlacementResult>;
  items: { skillId: string; problemId: string; correct: boolean; skipped: boolean }[];
}

/** passed/failed/partial: tested. credited: below a passed skill. blocked: a prerequisite failed. */
export type PlacementResult = 'passed' | 'partial' | 'failed' | 'credited' | 'blocked' | 'untested';

export const HISTORY_CAP = 60;
export const MISTAKE_CAP = 3000;

export function emptyProgress(): Progress {
  return {
    version: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    xp: 0,
    skills: {},
    days: {},
    mistakes: [],
    misconceptionCounts: {},
    stepMisses: {},
    settings: { dailyGoal: 10 },
  };
}

export function emptySkill(): SkillProgress {
  return { rating: INITIAL_RATING, attempts: 0, correctUnassisted: 0, history: [], interpretation: { correct: 0, total: 0 } };
}

/** Local calendar date, YYYY-MM-DD. */
export function dateKey(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------- validation / migration ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export class ProgressFormatError extends Error {}

/** Accepts anything parsed from JSON; returns a valid Progress or throws ProgressFormatError. */
export function migrate(raw: unknown): Progress {
  if (!isObj(raw)) throw new ProgressFormatError("This file isn't a MathPath progress file.");
  if (raw.version !== SCHEMA_VERSION) {
    throw new ProgressFormatError(`Unsupported progress version: ${String(raw.version)}.`);
  }
  const base = emptyProgress();
  const p: Progress = {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(isObj(raw.settings) ? raw.settings : {}) },
  } as Progress;
  if (!isObj(p.skills) || !isObj(p.days) || !Array.isArray(p.mistakes)) {
    throw new ProgressFormatError('Progress file is missing required sections.');
  }
  for (const [id, s] of Object.entries(p.skills)) {
    if (!isObj(s) || typeof s.rating !== 'number' || !Array.isArray(s.history)) {
      throw new ProgressFormatError(`Skill "${id}" has invalid data.`);
    }
    p.skills[id] = { ...emptySkill(), ...s };
  }
  p.misconceptionCounts = isObj(p.misconceptionCounts) ? p.misconceptionCounts : {};
  p.stepMisses = isObj(p.stepMisses) ? p.stepMisses : {};
  return p;
}

// ---------- localStorage (never throws: private mode, quota, disabled storage) ----------

let memoryCopy: string | null = null;

export function loadProgress(): Progress {
  let text: string | null = null;
  try {
    text = localStorage.getItem(STORAGE_KEY);
  } catch {
    text = memoryCopy;
  }
  if (!text) return emptyProgress();
  try {
    return migrate(JSON.parse(text));
  } catch {
    // Keep the unreadable copy so nothing is silently lost, and start fresh.
    try {
      localStorage.setItem(`${STORAGE_KEY}.corrupt.${Date.now()}`, text);
    } catch {
      /* ignore */
    }
    return emptyProgress();
  }
}

/** Returns false if the browser refused to store (the app keeps working from memory). */
export function saveProgress(p: Progress): boolean {
  const text = JSON.stringify(p);
  memoryCopy = text;
  try {
    localStorage.setItem(STORAGE_KEY, text);
    return true;
  } catch {
    return false;
  }
}
