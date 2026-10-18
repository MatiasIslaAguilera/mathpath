// GRE Circles & polygons. Formats: numeric entry (coefficient of pi, angle sums), multiple choice
// (L4 composite regions), select-all (L3 regular-polygon angles), quantitative comparison (L5).
// Circle questions with a radius use circleFigure (engine/figures.ts); there is no polygon or
// composite-figure builder, so those levels are described in words (see the report).
// L5 compares quantities that contain pi: every comparison is variable-free, and each draw is
// rejected unless the two values differ by at least 0.05, so the relation is certain because
// 3.14159 < pi < 3.1416 (pi is irrational, so "equal" can never occur).

import { choiceAnswer, multiAnswer, numberAnswer, qcAnswer, wrongNumber, type QcRelation } from '../../engine/answers';
import { circleFigure } from '../../engine/figures';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, Level, SkillDefinition } from '../../engine/types';

const ID = 'gre-circles-polygons';
type Body = ReturnType<SkillDefinition['generate']>;

const QC_PROMPT = (setup: string, A: string, B: string) =>
  `${setup ? `${setup}\n\n` : ''}**Quantity A:** ${A}\n\n**Quantity B:** ${B}\n\nCompare Quantity A and Quantity B.`;
const piTerm = (c: Q) => (c.eq(1) ? '\\pi' : `${c.toLatex()}\\pi`);
const PI = Math.PI;

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

// ---------- level 1: area and circumference ----------

