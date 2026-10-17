// Shared harness: runs every registered skill × level × N seeds (default 1000; set SEEDS=…).
// A new skill gets all of these checks automatically once it is in src/skills/index.ts.

import { existsSync } from 'node:fs';
import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { checkAnswer } from '../src/engine/checker';
import { matchMisconception } from '../src/engine/misconceptions';
import { makeProblem, SKILLS } from '../src/engine/registry';
import { parseRichText } from '../src/engine/richtext';
import { LEVELS, type AnswerInput, type AnswerSpec, type Problem, type SkillDefinition } from '../src/engine/types';
import { verifyAnswer } from './verify-check';

const N = Number(process.env.SEEDS ?? 1000);
const KATEX_SEEDS = 40;

const inputOf = (a: AnswerSpec): AnswerInput =>
  a.kind === 'tuple' ? a.values : a.kind === 'choice' ? a.correct : a.kind === 'multi' ? a.correct : a.value;

function renderLatex(latex: string, where: string) {
  try {
    katex.renderToString(latex, { throwOnError: true, displayMode: true });
  } catch (e) {
    throw new Error(`KaTeX failed in ${where}: ${latex}\n${(e as Error).message}`);
  }
}
function renderRich(text: string, where: string) {
  for (const seg of parseRichText(text)) if (seg.type === 'math') renderLatex(seg.value, where);
}
function answerLatex(a: AnswerSpec, where: string) {
  if (a.kind === 'choice' || a.kind === 'multi') a.options.forEach((o) => renderRich(o.label, where));
  else renderLatex(a.display, where);
}

function denominatorOf(value: string): number {
  const m = value.match(/^-?\d+(?:\/(\d+))?$/);
  if (!m) throw new Error(`answer value "${value}" is not an exact integer or fraction`);
  return m[1] ? Number(m[1]) : 1;
}

function checkProblem(skill: SkillDefinition, p: Problem, seed: number) {
  const ctx = `${p.id}`;
  // 1. Parameters stay inside the declared ranges for this level.
  const ranges = skill.levels[p.level].ranges;
  expect(Object.keys(p.params).sort(), `${ctx} params vs declared ranges`).toEqual(Object.keys(ranges).sort());
  for (const [k, v] of Object.entries(p.params)) {
    const [lo, hi] = ranges[k];
    if (!(v >= lo && v <= hi)) throw new Error(`${ctx}: param ${k}=${v} outside [${lo}, ${hi}]`);
  }

  // 2. The answer satisfies the problem statement (independent check).
  const err = verifyAnswer(p.verify, p.answer);
  if (err) throw new Error(`${ctx}: answer fails verification: ${err}`);
  expect(checkAnswer(p.answer, inputOf(p.answer)).correct, `${ctx} checker accepts own answer`).toBe(true);

  // Figures: well-formed, described, and never scripted.
  if (p.figure?.kind === 'svg') {
    const svg = p.figure.svg.trim();
    if (!svg.startsWith('<svg') || !svg.endsWith('</svg>') || /<script|\son\w+\s*=|javascript:/i.test(svg)) throw new Error(`${ctx}: malformed or unsafe SVG figure`);
    if (!p.figure.alt.trim()) throw new Error(`${ctx}: figure needs alt text`);
  }
  if (p.figure?.kind === 'table') {
    for (const row of p.figure.rows) expect(row.length, `${ctx} table row width`).toBe(p.figure.headers.length);
  }
  if (p.answer.kind === 'multi') {
    expect(p.answer.correct.length, `${ctx} select-all needs at least one correct option`).toBeGreaterThan(0);
    expect(p.verify.type, `${ctx} select-all answers use a 'choice' verify + skill test`).toBe('choice');
  }

  if (p.verify.type === 'choice' && !existsSync(`tests/skills/${skill.id}.test.ts`)) {
    throw new Error(`${ctx}: multiple-choice answers need tests/skills/${skill.id}.test.ts to re-derive the correct option`);
  }

  // 3. Clean answers (irrational-answer skills may use exact expressions like log(5)/2).
  if (p.answer.kind === 'number' || p.answer.kind === 'tuple') {
    const vals = p.answer.kind === 'number' ? [p.answer.value] : p.answer.values;
    for (const v of vals) {
      if (skill.irrationalAnswers && !/^-?\d+(?:\/\d+)?$/.test(v)) continue;
      if (denominatorOf(v) > skill.maxDenominator) throw new Error(`${ctx}: answer ${v} exceeds maxDenominator ${skill.maxDenominator}`);
    }
  }

  // 4. Steps: complete, each ask independently correct, last step = the answer.
  expect(p.steps.length, `${ctx} has steps`).toBeGreaterThanOrEqual(2);
  p.steps.forEach((s, i) => {
    const where = `${ctx} step ${i}`;
    if (!skill.stepLabels[s.key]) throw new Error(`${where}: step key "${s.key}" has no entry in stepLabels`);
    if (!s.key || !s.instruction.trim() || !s.math.trim() || !s.why.trim()) throw new Error(`${where}: missing key/instruction/math/why`);
    if (!s.ask) return;
    const a = s.ask.answer;
    if (a.kind === 'choice') {
      expect(a.options.map((o) => o.id), where).toContain(a.correct);
      return;
    }
    if (a.kind === 'multi') {
      for (const id of a.correct) expect(a.options.map((o) => o.id), where).toContain(id);
      return;
    }
    if (!s.ask.verify) throw new Error(`${where}: non-choice ask needs a verify spec`);
    const stepErr = verifyAnswer(s.ask.verify, a);
    if (stepErr) throw new Error(`${where}: ${stepErr}`);
    expect(checkAnswer(a, inputOf(a)).correct, `${where} checker accepts step answer`).toBe(true);
  });
  const last = p.steps[p.steps.length - 1].ask;
  if (!last) throw new Error(`${ctx}: final step must ask for the answer`);
  expect(checkAnswer(p.answer, inputOf(last.answer)).correct, `${ctx} final step equals answer`).toBe(true);

  // 5. Misconceptions are known, distinct from the answer, and diagnosable.
  for (const m of p.misconceptions) {
    expect(skill.misconceptions[m.id], `${ctx} misconception ${m.id} is defined`).toBeDefined();
    expect(checkAnswer(p.answer, inputOf(m.wrong)).correct, `${ctx} ${m.id} must not be correct`).toBe(false);
    expect(matchMisconception(p, inputOf(m.wrong)), `${ctx} ${m.id} matches itself`).toBe(m.id);
  }

  // 6. Interpretation questions are well formed.
  for (const iq of p.interpretation ?? []) {
    expect(iq.options.map((o) => o.id), ctx).toContain(iq.correct);
    expect(new Set(iq.options.map((o) => o.label)).size, `${ctx} distinct options`).toBe(iq.options.length);
  }

  // 7. All LaTeX renders (sampled: KaTeX is slow).
  if (seed <= KATEX_SEEDS) {
    renderRich(p.prompt, `${ctx} prompt`);
    if (p.figure?.kind === 'table') {
      renderRich(p.figure.caption, `${ctx} table caption`);
      [...p.figure.headers, ...p.figure.rows.flat()].forEach((c) => renderRich(c, `${ctx} table cell`));
    }
    answerLatex(p.answer, `${ctx} answer`);
    p.steps.forEach((s, i) => {
      renderRich(s.instruction, `${ctx} step ${i} instruction`);
      renderLatex(s.math, `${ctx} step ${i} math`);
      renderRich(s.why, `${ctx} step ${i} why`);
      if (s.ask) {
        renderRich(s.ask.prompt, `${ctx} step ${i} ask`);
        answerLatex(s.ask.answer, `${ctx} step ${i} ask answer`);
      }
    });
    p.misconceptions.forEach((m) => answerLatex(m.wrong, `${ctx} misconception ${m.id}`));
    for (const iq of p.interpretation ?? []) {
      renderRich(iq.prompt, `${ctx} interpretation`);
      iq.options.forEach((o) => renderRich(o.label, `${ctx} interpretation option`));
      renderRich(iq.explanation, `${ctx} interpretation explanation`);
    }
  }
}

