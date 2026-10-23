// Cobb-Douglas production Q = A·L^α·K^β: output at a point, returns to scale, marginal products,
// the MRTS, and growth accounting. Inputs are perfect powers so every answer is exact.

import { choiceAnswer, numberAnswer } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, InterpretationQuestion, MisconceptionInstance, SkillDefinition, Step, VerifySpec } from '../../engine/types';

const ID = 'cobb-douglas-production';

/** Exponent menu. Index 5 (the exponent 1) is only used by the returns-to-scale level. */
const EXPS: Q[] = [q(1, 4), q(1, 3), q(1, 2), q(2, 3), q(3, 4), q(1)];

/** Largest base so that base^den stays ≤ 100. */
const MAX_BASE: Record<number, number> = { 2: 10, 3: 4, 4: 3 };

/** An input that is a perfect power for the exponent's denominator, so x^e is an integer. */
function pickInput(rng: Rng, e: Q): { x: number; root: number } {
  const root = rng.int(2, MAX_BASE[e.d]);
  return { x: root ** e.d, root };
}

/** Integer r-th root power: t^(p/r) as an exact Q, or null if irrational. */
function powRat(t: number, e: Q): Q | null {
  for (let x = 1; x ** e.d <= t; x++) if (x ** e.d === t) return q(x ** e.n);
  return null;
}

// ---------- text helpers ----------

const expL = (e: Q) => (e.d === 1 ? `${e.n}` : `${e.n}/${e.d}`);
const powL = (v: string, e: Q) => (e.eq(1) ? v : `${v}^{${expL(e)}}`);
const coefL = (a: number) => (a === 1 ? '' : `${a}`);
const fnL = (A: number, a: Q, b: Q) => `${coefL(A)}${powL('L', a)}${powL('K', b)}`;
const fnE = (A: number, a: Q, b: Q) => `${A}*L^${a.toExpr()}*K^${b.toExpr()}`;
const qLatex = (v: Q) => `$${v.toLatex()}$`;
const mulL = (c: Q) => (c.eq(1) ? '' : c.toLatex());

function choice(rng: Rng, correct: string, wrong: string[]): { options: ChoiceOption[]; correct: string } {
  const options = rng.shuffle([correct, ...wrong].map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: 'o0' };
}

// ---------- level 2 helpers ----------

const SCALE_OPTIONS: ChoiceOption[] = [
  { id: 'inc', label: 'Increasing returns to scale' },
  { id: 'const', label: 'Constant returns to scale' },
  { id: 'dec', label: 'Decreasing returns to scale' },
];
const classOf = (sum: Q) => (sum.eq(1) ? 'const' : sum.valueOf() > 1 ? 'inc' : 'dec');

// ---------- interpretation ----------

function mpMeaning(rng: Rng, which: number, A: number, a: Q, b: Q, L: number, K: number, mp: Q): InterpretationQuestion {
  const lab = which === 0;
  const unit = lab ? 'labor' : 'capital';
  const other = lab ? 'capital' : 'labor';
  const sub = lab ? 'L' : 'K';
  const v = qLatex(mp);
  const { options, correct } = choice(rng, `One more unit of ${unit}, with ${other} held fixed, adds about ${v} units of output`, [
    `Each unit of ${unit} produces ${v} units of output on average`,
    `One more unit of ${unit} *and* one more unit of ${other} together add about ${v} units of output`,
    `${lab ? 'Labor' : 'Capital'} is ${v} times as productive as ${other}`,
  ]);
  return {
    prompt: `For $Q = ${fnL(A, a, b)}$ at $L = ${L}$, $K = ${K}$, you found $MP_${sub} = ${mp.toLatex()}$. What does that mean?`,
    options,
    correct,
    explanation: `$MP_${sub}$ is a partial derivative: it changes ${unit} and holds ${other} fixed, so it is the extra output from one more unit of ${unit} alone. It is not average product ($Q/${sub}$) and not a comparison of the two inputs.`,
  };
}

