// Total differential df = f_x dx + f_y dy: given partials, polynomial f at a point, the slope of a
// level curve (-f_x/f_y), a production story with a fall in capital, and the MRS of x^a y^b.

import { numberAnswer } from '../../engine/answers';
import { coefLatex, joinTerms } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { InterpretationQuestion, MisconceptionInstance, SkillDefinition, Step, VerifySpec } from '../../engine/types';

const ID = 'total-differential';
const VARS = ['x', 'y'];

interface Term {
  k: number;
  m: number;
  n: number;
}

function normalize(terms: Term[]): Term[] {
  const out: Term[] = [];
  for (const t of terms) {
    const hit = out.find((o) => o.m === t.m && o.n === t.n);
    if (hit) hit.k += t.k;
    else out.push({ ...t });
  }
  return out.filter((t) => t.k !== 0);
}

const pw = (v: string, e: number) => (e === 0 ? '' : e === 1 ? v : `${v}^{${e}}`);
function termLatex(t: Term, vx: string, vy: string): string {
  const body = pw(vx, t.m) + pw(vy, t.n);
  return body === '' ? q(t.k).toLatex() : `${coefLatex(q(t.k))}${body}`;
}
function termExpr(t: Term): string {
  const parts = [q(t.k).toExpr()];
  if (t.m > 0) parts.push(t.m === 1 ? 'x' : `x^${t.m}`);
  if (t.n > 0) parts.push(t.n === 1 ? 'y' : `y^${t.n}`);
  return parts.join('*');
}
const polyLatex = (terms: Term[], vx = 'x', vy = 'y') => joinTerms(normalize(terms).map((t) => termLatex(t, vx, vy)));
const polyExpr = (terms: Term[]) => {
  const ts = normalize(terms);
  return ts.length ? ts.map(termExpr).join(' + ') : '0';
};

function powQ(b: number, e: number): Q {
  let r = q(1);
  for (let i = 0; i < e; i++) r = r.mul(q(b));
  return r;
}
/** Partial of the polynomial with respect to x (v = 0) or y (v = 1), evaluated at a point. */
function partialAt(terms: Term[], v: number, x0: number, y0: number): Q {
  let s = q(0);
  for (const t of terms) {
    const own = v === 0 ? t.m : t.n;
    if (own === 0) continue;
    const m = v === 0 ? t.m - 1 : t.m;
    const n = v === 1 ? t.n - 1 : t.n;
    s = s.add(q(t.k * own).mul(powQ(x0, m)).mul(powQ(y0, n)));
  }
  return s;
}

const dec = (n: number) => String(n / 4); // multiples of 1/4 are exact decimals
const paren = (x: Q | number) => `(${typeof x === 'number' ? x : x.toExpr()})`;
/** Denominator of a reduced fraction. */
const denomOf = (x: Q) => Number(x.toString().split('/')[1] ?? 1);

function choice(rng: Rng, correct: string, wrong: string[]) {
  const options = rng.shuffle([correct, ...wrong].map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: 'o0' };
}

function interpretationFor(rng: Rng, a: number, b: number, x0: number, y0: number, slope: Q): InterpretationQuestion {
  const abs = slope.abs().toLatex();
  const { options, correct } = choice(rng, `The consumer would give up about $${abs}$ units of $y$ for one more unit of $x$ and be equally well off`, [
    `The consumer would gain about $${abs}$ units of $y$ from one more unit of $x$`,
    `Utility rises by about $${abs}$ when the consumer gets one more unit of $x$`,
    `The price of $x$ divided by the price of $y$ is $${abs}$`,
  ]);
  return {
    prompt: `$U = x^{${a}}y^{${b}}$ is a consumer's utility. At the bundle $(${x0}, ${y0})$ the indifference curve has slope $${slope.toLatex()}$. What does that mean?`,
    options,
    correct,
    explanation: `Along an indifference curve utility stays constant, so $dU = 0$ and $dy/dx = -U_x/U_y$. A slope of $${slope.toLatex()}$ means one more unit of $x$ is exactly offset by giving up about $${abs}$ units of $y$. It is the marginal rate of substitution, not a utility change and not (except at an optimum) a price ratio.`,
  };
}

const rangesPoly: Record<string, [number, number]> = {
  k1: [-9, 9],
  m1: [1, 3],
  n1: [1, 3],
  k2: [-9, 9],
  p2: [1, 3],
  k3: [-9, 9],
  q3: [1, 3],
  k4: [-9, 9],
};

