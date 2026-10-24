// Weak-spot report for an exported progress file (CLAUDE.md → "Workflow: analyzing a progress.json").
//
//   npm run analyze -- <progress.json>                          only what's new since the last review
//   npm run analyze -- <progress.json> --all                    everything
//   npm run analyze -- <progress.json> --mark-reviewed "what was changed"
//
// Reviews are recorded in docs/review-ledger.json (a cutoff timestamp per review), so each
// report starts where the last one stopped. It replays the event log with the app's own code and
// prints, for the new period:
//   1. per skill: solo accuracy (and the change from before), help, first-of-day vs later, level
//   2. whether earlier fixes worked: per-skill accuracy and misconception rates between reviews
//   3. new wrong answers re-diagnosed with TODAY's misconceptions; undiagnosed ones with the
//      regenerated prompt; misconceptions that persist after a review
//   4. new interpretation misses (with the chosen option) and missed steps

import { readFileSync, writeFileSync } from 'node:fs';
import { evalExact } from '../src/engine/checker';
import { matchMisconception } from '../src/engine/misconceptions';
import { problemFromId } from '../src/engine/registry';
import type { AnswerInput, Problem } from '../src/engine/types';
import { skillState, workingLevel } from '../src/learning/states';
import { sortEvents, type AttemptEvent, type InterpretationEvent, type LearningEvent } from '../src/storage/events';
import { dateKey, emptyProgress, emptySkill } from '../src/storage/progress';
import { applyEvent } from '../src/storage/replay';

const LEDGER = new URL('../docs/review-ledger.json', import.meta.url);

interface Review {
  date: string;
  through: number;
  commit?: string;
  summary: string;
}

const args = process.argv.slice(2);
const path = args.find((a) => !a.startsWith('--'));
const showAll = args.includes('--all');
const markIdx = args.indexOf('--mark-reviewed');
const markSummary = markIdx >= 0 ? args[markIdx + 1] : undefined;
if (!path || (markIdx >= 0 && !markSummary)) {
  console.error('Usage: npm run analyze -- <progress.json> [--all] [--mark-reviewed "summary"]');
  process.exit(1);
}

const ledger = JSON.parse(readFileSync(LEDGER, 'utf8')) as { _about?: string; reviews: Review[] };
const reviews = [...ledger.reviews].sort((a, b) => a.through - b.through);
const file = JSON.parse(readFileSync(path, 'utf8'));
const events: LearningEvent[] = sortEvents(file.events ?? []);
if (!events.length) {
  console.error('No event log in this file (format v2 exports have one). Nothing to replay.');
  process.exit(1);
}

if (markSummary) {
  const through = Math.max(...events.map((e) => e.ts));
  const last = reviews.at(-1);
  if (last && last.through >= through) {
    console.log(`Already reviewed through ${new Date(last.through).toISOString()}: nothing to mark.`);
  } else {
    ledger.reviews.push({ date: dateKey(), through, summary: markSummary });
    writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
    console.log(`Marked reviewed through ${new Date(through).toISOString()} in docs/review-ledger.json. Commit it with the fixes.`);
  }
  process.exit(0);
}

const lastReview = showAll ? undefined : reviews.at(-1);
const cutoff = lastReview?.through ?? -Infinity;
const isNew = (ts: number) => ts > cutoff;
/** Segment = how many reviews came before this moment (0 = before the first review). */
const segOf = (ts: number) => reviews.filter((r) => r.through < ts).length;
const segLabel = (s: number) => (s === 0 ? `before ${reviews[0]?.date ?? '–'}` : `after #${s} (${reviews[s - 1].date})`);

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '–');
const frac = (n: number, d: number) => `${pct(n, d).padStart(4)} (${n}/${d})`.padEnd(13);
const clip = (s: string, n = 110) => {
  const flat = s.replace(/\s+/g, ' ');
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
};
const regen = (id: string): Problem | undefined => {
  try {
    return problemFromId(id);
  } catch {
    return undefined;
  }
};
const toInput = (p: Problem, raw: string): AnswerInput =>
  p.answer.kind === 'tuple' || p.answer.kind === 'multi' ? raw.split(',').map((s) => s.trim()) : raw;