describe.each(SKILLS.map((s) => [s.id, s] as const))('%s', (_id, skill) => {
  it('has complete metadata and a renderable Learn card', () => {
    expect(skill.title).toBeTruthy();
    expect(LEVELS.every((l) => skill.levels[l])).toBe(true);
    renderRich(skill.learn.summary, 'learn summary');
    expect(skill.learn.whyItMatters.length, 'whyItMatters is written').toBeGreaterThan(120);
    expect(skill.learn.whyItMatters).not.toMatch(/TODO/);
    renderRich(skill.learn.whyItMatters, 'learn whyItMatters');
    skill.learn.formulas.forEach((f) => {
      renderLatex(f.latex, 'learn formula');
      if (f.note) renderRich(f.note, 'learn note');
    });
    (skill.learn.tips ?? []).forEach((t) => renderRich(t, 'learn tip'));
    for (const [id, m] of Object.entries(skill.misconceptions)) {
      expect(m.name, id).toBeTruthy();
      renderRich(m.explanation, `misconception ${id}`);
    }
  });

  it.each([...LEVELS])(`level %i: ${N} seeds`, (level) => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, level, seed);
      checkProblem(skill, p, seed);
      seen.add(p.prompt);
    }
    // Variety: at least ~30 distinct prompts per 100, so a level doesn't repeat within a session or two.
    expect(seen.size, 'distinct prompts').toBeGreaterThan(Math.min(N, 100) * 0.3);
  });

  it('is deterministic for a given seed', () => {
    for (const level of LEVELS) {
      expect(makeProblem(skill, level, 42)).toEqual(makeProblem(skill, level, 42));
    }
  });

  it('every misconception is reachable at some level', () => {
    const hit = new Set<string>();
    for (const level of LEVELS) for (let seed = 1; seed <= 200; seed++) makeProblem(skill, level, seed).misconceptions.forEach((m) => hit.add(m.id));
    expect([...Object.keys(skill.misconceptions)].filter((id) => !hit.has(id))).toEqual([]);
  });
});
