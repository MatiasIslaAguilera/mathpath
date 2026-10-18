// GRE Lines, angles & triangles. Formats: numeric entry (L1, L2, L4), exact-surd numeric entry and
// multiple choice (L3), quantitative comparison and select-all (L5). Every problem draws a
// triangle with triangleFigure (engine/figures.ts). The L5 pictures are deliberately NOT to scale
// (and say so), because "do not trust the picture" is the whole point.

import { choiceAnswer, multiAnswer, numberAnswer, qcAnswer, wrongNumber, type QcRelation } from '../../engine/answers';
import { triangleFigure } from '../../engine/figures';
import { distinctMisconceptions } from '../../engine/misconceptions';
import type { Rng } from '../../engine/rng';
import type { AnswerSpec, ChoiceOption, Figure, Level, SkillDefinition } from '../../engine/types';

const ID = 'gre-lines-angles-triangles';
type Body = ReturnType<SkillDefinition['generate']>;
type Pt = [number, number];

const QC_PROMPT = (setup: string, A: string, B: string) =>
  `${setup ? `${setup}\n\n` : ''}**Quantity A:** ${A}\n\n**Quantity B:** ${B}\n\nCompare Quantity A and Quantity B.`;
const NOT_TO_SCALE = 'Figure not drawn to scale.';

/** k·√r as an exact AnswerSpec value (r = 1 gives the plain integer). */
function surd(k: number, r: number): AnswerSpec {
  if (r === 1) return numberAnswer(k);
  return { kind: 'number', value: `${k}*sqrt(${r})`, display: `${k === 1 ? '' : k}\\sqrt{${r}}` };
}
const surdLatex = (k: number, r: number) => (r === 1 ? `${k}` : `${k === 1 ? '' : k}\\sqrt{${r}}`);

function buildChoice(rng: Rng, items: { label: string; key: string }[], correctKey: string) {
  if (new Set(items.map((i) => i.label)).size !== items.length) return null;
  const shuffled = rng.shuffle(items);
  const options: ChoiceOption[] = shuffled.map((it, i) => ({ id: `o${i}`, label: it.label }));
  const idOf = (key: string) => options[shuffled.findIndex((s) => s.key === key)].id;
  return { options, answer: choiceAnswer(options, idOf(correctKey)), idOf };
}

function shuffleOptions(rng: Rng, labels: string[], correctIdx: number[]): { options: ChoiceOption[]; correct: string[] } {
  const tagged = labels.map((label, i) => ({ label, good: correctIdx.includes(i) }));
  const shuffled = rng.shuffle(tagged);
  const options = shuffled.map((t, i) => ({ id: `o${i}`, label: t.label }));
  return { options, correct: options.filter((_, i) => shuffled[i].good).map((o) => o.id) };
}

/** Triangle with the given angles (degrees) at vertices 0 and 1: vertex 0 at the origin, vertex 1 at (1, 0). */
function trianglePoints(a0: number, a1: number): [Pt, Pt, Pt] {
  const r0 = (a0 * Math.PI) / 180;
  const r1 = (a1 * Math.PI) / 180;
  const t = Math.sin(r1) / Math.sin(r0 + r1);
  return [[0, 0], [1, 0], [t * Math.cos(r0), t * Math.sin(r0)]];
}

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
];

// ---------- level 1: angle sums ----------

const RATIOS: [number, number, number][] = [
  [1, 2, 3],
  [2, 3, 4],
  [1, 1, 2],
  [1, 3, 5],
  [3, 4, 5],
  [1, 4, 5],
  [2, 3, 7],
];