function mpTrend(rng: Rng, which: number, a: Q, b: Q): InterpretationQuestion {
  const lab = which === 0;
  const e = lab ? a : b;
  const unit = lab ? 'labor' : 'capital';
  const other = lab ? 'capital' : 'labor';
  const sub = lab ? 'L' : 'K';
  const correct = e.valueOf() < 1 ? 'Falls (diminishing marginal product)' : e.eq(1) ? 'Stays the same' : 'Rises';
  const all = ['Falls (diminishing marginal product)', 'Stays the same', 'Rises', 'Rises first, then falls'];
  const { options, correct: c } = choice(rng, correct, all.filter((x) => x !== correct));
  return {
    prompt: `If the firm keeps adding ${unit} and holds ${other} fixed, what happens to $MP_${sub}$?`,
    options,
    correct: c,
    explanation: `$MP_${sub}$ is proportional to $${sub}^{${expL(e.sub(1))}}$, and the exponent $${expL(e)} - 1 = ${expL(e.sub(1))}$ is ${e.valueOf() < 1 ? 'negative, so it shrinks as ' + sub + ' grows' : e.eq(1) ? 'zero, so it is constant' : 'positive, so it grows'}. An exponent below 1 means each extra unit of ${unit} adds less than the last.`,
  };
}

function residualQuestion(rng: Rng, gA: number): InterpretationQuestion {
  const { options, correct } = choice(rng, 'Output growth that growth in labor and capital does not explain (technology, efficiency)', [
    "Labor's share of output",
    'The growth rate of the capital stock',
    'Inflation in the price of output',
  ]);
  return {
    prompt: `In a growth-accounting exercise the residual is $g_A = ${gA}\\%$. What does the residual measure?`,
    options,
    correct,
    explanation: `$g_A = g_Q - \\alpha g_L - \\beta g_K$ is what is left of output growth after subtracting each input's weighted growth. It captures everything not explained by more labor or capital: technology, efficiency, organization. It is not a share and not a price.`,
  };
}

// ---------- the skill ----------

