// Outside checks on the learning model, from an exported progress file:
//
//   npm run measure -- <progress.json>
//
// Every prediction is made BEFORE the attempt it predicts (replaying the event log), so these are
// honest out-of-sample numbers. See docs/PLAN.md §8 for what each one is used to judge.
//   1. rating model: Brier score vs a constant baseline, calibration bins, predicted vs actual per level
//   2. FSRS: predicted recall vs actual on first-of-day attempts
//   3. time on task: median seconds for right and wrong answers; fast misses (< 12 s)
//   4. learning curve: accuracy and level by how many attempts the skill already had
//   5. content runway: built core skills not yet started, and the pace of starting new ones
//   6. translation gap: story (word-problem) vs plain items at the same skill and level

import { readFileSync } from 'node:fs';
import { SKILLS } from '../src/engine/registry';
import { pCorrect } from '../src/learning/mastery';
import { retrievability } from '../src/learning/scheduler';
import { TREE } from '../src/skills/tree';
import { sortEvents, type LearningEvent } from '../src/storage/events';
import { dateKey, emptyProgress, emptySkill } from '../src/storage/progress';
import { applyEvent } from '../src/storage/replay';

const path = process.argv[2];
if (!path) {
  console.error('Usage: npm run measure -- <progress.json>');
  process.exit(1);
}
const events: LearningEvent[] = sortEvents(JSON.parse(readFileSync(path, 'utf8')).events ?? []);

