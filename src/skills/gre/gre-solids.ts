// GRE Solids: volume & surface area. Formats: numeric entry (L1-L5), multiple choice (L5 cube
// diagonal with surd options), quantitative comparison (L4, variable-free so the relation is exact
// integer arithmetic). There is no 3-D figure builder in engine/figures.ts, so these problems are
// stated in words with every measurement given (see the report).

import { choiceAnswer, numberAnswer, qcAnswer, wrongNumber, type QcRelation } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, Level, SkillDefinition } from '../../engine/types';

const ID = 'gre-solids';
type Body = ReturnType<SkillDefinition['generate']>;

const QC_PROMPT = (setup: string, A: string, B: string) =>
  `${setup ? `${setup}\n\n` : ''}**Quantity A:** ${A}\n\n**Quantity B:** ${B}\n\nCompare Quantity A and Quantity B.`;
const rel = (a: number, b: number): QcRelation => (a > b ? 'a' : a < b ? 'b' : 'c');

function buildChoice(rng: Rng, items: { label: string; key: string }[], correctKey: string) {
  if (new Set(items.map((i) => i.label)).size !== items.length) return null;
  const shuffled = rng.shuffle(items);
  const options: ChoiceOption[] = shuffled.map((it, i) => ({ id: `o${i}`, label: it.label }));
  const idOf = (key: string) => options[shuffled.findIndex((s) => s.key === key)].id;
  return { options, answer: choiceAnswer(options, idOf(correctKey)), idOf };
}

// ---------- level 1: volume ----------

