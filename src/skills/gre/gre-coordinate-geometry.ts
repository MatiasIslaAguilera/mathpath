// GRE Coordinate geometry. Formats: numeric entry (L1-L4), multiple choice (L1 form 2, L3 form 3),
// quantitative comparison (L5). Every problem with a picture uses planeFigure (engine/figures.ts).
// QC relations are exact: variable-free comparisons use exact integer arithmetic; the one
// variable QC (quadrant signs) is a proven sign argument.

import { choiceAnswer, numberAnswer, qcAnswer, wrongNumber, type QcRelation } from '../../engine/answers';
import { linLatex } from '../../engine/format';
import { planeFigure } from '../../engine/figures';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { AnswerSpec, ChoiceOption, Level, SkillDefinition } from '../../engine/types';

const ID = 'gre-coordinate-geometry';
type Body = ReturnType<SkillDefinition['generate']>;

const QC_PROMPT = (setup: string, A: string, B: string) =>
  `${setup ? `${setup}\n\n` : ''}**Quantity A:** ${A}\n\n**Quantity B:** ${B}\n\nCompare Quantity A and Quantity B.`;
const par = (n: number) => (n < 0 ? `(${n})` : `${n}`);
const rel = (a: number, b: number): QcRelation => (a > b ? 'a' : a < b ? 'b' : 'c');
const pt = (x: number, y: number) => `(${x}, ${y})`;

/** Multiple choice from {label, key} items: shuffled after all math is done. Returns null if labels collide. */
function buildChoice(rng: Rng, items: { label: string; key: string }[], correctKey: string) {
  if (new Set(items.map((i) => i.label)).size !== items.length) return null;
  const shuffled = rng.shuffle(items);
  const options: ChoiceOption[] = shuffled.map((it, i) => ({ id: `o${i}`, label: it.label }));
  const idOf = (key: string) => options[shuffled.findIndex((s) => s.key === key)].id;
  return { options, answer: choiceAnswer(options, idOf(correctKey)) as AnswerSpec, idOf };
}

/** a x + b y = c as LaTeX (a, b nonzero). */
function eqnLatex(a: number, b: number, c: number): string {
  const t = (k: number, v: string) => (Math.abs(k) === 1 ? '' : Math.abs(k)) + v;
  return `${a < 0 ? '-' : ''}${t(a, 'x')} ${b < 0 ? '-' : '+'} ${t(b, 'y')} = ${c}`;
}

/** Choose starting coordinate so that both start and start+d stay within [-R, R]. */
function place(rng: Rng, d: number, R: number): number {
  return d >= 0 ? rng.int(-R, R - d) : rng.int(-R - d, R);
}

// ---------- level 1: slope and the line equation ----------