const answerText = (p: Problem): string => {
  const a = p.answer;
  switch (a.kind) {
    case 'number':
    case 'expression':
      return a.value;
    case 'tuple':
      return a.values.join(', ');
    case 'choice':
      return `${a.correct} = ${a.options.find((o) => o.id === a.correct)?.label ?? '?'}`;
    case 'multi':
      return a.correct.join(', ');
    default:
      return JSON.stringify(a);
  }
};

// ---------- replay, noting the working level before each attempt ----------

interface Served {
  e: AttemptEvent;
  working: number;
  firstOfDay: boolean;
  /** Misconception under today's code (wrong answers with an input). */
  now?: string;
}
const progress = emptyProgress();
const served: Served[] = [];
const interps: InterpretationEvent[] = [];
const seenToday = new Set<string>();
for (const e of events) {
  if (e.type === 'attempt') {
    const key = `${dateKey(new Date(e.ts))}|${e.skillId}`;
    served.push({ e, working: workingLevel(progress.skills[e.skillId] ?? emptySkill()), firstOfDay: !seenToday.has(key) });
    seenToday.add(key);
  } else if (e.type === 'interpretation') interps.push(e);
  applyEvent(progress, e);
}
for (const s of served) {
  if (s.e.correct || s.e.input === undefined) continue;
  const p = regen(s.e.problemId);
  if (p) s.now = matchMisconception(p, toInput(p, s.e.input));
}

const fresh = served.filter((s) => isNew(s.e.ts));
const old = served.filter((s) => !isNew(s.e.ts));
const freshDays = [...new Set(fresh.map((s) => dateKey(new Date(s.e.ts))))];
const solo = (xs: Served[]) => xs.filter((s) => s.e.help === 'none');
const ok = (xs: Served[]) => xs.filter((s) => s.e.correct).length;

console.log(`# Progress report: ${path}\n`);
if (lastReview) {
  console.log(`Last review: ${lastReview.date}${lastReview.commit ? ` (${lastReview.commit})` : ''}: ${lastReview.summary}`);
  console.log(`New since then: ${fresh.length} attempts${freshDays.length ? ` over ${freshDays.length} days (${freshDays[0]} → ${freshDays.at(-1)})` : ''}. ${old.length} earlier attempts were already reviewed (--all to include them).\n`);
} else {
  console.log(`All ${served.length} attempts (no review cutoff applied).\n`);
}
if (!fresh.length) {
  console.log('Nothing new since the last review. Practice a few days, then export again.');
  process.exit(0);
}

// ---------- 1. per skill, new period ----------

