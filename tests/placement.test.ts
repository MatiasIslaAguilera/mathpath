import { describe, expect, it } from 'vitest';
import { activePrerequisites, getSkill, hasSkill, makeProblem, SKILLS } from '../src/engine/registry';
import {
  answerPlacementItem,
  applyPlacement,
  MAX_ITEMS,
  nextPlacementItem,
  placementDone,
  startPlacement,
  type PlacementState,
} from '../src/learning/placement';
import { todaysAgenda, startSession } from '../src/learning/session';
import { skillState } from '../src/learning/states';
import { isUnlocked, lockedBy } from '../src/learning/unlock';
import { SKILLS as REGISTERED } from '../src/skills';
import { builtAncestors, resolvePrerequisites, TREE, treeNode } from '../src/skills/tree';
import { emptyProgress, emptySkill } from '../src/storage/progress';

const LIN = 'linear-equations';
const DER = 'derivatives-power-rule';
const SND = 'supply-demand-equilibrium';

/** Run the whole test, answering by a rule. Returns final state and the skills asked, in order. */
function run(answer: (skillId: string, i: number) => boolean | 'skip') {
  let st: PlacementState = startPlacement();
  const asked: string[] = [];
  for (let i = 0; i < 100; i++) {
    const n = nextPlacementItem(st, 1000 + i);
    if (!n) break;
    asked.push(n.problem.skillId);
    const a = answer(n.problem.skillId, i);
    st = answerPlacementItem(n.state, n.problem, a === true, a === 'skip');
  }
  expect(placementDone(st)).toBe(true);
  return { st, asked };
}

describe('skill tree', () => {
  it('lists every registered skill with matching prerequisites, in topological order', () => {
    for (const s of REGISTERED) {
      expect(treeNode(s.id), s.id).toBeDefined();
      expect(s.prerequisites, s.id).toEqual(treeNode(s.id)!.prerequisites);
      expect(s.track, s.id).toBe(treeNode(s.id)!.track);
    }
    const seen = new Set<string>();
    for (const n of TREE) {
      for (const p of n.prerequisites) expect(seen.has(p), `${n.id} after ${p}`).toBe(true);
      seen.add(n.id);
    }
    expect(seen.size).toBe(TREE.length); // unique ids
  });

  it('resolves prerequisites through unbuilt skills', () => {
    const built = (id: string) => [LIN, DER, SND].includes(id);
    expect(resolvePrerequisites(DER, built)).toEqual([LIN]); // via limits/functions and exponent rules
    expect(resolvePrerequisites(SND, built)).toEqual([LIN]);
    expect(resolvePrerequisites('elasticity', built).sort()).toEqual([DER, SND].sort());
  });
});

describe('prerequisite locks', () => {
  it('locks skills until their (resolved) prerequisites are practiced', () => {
    const p = emptyProgress();
    expect(isUnlocked(p, LIN)).toBe(true);
    const prereqs = activePrerequisites(getSkill(DER));
    expect(prereqs.length).toBeGreaterThan(0);
    expect(lockedBy(p, DER).sort()).toEqual([...prereqs].sort());
    for (const id of prereqs) p.skills[id] = { ...emptySkill(), rating: 1.5, attempts: 6 };
    expect(isUnlocked(p, DER)).toBe(true);
  });
  it('never re-locks a skill you already started', () => {
    const p = emptyProgress();
    p.skills[DER] = { ...emptySkill(), attempts: 3 };
    expect(isUnlocked(p, DER)).toBe(true);
  });
});

// These are properties of the search, so they hold however many skills are registered.
const ids = SKILLS.map((s) => s.id);
const ancestorsOf = (id: string) => builtAncestors(id, hasSkill);
const SOLID = ['passed', 'credited'];

describe('placement test', () => {
  it('starts with the middle skill of the tree (binary search)', () => {
    const { asked } = run(() => true);
    expect(asked[0]).toBe(ids[Math.floor((ids.length - 1) / 2)]);
  });

  it('acing it places every skill, using fewer items than testing each one', () => {
    const { st, asked } = run(() => true);
    for (const id of ids) expect(SOLID, id).toContain(st.results[id]);
    expect(asked.length).toBeLessThan(2 * ids.length);
    expect(asked.length).toBeLessThanOrEqual(MAX_ITEMS);
  });

  it('failing everything places nothing; blocked skills always have a non-solid ancestor', () => {
    const { st } = run(() => false);
    for (const id of ids) {
      expect(['failed', 'blocked'], id).toContain(st.results[id]);
      if (st.results[id] === 'blocked') expect(ancestorsOf(id).some((a) => !SOLID.includes(st.results[a])), id).toBe(true);
    }
  });

  it("is consistent for any answer pattern: a placed skill's prerequisites are placed too", () => {
    for (let pattern = 0; pattern < 40; pattern++) {
      const { st } = run((_id, i) => (pattern * 7 + i * 3) % 5 < 3);
      for (const id of ids) {
        if (SOLID.includes(st.results[id])) for (const a of ancestorsOf(id)) expect(SOLID, `${id} <- ${a}`).toContain(st.results[a]);
        expect(st.results[id], id).not.toBe('untested');
      }
    }
  });

  it('"I don\'t know" ends a probe after one item', () => {
    const { st, asked } = run(() => 'skip');
    const probed = ids.filter((id) => st.results[id] === 'failed');
    expect(asked).toHaveLength(probed.length);
    expect(new Set(asked).size).toBe(asked.length);
  });

  it('1 of 2 is partial: start at level 2', () => {
    let first: string | undefined;
    let k = 0;
    const { st } = run((id) => {
      first ??= id;
      return id === first ? k++ === 0 : true;
    });
    expect(st.results[first!]).toBe('partial');
    const p = applyPlacement(emptyProgress(), st, new Date(2026, 9, 17));
    expect(skillState(p.skills[first!])).toBe('learning');
  });

  it('applying results makes placed skills practiced, unlocks what follows, and schedules a review', () => {
    const { st } = run(() => true);
    const now = new Date(2026, 9, 17, 9);
    const p = applyPlacement(emptyProgress(), st, now);
    for (const id of ids) {
      expect(skillState(p.skills[id]), id).toBe('practiced');
      expect(isUnlocked(p, id), id).toBe(true);
    }
    expect(p.onboarding).toBe('placed');
    expect(p.placement!.items.length).toBeGreaterThan(0);
    // The first spaced review checks the placement a few days later.
    expect(todaysAgenda(p, now).reviewsDue).toEqual([]);
    expect(todaysAgenda(p, new Date(2026, 9, 30)).reviewsDue.length).toBeGreaterThan(0);
  });

  it('after placement the session works on something not yet placed', () => {
    const { st } = run((id) => id === ids[0]); // only the very first skill is known
    const p = applyPlacement(emptyProgress(), st);
    const current = startSession(p, 10).currentSkill!;
    expect(SOLID).not.toContain(st.results[current]);
  });

  it('retaking never lowers a rating or removes mastery', () => {
    const p = emptyProgress();
    p.skills[DER] = { ...emptySkill(), rating: 3, attempts: 40, readyAt: '2026-10-01', masteredAt: '2026-10-04' };
    const { st } = run(() => false);
    const after = applyPlacement(p, st);
    expect(after.skills[DER].rating).toBe(3);
    expect(skillState(after.skills[DER])).toBe('mastered');
  });

  it('asks level-3 problems', () => {
    const n = nextPlacementItem(startPlacement(), 5)!;
    expect(n.problem.level).toBe(3);
    expect(n.problem).toEqual(makeProblem(getSkill(n.problem.skillId), 3, 5));
  });
});