export const cobbDouglasProduction: SkillDefinition = {
  id: ID,
  title: 'Cobb-Douglas production',
  track: 'econ',
  unit: 'Production & utility',
  description: 'Output, returns to scale, marginal products, the MRTS and growth accounting for Q = A L^α K^β.',
  prerequisites: ['partial-derivatives', 'exponent-rules'],
  maxDenominator: 8,
  levels: {
    1: { description: 'Output at a point', ranges: { ai: [0, 4], bi: [0, 4], A: [1, 20], L: [1, 100], K: [1, 100] } },
    2: { description: 'Returns to scale', ranges: { form: [0, 1], ai: [0, 5], bi: [0, 5], A: [1, 20], t: [0, 27] } },
    3: { description: 'Marginal product at a point', ranges: { which: [0, 1], ai: [0, 4], bi: [0, 4], A: [1, 20], L: [1, 100], K: [1, 100] } },
    4: { description: 'Marginal rate of technical substitution', ranges: { ai: [0, 4], bi: [0, 4], A: [1, 20], L: [1, 100], K: [1, 100] } },
    5: {
      description: 'Growth accounting and the Solow residual',
      ranges: { form: [0, 1], ai: [0, 4], bi: [0, 4], gA: [1, 5], gL: [2, 12], gK: [2, 12], gQ: [1, 30] },
    },
  },
  misconceptions: {
    'exponent-as-multiplier': {
      name: 'Multiplied by the exponent instead of raising to it',
      explanation: 'In $A L^{\\alpha} K^{\\beta}$ the exponent is a power: $16^{1/2} = 4$ (a square root), not $16 \\cdot \\tfrac12 = 8$. Raise each input to its exponent, then multiply by $A$.',
    },
    'diminishing-mp-as-drs': {
      name: 'Read α < 1 and β < 1 as decreasing returns to scale',
      explanation: 'Each exponent below 1 means each input has diminishing *marginal* product when the other is held fixed. Returns to scale ask what happens when *all* inputs scale together, and that depends only on $\\alpha + \\beta$: above 1 is increasing, exactly 1 is constant, below 1 is decreasing.',
    },
    'product-of-exponents': {
      name: 'Multiplied the exponents instead of adding',
      explanation: 'Scaling both inputs by $t$ gives $(tL)^{\\alpha}(tK)^{\\beta} = t^{\\alpha}t^{\\beta}L^{\\alpha}K^{\\beta} = t^{\\alpha+\\beta}\\,L^{\\alpha}K^{\\beta}$. Same base, so the exponents *add*.',
    },
    'power-not-reduced': {
      name: "Didn't lower the power",
      explanation: 'The partial derivative brings the exponent down *and* lowers the power by one: $\\partial Q/\\partial L = \\alpha A L^{\\alpha-1}K^{\\beta} = \\alpha Q / L$. Stopping at $\\alpha Q$ leaves out the division by $L$.',
    },
    'mrts-inverted': {
      name: 'Divided MP_K by MP_L',
      explanation: 'The MRTS is $MP_L / MP_K$: how much capital one more unit of labor can replace. Dividing the other way gives the reciprocal, the labor needed to replace a unit of capital.',
    },
    'unweighted-growth': {
      name: 'Added growth rates without the exponents',
      explanation: "Each input's growth contributes in proportion to its exponent: $g_Q \\approx g_A + \\alpha g_L + \\beta g_K$. Using $g_L$ and $g_K$ at full weight overstates what the inputs explain.",
    },
    'residual-sign': {
      name: 'Added the input contributions instead of subtracting',
      explanation: 'The residual is what output growth has left *after* removing the inputs: $g_A = g_Q - \\alpha g_L - \\beta g_K$. Adding the contributions double counts them.',
    },
  },
  stepLabels: {
    powers: 'Evaluate each power',
    multiply: 'Multiply A by the powers',
    'sum-exponents': 'Add the exponents',
    classify: 'Compare α + β with 1',
    scale: 'Raise the factor to α + β',
    differentiate: 'Take the partial derivative',
    'evaluate-mp': 'Substitute the point',
    mpk: 'Find the other marginal product',
    ratio: 'Divide MP_L by MP_K',
    weights: "Weight each input's growth by its exponent",
    residual: 'Add (or subtract) to finish',
  },
  learn: {
    whyItMatters:
      'The Cobb-Douglas function $Q = A L^{\\alpha}K^{\\beta}$ is the standard model of production. With $Q = 10L^{1/2}K^{1/2}$, $L = 16$ workers and $K = 4$ machines, output is $10 \\cdot 4 \\cdot 2 = 80$. The marginal product of labor is $\\tfrac12 \\cdot 80/16 = 2.5$: the next worker adds about 2.5 units. The exponents are the inputs\' shares, their sum tells you returns to scale, and growth accounting uses them to split output growth into more inputs and better technology.',
    summary:
      'Output is $Q = A L^{\\alpha}K^{\\beta}$. Raise each input to its exponent and multiply. Scaling every input by $t$ scales output by $t^{\\alpha+\\beta}$: $\\alpha+\\beta > 1$ increasing, $= 1$ constant, $< 1$ decreasing returns to scale. Marginal products are partial derivatives, $MP_L = \\alpha Q/L$ and $MP_K = \\beta Q/K$, and the MRTS is their ratio. In growth terms, $g_Q \\approx g_A + \\alpha g_L + \\beta g_K$.',
    formulas: [
      { latex: 'Q = A\\,L^{\\alpha}K^{\\beta}' },
      { latex: 'MP_L = \\frac{\\partial Q}{\\partial L} = \\frac{\\alpha Q}{L}', note: '$MP_K = \\beta Q / K$ the same way.' },
      { latex: 'MRTS = \\frac{MP_L}{MP_K} = \\frac{\\alpha K}{\\beta L}' },
      { latex: 'g_Q \\approx g_A + \\alpha g_L + \\beta g_K', note: 'Growth rates in percent; $g_A$ is the Solow residual.' },
    ],
    example: { seed: 3, level: 3 },
    tips: ['Exponents below 1 mean diminishing *marginal* product; returns to scale depend on the exponents\' sum.'],
  },

  generate(rng, level): ReturnType<SkillDefinition['generate']> {
    const steps: Step[] = [];

    // ================= level 1: output at a point =================
    if (level === 1) {
      const ai = rng.int(0, 4);
      const bi = rng.int(0, 4);
      const a = EXPS[ai];
      const b = EXPS[bi];
      const A = rng.int(1, 20);
      const { x: L, root: lr } = pickInput(rng, a);
      const { x: K, root: kr } = pickInput(rng, b);
      const pL = lr ** a.n;
      const pK = kr ** b.n;
      const Qv = q(A * pL * pK);
      steps.push(
        {
          key: 'powers',
          instruction: `Evaluate each power: $L^{${expL(a)}}$ and $K^{${expL(b)}}$.`,
          math: `${L}^{${expL(a)}} = ${pL},\\qquad ${K}^{${expL(b)}} = ${pK}`,
          why: 'A fractional exponent is a root: $x^{1/2}$ is the square root, $x^{1/3}$ the cube root, and $x^{p/r} = (\\sqrt[r]{x})^{p}$.',
          ask: { prompt: `What is $${L}^{${expL(a)}}$?`, answer: numberAnswer(pL), verify: { type: 'evaluate', expr: `${L}^${a.toExpr()}` } },
        },
        {
          key: 'multiply',
          instruction: 'Multiply $A$ by the two powers.',
          math: `Q = ${A}\\cdot ${pL}\\cdot ${pK} = ${Qv.n}`,
          why: '$Q = A \\cdot L^{\\alpha} \\cdot K^{\\beta}$.',
          ask: { prompt: `What is $Q$?`, answer: numberAnswer(Qv), verify: { type: 'evaluate', expr: `${A}*${L}^${a.toExpr()}*${K}^${b.toExpr()}` } },
        },
      );
      const answer = numberAnswer(Qv);
      const wrong = q(A).mul(a).mul(L).mul(b).mul(K);
      return {
        params: { ai, bi, A, L, K },
        prompt: `A firm's output is $Q = ${fnL(A, a, b)}$. Find $Q$ when $L = ${L}$ and $K = ${K}$.`,
        answer,
        steps,
        misconceptions: distinctMisconceptions(answer, [{ id: 'exponent-as-multiplier', wrong: numberAnswer(wrong) }]),
        verify: { type: 'evaluate', expr: `${A}*${L}^${a.toExpr()}*${K}^${b.toExpr()}` },
      };
    }

    // ================= level 2: returns to scale =================
    if (level === 2) {
      for (;;) {
        const form = rng.int(0, 1);
        const ai = rng.int(0, 5);
        const bi = rng.int(0, 5);
        if (ai === 5 && bi === 5) continue;
        const a = EXPS[ai];
        const b = EXPS[bi];
        const A = rng.int(1, 20);
        const sum = a.add(b);
        const sumStep: Step = {
          key: 'sum-exponents',
          instruction: 'Add the exponents: scaling every input by $t$ multiplies output by $t^{\\alpha+\\beta}$.',
          math: `\\alpha + \\beta = ${a.toLatex()} + ${b.toLatex()} = ${sum.toLatex()}`,
          why: '$(tL)^{\\alpha}(tK)^{\\beta} = t^{\\alpha+\\beta}L^{\\alpha}K^{\\beta}$: same base, so exponents add.',
          ask: { prompt: `What is $\\alpha + \\beta$?`, answer: numberAnswer(sum), verify: { type: 'evaluate', expr: `${a.toExpr()}+${b.toExpr()}` } },
        };
        if (form === 0) {
          const cls = classOf(sum);
          // Make the three classes about equally common.
          if (cls !== (['inc', 'const', 'dec'] as const)[rng.int(0, 2)]) continue;
          const answer = choiceAnswer(SCALE_OPTIONS, cls);
          steps.push(sumStep, {
            key: 'classify',
            instruction: `Compare $\\alpha + \\beta = ${sum.toLatex()}$ with 1.`,
            math: `\\alpha+\\beta ${cls === 'inc' ? '> 1' : cls === 'const' ? '= 1' : '< 1'}`,
            why: 'Above 1: increasing returns. Exactly 1: constant. Below 1: decreasing.',
            ask: { prompt: `What returns to scale does $Q = ${fnL(A, a, b)}$ have?`, answer },
          });
          const prod = a.mul(b);
          const cands: (MisconceptionInstance | null)[] = [
            a.valueOf() < 1 && b.valueOf() < 1 && cls !== 'dec' ? { id: 'diminishing-mp-as-drs', wrong: choiceAnswer(SCALE_OPTIONS, 'dec') } : null,
            cls !== classOf(prod) ? { id: 'product-of-exponents', wrong: choiceAnswer(SCALE_OPTIONS, classOf(prod)) } : null,
          ];
          return {
            params: { form, ai, bi, A, t: 0 },
            prompt: `A firm's output is $Q = ${fnL(A, a, b)}$. Does it have increasing, constant, or decreasing returns to scale?`,
            answer,
            steps,
            misconceptions: distinctMisconceptions(answer, cands),
            verify: { type: 'choice', note: 'Classify by comparing alpha + beta with 1 (re-derived in tests/skills/cobb-douglas-production.test.ts).' },
          };
        }
        // form 1: a factor t
        const t = rng.pick([2, 4, 8, 9, 16, 27]);
        const f = powRat(t, sum);
        if (!f) continue;
        const ans = numberAnswer(f);
        steps.push(sumStep, {
          key: 'scale',
          instruction: `Raise the factor to $\\alpha+\\beta$: output is multiplied by $${t}^{${expL(sum)}}$.`,
          math: `${t}^{${expL(sum)}} = ${f.toLatex()}`,
          why: 'A fractional power is a root: take the root first, then the power.',
          ask: { prompt: `What is $${t}^{${expL(sum)}}$?`, answer: ans, verify: { type: 'evaluate', expr: `(${t}*1)^${a.toExpr()}*(${t}*1)^${b.toExpr()}/(1^${a.toExpr()}*1^${b.toExpr()})` } },
        });
        const prodF = powRat(t, a.mul(b));
        const cands: (MisconceptionInstance | null)[] = [prodF ? { id: 'product-of-exponents', wrong: numberAnswer(prodF) } : null];
        return {
          params: { form, ai, bi, A, t },
          prompt: `A firm's output is $Q = ${fnL(A, a, b)}$. If it multiplies *both* inputs by ${t}, output is multiplied by what factor?`,
          answer: ans,
          steps,
          misconceptions: distinctMisconceptions(ans, cands),
          verify: { type: 'evaluate', expr: `(${t}*1)^${a.toExpr()}*(${t}*1)^${b.toExpr()}/(1^${a.toExpr()}*1^${b.toExpr()})` },
        };
      }
    }

    // ================= level 3: marginal product =================
    if (level === 3) {
      for (;;) {
        const which = rng.int(0, 1);
        const ai = rng.int(0, 4);
        const bi = rng.int(0, 4);
        const a = EXPS[ai];
        const b = EXPS[bi];
        const A = rng.int(1, 20);
        const { x: L, root: lr } = pickInput(rng, a);
        const { x: K, root: kr } = pickInput(rng, b);
        const Qv = q(A * lr ** a.n * kr ** b.n);
        const lab = which === 0;
        const e = lab ? a : b;
        const x0 = lab ? L : K;
        const sub = lab ? 'L' : 'K';
        const mp = Qv.mul(e).div(x0);
        if (mp.d > 8) continue;
        const c = q(A).mul(e);
        const mpL = `${mulL(c)}${powL('L', lab ? a.sub(1) : a)}${powL('K', lab ? b : b.sub(1))}`;
        const mpE = `(${c.toString()})*L^${(lab ? a.sub(1) : a).toExpr()}*K^${(lab ? b : b.sub(1)).toExpr()}`;
        const fx = fnE(A, a, b);
        const at = { L: `${L}`, K: `${K}` };
        steps.push(
          {
            key: 'differentiate',
            instruction: `Take the partial derivative with respect to $${sub}$, holding the other input fixed.`,
            math: `MP_${sub} = \\frac{\\partial Q}{\\partial ${sub}} = ${mpL}`,
            why: 'Bring the exponent down and lower the power by one; the other input rides along as a constant.',
            ask: {
              prompt: `What is $MP_${sub} = \\partial Q/\\partial ${sub}$?`,
              answer: { kind: 'expression', value: mpE, variables: ['L', 'K'], display: mpL },
              verify: { type: 'partial', expr: fx, wrt: [sub], variables: ['L', 'K'] },
            },
          },
          {
            key: 'evaluate-mp',
            instruction: `Substitute $L = ${L}$, $K = ${K}$.`,
            math: `MP_${sub}(${L}, ${K}) = ${mp.toLatex()}`,
            why: 'Evaluate the marginal product at the given point (equivalently $\\alpha Q / ' + sub + '$).',
            ask: { prompt: `What is $MP_${sub}$ at $L = ${L}$, $K = ${K}$?`, answer: numberAnswer(mp), verify: { type: 'partial', expr: fx, wrt: [sub], variables: ['L', 'K'], at } },
          },
        );
        const answer = numberAnswer(mp);
        const cands = [{ id: 'power-not-reduced', wrong: numberAnswer(Qv.mul(e)) }];
        const base = {
          params: { which, ai, bi, A, L, K },
          prompt: `A firm's output is $Q = ${fnL(A, a, b)}$. Find the marginal product of ${lab ? 'labor' : 'capital'}, $MP_${sub}$, at $L = ${L}$, $K = ${K}$.`,
          answer,
          steps,
          misconceptions: distinctMisconceptions(answer, cands),
          verify: { type: 'partial' as const, expr: fx, wrt: [sub], variables: ['L', 'K'], at },
        };
        // Interpretation randomness is drawn last.
        if (rng.chance(0.5)) {
          return { ...base, interpretation: [rng.chance(0.5) ? mpMeaning(rng, which, A, a, b, L, K, mp) : mpTrend(rng, which, a, b)] };
        }
        return base;
      }
    }

    // ================= level 4: MRTS =================
    if (level === 4) {
      for (;;) {
        const ai = rng.int(0, 4);
        const bi = rng.int(0, 4);
        const a = EXPS[ai];
        const b = EXPS[bi];
        const A = rng.int(1, 20);
        const { x: L, root: lr } = pickInput(rng, a);
        const { x: K, root: kr } = pickInput(rng, b);
        const Qv = q(A * lr ** a.n * kr ** b.n);
        const mpl = Qv.mul(a).div(L);
        const mpk = Qv.mul(b).div(K);
        const mrts = mpl.div(mpk);
        if (mrts.d > 8 || mpl.d > 24 || mpk.d > 24) continue;
        const fx = fnE(A, a, b);
        const at = { L: `${L}`, K: `${K}` };
        steps.push(
          {
            key: 'differentiate',
            instruction: `Take $MP_L = \\partial Q/\\partial L$ and evaluate it at $L = ${L}$, $K = ${K}$.`,
            math: `MP_L = \\frac{\\alpha Q}{L} = \\frac{${a.toLatex()}\\cdot ${Qv.toLatex()}}{${L}} = ${mpl.toLatex()}`,
            why: 'Hold $K$ fixed, bring $\\alpha$ down and lower the power of $L$: $MP_L = \\alpha Q / L$.',
            ask: { prompt: `What is $MP_L$ at this point?`, answer: numberAnswer(mpl), verify: { type: 'partial', expr: fx, wrt: ['L'], variables: ['L', 'K'], at } },
          },
          {
            key: 'mpk',
            instruction: 'Find the other marginal product, $MP_K = \\partial Q/\\partial K$, at the same point.',
            math: `MP_K = \\frac{\\beta Q}{K} = \\frac{${b.toLatex()}\\cdot ${Qv.toLatex()}}{${K}} = ${mpk.toLatex()}`,
            why: 'Same steps with the roles swapped: $MP_K = \\beta Q / K$.',
            ask: { prompt: `What is $MP_K$ at this point?`, answer: numberAnswer(mpk), verify: { type: 'partial', expr: fx, wrt: ['K'], variables: ['L', 'K'], at } },
          },
          {
            key: 'ratio',
            instruction: 'Divide $MP_L$ by $MP_K$.',
            math: `MRTS = \\frac{MP_L}{MP_K} = \\frac{${mpl.toLatex()}}{${mpk.toLatex()}} = ${mrts.toLatex()}`,
            why: 'The MRTS is how much capital one more unit of labor can replace: $MRTS = \\frac{\\alpha K}{\\beta L}$.',
            ask: { prompt: `What is the MRTS?`, answer: numberAnswer(mrts), verify: { type: 'evaluate', expr: `(${a.toExpr()}*${A}*${L}^${a.sub(1).toExpr()}*${K}^${b.toExpr()})/(${b.toExpr()}*${A}*${L}^${a.toExpr()}*${K}^${b.sub(1).toExpr()})` } },
          },
        );
        const answer = numberAnswer(mrts);
        return {
          params: { ai, bi, A, L, K },
          prompt: `A firm's output is $Q = ${fnL(A, a, b)}$. Find the marginal rate of technical substitution, $MRTS = MP_L / MP_K$, at $L = ${L}$, $K = ${K}$.`,
          answer,
          steps,
          misconceptions: distinctMisconceptions(answer, [{ id: 'mrts-inverted', wrong: numberAnswer(mpk.div(mpl)) }]),
          verify: { type: 'evaluate', expr: `(${a.toExpr()}*${A}*${L}^${a.sub(1).toExpr()}*${K}^${b.toExpr()})/(${b.toExpr()}*${A}*${L}^${a.toExpr()}*${K}^${b.sub(1).toExpr()})` },
        };
      }
    }

    // ================= level 5: growth accounting =================
    const form = rng.int(0, 1);
    const ai = rng.int(0, 4);
    const bi = rng.int(0, 4);
    const a = EXPS[ai];
    const b = EXPS[bi];
    const gL = a.d * rng.int(1, Math.floor(12 / a.d));
    const gK = b.d * rng.int(1, Math.floor(12 / b.d));
    const gA = rng.int(1, 5);
    const wL = a.mul(gL);
    const wK = b.mul(gK);
    const gQ = q(gA).add(wL).add(wK);
    const target = form === 0 ? gQ : q(gA);
    const stmt = form === 0 ? `gQ = ${gA} + ${a.toExpr()}*${gL} + ${b.toExpr()}*${gK}` : `${gQ.toString()} = gA + ${a.toExpr()}*${gL} + ${b.toExpr()}*${gK}`;
    const verify: VerifySpec = { type: 'solve', equations: [stmt], unknowns: [form === 0 ? 'gQ' : 'gA'] };
    steps.push(
      {
        key: 'weights',
        instruction: `Weight each input's growth by its exponent: $\\alpha g_L$ and $\\beta g_K$.`,
        math: `\\alpha g_L = ${a.toLatex()}\\cdot ${gL} = ${wL.toLatex()},\\qquad \\beta g_K = ${b.toLatex()}\\cdot ${gK} = ${wK.toLatex()}`,
        why: 'A 1% rise in labor raises output by about $\\alpha\\%$, and a 1% rise in capital by $\\beta\\%$.',
        ask: { prompt: `What is $\\alpha g_L = ${a.toLatex()}\\cdot ${gL}$?`, answer: numberAnswer(wL), verify: { type: 'evaluate', expr: `${a.toExpr()}*${gL}` } },
      },
      {
        key: 'residual',
        instruction: form === 0 ? 'Add the three sources of growth.' : 'Subtract the weighted input growth from output growth.',
        math: form === 0 ? `g_Q = ${gA} + ${wL.toLatex()} + ${wK.toLatex()} = ${gQ.toLatex()}` : `g_A = ${gQ.toLatex()} - ${wL.toLatex()} - ${wK.toLatex()} = ${gA}`,
        why: '$g_Q \\approx g_A + \\alpha g_L + \\beta g_K$; the residual $g_A$ is what the inputs do not explain.',
        ask: { prompt: form === 0 ? 'What is $g_Q$ (in percent)?' : 'What is $g_A$ (in percent)?', answer: numberAnswer(target), verify },
      },
    );
    const answer = numberAnswer(target);
    const cands: MisconceptionInstance[] =
      form === 0
        ? [{ id: 'unweighted-growth', wrong: numberAnswer(q(gA + gL + gK)) }]
        : [
            { id: 'unweighted-growth', wrong: numberAnswer(gQ.sub(gL).sub(gK)) },
            { id: 'residual-sign', wrong: numberAnswer(gQ.add(wL).add(wK)) },
          ];
    const base = {
      params: { form, ai, bi, gA, gL, gK, gQ: gQ.n },
      prompt:
        form === 0
          ? `Output is $Q = A\\,${powL('L', a)}${powL('K', b)}$. Labor grows ${gL}%, capital grows ${gK}%, and technology $A$ grows ${gA}%. Using $g_Q \\approx g_A + \\alpha g_L + \\beta g_K$, by about what percent does output grow?`
          : `Output is $Q = A\\,${powL('L', a)}${powL('K', b)}$. Output grows ${gQ.toLatex()}%, labor grows ${gL}%, and capital grows ${gK}%. Using $g_Q \\approx g_A + \\alpha g_L + \\beta g_K$, what is technology growth $g_A$ (the Solow residual), in percent?`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, cands),
      verify,
    };
    // Interpretation randomness is drawn last.
    if (rng.chance(0.5)) return { ...base, interpretation: [residualQuestion(rng, gA)] };
    return base;
  },
};