function level1(rng: Rng): Body {
  const form = rng.int(0, 2);
  if (form === 0) {
    const a = rng.int(35, 90);
    const b = rng.int(35, 90);
    const x = 180 - a - b;
    if (x < 30) return level1(rng);
    const answer = numberAnswer(x);
    const fig: Figure = triangleFigure({
      points: trianglePoints(a, b),
      vertexLabels: ['A', 'B', 'C'],
      angleLabels: [`${a}°`, `${b}°`, 'x°'],
      alt: `Triangle ABC with angle A equal to ${a} degrees, angle B equal to ${b} degrees, and angle C equal to x degrees.`,
    });
    return {
      params: { form, a, b, c: 0 },
      prompt: `In triangle $ABC$, $\\angle A = ${a}^\\circ$ and $\\angle B = ${b}^\\circ$. What is the value of $x$, the measure of $\\angle C$ in degrees? ${NOT_TO_SCALE}`,
      figure: fig,
      answer,
      steps: [
        {
          key: 'angle-sum',
          instruction: 'The three angles of a triangle add up to 180°.',
          math: `${a} + ${b} + x = 180`,
          why: 'Angle sum of a triangle.',
          ask: { prompt: `What is $${a} + ${b}$?`, answer: numberAnswer(a + b), verify: { type: 'evaluate', expr: `${a} + ${b}` } },
        },
        {
          key: 'subtract',
          instruction: 'Subtract from 180.',
          math: `x = 180 - ${a + b} = ${x}`,
          why: 'The third angle is what remains.',
          ask: { prompt: 'What is $x$?', answer, verify: { type: 'evaluate', expr: `180 - ${a} - ${b}` } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('angle-sum-360', () => 360 - a - b)]),
      verify: { type: 'evaluate', expr: `180 - ${a} - ${b}` },
    };
  }
  if (form === 1) {
    const [m1, m2, m3] = rng.pick(RATIOS);
    const S = m1 + m2 + m3;
    const x = 180 / S;
    const lab = (m: number) => `${m === 1 ? '' : m}x°`;
    const angs = [m1 * x, m2 * x];
    const answer = numberAnswer(x);
    const fig = triangleFigure({
      points: trianglePoints(angs[0], angs[1]),
      vertexLabels: ['A', 'B', 'C'],
      angleLabels: [lab(m1), lab(m2), lab(m3)],
      alt: `Triangle ABC whose three angles measure ${lab(m1)}, ${lab(m2)} and ${lab(m3)}.`,
    });
    return {
      params: { form, a: m1, b: m2, c: m3 },
      prompt: `The three angles of triangle $ABC$ measure $${m1 === 1 ? '' : m1}x^\\circ$, $${m2 === 1 ? '' : m2}x^\\circ$ and $${m3 === 1 ? '' : m3}x^\\circ$. What is the value of $x$? ${NOT_TO_SCALE}`,
      figure: fig,
      answer,
      steps: [
        {
          key: 'angle-sum',
          instruction: 'Add the three angles and set the sum equal to 180.',
          math: `${m1}x + ${m2}x + ${m3}x = ${S}x = 180`,
          why: 'Angle sum of a triangle; combine like terms.',
          ask: { prompt: 'What is the total coefficient of $x$?', answer: numberAnswer(S), verify: { type: 'evaluate', expr: `${m1} + ${m2} + ${m3}` } },
        },
        {
          key: 'solve',
          instruction: 'Divide both sides.',
          math: `x = \\frac{180}{${S}} = ${x}`,
          why: 'Isolate x.',
          ask: { prompt: 'What is $x$?', answer, verify: { type: 'evaluate', expr: `180/(${m1} + ${m2} + ${m3})` } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('angle-sum-360', () => 360 / S)]),
      verify: { type: 'evaluate', expr: `180/(${m1} + ${m2} + ${m3})` },
    };
  }
  const a = rng.int(30, 60);
  const x = 90 - a;
  const answer = numberAnswer(x);
  const fig = triangleFigure({
    points: trianglePoints(90, a),
    vertexLabels: ['A', 'B', 'C'],
    angleLabels: ['', `${a}°`, 'x°'],
    rightAngleAt: 0,
    alt: `Right triangle ABC with the right angle at A, angle B equal to ${a} degrees, and angle C equal to x degrees.`,
  });
  return {
    params: { form, a, b: 0, c: 0 },
    prompt: `Triangle $ABC$ has a right angle at $A$ and $\\angle B = ${a}^\\circ$. What is the value of $x$, the measure of $\\angle C$ in degrees? ${NOT_TO_SCALE}`,
    figure: fig,
    answer,
    steps: [
      {
        key: 'angle-sum',
        instruction: 'The angles add to 180°, and one is 90°, so the two acute angles add to 90°.',
        math: `90 + ${a} + x = 180`,
        why: 'Angle sum of a triangle.',
        ask: { prompt: 'What do the two acute angles add up to?', answer: numberAnswer(90), verify: { type: 'evaluate', expr: '180 - 90' } },
      },
      {
        key: 'subtract',
        instruction: 'Subtract the known acute angle.',
        math: `x = 90 - ${a} = ${x}`,
        why: 'The acute angles of a right triangle are complementary.',
        ask: { prompt: 'What is $x$?', answer, verify: { type: 'evaluate', expr: `180 - 90 - ${a}` } },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('angle-sum-360', () => 180 - a)]),
    verify: { type: 'evaluate', expr: `180 - 90 - ${a}` },
  };
}

// ---------- level 2: Pythagorean triples ----------

function level2(rng: Rng): Body {
  const t = rng.int(0, 2);
  const k = rng.int(1, 4);
  const swap = rng.chance(0.5);
  const [ta, tb, tc] = TRIPLES[t];
  const a = (swap ? tb : ta) * k; // horizontal leg
  const b = (swap ? ta : tb) * k; // vertical leg
  const c = tc * k;
  const form = rng.int(0, 2);
  const pts: [Pt, Pt, Pt] = [[0, 0], [a, 0], [0, b]];
  const hidden = form === 0 ? 'c' : rng.int(0, 1) === 0 ? 'a' : 'b';
  const side = (name: 'a' | 'b' | 'c') => (name === 'a' ? a : name === 'b' ? b : c);
  const lab = (name: 'a' | 'b' | 'c') => (hidden === name ? 'x' : String(side(name)));
  const fig = triangleFigure({
    points: pts,
    vertexLabels: ['A', 'B', 'C'],
    sideLabels: [lab('a'), lab('c'), lab('b')],
    rightAngleAt: 0,
    alt: `Right triangle ABC with the right angle at A. Leg AB is ${hidden === 'a' ? 'x' : a}, leg AC is ${hidden === 'b' ? 'x' : b}, and hypotenuse BC is ${hidden === 'c' ? 'x' : c}.`,
  });
  if (form === 2) {
    const answer = numberAnswer(a + b + c);
    const expr = `${a} + ${b} + sqrt(${a}^2 + ${b}^2)`;
    return {
      params: { form, t, k, c: swap ? 1 : 0 },
      prompt: `In right triangle $ABC$, the legs $AB$ and $AC$ have lengths ${a} and ${b}. What is the perimeter of the triangle? ${NOT_TO_SCALE}`,
      figure: triangleFigure({
        points: pts,
        vertexLabels: ['A', 'B', 'C'],
        sideLabels: [String(a), '', String(b)],
        rightAngleAt: 0,
        alt: `Right triangle ABC with the right angle at A. Leg AB is ${a} and leg AC is ${b}.`,
      }),
      answer,
      steps: [
        {
          key: 'hypotenuse',
          instruction: `Spot the triple: ${ta * k}-${tb * k}-${tc * k} is ${k === 1 ? '' : `${k} times `}${ta}-${tb}-${tc}, so the hypotenuse is ${c}.`,
          math: `\\sqrt{${a}^2 + ${b}^2} = ${c}`,
          why: 'Common triples: 3-4-5, 5-12-13, 8-15-17 and their multiples.',
          ask: { prompt: 'What is the hypotenuse $BC$?', answer: numberAnswer(c), verify: { type: 'evaluate', expr: `sqrt(${a}^2 + ${b}^2)` } },
        },
        {
          key: 'perimeter',
          instruction: 'Add all three sides.',
          math: `${a} + ${b} + ${c} = ${a + b + c}`,
          why: 'Perimeter is the sum of the sides.',
          ask: { prompt: 'What is the perimeter?', answer, verify: { type: 'evaluate', expr } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('pythagorean-added-legs', () => 2 * (a + b))]),
      verify: { type: 'evaluate', expr },
    };
  }
  const known = hidden === 'c' ? `legs of lengths ${a} and ${b}` : hidden === 'a' ? `one leg of length ${b} and hypotenuse ${c}` : `one leg of length ${a} and hypotenuse ${c}`;
  const target = hidden === 'c' ? c : hidden === 'a' ? a : b;
  const other = hidden === 'a' ? b : a;
  const answer = numberAnswer(target);
  const expr = hidden === 'c' ? `sqrt(${a}^2 + ${b}^2)` : `sqrt(${c}^2 - ${other}^2)`;
  const wrong = hidden === 'c' ? a + b : c - other;
  return {
    params: { form, t, k, c: swap ? 1 : 0 },
    prompt: `Right triangle $ABC$ has its right angle at $A$ and ${known}. What is the length of the ${hidden === 'c' ? 'hypotenuse' : 'other leg'}, $x$? ${NOT_TO_SCALE}`,
    figure: fig,
    answer,
    steps: [
      {
        key: 'pythagorean',
        instruction: hidden === 'c' ? 'Use $a^2 + b^2 = c^2$ (or recognize the triple).' : 'Use $a^2 + b^2 = c^2$ with the hypotenuse as $c$, or recognize the triple.',
        math: hidden === 'c' ? `${a}^2 + ${b}^2 = ${a * a + b * b} = ${c}^2` : `x^2 = ${c}^2 - ${other}^2 = ${c * c - other * other}`,
        why: 'The hypotenuse is the longest side, opposite the right angle; it is NOT the sum of the legs.',
        ask: { prompt: hidden === 'c' ? 'What is $x^2$?' : 'What is $x^2$?', answer: numberAnswer(target * target), verify: { type: 'evaluate', expr: hidden === 'c' ? `${a}^2 + ${b}^2` : `${c}^2 - ${other}^2` } },
      },
      {
        key: 'root',
        instruction: 'Take the square root.',
        math: `x = ${target}`,
        why: `${ta}-${tb}-${tc} triples scale: ${ta * k}-${tb * k}-${tc * k}.`,
        ask: { prompt: 'What is $x$?', answer, verify: { type: 'evaluate', expr } },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('pythagorean-added-legs', () => wrong)]),
    verify: { type: 'evaluate', expr },
  };
}

// ---------- level 3: special right triangles ----------

function level3(rng: Rng): Body {
  const form = rng.int(0, 5);
  const s = rng.int(2, 12);
  const params = { form, s };
  const rt45: [Pt, Pt, Pt] = [[0, 0], [1, 0], [0, 1]];
  const rt3060: [Pt, Pt, Pt] = [[0, 0], [Math.sqrt(3), 0], [0, 1]];
  const mk = (pts: [Pt, Pt, Pt], sides: [string, string, string], angles: [string, string, string], alt: string) =>
    triangleFigure({ points: pts, vertexLabels: ['A', 'B', 'C'], sideLabels: sides, angleLabels: angles, rightAngleAt: 0, alt });
  if (form === 0 || form === 5) {
    // 45-45-90: leg s, hypotenuse s*sqrt(2)
    const fig = mk(rt45, [String(s), 'x', String(s)], ['', '45°', '45°'], `Right triangle ABC with the right angle at A, both legs ${s}, angles B and C 45 degrees, and hypotenuse BC labeled x.`);
    const prompt = `In right triangle $ABC$, $\\angle B = \\angle C = 45^\\circ$ and the legs $AB = AC = ${s}$. What is the length of the hypotenuse $BC$? ${NOT_TO_SCALE}`;
    const steps = [
      {
        key: 'ratio',
        instruction: '45-45-90 triangle: sides in the ratio $1 : 1 : \\sqrt{2}$ (leg : leg : hypotenuse).',
        math: `x^2 = ${s}^2 + ${s}^2 = ${2 * s * s}`,
        why: 'The hypotenuse is the leg times √2 (the diagonal of a square).',
        ask: { prompt: 'What is $x^2$?', answer: numberAnswer(2 * s * s), verify: { type: 'evaluate' as const, expr: `${s}^2 + ${s}^2` } },
      },
    ];
    const expr = `sqrt(${s}^2 + ${s}^2)`;
    if (form === 0) {
      const answer = surd(s, 2);
      return {
        params,
        prompt,
        figure: fig,
        answer,
        steps: [...steps, { key: 'simplify', instruction: `Simplify $\\sqrt{${2 * s * s}} = ${surdLatex(s, 2)}$. (Type $${s}\\sqrt{2}$ or a decimal of at least two places.)`, math: `x = ${surdLatex(s, 2)}`, why: 'Leg × √2.', ask: { prompt: 'What is $x$?', answer, verify: { type: 'evaluate', expr } } }],
        misconceptions: distinctMisconceptions(answer, [{ id: 'special-triangle-ratio-swapped', wrong: surd(s, 3) }]),
        verify: { type: 'evaluate', expr },
      };
    }
    // form 5: multiple choice
    const items = [
      { key: 'ok', label: `$${surdLatex(s, 2)}$` },
      { key: 'swap', label: `$${surdLatex(s, 3)}$` },
      { key: 'double', label: `$${2 * s}$` },
      { key: 'leg', label: `$${s + 2}$` },
      { key: 'half', label: `$${surdLatex(2 * s, 2)}$` },
    ];
    const ch = buildChoice(rng, items, 'ok');
    if (!ch) return level3(rng);
    return {
      params,
      prompt: prompt.replace('What is the length', 'Which of the following is the length') + '',
      figure: fig,
      answer: ch.answer,
      steps: [...steps, { key: 'simplify', instruction: `Simplify: $\\sqrt{${2 * s * s}} = ${surdLatex(s, 2)}$.`, math: `x = ${surdLatex(s, 2)}`, why: 'Leg × √2.', ask: { prompt: 'Which option is the hypotenuse?', answer: ch.answer } }],
      misconceptions: distinctMisconceptions(ch.answer, [{ id: 'special-triangle-ratio-swapped', wrong: choiceAnswer(ch.options, ch.idOf('swap')) }]),
      verify: { type: 'choice', note: 'tests/skills/gre-lines-angles-triangles.test.ts re-derives the hypotenuse by the Pythagorean theorem and finds the option' },
    };
  }
  if (form === 1) {
    // 45-45-90 with hypotenuse 2s: leg = s*sqrt(2)
    const h = 2 * s;
    const fig = mk(rt45, ['x', String(h), 'x'], ['', '45°', '45°'], `Right triangle ABC with the right angle at A, angles B and C 45 degrees, hypotenuse BC equal to ${h}, and legs labeled x.`);
    const answer = surd(s, 2);
    const expr = `sqrt(${h}^2/2)`;
    return {
      params,
      prompt: `In right triangle $ABC$, $\\angle B = \\angle C = 45^\\circ$ and the hypotenuse $BC = ${h}$. What is the length of leg $AB$? ${NOT_TO_SCALE}`,
      figure: fig,
      answer,
      steps: [
        {
          key: 'ratio',
          instruction: 'Both legs are equal, so $2x^2 = h^2$.',
          math: `2x^2 = ${h}^2 = ${h * h} \\Rightarrow x^2 = ${(h * h) / 2}`,
          why: '45-45-90: leg = hypotenuse ÷ √2.',
          ask: { prompt: 'What is $x^2$?', answer: numberAnswer((h * h) / 2), verify: { type: 'evaluate', expr: `${h}^2/2` } },
        },
        { key: 'simplify', instruction: `$x = \\sqrt{${(h * h) / 2}} = ${surdLatex(s, 2)}$ (decimal of at least two places is fine).`, math: `x = ${surdLatex(s, 2)}`, why: 'Divide the hypotenuse by √2: multiply top and bottom by √2.', ask: { prompt: 'What is $x$?', answer, verify: { type: 'evaluate', expr } } },
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'special-triangle-ratio-swapped', wrong: surd(h, 2) }, wrongNumber('special-triangle-ratio-swapped', () => s)]),
      verify: { type: 'evaluate', expr },
    };
  }
  // 30-60-90: short leg s (opposite 30), long leg s*sqrt(3), hypotenuse 2s
  const labelsFor = (short: string, long: string, hyp: string): [string, string, string] => [long, hyp, short];
  if (form === 2) {
    const answer = numberAnswer(2 * s);
    const fig = mk(rt3060, labelsFor(String(s), '', 'x'), ['', '30°', '60°'], `Right triangle ABC with the right angle at A, angle B 30 degrees, angle C 60 degrees, the shortest side AC equal to ${s}, and hypotenuse BC labeled x.`);
    const expr = `sqrt((${s})^2 + (${s}*sqrt(3))^2)`;
    return {
      params,
      prompt: `In right triangle $ABC$, $\\angle A = 90^\\circ$, $\\angle B = 30^\\circ$ and $AC = ${s}$. What is the length of the hypotenuse $BC$? ${NOT_TO_SCALE}`,
      figure: fig,
      answer,
      steps: [
        {
          key: 'ratio',
          instruction: '30-60-90: sides $1 : \\sqrt{3} : 2$. The side opposite 30° is the shortest; the hypotenuse is TWICE it.',
          math: `AC : AB : BC = ${s} : ${surdLatex(s, 3)} : ${2 * s}`,
          why: 'The √3 belongs to the LONG leg (opposite 60°), not the hypotenuse.',
        },
        { key: 'hypotenuse', instruction: 'Double the short leg.', math: `BC = 2 \\cdot ${s} = ${2 * s}`, why: 'Hypotenuse = 2 × short leg.', ask: { prompt: 'What is $BC$?', answer, verify: { type: 'evaluate', expr } } },
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'special-triangle-ratio-swapped', wrong: surd(s, 3) }]),
      verify: { type: 'evaluate', expr },
    };
  }
  if (form === 3) {
    const answer = surd(s, 3);
    const fig = mk(rt3060, labelsFor(String(s), 'x', ''), ['', '30°', '60°'], `Right triangle ABC with the right angle at A, angle B 30 degrees, angle C 60 degrees, the shortest side AC equal to ${s}, and the longer leg AB labeled x.`);
    const expr = `sqrt((2*${s})^2 - (${s})^2)`;
    return {
      params,
      prompt: `In right triangle $ABC$, $\\angle A = 90^\\circ$, $\\angle B = 30^\\circ$ and $AC = ${s}$. What is the length of $AB$? ${NOT_TO_SCALE}`,
      figure: fig,
      answer,
      steps: [
        {
          key: 'ratio',
          instruction: `30-60-90: short leg : long leg : hypotenuse $= 1 : \\sqrt{3} : 2$. Here the short leg is ${s}, so the hypotenuse is ${2 * s}.`,
          math: `x^2 = ${2 * s}^2 - ${s}^2 = ${3 * s * s}`,
          why: 'Check with Pythagoras: the long leg is short × √3.',
          ask: { prompt: 'What is $x^2$?', answer: numberAnswer(3 * s * s), verify: { type: 'evaluate', expr: `(2*${s})^2 - ${s}^2` } },
        },
        { key: 'simplify', instruction: `$x = ${surdLatex(s, 3)}$ (a decimal of at least two places is fine).`, math: `x = ${surdLatex(s, 3)}`, why: 'Long leg = short leg × √3.', ask: { prompt: 'What is $x$?', answer, verify: { type: 'evaluate', expr } } },
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'special-triangle-ratio-swapped', wrong: numberAnswer(2 * s) }]),
      verify: { type: 'evaluate', expr },
    };
  }
  // form 4: hypotenuse 2s given, find the long leg
  const h = 2 * s;
  const answer = surd(s, 3);
  const fig = mk(rt3060, labelsFor('', 'x', String(h)), ['', '30°', '60°'], `Right triangle ABC with the right angle at A, angle B 30 degrees, angle C 60 degrees, hypotenuse BC equal to ${h}, and the longer leg AB labeled x.`);
  const expr = `sqrt(${h}^2 - (${h}/2)^2)`;
  return {
    params,
    prompt: `In right triangle $ABC$, $\\angle A = 90^\\circ$, $\\angle B = 30^\\circ$ and $BC = ${h}$. What is the length of $AB$? ${NOT_TO_SCALE}`,
    figure: fig,
    answer,
    steps: [
      {
        key: 'ratio',
        instruction: 'The hypotenuse is twice the short leg, so find the short leg first.',
        math: `AC = \\frac{${h}}{2} = ${s}`,
        why: '30-60-90: short leg = hypotenuse ÷ 2.',
        ask: { prompt: 'What is the short leg $AC$?', answer: numberAnswer(s), verify: { type: 'evaluate', expr: `${h}/2` } },
      },
      { key: 'simplify', instruction: `Long leg = short leg × √3 $= ${surdLatex(s, 3)}$.`, math: `x = ${surdLatex(s, 3)}`, why: 'The long leg is opposite the 60° angle.', ask: { prompt: 'What is $x$?', answer, verify: { type: 'evaluate', expr } } },
    ],
    misconceptions: distinctMisconceptions(answer, [{ id: 'special-triangle-ratio-swapped', wrong: surd(h, 3) }, wrongNumber('special-triangle-ratio-swapped', () => s)]),
    verify: { type: 'evaluate', expr },
  };
}

