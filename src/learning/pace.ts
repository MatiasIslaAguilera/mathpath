// Pace toward the program: how fast core skills become solid, and whether that reaches the whole
// tree by the learner's target date. Pure functions of Progress (PLAN §8, pace).

import { hasSkill } from '../engine/registry';
import { TREE } from '../skills/tree';
import { emptySkill, type Progress } from '../storage/progress';
import { isFoundation } from './states';

const WEEK_MS = 7 * 86_400_000;
/** A pace from less than this much history is noise. */
const MIN_WEEKS = 1;

export interface PaceReport {
  /** Core skills in the tree (optional and GRE excluded), built or not. */
  total: number;
  /** Core skills solid enough to build on. */
  solid: number;
  remaining: number;
  /** Solid skills per week since the first answer; undefined in the first week. */
  perWeek?: number;
  /** When the whole tree is solid at this pace (YYYY-MM-DD). */
  projected?: string;
  /** With a target date: */
  target?: string;
  weeksLeft?: number;
  neededPerWeek?: number;
  onPace?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function paceReport(p: Progress, now = new Date()): PaceReport {
  const core = TREE.filter((n) => !n.optional && n.track !== 'gre');
  const solid = core.filter((n) => hasSkill(n.id) && isFoundation(p.skills[n.id] ?? emptySkill())).length;
  const remaining = core.length - solid;
  const report: PaceReport = { total: core.length, solid, remaining };

  const started = Object.values(p.skills).some((s) => s.attempts > 0);
  const weeks = started ? (now.getTime() - new Date(p.createdAt).getTime()) / WEEK_MS : 0;
  if (weeks >= MIN_WEEKS && solid > 0) {
    report.perWeek = solid / weeks;
    report.projected = key(new Date(now.getTime() + (remaining / report.perWeek) * WEEK_MS));
  }

  const target = p.settings.targetDate;
  if (target && /^\d{4}-\d{2}-\d{2}$/.test(target)) {
    const [y, m, d] = target.split('-').map(Number);
    const weeksLeft = (new Date(y, m - 1, d).getTime() - now.getTime()) / WEEK_MS;
    report.target = target;
    report.weeksLeft = Math.max(0, weeksLeft);
    report.neededPerWeek = weeksLeft > 0 ? remaining / weeksLeft : remaining > 0 ? Infinity : 0;
    if (report.perWeek !== undefined) report.onPace = report.perWeek >= report.neededPerWeek;
  }
  return report;
}

/** One line for Home, or null when there is no target date. Never a reproach: it states the gap and the pace that closes it. */
export function paceLine(r: PaceReport): string | null {
  if (!r.target || r.neededPerWeek === undefined) return null;
  if (r.remaining === 0) return 'Every core skill is solid.';
  const need = Number.isFinite(r.neededPerWeek) ? r.neededPerWeek.toFixed(1) : null;
  if (!need) return `Target date passed with ${r.remaining} skills to go. Set a new one in Settings.`;
  if (r.perWeek === undefined) return `${r.remaining} skills to go: ${need} a week reaches your target.`;
  return r.onPace
    ? `On pace: ${r.perWeek.toFixed(1)} skills a week, ${need} needed.`
    : `${r.perWeek.toFixed(1)} skills a week so far; ${need} a week reaches your target.`;
}