function level1(rng: Rng): Body {
  const form = rng.int(0, 3);
  const l = rng.int(2, 12);
  const w = rng.int(2, 10);
  const h = rng.int(2, 9);
  const e = rng.int(2, 9);
  const params = { form, l, w, h: form >= 2 ? e : h };
  if (form === 0) {
    const answer = numberAnswer(l * w * h);
    return {
      params,
      prompt: `A rectangular box has length ${l}, width ${w} and height ${h}. What is its volume?`,
      answer,
      steps: [
        { key: 'base', instruction: 'Volume = length × width × height. Start with the area of the base.', math: `${l} \\times ${w} = ${l * w}`, why: 'Volume is base area times height.', ask: { prompt: 'What is the area of the base?', answer: numberAnswer(l * w), verify: { type: 'evaluate', expr: `${l}*${w}` } } },
        { key: 'volume', instruction: 'Multiply by the height.', math: `${l * w} \\times ${h} = ${l * w * h}`, why: 'V = lwh.', ask: { prompt: 'What is the volume?', answer, verify: { type: 'evaluate', expr: `${l}*${w}*${h}` } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('volume-added', () => l + w + h)]),
      verify: { type: 'evaluate', expr: `${l}*${w}*${h}` },
    };
  }
  if (form === 1) {
    const V = l * w * h;
    const answer = numberAnswer(h);
    return {
      params,
      prompt: `A rectangular box has volume ${V}, length ${l} and width ${w}. What is its height?`,
      answer,
      steps: [
        { key: 'base', instruction: 'Volume = base area × height, so height = volume ÷ base area.', math: `${l} \\times ${w} = ${l * w}`, why: 'Undo the multiplication by dividing.', ask: { prompt: 'What is the area of the base?', answer: numberAnswer(l * w), verify: { type: 'evaluate', expr: `${l}*${w}` } } },
        { key: 'divide', instruction: 'Divide the volume by the base area.', math: `\\frac{${V}}{${l * w}} = ${h}`, why: 'h = V ÷ (lw).', ask: { prompt: 'What is the height?', answer, verify: { type: 'solve', equations: [`${l}*${w}*x = ${V}`], unknowns: ['x'] } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('volume-added', () => V - l - w)]),
      verify: { type: 'solve', equations: [`${l}*${w}*x = ${V}`], unknowns: ['x'] },
    };
  }
  if (form === 2) {
    const answer = numberAnswer(e ** 3);
    return {
      params,
      prompt: `A cube has edges of length ${e}. What is its volume?`,
      answer,
      steps: [
        { key: 'formula', instruction: 'A cube has three equal dimensions, so $V = e^3$.', math: `${e}^3 = ${e} \\times ${e} \\times ${e}`, why: 'Cubed, not tripled.', ask: { prompt: `What is $${e}^2$?`, answer: numberAnswer(e * e), verify: { type: 'evaluate', expr: `${e}^2` } } },
        { key: 'volume', instruction: 'Multiply once more.', math: `${e * e} \\times ${e} = ${e ** 3}`, why: 'V = e³.', ask: { prompt: 'What is the volume?', answer, verify: { type: 'evaluate', expr: `${e}^3` } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('volume-added', () => 3 * e), wrongNumber('volume-added', () => e * e)]),
      verify: { type: 'evaluate', expr: `${e}^3` },
    };
  }
  const answer = numberAnswer(e);
  return {
    params,
    prompt: `A cube has volume ${e ** 3}. What is the length of one edge?`,
    answer,
    steps: [
      { key: 'formula', instruction: 'For a cube, $V = e^3$, so the edge is the cube root of the volume. Back-solve: which whole number cubed gives the volume?', math: `e^3 = ${e ** 3}`, why: 'Check small cubes: 8, 27, 64, 125, 216, 343, 512, 729.', ask: { prompt: `What is $e^2$ (the area of one face)?`, answer: numberAnswer(e * e), verify: { type: 'evaluate', expr: `(${e ** 3})^(2/3)` } } },
      { key: 'volume', instruction: 'The edge is the cube root.', math: `e = \\sqrt[3]{${e ** 3}} = ${e}`, why: 'Cube root undoes cubing.', ask: { prompt: 'What is the edge length?', answer, verify: { type: 'evaluate', expr: `(${e ** 3})^(1/3)` } } },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('cube-root-as-divide', () => (e ** 3) / 3)]),
    verify: { type: 'evaluate', expr: `(${e ** 3})^(1/3)` },
  };
}

// ---------- level 2: surface area ----------

function level2(rng: Rng): Body {
  const form = rng.int(0, 3);
  const l = rng.int(2, 12);
  const w = rng.int(2, 10);
  const h = rng.int(2, 9);
  const e = rng.int(2, 9);
  const params = { form, l, w, h: form === 0 ? h : e };
  if (form === 0) {
    const sum = l * w + l * h + w * h;
    const answer = numberAnswer(2 * sum);
    const expr = `2*(${l}*${w} + ${l}*${h} + ${w}*${h})`;
    return {
      params: { form, l, w, h },
      prompt: `A rectangular box has length ${l}, width ${w} and height ${h}. What is its total surface area?`,
      answer,
      steps: [
        { key: 'faces', instruction: 'A box has three pairs of identical faces: $lw$, $lh$ and $wh$.', math: `${l}\\cdot ${w} + ${l}\\cdot ${h} + ${w}\\cdot ${h} = ${sum}`, why: 'List the three different faces once each.', ask: { prompt: 'What is $lw + lh + wh$?', answer: numberAnswer(sum), verify: { type: 'evaluate', expr: `${l}*${w} + ${l}*${h} + ${w}*${h}` } } },
        { key: 'double', instruction: 'Each face appears twice, so double.', math: `2 \\times ${sum} = ${2 * sum}`, why: 'Surface area = 2(lw + lh + wh).', ask: { prompt: 'What is the surface area?', answer, verify: { type: 'evaluate', expr } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('surface-area-half', () => sum), wrongNumber('volume-added', () => l * w * h)]),
      verify: { type: 'evaluate', expr },
    };
  }
  if (form === 1) {
    const answer = numberAnswer(6 * e * e);
    return {
      params,
      prompt: `A cube has edges of length ${e}. What is its total surface area?`,
      answer,
      steps: [
        { key: 'faces', instruction: 'A cube has 6 identical square faces.', math: `${e}^2 = ${e * e}`, why: 'Each face is e × e.', ask: { prompt: 'What is the area of one face?', answer: numberAnswer(e * e), verify: { type: 'evaluate', expr: `${e}^2` } } },
        { key: 'double', instruction: 'Multiply by the six faces.', math: `6 \\times ${e * e} = ${6 * e * e}`, why: 'Surface area of a cube = 6e².', ask: { prompt: 'What is the surface area?', answer, verify: { type: 'evaluate', expr: `6*${e}^2` } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('surface-area-half', () => 3 * e * e), wrongNumber('volume-added', () => e ** 3)]),
      verify: { type: 'evaluate', expr: `6*${e}^2` },
    };
  }
  if (form === 2) {
    const A = 6 * e * e;
    const answer = numberAnswer(e);
    return {
      params,
      prompt: `A cube has a total surface area of ${A}. What is the length of one edge?`,
      answer,
      steps: [
        { key: 'faces', instruction: 'The cube has 6 identical faces, so one face has area A ÷ 6.', math: `\\frac{${A}}{6} = ${e * e}`, why: 'Divide the surface area among the six faces.', ask: { prompt: 'What is the area of one face?', answer: numberAnswer(e * e), verify: { type: 'evaluate', expr: `${A}/6` } } },
        { key: 'edge', instruction: 'The edge is the square root of the face area.', math: `\\sqrt{${e * e}} = ${e}`, why: 'Face area = e².', ask: { prompt: 'What is the edge?', answer, verify: { type: 'evaluate', expr: `sqrt(${A}/6)` } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('face-area-not-rooted', () => e * e)]),
      verify: { type: 'evaluate', expr: `sqrt(${A}/6)` },
    };
  }
  // form 3: box with a missing dimension, surface area given
  const sum = l * w + l * h + w * h;
  const A = 2 * sum;
  const answer = numberAnswer(h);
  return {
    params: { form, l, w, h },
    prompt: `A rectangular box has surface area ${A}, length ${l} and width ${w}. What is its height?`,
    answer,
    steps: [
      { key: 'faces', instruction: `Half the surface area is $lw + lh + wh = ${sum}$.`, math: `\\frac{${A}}{2} = ${sum}`, why: 'Surface area = 2(lw + lh + wh).', ask: { prompt: 'What is $lw + lh + wh$?', answer: numberAnswer(sum), verify: { type: 'evaluate', expr: `${A}/2` } } },
      { key: 'solve', instruction: `Substitute $l$ and $w$: ${l * w} + ${l + w}h = ${sum}.`, math: `h = \\frac{${sum} - ${l * w}}{${l + w}} = ${h}`, why: 'Collect the h terms: h(l + w).', ask: { prompt: 'What is the height?', answer, verify: { type: 'solve', equations: [`2*(${l}*${w} + ${l}*x + ${w}*x) = ${A}`], unknowns: ['x'] } } },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('surface-area-half', () => (A - l * w) / (l + w))]),
    verify: { type: 'solve', equations: [`2*(${l}*${w} + ${l}*x + ${w}*x) = ${A}`], unknowns: ['x'] },
  };
}

// ---------- level 3: cylinders ----------

function level3(rng: Rng): Body {
  const form = rng.int(0, 2);
  const r = rng.int(2, 9);
  const h = rng.int(2, 12);
  const d = 2 * r;
  const params = { form, r, h };
  if (form === 0) {
    const answer = numberAnswer(r * r * h);
    return {
      params,
      prompt: `A right circular cylinder has radius ${r} and height ${h}. Its volume is $k\\pi$. What is $k$?`,
      answer,
      steps: [
        { key: 'formula', instruction: 'Volume = base area × height = $\\pi r^2 h$.', math: `\\pi (${r})^2 (${h})`, why: 'The base is a circle of area πr².', ask: { prompt: 'What is $r^2$?', answer: numberAnswer(r * r), verify: { type: 'evaluate', expr: `${r}^2` } } },
        { key: 'coefficient', instruction: 'Multiply by the height.', math: `V = ${r * r}\\cdot ${h}\\,\\pi = ${r * r * h}\\pi`, why: 'Leave the answer as a multiple of π.', ask: { prompt: 'What is $k$?', answer, verify: { type: 'evaluate', expr: `${r}^2*${h}` } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('cylinder-lateral-only', () => 2 * r * h)]),
      verify: { type: 'evaluate', expr: `${r}^2*${h}` },
    };
  }
  if (form === 1) {
    const answer = numberAnswer(2 * r * r + 2 * r * h);
    const expr = `2*${r}^2 + 2*${r}*${h}`;
    return {
      params,
      prompt: `A closed right circular cylinder has radius ${r} and height ${h}. Its total surface area is $k\\pi$. What is $k$?`,
      answer,
      steps: [
        { key: 'lateral', instruction: 'The curved side unrolls into a rectangle of width $2\\pi r$ and height $h$.', math: `2\\pi (${r})(${h}) = ${2 * r * h}\\pi`, why: 'Lateral area = circumference × height.', ask: { prompt: 'What is the coefficient of π for the curved side?', answer: numberAnswer(2 * r * h), verify: { type: 'evaluate', expr: `2*${r}*${h}` } } },
        { key: 'ends', instruction: 'Add the two circular ends, each $\\pi r^2$.', math: `${2 * r * h}\\pi + 2\\pi(${r})^2 = ${2 * r * h + 2 * r * r}\\pi`, why: 'A closed cylinder has a top AND a bottom.', ask: { prompt: 'What is $k$?', answer, verify: { type: 'evaluate', expr } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('cylinder-lateral-only', () => 2 * r * h), wrongNumber('cylinder-lateral-only', () => r * r + 2 * r * h)]),
      verify: { type: 'evaluate', expr },
    };
  }
  const answer = numberAnswer(r * r * h);
  return {
    params,
    prompt: `A right circular cylinder has a base with diameter ${d} and height ${h}. Its volume is $k\\pi$. What is $k$?`,
    answer,
    steps: [
      { key: 'radius', instruction: 'The formula needs the radius: half the diameter.', math: `r = \\frac{${d}}{2} = ${r}`, why: 'Read "diameter" carefully.', ask: { prompt: 'What is the radius?', answer: numberAnswer(r), verify: { type: 'evaluate', expr: `${d}/2` } } },
      { key: 'coefficient', instruction: 'Now $V = \\pi r^2 h$.', math: `V = \\pi (${r})^2 (${h}) = ${r * r * h}\\pi`, why: 'Square the radius, not the diameter.', ask: { prompt: 'What is $k$?', answer, verify: { type: 'evaluate', expr: `(${d}/2)^2*${h}` } } },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('cylinder-diameter-as-radius', () => d * d * h)]),
    verify: { type: 'evaluate', expr: `(${d}/2)^2*${h}` },
  };
}

// ---------- level 4: scaling ----------

function level4(rng: Rng): Body {
  const form = rng.int(0, 3);
  const k = rng.int(2, 5);
  const e = rng.int(2, 6);
  const v = rng.int(6, 60);
  const cube = k ** 3;
  const mPick = rng.int(0, 3);
  const m = mPick <= 1 ? cube : mPick === 2 ? rng.int(2, 130) : k * k;
  const params = { form, k, e, v, m: form === 3 ? m : 0 };
  if (form === 0) {
    const answer = numberAnswer(cube);
    return {
      params,
      prompt: `Every edge of a cube is multiplied by ${k}. By what factor does the volume of the cube increase?`,
      answer,
      steps: [
        { key: 'scale', instruction: 'Volume depends on three lengths, so each factor of the scale is applied three times.', math: `(${k}e)^3 = ${k}^3 e^3`, why: 'Lengths scale by k, areas by k², volumes by k³.', ask: { prompt: `What is $${k}^2$?`, answer: numberAnswer(k * k), verify: { type: 'evaluate', expr: `${k}^2` } } },
        { key: 'factor', instruction: 'Cube the scale factor.', math: `${k}^3 = ${cube}`, why: 'V scales with the cube of the length factor.', ask: { prompt: 'By what factor does the volume increase?', answer, verify: { type: 'evaluate', expr: `${k}^3` } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('scaling-linear', () => k), wrongNumber('scaling-linear', () => k * k)]),
      verify: { type: 'evaluate', expr: `${k}^3` },
    };
  }
  if (form === 1) {
    const answer = numberAnswer(k * k);
    return {
      params,
      prompt: `Every edge of a cube is multiplied by ${k}. By what factor does the total surface area increase?`,
      answer,
      steps: [
        { key: 'scale', instruction: 'Surface area is an area (two lengths multiplied), so it scales with the square of the length factor.', math: `(${k}e)^2 = ${k}^2 e^2`, why: 'Lengths scale by k, areas by k², volumes by k³.', ask: { prompt: 'What is the new area of one face compared with the old, as a factor?', answer: numberAnswer(k * k), verify: { type: 'evaluate', expr: `${k}^2` } } },
        { key: 'factor', instruction: 'All six faces scale the same way.', math: `${k}^2 = ${k * k}`, why: 'The total scales by the same factor as each face.', ask: { prompt: 'By what factor does the surface area increase?', answer, verify: { type: 'evaluate', expr: `${k}^2` } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('scaling-linear', () => k), wrongNumber('scaling-linear', () => cube)]),
      verify: { type: 'evaluate', expr: `${k}^2` },
    };
  }
  if (form === 2) {
    const answer = numberAnswer(v * cube);
    return {
      params,
      prompt: `A rectangular box has volume ${v}. If its length, width and height are each multiplied by ${k}, what is the volume of the new box?`,
      answer,
      steps: [
        { key: 'scale', instruction: `Each of the three dimensions is multiplied by ${k}, so the volume is multiplied by ${k}³.`, math: `${k}^3 = ${cube}`, why: 'V = lwh, so V scales with the cube of the length factor.', ask: { prompt: 'By what factor does the volume increase?', answer: numberAnswer(cube), verify: { type: 'evaluate', expr: `${k}^3` } } },
        { key: 'factor', instruction: 'Multiply the original volume by that factor.', math: `${v} \\times ${cube} = ${v * cube}`, why: 'New volume = old volume × k³.', ask: { prompt: 'What is the new volume?', answer, verify: { type: 'evaluate', expr: `${v}*${k}^3` } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('scaling-linear', () => v * k), wrongNumber('scaling-linear', () => v * k * k)]),
      verify: { type: 'evaluate', expr: `${v}*${k}^3` },
    };
  }
  // form 3: QC with exact integer arithmetic
  const A = (k * e) ** 3;
  const B = m * e ** 3;
  const relation = rel(A, B);
  const answer = qcAnswer(relation);
  return {
    params,
    prompt: QC_PROMPT('', `The volume of a cube with edge ${k * e}`, `${m} times the volume of a cube with edge ${e}`),
    answer,
    steps: [
      { key: 'scale', instruction: `The first cube's edge is ${k} times the second's, so its volume is ${k}³ = ${cube} times the second's.`, math: `\\frac{(${k * e})^3}{${e}^3} = ${k}^3 = ${cube}`, why: 'Volume scales with the cube of the edge ratio, so no need to compute either volume.', ask: { prompt: 'The first volume is how many times the second volume?', answer: numberAnswer(cube), verify: { type: 'evaluate', expr: `${k}^3` } } },
      { key: 'decide', instruction: `Compare ${cube} with ${m}.`, math: `${cube} \\text{ vs } ${m}`, why: 'With no variables the relationship is determined (never D).', ask: { prompt: 'So which is it?', answer } },
    ],
    misconceptions: distinctMisconceptions(answer, [{ id: 'scaling-linear', wrong: qcAnswer(rel(k, m)) }]),
    verify: { type: 'qc', quantityA: `(${k * e})^3`, quantityB: `${m}*${e}^3`, variables: [], constraints: [] },
  };
}

// ---------- level 5: the longest diagonal ----------

const QUADS: [number, number, number, number][] = [
  [1, 2, 2, 3],
  [2, 3, 6, 7],
  [1, 4, 8, 9],
  [4, 4, 7, 9],
  [2, 6, 9, 11],
  [6, 6, 7, 11],
  [2, 10, 11, 15],
  [2, 5, 14, 15],
  [4, 8, 8, 12],
  [3, 4, 12, 13],
  [8, 9, 12, 17],
];

function level5(rng: Rng): Body {
  const form = rng.int(0, 2) === 0 ? 1 : 0;
  if (form === 0) {
    const [a, b, c, D] = rng.pick(QUADS);
    const dims = rng.shuffle([a, b, c]);
    const [l, w, h] = dims;
    const answer = numberAnswer(D);
    const expr = `sqrt(${l}^2 + ${w}^2 + ${h}^2)`;
    return {
      params: { form, l, w, h, e: 0 },
      prompt: `A rectangular box has dimensions ${l} by ${w} by ${h}. What is the length of the longest straight line segment that can be drawn between two points of the box (from one corner to the opposite corner)?`,
      answer,
      steps: [
        { key: 'sum-squares', instruction: 'The space diagonal is $\\sqrt{l^2 + w^2 + h^2}$ (the Pythagorean theorem used twice).', math: `${l}^2 + ${w}^2 + ${h}^2 = ${l * l + w * w + h * h}`, why: 'Face diagonal first, then the diagonal through the box.', ask: { prompt: 'What is $l^2 + w^2 + h^2$?', answer: numberAnswer(l * l + w * w + h * h), verify: { type: 'evaluate', expr: `${l}^2 + ${w}^2 + ${h}^2` } } },
        { key: 'root', instruction: 'Take the square root.', math: `\\sqrt{${l * l + w * w + h * h}} = ${D}`, why: `These are the quadruples worth memorizing: (2, 3, 6, 7), (1, 4, 8, 9), (2, 6, 9, 11), (4, 4, 7, 9).`, ask: { prompt: 'What is the diagonal?', answer, verify: { type: 'evaluate', expr } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('diagonal-added-dims', () => l + w + h), wrongNumber('diagonal-no-root', () => l * l + w * w + h * h)]),
      verify: { type: 'evaluate', expr },
    };
  }
  const e = rng.int(2, 9);
  const lab = (k: string) => `$${k}$`;
  const items = [
    { key: 'ok', label: lab(`${e}\\sqrt{3}`) },
    { key: 'face', label: lab(`${e}\\sqrt{2}`) },
    { key: 'sum', label: lab(`${3 * e}`) },
    { key: 'twice', label: lab(`${2 * e}`) },
    { key: 'sq', label: lab(`${3 * e * e}`) },
  ];
  const ch = buildChoice(rng, items, 'ok');
  if (!ch) return level5(rng);
  return {
    params: { form, l: 0, w: 0, h: 0, e },
    prompt: `A cube has edges of length ${e}. What is the distance between two opposite corners of the cube (the longest segment that fits inside it)?`,
    answer: ch.answer,
    steps: [
      { key: 'sum-squares', instruction: 'For a cube $l = w = h = e$, so the space diagonal is $\\sqrt{e^2 + e^2 + e^2} = \\sqrt{3e^2}$.', math: `${e}^2 + ${e}^2 + ${e}^2 = ${3 * e * e}`, why: 'The face diagonal is e√2; the space diagonal is e√3.', ask: { prompt: 'What is $e^2 + e^2 + e^2$?', answer: numberAnswer(3 * e * e), verify: { type: 'evaluate', expr: `3*${e}^2` } } },
      { key: 'root', instruction: `$\\sqrt{${3 * e * e}} = ${e}\\sqrt{3}$.`, math: `d = ${e}\\sqrt{3}`, why: 'Pull the perfect square out of the root.', ask: { prompt: 'Which option is the space diagonal?', answer: ch.answer } },
    ],
    misconceptions: distinctMisconceptions(ch.answer, [
      { id: 'diagonal-face-not-space', wrong: choiceAnswer(ch.options, ch.idOf('face')) },
      { id: 'diagonal-added-dims', wrong: choiceAnswer(ch.options, ch.idOf('sum')) },
      { id: 'diagonal-no-root', wrong: choiceAnswer(ch.options, ch.idOf('sq')) },
    ]),
    verify: { type: 'choice', note: 'tests/skills/gre-solids.test.ts computes the corner-to-corner distance numerically and finds the matching option' },
  };
}

export const greSolids: SkillDefinition = {
  id: ID,
  title: 'Solids: volume & surface area',
  track: 'gre',
  unit: 'GRE · Geometry',
  description: 'Volume and surface area of boxes, cubes and cylinders, how scaling changes them, and the space diagonal.',
  prerequisites: ['gre-circles-polygons'],
  maxDenominator: 1,
  levels: {
    1: { description: 'Volume of boxes and cubes', ranges: { form: [0, 3], l: [2, 12], w: [2, 10], h: [2, 9] } },
    2: { description: 'Surface area of boxes and cubes', ranges: { form: [0, 3], l: [2, 12], w: [2, 10], h: [2, 9] } },
    3: { description: 'Cylinders (coefficient of π)', ranges: { form: [0, 2], r: [2, 9], h: [2, 12] } },
    4: { description: 'Scaling, including comparisons', ranges: { form: [0, 3], k: [2, 5], e: [2, 6], v: [6, 60], m: [0, 130] } },
    5: { description: 'The longest diagonal of a box (numeric, multiple choice)', ranges: { form: [0, 1], l: [0, 14], w: [0, 14], h: [0, 14], e: [0, 9] } },
  },
  misconceptions: {
    'volume-added': { name: 'Added the dimensions (or used a face area) for the volume', explanation: 'Volume is length × width × height, not their sum. A cube with edge $e$ has volume $e^3$, not $3e$ or $e^2$.' },
    'cube-root-as-divide': { name: 'Divided by 3 instead of taking a cube root', explanation: 'If $e^3 = V$ then $e = \\sqrt[3]{V}$. Dividing by 3 does not undo cubing: try $2^3 = 8$, and $8 \\div 3$ is not 2.' },
    'surface-area-half': { name: 'Forgot to double (or counted too few faces)', explanation: 'A box has SIX faces in three identical pairs, so $SA = 2(lw + lh + wh)$. A cube is $6e^2$. Without the 2 you have counted only half the faces.' },
    'face-area-not-rooted': { name: 'Gave the face area instead of the edge', explanation: 'Dividing the surface area by 6 gives the area of ONE FACE, $e^2$. The edge is its square root.' },
    'cylinder-lateral-only': { name: 'Left out the circular ends', explanation: 'A closed cylinder has a curved side ($2\\pi r h$) AND two circular ends ($2\\pi r^2$). Total: $2\\pi r^2 + 2\\pi r h$.' },
    'cylinder-diameter-as-radius': { name: 'Used the diameter as the radius', explanation: '$V = \\pi r^2 h$ needs the RADIUS. If the diameter is $d$, use $r = d/2$, so $V = \\pi (d/2)^2 h$.' },
    'scaling-linear': { name: 'Scaled volume or area linearly', explanation: 'Multiplying every length by $k$ multiplies areas by $k^2$ and volumes by $k^3$. Doubling the edges makes the volume 8 times larger, not 2 times.' },
    'diagonal-added-dims': { name: 'Added the dimensions for the diagonal', explanation: 'The space diagonal is $\\sqrt{l^2 + w^2 + h^2}$, which is shorter than $l + w + h$ (a straight line is the shortest path).' },
    'diagonal-no-root': { name: 'Forgot the square root', explanation: '$l^2 + w^2 + h^2$ is the SQUARE of the diagonal. Take the square root.' },
    'diagonal-face-not-space': { name: 'Used the face diagonal', explanation: 'A face diagonal is $e\\sqrt{2}$. The diagonal through the inside of the cube from corner to opposite corner is $e\\sqrt{3}$.' },
  },
  stepLabels: {
    base: 'Area of the base',
    volume: 'Multiply to get the volume',
    divide: 'Divide to find the missing dimension',
    formula: 'Choose the formula',
    faces: 'Count the faces',
    double: 'Double or multiply by six',
    edge: 'Take the root for the edge',
    solve: 'Solve for the dimension',
    coefficient: 'Find the coefficient of π',
    lateral: 'Curved side area',
    ends: 'Add the circular ends',
    radius: 'Find the radius',
    scale: 'Apply the scale factor',
    factor: 'Compute the factor',
    decide: 'Decide the relationship',
    'sum-squares': 'Sum the squares of the dimensions',
    root: 'Take the square root',
  },
  learn: {
    whyItMatters:
      'GRE solid-geometry questions test a handful of formulas and one big idea: lengths, areas and volumes scale differently. Doubling every edge doubles each length, multiplies each area by 4 and each volume by 8, which settles many quantitative comparisons without any computing. The same scaling logic appears in economics as returns to scale: if a firm doubles every input and output more than doubles, there are increasing returns, just as a bigger tank holds more than twice as much per extra unit of wall.',
    summary:
      'Box: $V = lwh$, $SA = 2(lw + lh + wh)$. Cube: $V = e^3$, $SA = 6e^2$. Cylinder: $V = \\pi r^2 h$, closed $SA = 2\\pi r^2 + 2\\pi r h$. Scaling every length by $k$ scales area by $k^2$ and volume by $k^3$. The longest segment in a box is the space diagonal $\\sqrt{l^2 + w^2 + h^2}$; useful quadruples: (2,3,6,7), (1,4,8,9), (2,6,9,11), (4,4,7,9).',
    formulas: [
      { latex: 'V = lwh, \\qquad SA = 2(lw + lh + wh)' },
      { latex: 'V = \\pi r^2 h, \\qquad SA = 2\\pi r^2 + 2\\pi r h' },
      { latex: 'd = \\sqrt{l^2 + w^2 + h^2}' },
      { latex: '\\text{lengths} \\times k \\;\\Rightarrow\\; \\text{areas} \\times k^2,\\; \\text{volumes} \\times k^3' },
    ],
    example: { seed: 4, level: 4 },
    tips: ['Doubling every edge multiplies the volume by 8.', 'Sketch the solid and list its faces before computing surface area.'],
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