// ---------- level 4: isosceles triangles ----------

function level4(rng: Rng): Body {
  const form = rng.int(0, 3);
  const t = rng.int(0, 2);
  const k = rng.int(1, 3);
  const swap = rng.chance(0.5);
  const [ta, tb, tc] = TRIPLES[t];
  const a = (swap ? tb : ta) * k; // half base
  const b = (swap ? ta : tb) * k; // height
  const c = tc * k; // leg
  const params = { form, t, k, v: 0, swap: swap ? 1 : 0 };
  if (form <= 1) {
    const ang = form === 0 ? rng.int(1, 7) * 20 : rng.int(2, 8) * 10; // form 0: apex angle; form 1: base angle
    const baseAng = form === 0 ? (180 - ang) / 2 : ang;
    const x = form === 0 ? baseAng : 180 - 2 * ang;
    const answer = numberAnswer(x);
    const pts = trianglePoints(baseAng, baseAng);
    const fig = triangleFigure({
      points: pts,
      vertexLabels: ['B', 'C', 'A'],
      sideLabels: ['', '', ''],
      angleLabels: form === 0 ? ['x°', 'x°', `${ang}°`] : [`${ang}°`, `${ang}°`, 'x°'],
      alt: form === 0 ? `Isosceles triangle ABC with AB = AC, apex angle A equal to ${ang} degrees, and base angles B and C each labeled x.` : `Isosceles triangle ABC with AB = AC, base angles B and C each ${ang} degrees, and apex angle A labeled x.`,
    });
    return {
      params: { ...params, v: ang },
      prompt:
        form === 0
          ? `In triangle $ABC$, $AB = AC$ and $\\angle A = ${ang}^\\circ$. What is the measure of $\\angle B$, in degrees? ${NOT_TO_SCALE}`
          : `In triangle $ABC$, $AB = AC$ and $\\angle B = ${ang}^\\circ$. What is the measure of $\\angle A$, in degrees? ${NOT_TO_SCALE}`,
      figure: fig,
      answer,
      steps:
        form === 0
          ? [
              { key: 'base-angles', instruction: 'Equal sides have equal opposite angles: $\\angle B = \\angle C$. The base angles share what is left after the apex angle.', math: `\\angle B + \\angle C = 180 - ${ang} = ${180 - ang}`, why: 'Isosceles: base angles are equal.', ask: { prompt: 'What do the two base angles add up to?', answer: numberAnswer(180 - ang), verify: { type: 'evaluate', expr: `180 - ${ang}` } } },
              { key: 'halve', instruction: 'Split evenly.', math: `\\angle B = \\frac{${180 - ang}}{2} = ${x}`, why: 'Two equal angles.', ask: { prompt: 'What is $\\angle B$?', answer, verify: { type: 'evaluate', expr: `(180 - ${ang})/2` } } },
            ]
          : [
              { key: 'base-angles', instruction: 'Equal sides have equal opposite angles, so $\\angle C = \\angle B$ too.', math: `\\angle B + \\angle C = ${2 * ang}`, why: 'Isosceles: base angles are equal.', ask: { prompt: 'What do the two base angles add up to?', answer: numberAnswer(2 * ang), verify: { type: 'evaluate', expr: `2*${ang}` } } },
              { key: 'subtract', instruction: 'The apex angle is the rest of the 180°.', math: `\\angle A = 180 - ${2 * ang} = ${x}`, why: 'Angle sum.', ask: { prompt: 'What is $\\angle A$?', answer, verify: { type: 'evaluate', expr: `180 - 2*${ang}` } } },
            ],
      misconceptions: distinctMisconceptions(answer, form === 0 ? [wrongNumber('base-angle-not-halved', () => 180 - ang)] : [wrongNumber('base-angle-not-halved', () => 180 - ang)]),
      verify: { type: 'evaluate', expr: form === 0 ? `(180 - ${ang})/2` : `180 - 2*${ang}` },
    };
  }
  // forms 2 and 3: area / perimeter of an isosceles triangle with base 2a, height b, legs c
  const pts: [Pt, Pt, Pt] = [[-a, 0], [a, 0], [0, b]];
  if (form === 2) {
    const answer = numberAnswer(a * b);
    const expr = `(2*${a})*sqrt(${c}^2 - ${a}^2)/2`;
    return {
      params,
      prompt: `Triangle $ABC$ is isosceles with $AB = AC = ${c}$ and base $BC = ${2 * a}$. What is its area? ${NOT_TO_SCALE}`,
      figure: triangleFigure({ points: pts, vertexLabels: ['B', 'C', 'A'], sideLabels: [String(2 * a), String(c), String(c)], alt: `Isosceles triangle ABC with base BC equal to ${2 * a} and equal sides AB and AC each equal to ${c}.` }),
      answer,
      steps: [
        { key: 'height', instruction: `Drop the altitude from $A$: it bisects the base, making a right triangle with leg ${a} and hypotenuse ${c}.`, math: `h = \\sqrt{${c}^2 - ${a}^2} = ${b}`, why: 'In an isosceles triangle the altitude to the base is also the median.', ask: { prompt: 'What is the height?', answer: numberAnswer(b), verify: { type: 'evaluate', expr: `sqrt(${c}^2 - ${a}^2)` } } },
        { key: 'area', instruction: 'Area = ½ × base × height.', math: `\\tfrac12 \\cdot ${2 * a} \\cdot ${b} = ${a * b}`, why: 'Use the height, not the slanted side.', ask: { prompt: 'What is the area?', answer, verify: { type: 'evaluate', expr } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('isosceles-leg-as-height', () => a * c)]),
      verify: { type: 'evaluate', expr },
    };
  }
  const answer = numberAnswer(2 * a + 2 * c);
  const expr = `2*${a} + 2*sqrt(${a}^2 + ${b}^2)`;
  return {
    params,
    prompt: `Triangle $ABC$ is isosceles with $AB = AC$. Its base $BC$ is ${2 * a} and the altitude from $A$ to $BC$ is ${b}. What is the perimeter of the triangle? ${NOT_TO_SCALE}`,
    figure: triangleFigure({ points: pts, vertexLabels: ['B', 'C', 'A'], sideLabels: [String(2 * a), '', ''], alt: `Isosceles triangle ABC with base BC equal to ${2 * a}; the altitude from A to the base has length ${b}.` }),
    answer,
    steps: [
      { key: 'leg', instruction: `The altitude splits the base into two halves of ${a}. Each equal side is the hypotenuse of a right triangle with legs ${a} and ${b}.`, math: `AB = \\sqrt{${a}^2 + ${b}^2} = ${c}`, why: 'Pythagorean theorem on half the triangle.', ask: { prompt: 'What is $AB$?', answer: numberAnswer(c), verify: { type: 'evaluate', expr: `sqrt(${a}^2 + ${b}^2)` } } },
      { key: 'perimeter', instruction: 'Add the three sides.', math: `${2 * a} + ${c} + ${c} = ${2 * a + 2 * c}`, why: 'Two equal sides plus the base.', ask: { prompt: 'What is the perimeter?', answer, verify: { type: 'evaluate', expr } } },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('pythagorean-added-legs', () => 2 * a + 2 * (a + b))]),
    verify: { type: 'evaluate', expr },
  };
}