function level1(rng: Rng): Body {
  for (;;) {
    const form = rng.int(0, 2);
    const qd = rng.int(1, 3);
    const pn = rng.nonzero(-6, 6);
    const k = rng.int(1, 2);
    const sx = rng.chance(0.5) ? 1 : -1;
    const dx = sx * qd * k;
    const dy = pn * k;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) continue;
    if (Math.abs(dx) + Math.abs(dy) < 3) continue;
    const x1 = place(rng, dx, 6);
    const y1 = place(rng, dy, 6);
    const x2 = x1 + dx;
    const y2 = y1 + dy;
    const m = new Q(dy, dx);
    const b = new Q(y1).sub(m.mul(x1));
    const inv = new Q(dx, dy);
    const bInv = new Q(y1).sub(inv.mul(x1));
    const fig = planeFigure({
      range: 8,
      points: [
        { at: [x1, y1], label: 'A' },
        { at: [x2, y2], label: 'B' },
      ],
      lines: [{ m: Number(m), b: Number(b) }],
      alt: `Coordinate plane with points A${pt(x1, y1)} and B${pt(x2, y2)} and the line through them.`,
    });
    const slopeExpr = `((${y2}) - (${y1}))/((${x2}) - (${x1}))`;
    const slopeSteps = (finalAsk: boolean) => ({
      key: 'rise-run',
      instruction: `Slope = rise ÷ run = (y₂ − y₁) ÷ (x₂ − x₁), with the points in the SAME order top and bottom.`,
      math: `m = \\frac{${y2} - ${par(y1)}}{${x2} - ${par(x1)}} = \\frac{${dy}}{${dx}} = ${m.toLatex()}`,
      why: 'Rise (change in y) goes on top; run (change in x) goes on the bottom.',
      ask: finalAsk
        ? { prompt: `What is the slope of the line through $A$ and $B$?`, answer: numberAnswer(m), verify: { type: 'evaluate' as const, expr: slopeExpr } }
        : { prompt: `What is the rise, $y_2 - y_1$?`, answer: numberAnswer(dy), verify: { type: 'evaluate' as const, expr: `(${y2}) - (${y1})` } },
    });
    const setup = `Line $\\ell$ passes through $A${pt(x1, y1)}$ and $B${pt(x2, y2)}$.`;
    if (form === 0) {
      const answer = numberAnswer(m);
      return {
        params: { form, x1, y1, x2, y2 },
        prompt: `${setup} What is the slope of $\\ell$?`,
        figure: fig,
        answer,
        steps: [slopeSteps(false), { ...slopeSteps(true), key: 'slope' }],
        misconceptions: distinctMisconceptions(answer, [wrongNumber('slope-inverted', () => inv)]),
        verify: { type: 'evaluate', expr: slopeExpr },
      };
    }
    const bExpr = `(${y1}) - ${slopeExpr}*(${x1})`;
    if (form === 1) {
      const answer = numberAnswer(b);
      return {
        params: { form, x1, y1, x2, y2 },
        prompt: `${setup} At what $y$-value does $\\ell$ cross the $y$-axis?`,
        figure: fig,
        answer,
        steps: [
          slopeSteps(true),
          {
            key: 'intercept',
            instruction: `Use $y = mx + b$ with one point: $b = y - mx$.`,
            math: `b = ${y1} - (${m.toLatex()})(${x1}) = ${b.toLatex()}`,
            why: 'Once you know the slope, plug in any point on the line to get b.',
            ask: { prompt: `What is the $y$-intercept?`, answer, verify: { type: 'evaluate', expr: bExpr } },
          },
        ],
        misconceptions: distinctMisconceptions(answer, [wrongNumber('slope-inverted', () => bInv)]),
        verify: { type: 'evaluate', expr: bExpr },
      };
    }
    // form 2: multiple choice
    const lab = (s: Q, t: Q) => `$y = ${linLatex(s, t)}$`;
    const items = [
      { key: 'ok', label: lab(m, b) },
      { key: 'inv', label: lab(inv, bInv) },
      { key: 'negb', label: lab(m, b.neg()) },
      { key: 'negm', label: lab(m.neg(), b) },
      { key: 'ycoord', label: lab(m, new Q(y1)) },
    ];
    if (dy === 0 || m.eq(inv)) continue;
    const ch = buildChoice(rng, items, 'ok');
    if (!ch) continue;
    return {
      params: { form, x1, y1, x2, y2 },
      prompt: `${setup} Which of the following is an equation of $\\ell$?`,
      figure: fig,
      answer: ch.answer,
      steps: [
        slopeSteps(true),
        {
          key: 'intercept',
          instruction: `Find b from a point, or back-solve: test point $A$ in each option.`,
          math: `${y1} = ${m.toLatex()}(${x1}) + b \\Rightarrow b = ${b.toLatex()}`,
          why: 'Back-solving: a correct equation must be satisfied by BOTH given points.',
          ask: { prompt: 'Which equation is it?', answer: ch.answer },
        },
      ],
      misconceptions: distinctMisconceptions(ch.answer, [
        { id: 'slope-inverted', wrong: choiceAnswer(ch.options, ch.idOf('inv')) },
      ]),
      verify: { type: 'choice', note: 'tests/skills/gre-coordinate-geometry.test.ts checks both points satisfy the correct option' },
    };
  }
}

// ---------- level 2: distance and midpoint ----------

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [6, 8, 10],
  [9, 12, 15],
];