console.log(`## Skills ${lastReview ? 'since the last review' : ''} (solo = unassisted; Δ = change from before)\n`);
console.log(`${'skill'.padEnd(26)}${'n'.padStart(4)}  ${'solo correct'.padEnd(13)} ${'Δ'.padStart(5)}  ${'help'.padEnd(13)} ${'first-of-day'.padEnd(13)} ${'later'.padEnd(13)} lvl served (below/at/above)  now: lvl state`);
const skillIds = [...new Set(fresh.map((s) => s.e.skillId))];
const flags: string[] = [];
for (const id of skillIds) {
  const mine = fresh.filter((s) => s.e.skillId === id);
  const before = solo(old.filter((s) => s.e.skillId === id));
  const sm = solo(mine);
  const fod = sm.filter((s) => s.firstOfDay);
  const later = sm.filter((s) => !s.firstOfDay);
  const delta = before.length >= 5 && sm.length ? Math.round(100 * (ok(sm) / sm.length - ok(before) / before.length)) : undefined;
  const below = mine.filter((s) => s.e.level < s.working).length;
  const above = mine.filter((s) => s.e.level > s.working).length;
  const sp = progress.skills[id] ?? emptySkill();
  console.log(
    `${id.padEnd(26)}${String(mine.length).padStart(4)}  ${frac(ok(sm), sm.length)} ${(delta === undefined ? 'new' : `${delta > 0 ? '+' : ''}${delta}`).padStart(5)}  ${frac(mine.length - sm.length, mine.length)} ${frac(ok(fod), fod.length)} ${frac(ok(later), later.length)} ${`${below}/${mine.length - below - above}/${above}`.padEnd(27)} ${workingLevel(sp)}   ${skillState(sp)}`,
  );
  const fodAcc = fod.length ? ok(fod) / fod.length : 1;
  const laterAcc = later.length ? ok(later) / later.length : 0;
  if (fod.length >= 3 && laterAcc - fodAcc >= 0.2) flags.push(`${id}: first-of-day ${pct(ok(fod), fod.length)} vs later ${pct(ok(later), later.length)} (illusion-of-mastery signal)`);
  if (sm.length >= 5 && ok(sm) / sm.length < 0.6) flags.push(`${id}: solo accuracy ${pct(ok(sm), sm.length)}`);
  if (delta !== undefined && delta <= -10 && sm.length >= 8) flags.push(`${id}: solo accuracy down ${-delta} points from before the review`);
}
if (flags.length) console.log(`\nFlags:\n${flags.map((f) => `- ${f}`).join('\n')}`);

// ---------- 2. did the fixes work? ----------

console.log('\n## Trend between reviews (did the fixes work?)\n');
const segs = [...new Set(served.map((s) => segOf(s.e.ts)))].sort((a, b) => a - b);
console.log(`Segments: ${segs.map((s) => `[${s}] ${segLabel(s)}`).join('   ')}`);
for (const s of segs) if (s > 0) console.log(`  review #${s}: ${reviews[s - 1].summary}`);
console.log(`\n${'skill: solo accuracy (avg level)'.padEnd(34)}${segs.map((s) => `[${s}]`.padEnd(19)).join('')}`);
for (const id of skillIds) {
  const cells = segs.map((g) => {
    const xs = served.filter((s) => s.e.skillId === id && segOf(s.e.ts) === g);
    const sx = solo(xs);
    if (!xs.length) return ''.padEnd(19);
    const avgLvl = xs.reduce((a, s) => a + s.e.level, 0) / xs.length;
    return `${pct(ok(sx), sx.length).padStart(4)} n=${String(sx.length).padEnd(3)} L${avgLvl.toFixed(1)}`.padEnd(19);
  });
  console.log(`${id.padEnd(34)}${cells.join('')}`);
}
const misKeys = [...new Set(served.filter((s) => s.now).map((s) => `${s.e.skillId}/${s.now}`))];
if (misKeys.length) {
  console.log(`\n${'misconception (per attempts on the skill)'.padEnd(52)}${segs.map((s) => `[${s}]`.padEnd(10)).join('')}`);
  const persisting: string[] = [];
  const predeploy: string[] = [];
  for (const key of misKeys) {
    const [skill, mis] = key.split('/');
    const counts = segs.map((g) => {
      const xs = served.filter((s) => s.e.skillId === skill && segOf(s.e.ts) === g);
      return { n: xs.filter((s) => s.now === mis).length, d: xs.length };
    });
    console.log(`${key.padEnd(52)}${counts.map((c) => (c.d ? `${c.n}/${c.d}` : '').padEnd(10)).join('')}`);
    // A review's fix reaches the phone only once it's deployed. A miss logged in-app under another
    // label than today's came from a build without the fix, so it says nothing about the fix
    // (review 6: 3 of 5 "persisting" read-backwards misses were logged as flip-positive).
    const since = fresh.filter((s) => s.e.skillId === skill && s.now === mis);
    const newN = since.filter((s) => s.e.misconception === mis).length;
    const olderBuild = since.length - newN;
    const oldN = old.filter((s) => s.e.skillId === skill && s.now === mis).length;
    if (newN && oldN) persisting.push(`${key}: ${oldN} before, ${newN} since${olderBuild ? ` (+${olderBuild} on a build without the fix)` : ''}`);
    else if (olderBuild && oldN) predeploy.push(`${key}: all ${olderBuild} since were on a build without the fix`);
  }
  if (lastReview && persisting.length) console.log(`\nPersisting after review (already diagnosed; the explanation or practice isn't landing):\n${persisting.map((p) => `- ${p}`).join('\n')}`);
  if (lastReview && predeploy.length) console.log(`\nNot yet tested (misses logged under an older label, before the fix was deployed):\n${predeploy.map((p) => `- ${p}`).join('\n')}`);
}