// ---------- level 5: not drawn to scale ----------

function level5(rng: Rng): Body {
  const form = rng.int(0, 2);
  if (form === 0) {
    const lo = rng.int(3, 9);
    const hi = lo + rng.int(1, 5);
    const pickEq = rng.chance(0.15);
    const [ab, ac] = pickEq ? [lo, lo] : rng.chance(0.5) ? [hi, lo] : [lo, hi];
    // angle C is opposite AB, angle B is opposite AC: the larger side faces the larger angle.
    const relation: QcRelation = ab > ac ? 'a' : ab < ac ? 'b' : 'c';
    const answer = qcAnswer(relation);
    // The drawing deliberately contradicts the data (a longer side drawn shorter).
    const drawnAbLonger = ab <= ac;
    const pts: [Pt, Pt, Pt] = drawnAbLonger ? [[2, 5], [-4, 0], [3, 0]] : [[-2, 5], [-3, 0], [4, 0]];
    const fig = triangleFigure({
      points: pts,
      vertexLabels: ['A', 'B', 'C'],
      sideLabels: [String(ab), '', String(ac)],
      alt: `Triangle ABC with AB = ${ab} and AC = ${ac}. The picture is not drawn to scale and may look different from the true shape.`,
    });
    const wrongRel: QcRelation = relation === 'c' ? 'd' : relation === 'a' ? 'b' : 'a';
    return {
      params: { form, a: ab, b: ac, c: 0, d: 0 },
      prompt: QC_PROMPT(`In triangle $ABC$, $AB = ${ab}$ and $AC = ${ac}$. ${NOT_TO_SCALE}`, '$\\angle C$', '$\\angle B$'),
      figure: fig,
      answer,
      steps: [
        {
          key: 'opposite',
          instruction: 'Ignore the picture. Match each angle with the side opposite it: $\\angle C$ faces $AB$, and $\\angle B$ faces $AC$.',
          math: `\\angle C \\leftrightarrow AB = ${ab}, \\qquad \\angle B \\leftrightarrow AC = ${ac}`,
          why: 'In any triangle the larger angle is opposite the longer side.',
          ask: { prompt: 'Which side is opposite $\\angle C$?', answer: { kind: 'choice', options: [{ id: 'ab', label: '$AB$' }, { id: 'ac', label: '$AC$' }, { id: 'bc', label: '$BC$' }], correct: 'ab' } },
        },
        { key: 'decide', instruction: ab === ac ? 'Equal sides face equal angles.' : 'The longer side faces the larger angle.', math: ab > ac ? '\\angle C > \\angle B' : ab < ac ? '\\angle C < \\angle B' : '\\angle C = \\angle B', why: 'Never trust the drawing when it says "not drawn to scale".', ask: { prompt: 'So which is it?', answer } },
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'trusted-the-figure', wrong: qcAnswer(wrongRel) }]),
      verify: { type: 'choice', note: 'tests/skills/gre-lines-angles-triangles.test.ts compares the angles opposite the given sides by the law of cosines' },
    };
  }
  if (form === 1) {
    const a = rng.int(3, 12);
    const b = rng.int(3, 12);
    const lo = Math.abs(a - b);
    const hi = a + b;
    const inside: number[] = [];
    for (let v = lo + 1; v < hi; v++) inside.push(v);
    const goodVals = rng.shuffle(inside).slice(0, rng.int(1, Math.min(3, inside.length)));
    const badVals = [hi, lo, hi + rng.int(1, 3), lo >= 2 ? lo - 1 : hi + 4].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i);
    const vals = [...goodVals, ...badVals];
    const goodIdx = vals.map((v, i) => (v > lo && v < hi ? i : -1)).filter((i) => i >= 0);
    const { options, correct } = shuffleOptions(rng, vals.map(String), goodIdx);
    const boundaryIds = options.filter((o) => Number(o.label) === lo || Number(o.label) === hi).map((o) => o.id);
    const answer = multiAnswer(options, correct);
    return {
      params: { form, a, b, c: 0, d: 0 },
      prompt: `Two sides of a triangle have lengths ${a} and ${b}. Which of the following could be the length of the third side?\n\nSelect all that apply.`,
      figure: triangleFigure({
        points: [[0, 0], [5, 0], [1.5, 3]],
        vertexLabels: ['', '', ''],
        sideLabels: [String(a), String(b), '?'],
        alt: `A triangle with two sides labeled ${a} and ${b} and the third side labeled with a question mark. Not drawn to scale.`,
      }),
      answer,
      steps: [
        { key: 'inequality', instruction: 'Each side must be shorter than the other two put together, and longer than their difference.', math: `|${a} - ${b}| < c < ${a} + ${b} \\;\\Rightarrow\\; ${lo} < c < ${hi}`, why: 'Strict inequalities: c equal to the sum would be a flat "triangle" with no area.', ask: { prompt: `What is the smallest whole number the third side could be?`, answer: numberAnswer(lo + 1), verify: { type: 'evaluate', expr: `abs(${a} - ${b}) + 1` } } },
        { key: 'test-each', instruction: 'Test each option against the interval, remembering both ends are excluded.', math: `${lo} < c < ${hi}`, why: 'Select-all needs every valid option and no invalid one.', ask: { prompt: 'Select all possible lengths.', answer } },
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'triangle-inequality-inclusive', wrong: multiAnswer(options, [...new Set([...correct, ...boundaryIds])]) }]),
      verify: { type: 'choice', note: 'tests/skills/gre-lines-angles-triangles.test.ts checks |a-b| < c < a+b for every option' },
    };
  }
  // form 2: third side x compared with a constant
  const a = rng.int(3, 10);
  let b = rng.int(3, 10);
  if (b === a) b = a === 10 ? 9 : a + 1;
  const lo = Math.abs(a - b);
  const hi = a + b;
  const mode = rng.int(0, 4); // 0: B = lo (A), 1: B = hi (B), 2: B inside (D), 3: B inside (D), 4: B above hi
  const B = mode === 0 ? lo : mode === 1 ? hi : mode === 4 ? hi + rng.int(1, 3) : rng.int(lo + 1, hi - 1);
  const relation: QcRelation = B <= lo ? 'a' : B >= hi ? 'b' : 'd';
  const inclusiveWrong: QcRelation | null = B === lo || B === hi ? 'd' : null;
  const answer = qcAnswer(relation);
  return {
    params: { form, a, b, c: B, d: 0 },
    prompt: QC_PROMPT(`The lengths of two sides of a triangle are ${a} and ${b}. The length of the third side is $x$.`, '$x$', `$${B}$`),
    figure: triangleFigure({
      points: [[0, 0], [5, 0], [1.5, 3]],
      vertexLabels: ['', '', ''],
      sideLabels: [String(a), String(b), 'x'],
      alt: `A triangle with sides ${a}, ${b} and x. Not drawn to scale.`,
    }),
    answer,
    steps: [
      { key: 'inequality', instruction: 'Triangle inequality: the third side lies strictly between the difference and the sum.', math: `${lo} < x < ${hi}`, why: 'Both ends are excluded.', ask: { prompt: 'What is the largest whole number $x$ could be?', answer: numberAnswer(hi - 1), verify: { type: 'evaluate', expr: `${a} + ${b} - 1` } } },
      { key: 'decide', instruction: `Compare the interval $(${lo}, ${hi})$ with ${B}.`, math: B <= lo ? `x > ${lo} \\ge ${B}` : B >= hi ? `x < ${hi} \\le ${B}` : `${B} \\text{ is inside the interval, so } x \\text{ can be above or below it}`, why: 'If x can be on either side of B the answer is D.', ask: { prompt: 'So which is it?', answer } },
    ],
    misconceptions: distinctMisconceptions(answer, [inclusiveWrong ? { id: 'triangle-inequality-inclusive', wrong: qcAnswer(inclusiveWrong) } : null]),
    verify: {
      type: 'qc',
      quantityA: 'x',
      quantityB: `${B}`,
      variables: [{ name: 'x', min: lo + 0.001, max: hi - 0.001 }],
      constraints: [],
    },
  };
}