function level1(rng: Rng): Body {
  const form = rng.int(0, 4);
  const r = rng.int(2, 12);
  const d = 2 * r;
  const noRadius = form === 1 || form === 2 || form === 4;
  const fig = circleFigure(
    noRadius
      ? { centerLabel: 'O', alt: `A circle with center O. ${form === 4 ? `Its circumference is ${d}π.` : `Its diameter is ${d}.`}` }
      : { radiusLabel: `r = ${r}`, centerLabel: 'O', alt: `A circle with center O and a radius of length ${r}.` },
  );
  const params = { form, r };
  if (form === 0) {
    const answer = numberAnswer(r * r);
    return {
      params,
      prompt: `A circle has radius ${r}. Its area is $k\\pi$. What is $k$?`,
      figure: fig,
      answer,
      steps: [
        { key: 'formula', instruction: 'Area of a circle: $A = \\pi r^2$.', math: `A = \\pi (${r})^2`, why: 'Area uses r squared; circumference uses r to the first power.', ask: { prompt: `What is $r^2$?`, answer, verify: { type: 'evaluate', expr: `${r}^2` } } },
        { key: 'coefficient', instruction: 'So $k = r^2$.', math: `A = ${r * r}\\pi`, why: 'Leave the answer as a multiple of π.', ask: { prompt: 'What is $k$?', answer, verify: { type: 'evaluate', expr: `${r}^2` } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('circumference-area-swap', () => 2 * r)]),
      verify: { type: 'evaluate', expr: `${r}^2` },
    };
  }
  if (form === 1) {
    const answer = numberAnswer(r * r);
    return {
      params,
      prompt: `A circle has diameter ${d}. Its area is $k\\pi$. What is $k$?`,
      figure: fig,
      answer,
      steps: [
        { key: 'radius', instruction: 'The formula needs the RADIUS, which is half the diameter.', math: `r = \\frac{${d}}{2} = ${r}`, why: 'Read "diameter" vs "radius" carefully.', ask: { prompt: 'What is the radius?', answer: numberAnswer(r), verify: { type: 'evaluate', expr: `${d}/2` } } },
        { key: 'coefficient', instruction: 'Now $A = \\pi r^2$.', math: `A = \\pi (${r})^2 = ${r * r}\\pi`, why: 'Area = π r².', ask: { prompt: 'What is $k$?', answer, verify: { type: 'evaluate', expr: `(${d}/2)^2` } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('diameter-as-radius', () => d * d), wrongNumber('circumference-area-swap', () => d)]),
      verify: { type: 'evaluate', expr: `(${d}/2)^2` },
    };
  }
  if (form === 2) {
    const answer = numberAnswer(d);
    return {
      params,
      prompt: `A circle has diameter ${d}. Its circumference is $k\\pi$. What is $k$?`,
      figure: fig,
      answer,
      steps: [
        { key: 'formula', instruction: 'Circumference: $C = \\pi d$ (which is the same as $2\\pi r$).', math: `C = \\pi \\cdot ${d}`, why: 'With the diameter given, no halving is needed.', ask: { prompt: 'What is $k$?', answer, verify: { type: 'evaluate', expr: `${d}` } } },
        { key: 'coefficient', instruction: `So $C = ${d}\\pi$.`, math: `k = ${d}`, why: 'Circumference grows linearly with the diameter.', ask: { prompt: 'What is $k$?', answer, verify: { type: 'evaluate', expr: `2*(${d}/2)` } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('diameter-as-radius', () => 2 * d), wrongNumber('circumference-area-swap', () => r * r)]),
      verify: { type: 'evaluate', expr: `2*(${d}/2)` },
    };
  }
  if (form === 3) {
    const answer = numberAnswer(d);
    return {
      params,
      prompt: `A circle has radius ${r}. Its circumference is $k\\pi$. What is $k$?`,
      figure: fig,
      answer,
      steps: [
        { key: 'formula', instruction: 'Circumference: $C = 2\\pi r$.', math: `C = 2\\pi(${r}) = ${d}\\pi`, why: 'Circumference uses r to the first power.', ask: { prompt: 'What is $2r$?', answer, verify: { type: 'evaluate', expr: `2*${r}` } } },
        { key: 'coefficient', instruction: `So $k = ${d}$.`, math: `k = ${d}`, why: 'Leave the answer as a multiple of π.', ask: { prompt: 'What is $k$?', answer, verify: { type: 'evaluate', expr: `2*${r}` } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('circumference-area-swap', () => r * r)]),
      verify: { type: 'evaluate', expr: `2*${r}` },
    };
  }
  // form 4: circumference d*pi given, find the area coefficient
  const answer = numberAnswer(r * r);
  return {
    params,
    prompt: `A circle has circumference $${d}\\pi$. Its area is $k\\pi$. What is $k$?`,
    figure: fig,
    answer,
    steps: [
      { key: 'radius', instruction: 'Use $C = 2\\pi r$ to find the radius first.', math: `2\\pi r = ${d}\\pi \\Rightarrow r = ${r}`, why: 'Circumference gives r; area then needs r².', ask: { prompt: 'What is the radius?', answer: numberAnswer(r), verify: { type: 'evaluate', expr: `${d}/2` } } },
      { key: 'coefficient', instruction: 'Area $= \\pi r^2$.', math: `A = \\pi(${r})^2 = ${r * r}\\pi`, why: 'Area = π r².', ask: { prompt: 'What is $k$?', answer, verify: { type: 'evaluate', expr: `(${d}/2)^2` } } },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('diameter-as-radius', () => d * d), wrongNumber('circumference-area-swap', () => d)]),
    verify: { type: 'evaluate', expr: `(${d}/2)^2` },
  };
}

// ---------- level 2: arcs and sectors ----------

const ANGLES = [30, 45, 60, 72, 90, 120, 135, 150, 180, 240, 270];

function level2(rng: Rng): Body {
  for (;;) {
    const form = rng.int(0, 2);
    const th = rng.pick(ANGLES);
    const r = rng.int(2, 12);
    const useD = form !== 2 && rng.chance(0.4);
    const arc = new Q(th * r, 180);
    const area = new Q(th * r * r, 360);
    if ((form === 0 ? arc : area).d > 6) continue;
    const whole = useD ? `a diameter of ${2 * r}` : `radius ${r}`;
    const figure = circleFigure({
      sectorDegrees: th,
      sectorLabel: `${th}°`,
      centerLabel: 'O',
      alt: `A circle with center O and a shaded sector with a central angle of ${th} degrees. ${useD ? `The circle has diameter ${2 * r}.` : `The radius is ${r}.`}`,
    });
    const frac = new Q(th, 360);
    const params = { form, r, th, useD: useD ? 1 : 0 };
    if (form === 0) {
      const answer = numberAnswer(arc);
      const expr = `(${th}/360)*2*(${r})`;
      return {
        params,
        prompt: `In a circle with ${whole}, a central angle of ${th}° intercepts an arc of length $k\\pi$. What is $k$?`,
        figure,
        answer,
        steps: [
          { key: 'fraction', instruction: `The arc is ${th}/360 of the whole circle.`, math: `\\frac{${th}}{360} = ${frac.toLatex()}`, why: 'A full turn is 360°, not 180°.', ask: { prompt: `What fraction of the circle is the sector?`, answer: numberAnswer(frac), verify: { type: 'evaluate', expr: `${th}/360` } } },
          { key: 'arc', instruction: `Whole circumference is $2\\pi r = ${2 * r}\\pi$. Multiply by the fraction.`, math: `${frac.toLatex()} \\cdot ${2 * r}\\pi = ${arc.toLatex()}\\pi`, why: 'Arc length = (angle/360) × circumference.', ask: { prompt: 'What is $k$?', answer, verify: { type: 'evaluate', expr } } },
        ],
        misconceptions: distinctMisconceptions(answer, [
          wrongNumber('sector-fraction-wrong', () => new Q(th * r, 90)),
          useD ? wrongNumber('diameter-as-radius', () => new Q(th * 2 * r, 180)) : null,
        ]),
        verify: { type: 'evaluate', expr },
      };
    }
    if (form === 1) {
      const answer = numberAnswer(area);
      const expr = `(${th}/360)*(${r})^2`;
      return {
        params,
        prompt: `In a circle with ${whole}, a sector has a central angle of ${th}°. The area of the sector is $k\\pi$. What is $k$?`,
        figure,
        answer,
        steps: [
          { key: 'fraction', instruction: `The sector is ${th}/360 of the whole circle.`, math: `\\frac{${th}}{360} = ${frac.toLatex()}`, why: 'A full turn is 360°.', ask: { prompt: `What fraction of the circle is the sector?`, answer: numberAnswer(frac), verify: { type: 'evaluate', expr: `${th}/360` } } },
          { key: 'sector-area', instruction: `Whole area is $\\pi r^2 = ${r * r}\\pi$. Multiply by the fraction.`, math: `${frac.toLatex()} \\cdot ${r * r}\\pi = ${area.toLatex()}\\pi`, why: 'Sector area = (angle/360) × πr².', ask: { prompt: 'What is $k$?', answer, verify: { type: 'evaluate', expr } } },
        ],
        misconceptions: distinctMisconceptions(answer, [
          wrongNumber('sector-fraction-wrong', () => new Q(th * r * r, 180)),
          useD ? wrongNumber('diameter-as-radius', () => new Q(th * 4 * r * r, 360)) : null,
        ]),
        verify: { type: 'evaluate', expr },
      };
    }
    const answer = numberAnswer(th);
    const expr = `360*(${area.toString()})/(${r})^2`;
    return {
      params,
      prompt: `A sector of a circle with radius ${r} has area $${area.toLatex()}\\pi$. What is the measure of its central angle, in degrees?`,
      figure: circleFigure({ sectorDegrees: th, sectorLabel: '?', centerLabel: 'O', alt: `A circle with center O, radius ${r}, and a shaded sector whose central angle is unknown. The picture is only a sketch.` }),
      answer,
      steps: [
        { key: 'fraction', instruction: `Sector area ÷ whole area gives the fraction of the circle: $\\frac{${area.toLatex()}\\pi}{${r * r}\\pi}$.`, math: `\\frac{${area.toLatex()}}{${r * r}} = ${frac.toLatex()}`, why: 'The angle is that fraction of 360°.', ask: { prompt: 'What fraction of the circle is the sector?', answer: numberAnswer(frac), verify: { type: 'evaluate', expr: `(${area.toString()})/(${r})^2` } } },
        { key: 'angle', instruction: 'Multiply by 360°.', math: `${frac.toLatex()} \\cdot 360 = ${th}`, why: 'Central angle = fraction × 360°.', ask: { prompt: 'What is the central angle in degrees?', answer, verify: { type: 'evaluate', expr } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('sector-fraction-wrong', () => th / 2)]),
      verify: { type: 'evaluate', expr },
    };
  }
}

// ---------- level 3: polygon angles ----------

const GOOD_ANGLES = [60, 90, 108, 120, 135, 140, 144, 150, 160, 162];
const BAD_ANGLES = [95, 98, 100, 105, 110, 115, 118, 125, 130, 138, 145, 155];

const REGULAR_N = [3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36];

function level3(rng: Rng): Body {
  const pickForm = rng.int(0, 7);
  const form = pickForm <= 2 ? 0 : pickForm <= 4 ? 1 : pickForm <= 6 ? 2 : 3;
  if (form === 0) {
    const n = rng.int(4, 30);
    const answer = numberAnswer((n - 2) * 180);
    return {
      params: { form, n, th: 0 },
      prompt: `What is the sum of the measures of the interior angles of a polygon with ${n} sides?`,
      answer,
      steps: [
        { key: 'triangles', instruction: `Split the polygon into triangles from one vertex: ${n} − 2 triangles.`, math: `${n} - 2 = ${n - 2}`, why: 'Each triangle contributes 180°.', ask: { prompt: 'How many triangles?', answer: numberAnswer(n - 2), verify: { type: 'evaluate', expr: `${n} - 2` } } },
        { key: 'angle-sum', instruction: 'Multiply by 180°.', math: `(${n} - 2)\\cdot 180 = ${(n - 2) * 180}`, why: 'Sum of interior angles = (n − 2)·180°.', ask: { prompt: 'What is the sum?', answer, verify: { type: 'evaluate', expr: `(${n} - 2)*180` } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('polygon-sum-n-times-180', () => n * 180)]),
      verify: { type: 'evaluate', expr: `(${n} - 2)*180` },
    };
  }
  if (form === 1) {
    const n = rng.pick(REGULAR_N);
    const answer = numberAnswer(((n - 2) * 180) / n);
    return {
      params: { form, n, th: 0 },
      prompt: `What is the measure, in degrees, of each interior angle of a regular polygon with ${n} sides?`,
      answer,
      steps: [
        { key: 'angle-sum', instruction: 'First the total of the interior angles.', math: `(${n} - 2)\\cdot 180 = ${(n - 2) * 180}`, why: 'Sum of interior angles = (n − 2)·180°.', ask: { prompt: 'What is the sum of the interior angles?', answer: numberAnswer((n - 2) * 180), verify: { type: 'evaluate', expr: `(${n} - 2)*180` } } },
        { key: 'divide', instruction: `A regular polygon has ${n} equal angles: divide.`, math: `\\frac{${(n - 2) * 180}}{${n}} = ${((n - 2) * 180) / n}`, why: 'Check: also 180° − 360°/n.', ask: { prompt: 'What is each interior angle?', answer, verify: { type: 'evaluate', expr: `180 - 360/${n}` } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('forgot-divide-by-n', () => (n - 2) * 180)]),
      verify: { type: 'evaluate', expr: `180 - 360/${n}` },
    };
  }
  if (form === 2) {
    const n = rng.pick(REGULAR_N);
    const ang = 180 - 360 / n;
    const answer = numberAnswer(n);
    return {
      params: { form, n, th: ang },
      prompt: `Each interior angle of a regular polygon measures ${ang}°. How many sides does the polygon have?`,
      answer,
      steps: [
        { key: 'exterior', instruction: 'Each exterior angle is the supplement of the interior angle, and the exterior angles of any polygon add to 360°.', math: `180 - ${ang} = ${180 - ang}`, why: 'Interior + exterior = 180° at each vertex.', ask: { prompt: 'What is each exterior angle?', answer: numberAnswer(180 - ang), verify: { type: 'evaluate', expr: `180 - ${ang}` } } },
        { key: 'count', instruction: 'Divide 360° by the exterior angle.', math: `\\frac{360}{${180 - ang}} = ${n}`, why: 'n equal exterior angles total 360°.', ask: { prompt: 'How many sides?', answer, verify: { type: 'evaluate', expr: `360/(180 - ${ang})` } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('forgot-divide-by-n', () => 360 / ang)]),
      verify: { type: 'evaluate', expr: `360/(180 - ${ang})` },
    };
  }
  const nGood = rng.int(2, 3);
  const goods = rng.shuffle(GOOD_ANGLES).slice(0, nGood);
  const bads = rng.shuffle(BAD_ANGLES).slice(0, 6 - nGood);
  const labels = [...goods, ...bads].map((v) => `${v}°`);
  const { options, correct } = shuffleOptions(rng, labels, goods.map((_, i) => i));
  const answer = multiAnswer(options, correct);
  return {
    params: { form, n: 0, th: 0 },
    prompt: 'Which of the following could be the measure of an interior angle of a regular polygon?\n\nSelect all that apply.',
    answer,
    steps: [
      { key: 'exterior', instruction: 'For a regular n-gon the exterior angle is 360°/n, so 180° − (interior angle) must divide 360 into a whole number n ≥ 3.', math: 'n = \\frac{360}{180 - \\theta}', why: 'The number of sides must be a whole number.', ask: { prompt: 'For an interior angle of 120°, how many sides does the regular polygon have?', answer: numberAnswer(6), verify: { type: 'evaluate', expr: '360/(180 - 120)' } } },
      { key: 'test-each', instruction: 'Test each option with $n = 360/(180 - \\theta)$.', math: 'n \\in \\{3, 4, 5, \\dots\\}', why: 'Select-all: every valid option and no invalid one.', ask: { prompt: 'Select all possible interior angles.', answer } },
    ],
    misconceptions: [],
    verify: { type: 'choice', note: 'tests/skills/gre-circles-polygons.test.ts checks that 360/(180 - angle) is a whole number >= 3 for every option' },
  };
}

// ---------- level 4: composite figures ----------

function level4(rng: Rng): Body {
  for (;;) {
    const form = rng.int(0, 2);
    const r = rng.int(2, 8);
    const h = rng.int(2, 9);
    if (form === 2) {
      const answer = numberAnswer(2 * r * r);
      return {
        params: { form, r, h: 0 },
        prompt: `A square is inscribed in a circle of radius ${r}, so its four vertices lie on the circle. What is the area of the square?`,
        answer,
        steps: [
          { key: 'diagonal', instruction: `The square's diagonal is a diameter of the circle: ${2 * r}.`, math: `\\text{diagonal} = 2r = ${2 * r}`, why: 'A square inscribed in a circle has its diagonal equal to the diameter.', ask: { prompt: 'What is the diagonal of the square?', answer: numberAnswer(2 * r), verify: { type: 'evaluate', expr: `2*${r}` } } },
          { key: 'square-area', instruction: 'Area of a square from its diagonal: $A = \\frac{d^2}{2}$.', math: `\\frac{${2 * r}^2}{2} = ${2 * r * r}`, why: 'A square with side s has diagonal s√2, so area s² = d²/2.', ask: { prompt: 'What is the area of the square?', answer, verify: { type: 'evaluate', expr: `(2*${r})^2/2` } } },
        ],
        misconceptions: distinctMisconceptions(answer, [wrongNumber('inscribed-square-side-as-diameter', () => 4 * r * r)]),
        verify: { type: 'evaluate', expr: `(2*${r})^2/2` },
      };
    }
    const s = 2 * r;
    let items: { key: string; label: string }[];
    let prompt: string;
    let steps: Body['steps'];
    let misc: { id: string; key: string }[];
    if (form === 0) {
      prompt = `A circle is inscribed in a square with side length ${s}, so the circle touches all four sides. What is the area of the region inside the square but outside the circle?`;
      items = [
        { key: 'ok', label: `$${s * s} - ${piTerm(new Q(r * r))}$` },
        { key: 'dr', label: `$${s * s} - ${piTerm(new Q(s * s))}$` },
        { key: 'circ', label: `$${s * s} - ${piTerm(new Q(s))}$` },
        { key: 'rev', label: `$${piTerm(new Q(r * r))} - ${s * s}$` },
        { key: 'half', label: `$${s * s} - ${piTerm(new Q(r))}$` },
      ];
      misc = [{ id: 'diameter-as-radius', key: 'dr' }, { id: 'circumference-area-swap', key: 'circ' }];
      steps = [
        { key: 'radius', instruction: 'The circle touches all four sides, so its diameter equals the side of the square.', math: `r = \\frac{${s}}{2} = ${r}`, why: 'Inscribed circle: diameter = side.', ask: { prompt: 'What is the circle\'s radius?', answer: numberAnswer(r), verify: { type: 'evaluate', expr: `${s}/2` } } },
        { key: 'subtract', instruction: 'Shaded area = square − circle.', math: `${s}^2 - \\pi(${r})^2 = ${s * s} - ${r * r}\\pi`, why: 'Area of a region with a hole: subtract the hole.', ask: { prompt: 'Which expression is the shaded area?', answer: { kind: 'choice', options: [], correct: '' } } },
      ];
    } else {
      const base = 2 * r * h;
      prompt = `A figure is made of a rectangle with width ${s} and height ${h}, with a semicircle attached on top using the ${s}-unit side as its diameter. What is the total area of the figure?`;
      items = [
        { key: 'ok', label: `$${base} + ${piTerm(new Q(r * r, 2))}$` },
        { key: 'full', label: `$${base} + ${piTerm(new Q(r * r))}$` },
        { key: 'dr', label: `$${base} + ${piTerm(new Q(s * s, 2))}$` },
        { key: 'circ', label: `$${base} + ${piTerm(new Q(r))}$` },
        { key: 'norect', label: `$${r * h} + ${piTerm(new Q(r * r, 2))}$` },
      ];
      misc = [{ id: 'diameter-as-radius', key: 'dr' }, { id: 'circumference-area-swap', key: 'circ' }];
      steps = [
        { key: 'radius', instruction: `The semicircle's diameter is ${s}, so its radius is ${r}.`, math: `r = \\frac{${s}}{2} = ${r}`, why: 'The side it sits on is the diameter, not the radius.', ask: { prompt: 'What is the semicircle\'s radius?', answer: numberAnswer(r), verify: { type: 'evaluate', expr: `${s}/2` } } },
        { key: 'add', instruction: 'Total area = rectangle + half a circle.', math: `${s}\\cdot ${h} + \\tfrac12 \\pi (${r})^2 = ${base} + ${piTerm(new Q(r * r, 2))}`, why: 'Add the pieces; the semicircle is HALF of πr².', ask: { prompt: 'Which expression is the total area?', answer: { kind: 'choice', options: [], correct: '' } } },
      ];
    }
    const ch = buildChoice(rng, items, 'ok');
    if (!ch) continue;
    // the last step's ask is the final multiple-choice answer
    steps[1] = { ...steps[1], ask: { ...steps[1].ask!, answer: ch.answer } };
    return {
      params: { form, r, h: form === 1 ? h : 0 },
      prompt,
      answer: ch.answer,
      steps,
      misconceptions: distinctMisconceptions(ch.answer, misc.map((m) => ({ id: m.id, wrong: choiceAnswer(ch.options, ch.idOf(m.key)) }))),
      verify: { type: 'choice', note: 'tests/skills/gre-circles-polygons.test.ts recomputes the region area numerically and finds the matching option' },
    };
  }
}

// ---------- level 5: comparisons involving pi ----------

function level5(rng: Rng): Body {
  for (;;) {
    const form = rng.int(0, 2);
    if (form === 0) {
      const c = 2 * rng.int(2, 8); // circumference c*pi, so radius c/2
      const d = Math.max(2, Math.round(c * 1.25 * (0.6 + rng.next() * 0.9)));
      const A = PI * (c / 2) ** 2;
      const B = (d * d) / 2;
      if (Math.abs(A - B) < 0.05) continue;
      const relation: QcRelation = A > B ? 'a' : 'b';
      const answer = qcAnswer(relation);
      const wrongA = PI * c * c; // used c as the radius
      return {
        params: { form, p: c, q: d },
        prompt: QC_PROMPT('', `The area of a circle with circumference $${c}\\pi$`, `The area of a square with diagonal ${d}`),
        answer,
        steps: [
          { key: 'circle', instruction: `Circle: $2\\pi r = ${c}\\pi$, so $r = ${c / 2}$ and $A = ${(c / 2) ** 2}\\pi \\approx ${A.toFixed(1)}$.`, math: `A = \\pi (${c / 2})^2 = ${(c / 2) ** 2}\\pi`, why: 'Find the radius from the circumference first.', ask: { prompt: 'What is the radius of the circle?', answer: numberAnswer(c / 2), verify: { type: 'evaluate', expr: `${c}/2` } } },
          { key: 'square', instruction: `Square: area $= \\frac{d^2}{2} = \\frac{${d * d}}{2} = ${B}$.`, math: `\\frac{${d}^2}{2} = ${B}`, why: 'Diagonal d means side d/√2, so area d²/2.', ask: { prompt: 'What is the area of the square?', answer: numberAnswer(new Q(d * d, 2)), verify: { type: 'evaluate', expr: `${d}^2/2` } } },
          { key: 'decide', instruction: `Compare ${(c / 2) ** 2}π (use π ≈ 3.14) with ${B}.`, math: `${(c / 2) ** 2}\\pi \\approx ${A.toFixed(1)} \\text{ vs } ${B}`, why: 'With no variables the relationship is determined (never D).', ask: { prompt: 'So which is it?', answer } },
        ],
        misconceptions: distinctMisconceptions(answer, [{ id: 'diameter-as-radius', wrong: qcAnswer(wrongA > B ? 'a' : 'b') }]),
        verify: { type: 'qc', quantityA: `pi*(${c}/2)^2`, quantityB: `${d}^2/2`, variables: [], constraints: [] },
      };
    }
    if (form === 1) {
      const n = rng.int(2, 12);
      const m = rng.chance(0.4) ? 3 * n : Math.round(PI * n) + rng.int(-2, 2);
      const A = PI * n;
      if (Math.abs(A - m) < 0.05) continue;
      const relation: QcRelation = A > m ? 'a' : 'b';
      const answer = qcAnswer(relation);
      return {
        params: { form, p: n, q: m },
        prompt: QC_PROMPT('', `The circumference of a circle with diameter ${n}`, `${m}`),
        answer,
        steps: [
          { key: 'circle', instruction: 'Circumference $= \\pi d$.', math: `C = ${n}\\pi \\approx ${A.toFixed(2)}`, why: 'π is a little more than 3.14, not exactly 3.', ask: { prompt: `Is $${n}\\pi$ more or less than $${3 * n}$ (that is, $3 \\times ${n}$)?`, answer: { kind: 'choice', options: [{ id: 'more', label: 'More' }, { id: 'less', label: 'Less' }], correct: 'more' } } },
          { key: 'decide', instruction: `Compare ${A.toFixed(2)} with ${m}.`, math: `${n}\\pi \\text{ vs } ${m}`, why: 'Use π ≈ 3.14 and compare the decimals.', ask: { prompt: 'So which is it?', answer } },
        ],
        misconceptions: m === 3 * n ? [] : distinctMisconceptions(answer, [{ id: 'pi-as-three', wrong: qcAnswer(3 * n > m ? 'a' : 3 * n < m ? 'b' : 'c') }]),
        verify: { type: 'qc', quantityA: `pi*${n}`, quantityB: `${m}`, variables: [], constraints: [] },
      };
    }
    const r = rng.int(2, 9);
    const s = Math.max(2, Math.round(r * Math.sqrt(PI) + rng.int(-1, 1)));
    const A = PI * r * r;
    const B = s * s;
    if (Math.abs(A - B) < 0.05) continue;
    const relation: QcRelation = A > B ? 'a' : 'b';
    const answer = qcAnswer(relation);
    return {
      params: { form, p: r, q: s },
      prompt: QC_PROMPT('', `The area of a circle with radius ${r}`, `The area of a square with side ${s}`),
      answer,
      steps: [
        { key: 'circle', instruction: `Circle: $\\pi r^2 = ${r * r}\\pi \\approx ${A.toFixed(1)}$.`, math: `\\pi(${r})^2 = ${r * r}\\pi`, why: 'Area = π r².', ask: { prompt: 'What is the coefficient of π in the circle\'s area?', answer: numberAnswer(r * r), verify: { type: 'evaluate', expr: `${r}^2` } } },
        { key: 'square', instruction: `Square: $s^2 = ${B}$.`, math: `${s}^2 = ${B}`, why: 'Area = side².', ask: { prompt: 'What is the square\'s area?', answer: numberAnswer(B), verify: { type: 'evaluate', expr: `${s}^2` } } },
        { key: 'decide', instruction: `Compare ${A.toFixed(1)} with ${B}.`, math: `${r * r}\\pi \\text{ vs } ${B}`, why: 'Use π ≈ 3.14.', ask: { prompt: 'So which is it?', answer } },
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'pi-as-three', wrong: qcAnswer(3 * r * r > B ? 'a' : 3 * r * r < B ? 'b' : 'c') }]),
      verify: { type: 'qc', quantityA: `pi*${r}^2`, quantityB: `${s}^2`, variables: [], constraints: [] },
    };
  }
}

export const greCirclesPolygons: SkillDefinition = {
  id: ID,
  title: 'Circles & polygons',
  track: 'gre',
  unit: 'GRE · Geometry',
  description: 'Circle area and circumference, arcs and sectors, polygon angles, composite regions, and comparisons that involve pi.',
  prerequisites: ['gre-lines-angles-triangles'],
  maxDenominator: 6,
  levels: {
    1: { description: 'Area and circumference (coefficient of π)', ranges: { form: [0, 4], r: [2, 12] } },
    2: { description: 'Arc length and sector area', ranges: { form: [0, 2], r: [2, 12], th: [30, 270], useD: [0, 1] } },
    3: { description: 'Polygon angles (numeric, select all)', ranges: { form: [0, 3], n: [0, 36], th: [0, 175] } },
    4: { description: 'Composite figures (multiple choice)', ranges: { form: [0, 2], r: [2, 8], h: [0, 9] } },
    5: { description: 'Quantitative comparison with π', ranges: { form: [0, 2], p: [2, 16], q: [2, 40] } },
  },
  misconceptions: {
    'diameter-as-radius': { name: 'Used the diameter where the radius was needed', explanation: 'Area is $\\pi r^2$ and circumference is $2\\pi r$ with $r$ the RADIUS. If you are given the diameter, halve it first (a semicircle on a side of length $s$ has radius $s/2$).' },
    'circumference-area-swap': { name: 'Mixed up circumference and area', explanation: 'Circumference $= 2\\pi r$ (a length, $r$ to the first power). Area $= \\pi r^2$ (square units, $r$ squared). Check the units.' },
    'polygon-sum-n-times-180': { name: 'Used n·180 for the angle sum', explanation: 'Splitting a polygon into triangles from one vertex gives $n - 2$ triangles, so the interior angles sum to $(n-2)\\cdot 180^\\circ$.' },
    'forgot-divide-by-n': { name: 'Used the total or the wrong division', explanation: 'Each interior angle of a regular $n$-gon is the total $(n-2)\\cdot 180$ divided by $n$ (or $180 - \\frac{360}{n}$). Going backwards, $n = \\frac{360}{180 - \\text{interior}}$.' },
    'sector-fraction-wrong': { name: 'Used angle/180 instead of angle/360', explanation: 'A full circle is $360^\\circ$, so a sector with central angle $\\theta$ is $\\frac{\\theta}{360}$ of the circle. A semicircle ($180^\\circ$) is one half.' },
    'inscribed-square-side-as-diameter': { name: 'Took the side of the inscribed square to be the diameter', explanation: 'For a square inscribed in a circle, the DIAGONAL equals the diameter. Area of the square is then $\\frac{d^2}{2}$, half of the circumscribed square.' },
    'pi-as-three': { name: 'Treated π as exactly 3', explanation: '$\\pi \\approx 3.14159$ is slightly more than 3, which is exactly what comparisons with whole numbers are testing. Use 3.14 and compare decimals.' },
  },
  stepLabels: {
    formula: 'Choose the formula',
    coefficient: 'Find the coefficient of π',
    radius: 'Find the radius',
    fraction: 'Find the fraction of the circle',
    arc: 'Arc length',
    'sector-area': 'Sector area',
    angle: 'Find the central angle',
    triangles: 'Count the triangles',
    'angle-sum': 'Sum of interior angles',
    divide: 'Divide among the angles',
    exterior: 'Use the exterior angle',
    count: 'Count the sides',
    'test-each': 'Test each option',
    diagonal: 'Diagonal equals diameter',
    'square-area': 'Area of a square from its diagonal',
    subtract: 'Subtract the removed region',
    add: 'Add the pieces',
    circle: 'Evaluate the circle quantity',
    square: 'Evaluate the square quantity',
    decide: 'Decide the relationship',
  },
  learn: {
    whyItMatters:
      'Circle and polygon formulas are GRE staples, and many questions are really about not mixing them up: radius versus diameter, circumference versus area, and the fact that $\\pi$ is a bit more than 3 (which decides quantitative comparisons like a circle versus a square). Leaving answers in terms of $\\pi$ also keeps arithmetic exact. In economics the same geometry shows up as areas under curves: a triangle under a linear demand curve is half base times height, and a pie chart sector is just angle/360 of the whole budget.',
    summary:
      'Circle: $A = \\pi r^2$, $C = 2\\pi r = \\pi d$. A sector with central angle $\\theta$ is $\\frac{\\theta}{360}$ of the circle (area and arc length). A polygon with $n$ sides has interior angles summing to $(n-2)\\cdot 180^\\circ$; each angle of a regular $n$-gon is $180 - \\frac{360}{n}$. A square inscribed in a circle has its diagonal equal to the diameter. For composite regions, add or subtract simple pieces.',
    formulas: [
      { latex: 'A = \\pi r^2, \\qquad C = 2\\pi r' },
      { latex: '\\text{sector} = \\frac{\\theta}{360}\\cdot \\pi r^2, \\qquad \\text{arc} = \\frac{\\theta}{360}\\cdot 2\\pi r' },
      { latex: '\\text{angle sum} = (n-2)\\cdot 180^\\circ, \\qquad \\text{each angle} = 180 - \\frac{360}{n}' },
    ],
    example: { seed: 2, level: 2 },
    tips: ['Circle area and circumference: circle the word "radius" or "diameter" first.', 'Leave π in the answer unless told to approximate.'],
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