function level2(rng: Rng): Body {
  const [ta, tb, h] = rng.pick(TRIPLES);
  const swap = rng.chance(0.5);
  const dx = (swap ? tb : ta) * (rng.chance(0.5) ? 1 : -1);
  const dy = (swap ? ta : tb) * (rng.chance(0.5) ? 1 : -1);
  const x1 = place(rng, dx, 8);
  const y1 = place(rng, dy, 8);
  const x2 = x1 + dx;
  const y2 = y1 + dy;
  // keep points clear of the axis letters drawn at the ends of the axes
  if ([[x1, y1], [x2, y2]].some(([px, py]) => (px >= 7 && Math.abs(py) <= 1) || (py >= 7 && Math.abs(px) <= 1))) return level2(rng);
  const form = rng.int(0, 2);
  const mm = new Q(dy, dx);
  const bb = new Q(y1).sub(mm.mul(x1));
  const setup = `Points $A${pt(x1, y1)}$ and $B${pt(x2, y2)}$ lie in the $xy$-plane.`;
  const fig = planeFigure({
    range: 10,
    points: [
      { at: [x1, y1], label: 'A' },
      { at: [x2, y2], label: 'B' },
    ],
    lines: [{ m: Number(mm), b: Number(bb) }],
    alt: `Coordinate plane with points A${pt(x1, y1)} and B${pt(x2, y2)} and the line through them.`,
  });
  if (form === 0) {
    const expr = `sqrt(((${x2}) - (${x1}))^2 + ((${y2}) - (${y1}))^2)`;
    const answer = numberAnswer(h);
    return {
      params: { form, x1, y1, x2, y2 },
      prompt: `${setup} What is the distance between $A$ and $B$?`,
      figure: fig,
      answer,
      steps: [
        {
          key: 'legs',
          instruction: 'Treat the segment as the hypotenuse of a right triangle: horizontal leg |Δx|, vertical leg |Δy|.',
          math: `|\\Delta x| = ${Math.abs(dx)}, \\quad |\\Delta y| = ${Math.abs(dy)}`,
          why: 'The distance formula is just the Pythagorean theorem. Look for a triple like 3-4-5 or 5-12-13.',
          ask: { prompt: `What is $|\\Delta x|$?`, answer: numberAnswer(Math.abs(dx)), verify: { type: 'evaluate', expr: `abs((${x2}) - (${x1}))` } },
        },
        {
          key: 'distance',
          instruction: 'Apply $d = \\sqrt{(\\Delta x)^2 + (\\Delta y)^2}$.',
          math: `d = \\sqrt{${dx * dx} + ${dy * dy}} = \\sqrt{${h * h}} = ${h}`,
          why: 'Take the square root at the end.',
          ask: { prompt: 'What is the distance?', answer, verify: { type: 'evaluate', expr } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('distance-no-square-root', () => h * h)]),
      verify: { type: 'evaluate', expr },
    };
  }
  if (form === 1) {
    const axis = rng.int(0, 1); // 0: x-coordinate, 1: y-coordinate
    const [u1, u2] = axis === 0 ? [x1, x2] : [y1, y2];
    const mid = new Q(u1 + u2, 2);
    const answer = numberAnswer(mid);
    const expr = `((${u1}) + (${u2}))/2`;
    const name = axis === 0 ? 'x' : 'y';
    return {
      params: { form, x1, y1, x2, y2 },
      prompt: `${setup} What is the ${name}-coordinate of the midpoint of segment $AB$?`,
      figure: fig,
      answer,
      steps: [
        {
          key: 'sum',
          instruction: `Add the two ${name}-coordinates.`,
          math: `${u1} + (${u2}) = ${u1 + u2}`,
          why: 'The midpoint is the average of the endpoints, coordinate by coordinate.',
          ask: { prompt: `What is the sum of the ${name}-coordinates?`, answer: numberAnswer(u1 + u2), verify: { type: 'evaluate', expr: `(${u1}) + (${u2})` } },
        },
        {
          key: 'halve',
          instruction: 'Divide by 2.',
          math: `\\frac{${u1 + u2}}{2} = ${mid.toLatex()}`,
          why: 'Average = sum ÷ 2.',
          ask: { prompt: `What is the ${name}-coordinate of the midpoint?`, answer, verify: { type: 'evaluate', expr } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('midpoint-not-halved', () => u1 + u2)]),
      verify: { type: 'evaluate', expr },
    };
  }
  // form 2: M is the midpoint of AB, A and M given; find B's x- or y-coordinate
  const axis = rng.int(0, 1);
  const [u1, u2] = axis === 0 ? [x1, x2] : [y1, y2];
  const um = new Q(u1 + u2, 2);
  const name = axis === 0 ? 'x' : 'y';
  const mx = new Q(x1 + x2, 2);
  const my = new Q(y1 + y2, 2);
  const answer = numberAnswer(u2);
  const expr = `2*(${um.toString()}) - (${u1})`;
  const figM = planeFigure({
    range: 10,
    points: [
      { at: [x1, y1], label: 'A' },
      { at: [Number(mx), Number(my)], label: 'M' },
    ],
    alt: `Coordinate plane with point A${pt(x1, y1)} and the midpoint M of segment AB at (${mx.toString()}, ${my.toString()}).`,
  });
  return {
    params: { form, x1, y1, x2, y2 },
    prompt: `$M$ is the midpoint of segment $AB$. $A = ${pt(x1, y1)}$ and $M = (${mx.toLatex()}, ${my.toLatex()})$. What is the ${name}-coordinate of $B$?`,
    figure: figM,
    answer,
    steps: [
      {
        key: 'double',
        instruction: `The midpoint is the average, so ${name}_M = (${name}_A + ${name}_B)/2. Double the midpoint's ${name}-coordinate.`,
        math: `2(${um.toString()}) = ${u1 + u2}`,
        why: 'Undo the "divide by 2" first: A + B = 2M.',
        ask: { prompt: `What is $2 \\times ${name}_M$?`, answer: numberAnswer(u1 + u2), verify: { type: 'evaluate', expr: `2*(${um.toString()})` } },
      },
      {
        key: 'subtract',
        instruction: `Subtract A's ${name}-coordinate.`,
        math: `${u1 + u2} - (${u1}) = ${u2}`,
        why: 'B = 2M − A.',
        ask: { prompt: `What is the ${name}-coordinate of $B$?`, answer, verify: { type: 'evaluate', expr } },
      },
    ],
    misconceptions: [],
    verify: { type: 'evaluate', expr },
  };
}

// ---------- level 3: parallel and perpendicular ----------

function level3(rng: Rng): Body {
  for (;;) {
    const form = rng.int(0, 3);
    const a = rng.nonzero(-6, 6);
    const b = rng.nonzero(-6, 6);
    if (Math.abs(a) === Math.abs(b)) continue;
    const c = rng.int(-12, 12);
    const m = new Q(-a, b);
    const perp = new Q(b, a);
    const eq = eqnLatex(a, b, c);
    const base = { form, a, b, c, x0: 0, y0: 0 };
    if (form === 0) {
      const answer = numberAnswer(perp);
      return {
        params: base,
        prompt: `What is the slope of a line perpendicular to the line $${eq}$?`,
        answer,
        steps: [
          {
            key: 'slope-given',
            instruction: `Solve for y to read off the slope: $y = ${linLatex(m, new Q(c, b))}$.`,
            math: `${b}y = ${-a}x + ${c} \\Rightarrow m = ${m.toLatex()}`,
            why: 'For ax + by = c the slope is −a/b.',
            ask: { prompt: 'What is the slope of the given line?', answer: numberAnswer(m), verify: { type: 'evaluate', expr: `-(${a})/(${b})` } },
          },
          {
            key: 'negative-reciprocal',
            instruction: 'Perpendicular slopes are negative reciprocals: flip AND change the sign.',
            math: `-\\frac{1}{${m.toLatex()}} = ${perp.toLatex()}`,
            why: 'Perpendicular slopes multiply to −1.',
            ask: { prompt: 'What is the slope of a perpendicular line?', answer, verify: { type: 'solve', equations: [`s*(-(${a})/(${b})) = -1`], unknowns: ['s'] } },
          },
        ],
        misconceptions: distinctMisconceptions(answer, [wrongNumber('perpendicular-not-negated', () => perp.neg())]),
        verify: { type: 'solve', equations: [`s*(-(${a})/(${b})) = -1`], unknowns: ['s'] },
      };
    }
    if (form === 1 || form === 2) {
      // keep the y-intercept a clean fraction: x0 multiple of the slope denominators
      const x0 = rng.int(-3, 3) * (form === 1 ? b : a);
      const y0 = rng.int(-6, 6);
      const slope = form === 1 ? m : perp;
      const yint = new Q(y0).sub(slope.mul(x0));
      const wrongSlope = form === 1 ? null : perp.neg();
      const answer = numberAnswer(yint);
      const expr = form === 1 ? `(${y0}) - (-(${a})/(${b}))*(${x0})` : `(${y0}) - ((${b})/(${a}))*(${x0})`;
      return {
        params: { form, a, b, c, x0, y0 },
        prompt: `Line $k$ is ${form === 1 ? 'parallel' : 'perpendicular'} to the line $${eq}$ and passes through $${pt(x0, y0)}$. At what $y$-value does $k$ cross the $y$-axis?`,
        answer,
        steps: [
          {
            key: 'slope-needed',
            instruction: form === 1 ? 'Parallel lines have the same slope as the given line.' : 'Perpendicular lines have the negative reciprocal slope.',
            math: `m_k = ${slope.toLatex()}`,
            why: form === 1 ? 'Parallel: equal slopes.' : 'Perpendicular: slopes multiply to −1.',
            ask: {
              prompt: `What is the slope of $k$?`,
              answer: numberAnswer(slope),
              verify: { type: 'evaluate', expr: form === 1 ? `-(${a})/(${b})` : `(${b})/(${a})` },
            },
          },
          {
            key: 'intercept',
            instruction: 'Use the point to find b: $b = y_0 - m x_0$.',
            math: `b = ${y0} - (${slope.toLatex()})(${x0}) = ${yint.toLatex()}`,
            why: 'Substitute a known point into y = mx + b.',
            ask: { prompt: `What is the $y$-intercept of $k$?`, answer, verify: { type: 'evaluate', expr } },
          },
        ],
        misconceptions: distinctMisconceptions(answer, [
          wrongSlope ? wrongNumber('perpendicular-not-negated', () => new Q(y0).sub(wrongSlope.mul(x0))) : null,
        ]),
        verify: { type: 'evaluate', expr },
      };
    }
    // form 3: multiple choice, which line is perpendicular
    const t = rng.int(-4, 4);
    const lab = (s: Q) => `$y = ${linLatex(s, t)}$`;
    const items = [
      { key: 'ok', label: lab(perp) },
      { key: 'parallel', label: lab(m) },
      { key: 'notneg', label: lab(perp.neg()) },
      { key: 'negonly', label: lab(m.neg()) },
      { key: 'other', label: lab(perp.add(1)) },
    ];
    const ch = buildChoice(rng, items, 'ok');
    if (!ch) continue;
    return {
      params: { form, a, b, c, x0: 0, y0: t },
      prompt: `Which of the following lines is perpendicular to the line $${eq}$?`,
      answer: ch.answer,
      steps: [
        {
          key: 'slope-given',
          instruction: `Find the slope of the given line: $${eq}$ has $m = ${m.toLatex()}$.`,
          math: `m = -\\frac{a}{b} = ${m.toLatex()}`,
          why: 'Rewrite as y = mx + b, or use m = −a/b.',
          ask: { prompt: 'What is the slope of the given line?', answer: numberAnswer(m), verify: { type: 'evaluate', expr: `-(${a})/(${b})` } },
        },
        {
          key: 'negative-reciprocal',
          instruction: 'The perpendicular slope is the negative reciprocal. Only the slope matters here: all options share the same intercept.',
          math: `-\\frac{1}{${m.toLatex()}} = ${perp.toLatex()}`,
          why: 'Flip AND negate. Flipping alone, or negating alone, are the two classic wrong options.',
          ask: { prompt: 'Which line is perpendicular?', answer: ch.answer },
        },
      ],
      misconceptions: distinctMisconceptions(ch.answer, [{ id: 'perpendicular-not-negated', wrong: choiceAnswer(ch.options, ch.idOf('notneg')) }]),
      verify: { type: 'choice', note: 'tests/skills/gre-coordinate-geometry.test.ts checks slope products equal -1' },
    };
  }
}

// ---------- level 4: intercepts and the triangle with the axes ----------

function level4(rng: Rng): Body {
  for (;;) {
    const form = rng.int(0, 2);
    const p = rng.nonzero(-7, 7); // x-intercept
    const q = rng.nonzero(-7, 7); // y-intercept
    if (Math.abs(p) === 1 && Math.abs(q) === 1) continue;
    const s = rng.int(1, 2);
    const a = s * q;
    const b = s * p;
    const c = s * p * q;
    const mm = new Q(-q, p);
    const fig = planeFigure({
      range: Math.max(Math.abs(p), Math.abs(q)) + 1,
      lines: [{ m: Number(mm), b: q, label: 'ℓ' }],
      alt: `Coordinate plane showing line ℓ crossing the x-axis at (${p}, 0) and the y-axis at (0, ${q}).`,
    });
    const area = new Q(Math.abs(p * q), 2);
    const params = { form, p, q, s };
    if (form === 1) {
      const answer = numberAnswer(p + q);
      const expr = `(${c})/(${a}) + (${c})/(${b})`;
      return {
        params,
        prompt: `The graph of $${eqnLatex(a, b, c)}$ is the line $\\ell$ shown. What is the sum of the $x$-intercept and the $y$-intercept of $\\ell$?`,
        figure: fig,
        answer,
        steps: [
          {
            key: 'x-intercept',
            instruction: 'Set y = 0 and solve for x.',
            math: `${a}x = ${c} \\Rightarrow x = ${p}`,
            why: 'On the x-axis, y = 0.',
            ask: { prompt: 'What is the x-intercept?', answer: numberAnswer(p), verify: { type: 'evaluate', expr: `(${c})/(${a})` } },
          },
          {
            key: 'y-intercept',
            instruction: 'Set x = 0 and solve for y, then add.',
            math: `${b}y = ${c} \\Rightarrow y = ${q}; \\quad ${p} + ${par(q)} = ${p + q}`,
            why: 'On the y-axis, x = 0.',
            ask: { prompt: 'What is the sum of the intercepts?', answer, verify: { type: 'evaluate', expr } },
          },
        ],
        misconceptions: [],
        verify: { type: 'evaluate', expr },
      };
    }
    const given = form === 0 ? `$${eqnLatex(a, b, c)}$` : `$y = ${linLatex(mm, q)}$`;
    const answer = numberAnswer(area);
    const expr = form === 0 ? `abs((${c})/(${a}))*abs((${c})/(${b}))/2` : `abs((${q})/(${mm.toString()}))*abs(${q})/2`;
    return {
      params,
      prompt: `The line ${given} and the two coordinate axes form a triangle. What is its area?`,
      figure: fig,
      answer,
      steps: [
        {
          key: 'intercepts',
          instruction: 'The legs of the right triangle are the intercepts (distances from the origin). Find where the line meets each axis.',
          math: `x\\text{-intercept } ${p}, \\quad y\\text{-intercept } ${q}`,
          why: 'Set y = 0 for the x-intercept and x = 0 for the y-intercept.',
          ask: { prompt: 'What is the length of the leg along the x-axis, |x-intercept|?', answer: numberAnswer(Math.abs(p)), verify: { type: 'evaluate', expr: form === 0 ? `abs((${c})/(${a}))` : `abs((${q})/(${mm.toString()}))` } },
        },
        {
          key: 'triangle-area',
          instruction: 'Area = ½ × base × height. Lengths are positive even if an intercept is negative.',
          math: `\\tfrac12 \\cdot ${Math.abs(p)} \\cdot ${Math.abs(q)} = ${area.toLatex()}`,
          why: 'The axes meet at a right angle, so the legs are base and height.',
          ask: { prompt: 'What is the area of the triangle?', answer, verify: { type: 'evaluate', expr } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('area-without-half', () => Math.abs(p * q))]),
      verify: { type: 'evaluate', expr },
    };
  }
}

// ---------- level 5: quantitative comparison from a graph ----------

function level5(rng: Rng): Body {
  for (;;) {
    const form = rng.chance(0.2) ? 2 : rng.int(0, 1);
    if (form === 2) {
      const quad = rng.int(1, 4); // quadrant
      const sx = quad === 1 || quad === 4 ? 1 : -1;
      const sy = quad === 1 || quad === 2 ? 1 : -1;
      const relation: QcRelation = sx * sy > 0 ? 'a' : 'b';
      const answer = qcAnswer(relation);
      return {
        params: { form, quad, x1: 0, y1: 0, x2: 0, y2: 0 },
        prompt: QC_PROMPT(`Point $P = (x, y)$ lies in Quadrant ${['I', 'II', 'III', 'IV'][quad - 1]} (not on either axis).`, '$xy$', '$0$'),
        answer,
        steps: [
          {
            key: 'signs',
            instruction: `In Quadrant ${['I', 'II', 'III', 'IV'][quad - 1]}, x is ${sx > 0 ? 'positive' : 'negative'} and y is ${sy > 0 ? 'positive' : 'negative'}.`,
            math: `x ${sx > 0 ? '>' : '<'} 0,\\; y ${sy > 0 ? '>' : '<'} 0 \\Rightarrow xy ${sx * sy > 0 ? '>' : '<'} 0`,
            why: 'The sign of a product depends only on the signs of the factors; no numbers are needed.',
            ask: { prompt: 'Is $xy$ positive or negative here?', answer: { kind: 'choice', options: [{ id: 'pos', label: 'Positive' }, { id: 'neg', label: 'Negative' }], correct: sx * sy > 0 ? 'pos' : 'neg' } },
          },
          { key: 'decide', instruction: 'Compare with 0.', math: relation === 'a' ? 'xy > 0' : 'xy < 0', why: 'Positive beats 0; negative loses.', ask: { prompt: 'So which is it?', answer } },
        ],
        misconceptions: [],
        verify: {
          type: 'qc',
          quantityA: 'x*y',
          quantityB: '0',
          variables: [
            { name: 'x', min: sx > 0 ? 0.01 : -10, max: sx > 0 ? 10 : -0.01 },
            { name: 'y', min: sy > 0 ? 0.01 : -10, max: sy > 0 ? 10 : -0.01 },
          ],
          constraints: [],
        },
      };
    }
    if (form === 0) {
      const x1 = rng.int(-6, 6);
      let x2 = rng.int(-6, 6);
      if (x2 === x1) x2 = x1 < 6 ? x1 + 1 : x1 - 1;
      const y1 = rng.int(-6, 6);
      // aim for slope near 1 so that all three relations (and 1 exactly) occur
      const target = rng.pick([1, 1, 2, -1, 3]);
      const tweak = rng.int(-1, 1);
      const y2 = Math.max(-6, Math.min(6, y1 + target * (x2 - x1) + tweak));
      if (Math.abs(x2 - x1) + Math.abs(y2 - y1) < 3) continue;
      const slope = new Q(y2 - y1, x2 - x1);
      const relation = rel(Number(slope.n) * 1, slope.d); // slope > 1  <=>  n > d (d > 0)
      const m = Number(slope);
      const answer = qcAnswer(relation);
      const fig = planeFigure({
        range: 8,
        points: [
          { at: [x1, y1] },
          { at: [x2, y2] },
        ],
        lines: [{ m, b: y1 - m * x1 }],
        alt: `Coordinate plane with line ℓ passing through the points ${pt(x1, y1)} and ${pt(x2, y2)}. The picture is only a sketch.`,
      });
      const expr = `((${y2}) - (${y1}))/((${x2}) - (${x1}))`;
      return {
        params: { form, quad: 0, x1, y1, x2, y2 },
        prompt: QC_PROMPT(`Line $\\ell$ passes through the points $${pt(x1, y1)}$ and $${pt(x2, y2)}$.`, 'The slope of $\\ell$', '$1$'),
        figure: fig,
        answer,
        steps: [
          {
            key: 'slope',
            instruction: 'Compute the slope exactly; do not judge it from the sketch.',
            math: `m = \\frac{${y2} - ${par(y1)}}{${x2} - ${par(x1)}} = ${slope.toLatex()}`,
            why: 'Rise over run, with the points in the same order top and bottom.',
            ask: { prompt: 'What is the slope of $\\ell$?', answer: numberAnswer(slope), verify: { type: 'evaluate', expr } },
          },
          { key: 'decide', instruction: 'Compare the slope with 1.', math: `${slope.toLatex()} \\text{ vs } 1`, why: 'No variables, so the relationship is determined (never D).', ask: { prompt: 'So which is it?', answer } },
        ],
        misconceptions: distinctMisconceptions(answer, [{ id: 'slope-inverted', wrong: qcAnswer(rel(Number(new Q(x2 - x1, y2 - y1 || 1)), 1)) }].filter(() => y2 !== y1)),
        verify: { type: 'qc', quantityA: expr, quantityB: '1', variables: [], constraints: [] },
      };
    }
    // form 1: distances from the origin (compare squares: exact integers)
    const x1 = rng.int(-6, 6);
    const y1 = rng.int(-6, 6);
    let x2 = rng.int(-6, 6);
    let y2 = rng.int(-6, 6);
    if (rng.chance(0.3)) [x2, y2] = [y1 * (rng.chance(0.5) ? 1 : -1), x1 * (rng.chance(0.5) ? 1 : -1)];
    const dP = x1 * x1 + y1 * y1;
    const dQ = x2 * x2 + y2 * y2;
    if (dP === 0 || dQ === 0 || Math.abs(x1 - x2) + Math.abs(y1 - y2) < 3) continue;
    const relation = rel(dP, dQ);
    const answer = qcAnswer(relation);
    const fig = planeFigure({
      range: 8,
      points: [
        { at: [x1, y1], label: 'P' },
        { at: [x2, y2], label: 'Q' },
      ],
      alt: `Coordinate plane with points P${pt(x1, y1)} and Q${pt(x2, y2)}.`,
    });
    return {
      params: { form, quad: 0, x1, y1, x2, y2 },
      prompt: QC_PROMPT(`$P = ${pt(x1, y1)}$ and $Q = ${pt(x2, y2)}$.`, 'The distance from $P$ to the origin', 'The distance from $Q$ to the origin'),
      figure: fig,
      answer,
      steps: [
        {
          key: 'squares',
          instruction: 'Both distances are square roots, so compare the numbers under the root: $x^2 + y^2$ for each point.',
          math: `P: ${dP}, \\quad Q: ${dQ}`,
          why: 'Square roots preserve order, so you can skip them when comparing.',
          ask: { prompt: 'What is $x^2 + y^2$ for $P$?', answer: numberAnswer(dP), verify: { type: 'evaluate', expr: `(${x1})^2 + (${y1})^2` } },
        },
        { key: 'decide', instruction: 'Compare.', math: `${dP} \\text{ vs } ${dQ}`, why: 'The larger sum is the farther point.', ask: { prompt: 'So which is it?', answer } },
      ],
      misconceptions: [],
      verify: { type: 'qc', quantityA: `sqrt((${x1})^2 + (${y1})^2)`, quantityB: `sqrt((${x2})^2 + (${y2})^2)`, variables: [], constraints: [] },
    };
  }
}

export const greCoordinateGeometry: SkillDefinition = {
  id: ID,
  title: 'Coordinate geometry',
  track: 'gre',
  unit: 'GRE · Algebra',
  description: 'Slope, line equations, distance and midpoint, parallel and perpendicular lines, intercepts, and comparisons on the plane.',
  prerequisites: ['gre-equations-word-problems'],
  maxDenominator: 12,
  levels: {
    1: { description: 'Slope and line equation (numeric entry, multiple choice)', ranges: { form: [0, 2], x1: [-8, 8], y1: [-8, 8], x2: [-8, 8], y2: [-8, 8] } },
    2: { description: 'Distance and midpoint', ranges: { form: [0, 2], x1: [-8, 8], y1: [-8, 8], x2: [-8, 8], y2: [-8, 8] } },
    3: { description: 'Parallel and perpendicular lines', ranges: { form: [0, 3], a: [-6, 6], b: [-6, 6], c: [-12, 12], x0: [-18, 18], y0: [-6, 6] } },
    4: { description: 'Intercepts and the triangle with the axes', ranges: { form: [0, 2], p: [-7, 7], q: [-7, 7], s: [1, 2] } },
    5: { description: 'Quantitative comparison on the plane', ranges: { form: [0, 2], quad: [0, 4], x1: [-6, 6], y1: [-6, 6], x2: [-6, 6], y2: [-6, 6] } },
  },
  misconceptions: {
    'slope-inverted': { name: 'Inverted the slope (run over rise)', explanation: 'Slope is rise over run: $\\frac{\\Delta y}{\\Delta x}$. A steep line has a BIG slope, so if your slope for a steep line is small, you flipped it.' },
    'perpendicular-not-negated': { name: 'Flipped the slope but forgot the sign change', explanation: 'Perpendicular slopes are NEGATIVE reciprocals: $m \\to -\\frac{1}{m}$. Flipping alone gives $\\frac{1}{m}$, which has the same sign as $m$, so it cannot be perpendicular.' },
    'distance-no-square-root': { name: 'Forgot the square root in the distance formula', explanation: '$d = \\sqrt{(\\Delta x)^2 + (\\Delta y)^2}$. The sum of squares is $d^2$; take the square root to get $d$.' },
    'midpoint-not-halved': { name: 'Added the coordinates but did not halve', explanation: 'The midpoint is the AVERAGE of the endpoints: $\\frac{x_1 + x_2}{2}$, not the sum.' },
    'area-without-half': { name: 'Forgot the one-half in the triangle area', explanation: 'Area of a triangle is $\\frac12 \\times \\text{base} \\times \\text{height}$. The product of the two intercepts is the area of the rectangle.' },
  },
  stepLabels: {
    'rise-run': 'Rise over run',
    slope: 'Compute the slope',
    intercept: 'Find the y-intercept',
    legs: 'Find the legs of the right triangle',
    distance: 'Apply the distance formula',
    sum: 'Add the coordinates',
    halve: 'Divide by 2',
    double: 'Double the midpoint',
    subtract: 'Subtract the known endpoint',
    'slope-given': 'Read the slope of the given line',
    'negative-reciprocal': 'Negative reciprocal',
    'slope-needed': 'Find the required slope',
    'x-intercept': 'Find the x-intercept',
    'y-intercept': 'Find the y-intercept and add',
    intercepts: 'Find the intercepts',
    'triangle-area': 'Half base times height',
    signs: 'Signs by quadrant',
    squares: 'Compare squared distances',
    decide: 'Decide the relationship',
  },
  learn: {
    whyItMatters:
      'Coordinate geometry questions on the GRE are really algebra on a picture: slope, intercepts, distance and perpendicular lines. Remember that slope is "rise over run" and that perpendicular slopes multiply to $-1$. The same ideas read economics graphs: a linear demand curve $P = 100 - 2Q$ has slope $-2$ (each extra unit lowers the price by 2), a y-intercept of 100 (the choke price) and an x-intercept of 50 (the quantity at price zero), and the triangle under it measures total consumer value.',
    summary:
      'Slope $m = \\frac{y_2 - y_1}{x_2 - x_1}$; a line is $y = mx + b$. Distance $= \\sqrt{(\\Delta x)^2 + (\\Delta y)^2}$ (often a 3-4-5 or 5-12-13 triple); the midpoint is the average of the endpoints. Parallel lines share a slope; perpendicular slopes are negative reciprocals. Intercepts: set $y=0$ for the x-intercept, $x=0$ for the y-intercept. Figures are sketches: trust the coordinates, not the picture.',
    formulas: [
      { latex: 'm = \\frac{y_2 - y_1}{x_2 - x_1}' },
      { latex: 'd = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}' },
      { latex: 'm_\\perp = -\\frac{1}{m}' },
      { latex: 'ax + by = c \\Rightarrow m = -\\frac{a}{b}' },
    ],
    example: { seed: 5, level: 3 },
    tips: ['Look for Pythagorean triples before computing a distance.', 'In QC with no variables the answer is never D: compute both quantities exactly.'],
  },

  generate(rng, level: Level) {
    switch (level) {
      case 1:
        return level1(rng);
      case 2:
        return level2(rng);
      case 3:
        return level3(rng);
      case 4:
        return level4(rng);
      case 5:
        return level5(rng);
    }
  },
};