export const greLinesAnglesTriangles: SkillDefinition = {
  id: ID,
  title: 'Lines, angles & triangles',
  track: 'gre',
  unit: 'GRE · Geometry',
  description: 'Angle sums, Pythagorean triples, 45-45-90 and 30-60-90 triangles, isosceles triangles, and the triangle inequality.',
  prerequisites: ['gre-integers'],
  maxDenominator: 1,
  irrationalAnswers: true,
  levels: {
    1: { description: 'Angles in a triangle', ranges: { form: [0, 2], a: [1, 95], b: [0, 95], c: [0, 7] } },
    2: { description: 'Pythagorean triples', ranges: { form: [0, 2], t: [0, 2], k: [1, 4], c: [0, 1] } },
    3: { description: 'Special right triangles (exact values, multiple choice)', ranges: { form: [0, 5], s: [2, 12] } },
    4: { description: 'Isosceles triangles', ranges: { form: [0, 3], t: [0, 2], k: [1, 3], v: [0, 160], swap: [0, 1] } },
    5: { description: 'Not drawn to scale: comparisons and the triangle inequality', ranges: { form: [0, 2], a: [3, 14], b: [3, 14], c: [0, 25], d: [0, 0] } },
  },
  misconceptions: {
    'angle-sum-360': { name: 'Used the wrong angle total', explanation: 'The angles of a TRIANGLE add to $180^\\circ$ (a full turn, $360^\\circ$, is for a quadrilateral). In a right triangle the two acute angles add to $90^\\circ$.' },
    'pythagorean-added-legs': { name: 'Added the legs instead of using the Pythagorean theorem', explanation: 'The hypotenuse is $\\sqrt{a^2 + b^2}$, which is shorter than $a + b$ (a side is always shorter than the sum of the other two). Look for a 3-4-5 or 5-12-13 triple.' },
    'special-triangle-ratio-swapped': { name: 'Used the wrong special-triangle ratio', explanation: '45-45-90: $1 : 1 : \\sqrt{2}$ (hypotenuse = leg × √2). 30-60-90: $1 : \\sqrt{3} : 2$ (short leg : long leg : hypotenuse), so the hypotenuse is 2 × the short leg and $\\sqrt{3}$ goes with the long leg. Divide when going from the hypotenuse to a leg.' },
    'trusted-the-figure': { name: 'Answered from the picture', explanation: 'GRE figures are often NOT drawn to scale. Use only the numbers given: the larger angle is opposite the longer side, whatever the sketch looks like.' },
    'triangle-inequality-inclusive': { name: 'Allowed the third side to equal the sum or difference', explanation: 'The third side must satisfy $|a - b| < c < a + b$ with strict inequalities. Equality would collapse the triangle to a flat line.' },
    'base-angle-not-halved': { name: 'Forgot the angles are shared or halved', explanation: 'In an isosceles triangle with apex angle $A$, the two equal base angles share $180^\\circ - A$, so each is $\\frac{180 - A}{2}$. Going the other way, $A = 180 - 2B$.' },
    'isosceles-leg-as-height': { name: 'Used a slanted side as the height', explanation: 'The height is the perpendicular altitude, not an equal side. Drop the altitude to the base, which bisects it, and use the Pythagorean theorem to find it.' },
  },
  stepLabels: {
    'angle-sum': 'Angle sum is 180°',
    subtract: 'Subtract from the total',
    solve: 'Solve for x',
    hypotenuse: 'Find the hypotenuse',
    perimeter: 'Add the sides',
    pythagorean: 'Apply a² + b² = c²',
    root: 'Take the square root',
    ratio: 'Use the special-triangle ratio',
    simplify: 'Simplify the surd',
    'base-angles': 'Base angles are equal',
    halve: 'Split the remaining angle',
    height: 'Find the height',
    area: 'Half base times height',
    leg: 'Find the equal side',
    opposite: 'Match angles with opposite sides',
    decide: 'Decide the relationship',
    inequality: 'Triangle inequality',
    'test-each': 'Test each option',
  },
  learn: {
    whyItMatters:
      'Triangle facts are the backbone of GRE geometry: angles sum to $180^\\circ$, right triangles hide Pythagorean triples (3-4-5, 5-12-13, 8-15-17) and special ratios, and figures are usually "not drawn to scale", so you must reason from the given numbers rather than the picture. The same discipline matters in economics and statistics: a graph is a sketch, and conclusions must come from the data. A right triangle with legs 30 and 40 (say, a 30-unit price gap and a 40-unit quantity gap) has a straight-line distance of 50.',
    summary:
      'Angles in a triangle add to $180^\\circ$. In a right triangle $a^2 + b^2 = c^2$; memorize 3-4-5, 5-12-13, 8-15-17 and their multiples. 45-45-90: $1 : 1 : \\sqrt{2}$. 30-60-90: $1 : \\sqrt{3} : 2$. Equal sides face equal angles, and the longer side faces the larger angle. The third side $c$ satisfies $|a-b| < c < a+b$.',
    formulas: [
      { latex: '\\angle A + \\angle B + \\angle C = 180^\\circ' },
      { latex: 'a^2 + b^2 = c^2' },
      { latex: '45\\text{-}45\\text{-}90:\\; 1 : 1 : \\sqrt{2} \\qquad 30\\text{-}60\\text{-}90:\\; 1 : \\sqrt{3} : 2' },
      { latex: '|a - b| < c < a + b', note: 'Strict inequalities.' },
    ],
    example: { seed: 3, level: 3 },
    tips: ['If it says "not drawn to scale", ignore the shape of the picture.', 'The √3 goes with the LONG leg of a 30-60-90 triangle, never the hypotenuse.'],
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