export const totalDifferential: SkillDefinition = {
  id: ID,
  title: 'Total differential',
  track: 'math',
  unit: 'Multivariable calculus',
  description: 'df = f_x dx + f_y dy: approximate changes, the slope of a level curve, and the marginal rate of substitution.',
  prerequisites: ['partial-derivatives'],
  maxDenominator: 4,
  levels: {
    1: {
      description: 'Partials given: find df for small changes',
      ranges: { fx: [-9, 9], fy: [-9, 9], dxn: [-8, 8], dyn: [-8, 8] },
    },
    2: {
      description: 'Polynomial f at a point: df for dx and dy',
      ranges: { ...rangesPoly, x0: [-3, 3], y0: [-3, 3], dxn: [-8, 8], dyn: [-8, 8] },
    },
    3: {
      description: 'Slope of a level curve: dy/dx = -f_x / f_y',
      ranges: { ...rangesPoly, x0: [-3, 3], y0: [-3, 3] },
    },
    4: {
      description: 'Production story: labor up, capital down',
      ranges: { k1: [1, 9], m1: [1, 3], n1: [1, 3], k2: [1, 9], p2: [1, 3], k3: [1, 9], q3: [1, 3], k4: [0, 9], x0: [1, 4], y0: [1, 4], dxn: [1, 8], dyn: [1, 8] },
    },
    5: {
      description: 'Marginal rate of substitution for U = x^a y^b',
      ranges: { a: [1, 3], b: [1, 3], x0: [1, 6], y0: [1, 6] },
    },
  },
  misconceptions: {
    'forgot-dy-term': {
      name: 'Left out the f_y dy term',
      explanation: 'Both inputs change, so both contribute: $df = f_x\\,dx + f_y\\,dy$. Dropping the $f_y\\,dy$ term ignores the change in the second variable.',
    },
    'added-partials': {
      name: 'Added the partials without multiplying by the changes',
      explanation: 'A partial is a rate (change in $f$ per unit of one variable). Multiply each by the size of its change first: $f_x\\,dx + f_y\\,dy$, not $f_x + f_y$.',
    },
    'sign-of-decrease': {
      name: 'Used a decrease as a positive change',
      explanation: 'If capital falls by $\\Delta K$, then $dK = -\\Delta K$. Put the minus sign into the change before multiplying by $f_K$.',
    },
    'slope-inverted': {
      name: 'Divided the wrong way',
      explanation: 'Along a level curve $f_x\\,dx + f_y\\,dy = 0$, so $dy/dx = -f_x/f_y$, with $f_x$ on top. $-f_y/f_x$ is $dx/dy$.',
    },
    'slope-sign': {
      name: 'Dropped the minus sign',
      explanation: 'Setting $f_x\\,dx + f_y\\,dy = 0$ gives $dy/dx = -f_x/f_y$. The minus sign comes from moving $f_x\\,dx$ to the other side; it is not $f_x/f_y$.',
    },
  },
  stepLabels: {
    'term-x': 'Multiply f_x by dx',
    'term-y': 'Multiply f_y by dy',
    fx: 'Find the partial with respect to x',
    fy: 'Find the partial with respect to y',
    'sign-change': 'Write the decrease as a negative change',
    combine: 'Multiply each partial by its change and add',
    slope: 'Divide: dy/dx = -f_x / f_y',
  },
  learn: {
    whyItMatters:
      'The total differential turns partial derivatives into an estimate of how much a function changes when several inputs move at once. Take output $Q = 3LK + 2L$ at $L = 4$, $K = 5$: $Q_L = 3K + 2 = 17$ and $Q_K = 3L = 12$. Hire half an hour more labor and cut capital by $0.25$: $dQ \\approx 17(0.5) + 12(-0.25) = 5.5$ units. Setting $dQ = 0$ instead gives the slope of an isoquant, and for utility the marginal rate of substitution, which comparative statics uses constantly.',
    summary:
      'For small changes, $df \\approx f_x\\,dx + f_y\\,dy$: each partial times its own change, added up. A decrease is a negative change. Staying on one level curve means $df = 0$, which gives $dy/dx = -f_x/f_y$.',
    formulas: [
      { latex: 'df = f_x\\,dx + f_y\\,dy', note: 'Evaluate the partials at the starting point.' },
      { latex: '\\frac{dy}{dx} = -\\frac{f_x}{f_y}', note: 'Slope of the level curve $f(x, y) = c$.' },
      { latex: 'MRS = -\\frac{U_x}{U_y} = -\\frac{a\\,y}{b\\,x}', note: 'For $U = x^a y^b$.' },
    ],
    example: { seed: 3, level: 2 },
    tips: ['Evaluate $f_x$ and $f_y$ at the starting point before you multiply by anything.'],
  },

  generate(rng, level) {
    const steps: Step[] = [];
    const num = (value: Q, expr: string, prompt: string, key: string, instruction: string, math: string, why: string): Step => ({
      key,
      instruction,
      math,
      why,
      ask: { prompt, answer: numberAnswer(value), verify: { type: 'evaluate', expr } },
    });
    const partialVerify = (fE: string, w: string, at: Record<string, string>): VerifySpec => ({ type: 'partial', expr: fE, wrt: [w], variables: VARS, at });
    const slopeVerify = (fx: Q, fy: Q): VerifySpec => ({ type: 'solve', equations: [`${paren(fx)}*1 + ${paren(fy)}*m = 0`], unknowns: ['m'] });

    // ================= level 1: partials given =================
    if (level === 1) {
      for (;;) {
        const fx = rng.nonzero(-9, 9);
        const fy = rng.nonzero(-9, 9);
        const dxn = rng.nonzero(-8, 8);
        const dyn = rng.nonzero(-8, 8);
        const dx = q(dxn, 4);
        const dy = q(dyn, 4);
        const tx = dx.mul(fx);
        const ty = dy.mul(fy);
        const val = tx.add(ty);
        if (val.isZero()) continue;
        steps.push(
          num(tx, `${fx}*${paren(dx)}`, `What is $f_x\\,dx$?`, 'term-x', `Multiply $f_x$ by $dx$.`, `f_x\\,dx = ${fx}(${dec(dxn)}) = ${tx.toLatex()}`, 'Each partial is a rate; multiply by the size of its change.'),
          num(ty, `${fy}*${paren(dy)}`, `What is $f_y\\,dy$?`, 'term-y', `Multiply $f_y$ by $dy$.`, `f_y\\,dy = ${fy}(${dec(dyn)}) = ${ty.toLatex()}`, 'The second input contributes its own piece.'),
          num(val, `${fx}*${paren(dx)} + ${fy}*${paren(dy)}`, `So $df \\approx \\;?$`, 'combine', 'Add the two contributions.', `df = ${tx.toLatex()} + (${ty.toLatex()}) = ${val.toLatex()}`, '$df = f_x\\,dx + f_y\\,dy$.'),
        );
        const cands: (MisconceptionInstance | null)[] = [
          { id: 'forgot-dy-term', wrong: numberAnswer(tx) },
          { id: 'added-partials', wrong: numberAnswer(fx + fy) },
        ];
        return {
          params: { fx, fy, dxn, dyn } as Record<string, number>,
          prompt: `At a point, $f_x = ${fx}$ and $f_y = ${fy}$. Estimate $df$ when $dx = ${dec(dxn)}$ and $dy = ${dec(dyn)}$.`,
          answer: numberAnswer(val),
          steps,
          misconceptions: distinctMisconceptions(numberAnswer(val), cands),
          verify: { type: 'evaluate', expr: `${fx}*${paren(dx)} + ${fy}*${paren(dy)}` },
        };
      }
    }

    // ================= level 5: MRS of x^a y^b =================
    if (level === 5) {
      for (;;) {
        const a = rng.int(1, 3);
        const b = rng.int(1, 3);
        const x0 = rng.int(1, 6);
        const y0 = rng.int(1, 6);
        const ux = q(a * x0 ** (a - 1) * y0 ** b);
        const uy = q(b * x0 ** a * y0 ** (b - 1));
        const slope = ux.div(uy).neg();
        if (denomOf(slope) > 4) continue;
        const fE = `x^${a}*y^${b}`;
        const at = { x: String(x0), y: String(y0) };
        steps.push(
          {
            key: 'fx',
            instruction: `Find $U_x$ at $(${x0}, ${y0})$.`,
            math: `U_x = ${a}x^{${a - 1}}y^{${b}} = ${ux.toLatex()}`,
            why: 'Differentiate by $x$, holding $y$ fixed, then substitute the bundle.',
            ask: { prompt: `What is $U_x(${x0}, ${y0})$?`, answer: numberAnswer(ux), verify: partialVerify(fE, 'x', at) },
          },
          {
            key: 'fy',
            instruction: `Find $U_y$ at $(${x0}, ${y0})$.`,
            math: `U_y = ${b}x^{${a}}y^{${b - 1}} = ${uy.toLatex()}`,
            why: 'Differentiate by $y$, holding $x$ fixed, then substitute the bundle.',
            ask: { prompt: `What is $U_y(${x0}, ${y0})$?`, answer: numberAnswer(uy), verify: partialVerify(fE, 'y', at) },
          },
          {
            key: 'slope',
            instruction: 'Along an indifference curve $dU = 0$, so divide.',
            math: `\\frac{dy}{dx} = -\\frac{U_x}{U_y} = -\\frac{${ux.toLatex()}}{${uy.toLatex()}} = ${slope.toLatex()}`,
            why: '$U_x\\,dx + U_y\\,dy = 0$, so $dy/dx = -U_x/U_y$.',
            ask: { prompt: `What is $dy/dx$?`, answer: numberAnswer(slope), verify: slopeVerify(ux, uy) },
          },
        );
        const answer = numberAnswer(slope);
        const cands: MisconceptionInstance[] = [
          { id: 'slope-inverted', wrong: numberAnswer(uy.div(ux).neg()) },
          { id: 'slope-sign', wrong: numberAnswer(ux.div(uy)) },
        ];
        const base = {
          params: { a, b, x0, y0 } as Record<string, number>,
          prompt: `A consumer has utility $U = x^{${a}}y^{${b}}$. Find the slope $dy/dx$ of the indifference curve at the bundle $(${x0}, ${y0})$.`,
          answer,
          steps,
          misconceptions: distinctMisconceptions(answer, cands),
          verify: slopeVerify(ux, uy),
        };
        // Interpretation randomness is drawn last.
        if (rng.chance(0.5)) return { ...base, interpretation: [interpretationFor(rng, a, b, x0, y0, slope)] };
        return base;
      }
    }

    // ================= levels 2, 3, 4: polynomial f =================
    for (;;) {
      const prod = level === 4;
      const k1 = prod ? rng.int(1, 9) : rng.nonzero(-9, 9);
      const m1 = rng.int(1, 3);
      const n1 = rng.int(1, 3);
      const k2 = prod ? rng.int(1, 9) : rng.nonzero(-9, 9);
      const p2 = rng.int(1, 3);
      const k3 = prod ? rng.int(1, 9) : rng.nonzero(-9, 9);
      const q3 = rng.int(1, 3);
      const k4 = prod ? rng.int(0, 9) : rng.int(-9, 9);
      const x0 = prod ? rng.int(1, 4) : rng.int(-3, 3);
      const y0 = prod ? rng.int(1, 4) : rng.int(-3, 3);
      const terms: Term[] = rng.shuffle<Term>([
        { k: k1, m: m1, n: n1 },
        { k: k2, m: p2, n: 0 },
        { k: k3, m: 0, n: q3 },
        ...(k4 !== 0 ? [{ k: k4, m: 0, n: 0 }] : []),
      ]);
      const fx = partialAt(terms, 0, x0, y0);
      const fy = partialAt(terms, 1, x0, y0);
      if (fx.isZero() || fy.isZero()) continue;
      const fE = polyExpr(terms);
      const at = { x: String(x0), y: String(y0) };
      const vx = prod ? 'L' : 'x';
      const vy = prod ? 'K' : 'y';
      const fL = polyLatex(terms, vx, vy);
      const fxName = `f_${vx}`;
      const fyName = `f_${vy}`;
      const fxStep: Step = {
        key: 'fx',
        instruction: `Find $${fxName}$ at $(${x0}, ${y0})$.`,
        math: `${fxName}(${x0}, ${y0}) = ${fx.toLatex()}`,
        why: `Differentiate by $${vx}$, holding $${vy}$ fixed, then substitute the point.`,
        ask: { prompt: `What is $${fxName}(${x0}, ${y0})$?`, answer: numberAnswer(fx), verify: partialVerify(fE, 'x', at) },
      };
      const fyStep: Step = {
        key: 'fy',
        instruction: `Find $${fyName}$ at $(${x0}, ${y0})$.`,
        math: `${fyName}(${x0}, ${y0}) = ${fy.toLatex()}`,
        why: `Differentiate by $${vy}$, holding $${vx}$ fixed, then substitute the point.`,
        ask: { prompt: `What is $${fyName}(${x0}, ${y0})$?`, answer: numberAnswer(fy), verify: partialVerify(fE, 'y', at) },
      };

      if (level === 3) {
        const slope = fx.div(fy).neg();
        if (denomOf(slope) > 4) continue;
        steps.push(fxStep, fyStep, {
          key: 'slope',
          instruction: 'Along the level curve $df = 0$, so divide.',
          math: `\\frac{dy}{dx} = -\\frac{f_x}{f_y} = -\\frac{${fx.toLatex()}}{${fy.toLatex()}} = ${slope.toLatex()}`,
          why: '$f_x\\,dx + f_y\\,dy = 0$, so $dy/dx = -f_x/f_y$.',
          ask: { prompt: `What is $dy/dx$?`, answer: numberAnswer(slope), verify: slopeVerify(fx, fy) },
        });
        const answer = numberAnswer(slope);
        const cands: MisconceptionInstance[] = [
          { id: 'slope-inverted', wrong: numberAnswer(fy.div(fx).neg()) },
          { id: 'slope-sign', wrong: numberAnswer(fx.div(fy)) },
        ];
        return {
          params: { k1, m1, n1, k2, p2, k3, q3, k4, x0, y0 } as Record<string, number>,
          prompt: `Find the slope $dy/dx$ of the level curve $f(x, y) = c$ through $(${x0}, ${y0})$, where $$f(x, y) = ${fL}$$`,
          answer,
          steps,
          misconceptions: distinctMisconceptions(answer, cands),
          verify: slopeVerify(fx, fy),
        };
      }

      // levels 2 and 4
      let dxn: number;
      let dyn: number;
      let dx: Q;
      let dy: Q;
      let prompt: string;
      if (prod) {
        dxn = rng.int(1, 8);
        dyn = rng.int(1, 8);
        dx = q(dxn, 4);
        dy = q(-dyn, 4);
        prompt = `A firm's output is $Q = f(L, K)$ with $$f(L, K) = ${fL}$$ At $L = ${x0}$, $K = ${y0}$, labor rises by $${dec(dxn)}$ and capital falls by $${dec(dyn)}$. Use $dQ = f_L\\,dL + f_K\\,dK$ to approximate the change in output.`;
      } else {
        dxn = rng.nonzero(-8, 8);
        dyn = rng.nonzero(-8, 8);
        dx = q(dxn, 4);
        dy = q(dyn, 4);
        prompt = `Estimate $df$ at $(${x0}, ${y0})$ for $dx = ${dec(dxn)}$ and $dy = ${dec(dyn)}$, where $$f(x, y) = ${fL}$$`;
      }
      const val = fx.mul(dx).add(fy.mul(dy));
      if (val.isZero()) continue;
      steps.push(fxStep, fyStep);
      if (prod) {
        steps.push(
          num(dy, `-${paren(q(dyn, 4))}`, `What is $dK$, the change in capital, as a signed number?`, 'sign-change', 'Write the decrease as a negative change.', `dK = -${dec(dyn)}`, 'A fall is a negative change; put the sign in before multiplying.'),
        );
      }
      const combineExpr = `${paren(fx)}*${paren(dx)} + ${paren(fy)}*${paren(dy)}`;
      const dName = prod ? 'Q' : 'f';
      steps.push(
        num(
          val,
          combineExpr,
          `So $d${dName} \\approx \\;?$`,
          'combine',
          'Multiply each partial by its change and add.',
          `d${dName} = ${fx.toLatex()}(${dx.toLatex()}) + ${fy.toLatex()}(${dy.toLatex()}) = ${val.toLatex()}`,
          '$df = f_x\\,dx + f_y\\,dy$, with each change carrying its sign.',
        ),
      );
      const answer = numberAnswer(val);
      const cands: (MisconceptionInstance | null)[] = [
        { id: 'forgot-dy-term', wrong: numberAnswer(fx.mul(dx)) },
        { id: 'added-partials', wrong: numberAnswer(fx.add(fy)) },
        prod ? { id: 'sign-of-decrease', wrong: numberAnswer(fx.mul(dx).add(fy.mul(q(dyn, 4)))) } : null,
      ];
      return {
        params: { k1, m1, n1, k2, p2, k3, q3, k4, x0, y0, dxn, dyn } as Record<string, number>,
        prompt,
        answer,
        steps,
        misconceptions: distinctMisconceptions(answer, cands),
        verify: { type: 'evaluate', expr: combineExpr },
      };
    }
  },
};