interface Row {
  skill: string;
  level: number;
  pred: number;
  y: number;
  n: number;
  recall?: number;
  secs?: number;
  ts: number;
  story: boolean;
}
const p = emptyProgress();
const rows: Row[] = [];
const firstSeen: Record<string, number> = {};
const seenToday = new Set<string>();
let prevTs = 0;
for (const e of events) {
  if (e.type === 'attempt') {
    const sp = p.skills[e.skillId] ?? emptySkill();
    const key = `${dateKey(new Date(e.ts))}|${e.skillId}`;
    const firstOfDay = !seenToday.has(key);
    seenToday.add(key);
    firstSeen[e.skillId] ??= e.ts;
    const gap = (e.ts - prevTs) / 1000;
    if (e.help === 'none')
      rows.push({
        skill: e.skillId,
        level: e.level,
        pred: pCorrect(sp.rating, e.level),
        y: e.correct ? 1 : 0,
        n: sp.attempts,
        recall: firstOfDay && sp.fsrs ? retrievability(sp.fsrs, new Date(e.ts)) : undefined,
        secs: gap < 900 ? gap : undefined,
        ts: e.ts,
        story: e.problemId.endsWith(':s'),
      });
  }
  prevTs = e.ts;
  applyEvent(p, e);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const brier = (rs: Row[], f: (r: Row) => number) => mean(rs.map((r) => (f(r) - r.y) ** 2));
const f2 = (x: number) => x.toFixed(2);
const median = (xs: number[]) => (xs.length ? `${[...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)].toFixed(0)}s` : '–');

console.log(`# Model checks: ${path} (${rows.length} solo attempts)\n`);

// 1. Rating model
const base = mean(rows.map((r) => r.y));
const settled = rows.filter((r) => r.n >= 15);
const baseS = mean(settled.map((r) => r.y));
console.log('## 1. Rating model (lower Brier is better; it should beat the constant baseline)\n');
console.log(`all attempts:        model ${brier(rows, (r) => r.pred).toFixed(4)}   constant ${f2(base)} → ${brier(rows, () => base).toFixed(4)}`);
console.log(`15+ attempts in:     model ${brier(settled, (r) => r.pred).toFixed(4)}   constant ${f2(baseS)} → ${brier(settled, () => baseS).toFixed(4)}   (n ${settled.length})`);
console.log(`solo accuracy ${Math.round(base * 100)}% (target band 75–85%)\n`);
console.log('calibration: predicted → actual');
for (let lo = 0; lo < 1; lo += 0.1) {
  const b = rows.filter((r) => r.pred >= lo && r.pred < lo + 0.1);
  if (b.length >= 5) console.log(`  ${f2(lo)}–${f2(lo + 0.1)}  ${f2(mean(b.map((r) => r.pred)))} → ${f2(mean(b.map((r) => r.y)))}   n ${b.length}`);
}
console.log('by level (15+ attempts in): predicted → actual');
for (const L of [1, 2, 3, 4, 5]) {
  const b = settled.filter((r) => r.level === L);
  if (b.length) console.log(`  L${L}  ${f2(mean(b.map((r) => r.pred)))} → ${f2(mean(b.map((r) => r.y)))}   n ${b.length}`);
}

// 2. FSRS
const fod = rows.filter((r) => r.recall !== undefined);
console.log(`\n## 2. FSRS on first-of-day attempts (n ${fod.length}): predicted recall ${f2(mean(fod.map((r) => r.recall!)))} → actual ${f2(mean(fod.map((r) => r.y)))}`);
console.log('   (fit personal FSRS parameters once n ≥ 50; until then, treat this as a hint, not a verdict)');

// 3. Time on task
console.log('\n## 3. Time on task (gap from the previous event, under 15 min)\n');
const timed = rows.filter((r) => r.secs !== undefined);
for (const s of [...new Set(timed.map((r) => r.skill))]) {
  const b = timed.filter((r) => r.skill === s);
  const right = b.filter((r) => r.y).map((r) => r.secs!);
  const wrong = b.filter((r) => !r.y).map((r) => r.secs!);
  console.log(`  ${s.padEnd(26)} right ${median(right).padStart(5)}   wrong ${median(wrong).padStart(5)}   fast misses (<12s) ${wrong.filter((x) => x < 12).length}/${wrong.length}`);
}
const days = new Set(rows.map((r) => dateKey(new Date(r.ts)))).size;
console.log(`  ${Math.round(mean([timed.reduce((a, r) => a + r.secs!, 0) / 60 / days]))} timed minutes per active day over ${days} days`);

// 4. Learning curve
console.log('\n## 4. Learning curve: does the level keep up with the accuracy?\n');
for (const [lo, hi] of [[0, 10], [10, 30], [30, 60], [60, 1e9]]) {
  const b = rows.filter((r) => r.n >= lo && r.n < hi);
  if (b.length) console.log(`  attempts ${String(lo).padStart(2)}–${hi > 1e8 ? '' : hi}`.padEnd(20) + `accuracy ${f2(mean(b.map((r) => r.y)))}   avg level ${f2(mean(b.map((r) => r.level)))}   n ${b.length}`);
}

// 5. Content runway
const core = TREE.filter((n) => !n.optional && n.track !== 'gre');
const built = core.filter((n) => SKILLS.some((s) => s.id === n.id));
const started = built.filter((n) => firstSeen[n.id] !== undefined);
const spanDays = Math.max(1, (Math.max(...events.map((e) => e.ts)) - Math.min(...events.map((e) => e.ts))) / 86_400_000);
const perWeek = (started.length / spanDays) * 7;
const ahead = built.length - started.length;
console.log('\n## 5. Content runway\n');
console.log(`  core skills: ${core.length} in the tree, ${built.length} built, ${started.length} started`);
console.log(`  pace: ${perWeek.toFixed(1)} new core skills per week → ${ahead} built-but-unstarted = ~${(ahead / Math.max(perWeek, 0.1)).toFixed(1)} weeks of runway (keep ≥ 3)`);

// 6. Translation gap
console.log('\n## 6. Translation gap: story vs plain, same skill and level (the story batch should shrink it)\n');
const cells = [...new Set(rows.filter((r) => r.story).map((r) => `${r.skill}|${r.level}`))];
if (!cells.length) console.log('  no story items answered yet');
for (const cell of cells) {
  const [skill, level] = cell.split('|');
  const at = rows.filter((r) => r.skill === skill && r.level === Number(level));
  const st = at.filter((r) => r.story);
  const pl = at.filter((r) => !r.story);
  const secs = (xs: Row[]) => median(xs.filter((r) => r.secs !== undefined && r.y).map((r) => r.secs!));
  console.log(
    `  ${`${skill} L${level}`.padEnd(30)} story ${f2(mean(st.map((r) => r.y)))} (n ${st.length}, ${secs(st)})   plain ${f2(mean(pl.map((r) => r.y)))} (n ${pl.length}, ${secs(pl)})   gap ${(100 * (mean(pl.map((r) => r.y)) - mean(st.map((r) => r.y)))).toFixed(0)} pts`,
  );
}