// ---------- 3. new wrong answers ----------

const wrong = fresh.filter((s) => !s.e.correct && s.e.input !== undefined);
const diagnosed = wrong.filter((s) => s.now);
const undiagnosed = wrong.filter((s) => !s.now);
console.log(`\n## New wrong answers: ${wrong.length} (${diagnosed.length} diagnosed, ${undiagnosed.length} undiagnosed)\n`);
const byMis: Record<string, number> = {};
for (const s of diagnosed) byMis[`${s.e.skillId}/${s.now}`] = (byMis[`${s.e.skillId}/${s.now}`] ?? 0) + 1;
for (const [k, n] of Object.entries(byMis).sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(3)}  ${k}`);
if (undiagnosed.length) console.log('\nUndiagnosed: work out what mistake produces each input.\n');
for (const { e } of undiagnosed) {
  const p = regen(e.problemId);
  if (!p) {
    console.log(`- ${e.problemId}  input ${e.input}  (skill no longer exists)`);
    continue;
  }
  let gap = '';
  if (p.answer.kind === 'number') {
    const d = Number(e.input) - evalExact(p.answer.value);
    if (Number.isFinite(d)) gap = `  (off by ${+d.toFixed(4)})`;
  }
  const working = e.working ? `\n      working: ${e.working.join('  |  ')} (${e.workingFirstWrong === undefined ? 'no line flagged' : `first wrong line ${e.workingFirstWrong + 1}`})` : '';
  console.log(`- ${e.problemId}  L${e.level}  input ${e.input}  answer ${answerText(p)}${gap}\n      ${clip(p.prompt)}${working}`);
}

// ---------- 4. interpretation and missed steps ----------

const newInterps = interps.filter((e) => isNew(e.ts));
const interpMisses = newInterps.filter((e) => !e.correct);
if (newInterps.length) {
  console.log(`\n## Interpretation: ${newInterps.length - interpMisses.length}/${newInterps.length} correct\n`);
  for (const e of interpMisses) {
    const q = regen(e.problemId)?.interpretation?.[e.question ?? 0];
    const chose = e.input ? (q?.options.find((o) => o.id === e.input)?.label ?? e.input) : 'not recorded (logged before the app saved it)';
    const right = q?.options.find((o) => o.id === q.correct)?.label ?? '?';
    console.log(`- ${e.problemId}${q ? `\n      ${clip(q.prompt)}` : ''}\n      chose: ${chose}   correct: ${right}`);
  }
}
const steps: Record<string, number> = {};
for (const { e } of fresh) for (const k of new Set(e.missedSteps)) steps[`${e.skillId}/${k}`] = (steps[`${e.skillId}/${k}`] ?? 0) + 1;
if (Object.keys(steps).length) {
  console.log('\n## New missed steps (hints, guided, reveals)\n');
  for (const [k, n] of Object.entries(steps).sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(3)}  ${k}`);
}
console.log(`\nAfter acting on this: npm run analyze -- ${path} --mark-reviewed "what you changed"`);
