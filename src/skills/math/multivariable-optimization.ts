// Unconstrained optimization of f(x, y) = ax² + bxy + cy² + dx + ey + g. The critical point is
// chosen first, then d and e make both first-order conditions hold. L1-L2 solve the FOCs, L3
// classifies from the Hessian (a choice), L4 is a two-product profit maximum, L5 is price
// discrimination across two markets.

import { choiceAnswer, expressionAnswer, numberAnswer, tupleAnswer } from '../../engine/answers';
import { coefLatex, joinTerms } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { AnswerSpec, InterpretationQuestion, MisconceptionInstance, SkillDefinition, Step, VerifySpec } from '../../engine/types';

const ID = 'multivariable-optimization';
const VARS = ['x', 'y'];

/** k·xᵐ·yⁿ */
type T = [k: number, m: number, n: number];

const mono = (v: string, e: number) => (e === 0 ? '' : e === 1 ? v : `${v}^{${e}}`);
function latexOf(ts: T[]): string {
  const live = ts.filter((t) => t[0] !== 0);
  if (!live.length) return '0';
  return joinTerms(live.map(([k, m, n]) => (m === 0 && n === 0 ? q(k).toLatex() : `${coefLatex(q(k))}${mono('x', m)}${mono('y', n)}`)));
}
/** Expression text; `xs`/`ys` replace the variable names (to evaluate at a point). */
function exprOf(ts: T[], xs = 'x', ys = 'y'): string {
  const live = ts.filter((t) => t[0] !== 0);
  if (!live.length) return '0';
  return live
    .map(([k, m, n]) => {
      const parts = [q(k).toExpr()];
      if (m > 0) parts.push(m === 1 ? xs : `${xs}^${m}`);
      if (n > 0) parts.push(n === 1 ? ys : `${ys}^${n}`);
      return parts.join('*');
    })
    .join(' + ');
}

interface Coef {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  g: number;
}
const fTerms = (k: Coef): T[] => [[k.a, 2, 0], [k.b, 1, 1], [k.c, 0, 2], [k.d, 1, 0], [k.e, 0, 1], [k.g, 0, 0]];
const fxTerms = (k: Coef): T[] => [[2 * k.a, 1, 0], [k.b, 0, 1], [k.d, 0, 0]];
const fyTerms = (k: Coef): T[] => [[k.b, 1, 0], [2 * k.c, 0, 1], [k.e, 0, 0]];

type Body = ReturnType<SkillDefinition['generate']>;

const OPT = [
  { id: 'max', label: 'Local maximum' },
  { id: 'min', label: 'Local minimum' },
  { id: 'saddle', label: 'Saddle point' },
  { id: 'inconc', label: 'Test inconclusive' },
];

/** Second-derivative test: 0 max, 1 min, 2 saddle, 3 inconclusive. */
function classify(fxx: number, D: number): number {
  if (D > 0) return fxx < 0 ? 0 : 1;
  if (D < 0) return 2;
  return 3;
}

function interpretationFor(rng: Rng): InterpretationQuestion {
  const labels = [
    'Marginal revenue is the same in both markets and equals marginal cost',
    'The price is the same in both markets',
    'The quantity sold is the same in both markets',
    'The price equals marginal cost in each market',
  ];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return {
    prompt: 'At the profit-maximizing quantities, which statement is true?',
    options,
    correct: options.find((o) => o.label === labels[0])!.id,
    explanation:
      'The first-order conditions say $MR_1 = m$ and $MR_2 = m$, so marginal revenue is equal across markets and equals marginal cost. Because the demand curves differ, the *prices* and quantities generally differ. Price exceeds marginal revenue (and so marginal cost) whenever the firm has market power.',
  };
}

const rangesPoint: Record<string, [number, number]> = { a: [-4, 4], b: [-4, 4], c: [-4, 4], xs: [-6, 6], ys: [-6, 6] };

export const multivariableOptimization: SkillDefinition = {
  id: ID,
  title: 'Multivariable optimization (FOC/SOC)',
  track: 'math',
  unit: 'Multivariable calculus',
  description: 'Find and classify the critical point of f(x, y): first-order conditions, the Hessian, and two-product profit.',
  prerequisites: ['partial-derivatives', 'optimization', 'determinants'],
  maxDenominator: 4,
  levels: {
    1: { description: 'Separable: no xy term', ranges: { ...rangesPoint, b: [0, 0], g: [-9, 9] } },
    2: { description: 'With an xy term: solve two linear FOCs', ranges: { ...rangesPoint, g: [-9, 9] } },
    3: {
      description: 'Classify a critical point with the second-derivative test',
      ranges: { form: [0, 1], a: [-6, 6], b: [-6, 6], c: [-6, 6], xs: [-6, 6], ys: [-6, 6], g: [-9, 9] },
    },
    4: { description: 'Maximum profit of a two-product firm', ranges: { a: [-4, -1], b: [-3, 3], c: [-4, -1], xs: [1, 6], ys: [1, 6], g: [0, 40] } },
    5: { description: 'Price discrimination in two markets', ranges: { q1: [1, 12], q2: [1, 12], be1: [1, 4], be2: [1, 4], m: [5, 30] } },
  },
  misconceptions: {
    'foc-one-at-a-time': {
      name: 'Solved each condition as if the other variable were 0',
      explanation:
        'The two first-order conditions are *simultaneous*: $f_x$ contains $y$ and $f_y$ contains $x$. Solving $f_x = 0$ for $x$ with $y$ ignored (or $f_y = 0$ for $y$) gives the wrong point. Solve the pair as a system.',
    },
    'forgot-factor-2': {
      name: 'Differentiated $ax^2$ as $ax$',
      explanation: 'The derivative of $ax^2$ is $2ax$, not $ax$. Both first partials carry the 2 on the squared terms, and so does the Hessian.',
    },
    'ignored-cross': {
      name: 'Left out $f_{xy}^2$ from D',
      explanation: 'The test uses $D = f_{xx}f_{yy} - (f_{xy})^2$. Dropping the cross term can turn a saddle into a "maximum" or the reverse. The $xy$ interaction matters.',
    },
    'fxx-sign-swapped': {
      name: 'Read $f_{xx} < 0$ as a minimum',
      explanation: 'When $D > 0$, the sign of $f_{xx}$ decides: $f_{xx} < 0$ means the surface curves down (a maximum) and $f_{xx} > 0$ a minimum, as with one variable.',
    },
    'saddle-as-extremum': {
      name: 'Called a point with D < 0 a maximum or minimum',
      explanation: 'If $D < 0$ the surface curves up in one direction and down in another: a saddle point, never an extremum, whatever the sign of $f_{xx}$.',
    },
    'mr-equals-price': {
      name: 'Set price equal to marginal cost',
      explanation: 'A firm with market power sets *marginal revenue* equal to marginal cost, not price. With $P = \\alpha - \\beta q$, $MR = \\alpha - 2\\beta q$, so $q = (\\alpha - m)/(2\\beta)$.',
    },
  },
  stepLabels: {
    fx: 'Take the partial with respect to x',
    fy: 'Take the partial with respect to y',
    foc: 'Set both partials to zero and solve',
    hessian: 'Find the second partials and D',
    classify: 'Use D and f_xx to classify',
    value: 'Evaluate profit at the optimum',
  },
  learn: {
    whyItMatters:
      'A firm selling in two markets chooses two quantities at once. With $P_1 = 100 - 2q_1$, $P_2 = 80 - q_2$ and marginal cost 20, profit is $\\pi = 80q_1 - 2q_1^2 + 60q_2 - q_2^2$. Setting both partials to zero gives $80 - 4q_1 = 0$ and $60 - 2q_2 = 0$, so $q_1 = 20$ and $q_2 = 30$ (prices 60 and 50). The second-order test confirms a maximum, because $D = (-4)(-2) - 0 = 8 > 0$ and $\\pi_{11} < 0$. The same method finds optimal input mixes and utility peaks.',
    summary:
      'Set both first partials to zero and solve the pair together: that is the critical point. Then classify it with $D = f_{xx}f_{yy} - f_{xy}^2$. If $D > 0$, a maximum when $f_{xx} < 0$ and a minimum when $f_{xx} > 0$. If $D < 0$, a saddle point. If $D = 0$, the test says nothing.',
    formulas: [
      { latex: 'f_x = 0,\\quad f_y = 0', note: 'First-order conditions: solve them as a system.' },
      { latex: 'D = f_{xx}f_{yy} - (f_{xy})^2', note: 'The determinant of the Hessian.' },
      { latex: 'D>0,\\; f_{xx}<0 \\Rightarrow \\max;\\quad D>0,\\; f_{xx}>0 \\Rightarrow \\min;\\quad D<0 \\Rightarrow \\text{saddle}', note: 'Second-order conditions.' },
    ],
    example: { seed: 4, level: 2 },
    tips: ['For $f = ax^2 + bxy + cy^2 + \\dots$ the Hessian never changes: $f_{xx} = 2a$, $f_{xy} = b$, $f_{yy} = 2c$.'],
  },

  generate(rng, level) {
    const steps: Step[] = [];
    const partialSteps = (k: Coef, fE: string, fL: string): void => {
      for (const v of ['x', 'y'] as const) {
        const ts = v === 'x' ? fxTerms(k) : fyTerms(k);
        steps.push({
          key: v === 'x' ? 'fx' : 'fy',
          instruction: `Take the partial derivative with respect to $${v}$, treating $${v === 'x' ? 'y' : 'x'}$ as a constant.`,
          math: `f_${v} = ${latexOf(ts)}`,
          why: `Differentiate every term by $${v}$; terms without $${v}$ vanish.`,
          ask: {
            prompt: `What is $f_${v}$ for $f = ${fL}$?`,
            answer: expressionAnswer(exprOf(ts), latexOf(ts), VARS),
            verify: { type: 'partial', expr: fE, wrt: [v], variables: VARS },
          },
        });
      }
    };
    const focEqs = (k: Coef): string[] => [`${exprOf(fxTerms(k))} = 0`, `${exprOf(fyTerms(k))} = 0`];
    const pointAnswer = (xv: Q | number, yv: Q | number, labels = ['x', 'y'], disp = ['x', 'y']) => tupleAnswer(labels, [xv, yv], disp);
    const solveFoc = (k: Coef, xs: number, ys: number, ans: AnswerSpec, prompt: string): Step => ({
      key: 'foc',
      instruction: 'Set both partial derivatives equal to zero and solve the two equations together.',
      math: `\\begin{cases} ${latexOf(fxTerms(k))} = 0 \\\\ ${latexOf(fyTerms(k))} = 0 \\end{cases} \\;\\Rightarrow\\; (x, y) = (${xs},\\; ${ys})`,
      why: 'At an interior maximum or minimum, both slopes are zero. The conditions share $x$ and $y$, so solve them as a system.',
      ask: { prompt, answer: ans, verify: { type: 'solve', equations: focEqs(k), unknowns: VARS } },
    });
    /** The critical point reached by (wrongly) differentiating ax² as ax, solved exactly; null if singular. */
    const factorWrong = (k: Coef): [Q, Q] | null => {
      const det = k.a * k.c - k.b * k.b;
      if (det === 0) return null;
      const bx = -k.d;
      const by = -k.e;
      return [q(bx * k.c - k.b * by, det), q(k.a * by - k.b * bx, det)];
    };

    // ================= level 3: classify =================
    if (level === 3) {
      for (;;) {
        const form = rng.int(0, 1);
        const target = rng.int(0, form === 1 ? 3 : 2);
        let k: Coef;
        let xs = 0;
        let ys = 0;
        let fxx: number, fxy: number, fyy: number;
        if (form === 0) {
          const a = rng.nonzero(-4, 4);
          const b = rng.int(-4, 4);
          const c = rng.nonzero(-4, 4);
          xs = rng.int(-6, 6);
          ys = rng.int(-6, 6);
          const g = rng.int(-9, 9);
          k = { a, b, c, d: -(2 * a * xs + b * ys), e: -(b * xs + 2 * c * ys), g };
          fxx = 2 * a;
          fxy = b;
          fyy = 2 * c;
          if (4 * a * c - b * b === 0) continue;
        } else {
          const a = rng.int(-6, 6);
          const b = rng.int(-6, 6);
          const c = rng.int(-6, 6);
          k = { a, b, c, d: 0, e: 0, g: 0 };
          fxx = a;
          fxy = b;
          fyy = c;
        }
        const D = fxx * fyy - fxy * fxy;
        const cls = classify(fxx, D);
        if (cls !== target) continue;

        const optionAns = (i: number) => choiceAnswer(OPT, OPT[i].id);
        const answer = optionAns(cls);
        if (form === 0) partialSteps(k, exprOf(fTerms(k)), latexOf(fTerms(k)));
        steps.push(
          {
            key: 'hessian',
            instruction: 'Find the second partials and compute $D = f_{xx}f_{yy} - (f_{xy})^2$.',
            math: `f_{xx} = ${fxx},\\; f_{xy} = ${fxy},\\; f_{yy} = ${fyy} \\;\\Rightarrow\\; D = (${fxx})(${fyy}) - (${fxy})^2 = ${D}`,
            why: 'D is the determinant of the Hessian matrix; its sign says whether the surface curves the same way in every direction.',
            ask: {
              prompt: `With $f_{xx} = ${fxx}$, $f_{xy} = ${fxy}$, $f_{yy} = ${fyy}$, what is $D$?`,
              answer: numberAnswer(D),
              verify: { type: 'evaluate', expr: `(${fxx})*(${fyy}) - (${fxy})^2` },
            },
          },
          {
            key: 'classify',
            instruction:
              D > 0 ? `$D > 0$, so look at the sign of $f_{xx} = ${fxx}$.` : D < 0 ? '$D < 0$: the surface curves up one way and down another.' : '$D = 0$: the second-derivative test cannot decide.',
            math: `D = ${D}${D > 0 ? `,\\; f_{xx} = ${fxx}` : ''} \\;\\Rightarrow\\; \\text{${OPT[cls].label.toLowerCase()}}`,
            why: 'D > 0 with f_xx < 0 is a maximum, D > 0 with f_xx > 0 a minimum, D < 0 a saddle, D = 0 inconclusive.',
            ask: { prompt: 'Classify the critical point.', answer },
          },
        );

        const cands: (MisconceptionInstance | null)[] = [
          { id: 'ignored-cross', wrong: optionAns(classify(fxx, fxx * fyy)) },
          D > 0 ? { id: 'fxx-sign-swapped', wrong: optionAns(fxx < 0 ? 1 : 0) } : null,
          D < 0 && fxx !== 0 ? { id: 'saddle-as-extremum', wrong: optionAns(fxx < 0 ? 0 : 1) } : null,
        ];
        return {
          params: { form, a: k.a, b: k.b, c: k.c, xs, ys, g: k.g },
          prompt:
            form === 0
              ? `$$f(x, y) = ${latexOf(fTerms(k))}$$ has a critical point at $(${xs}, ${ys})$. Classify it with the second-derivative test.`
              : `At a critical point of $f(x, y)$, $f_{xx} = ${fxx}$, $f_{xy} = ${fxy}$ and $f_{yy} = ${fyy}$. Classify the point.`,
          answer,
          steps,
          misconceptions: distinctMisconceptions(answer, cands),
          verify: { type: 'choice', note: 'tests/skills/multivariable-optimization.test.ts classifies by sampling f on a circle around the point (D = 0 handled as inconclusive)' },
        };
      }
    }

    // ================= level 5: price discrimination =================
    if (level === 5) {
      const q1 = rng.int(1, 12);
      const q2 = rng.int(1, 12);
      const be1 = rng.int(1, 4);
      const be2 = rng.int(1, 4);
      const m = rng.int(5, 30);
      const al1 = m + 2 * be1 * q1;
      const al2 = m + 2 * be2 * q2;
      const k: Coef = { a: -be1, b: 0, c: -be2, d: al1 - m, e: al2 - m, g: 0 };
      partialSteps(k, exprOf(fTerms(k)), `\\pi(x, y) = ${latexOf(fTerms(k))}`);
      const labels = ['q₁', 'q₂'];
      const disp = ['q_1', 'q_2'];
      const answer = pointAnswer(q1, q2, labels, disp);
      steps.push(solveFoc(k, q1, q2, answer, 'Find the profit-maximizing $(q_1, q_2)$, i.e. $(x, y)$.'));
      // Price = MC in each market: q = (alpha - m) / beta. (Differentiating beta*q^2 as beta*q gives the same wrong point.)
      const cands: MisconceptionInstance[] = [{ id: 'mr-equals-price', wrong: pointAnswer(q(al1 - m, be1), q(al2 - m, be2), labels, disp) }];
      const base: Body = {
        params: { q1, q2, be1, be2, m },
        prompt: `A firm sells in two separate markets with demand $P_1 = ${al1} - ${be1 === 1 ? '' : be1}q_1$ and $P_2 = ${al2} - ${be2 === 1 ? '' : be2}q_2$. Its marginal cost is a constant $${m}$ in both. Writing $x = q_1$ and $y = q_2$, the profit is $$\\pi(x, y) = ${latexOf(fTerms(k))}$$ Find the profit-maximizing quantities.`,
        answer,
        steps,
        misconceptions: distinctMisconceptions(answer, cands),
        verify: { type: 'solve', equations: focEqs(k), unknowns: VARS },
      };
      // Interpretation randomness is drawn last.
      if (rng.chance(0.5)) return { ...base, interpretation: [interpretationFor(rng)] };
      return base;
    }

    // ================= levels 1, 2, 4: the critical point (or the maximum profit) =================
    for (;;) {
      let k: Coef;
      let xs: number;
      let ys: number;
      if (level === 4) {
        const a = rng.int(-4, -1);
        const c = rng.int(-4, -1);
        const b = rng.int(-3, 3);
        if (4 * a * c - b * b <= 0) continue;
        xs = rng.int(1, 6);
        ys = rng.int(1, 6);
        const g = rng.int(0, 40);
        k = { a, b, c, d: -(2 * a * xs + b * ys), e: -(b * xs + 2 * c * ys), g };
      } else {
        const a = rng.nonzero(-4, 4);
        const c = rng.nonzero(-4, 4);
        const b = level === 1 ? 0 : rng.nonzero(-4, 4);
        if (4 * a * c - b * b === 0) continue;
        xs = rng.int(-6, 6);
        ys = rng.int(-6, 6);
        if (level === 2 && ys === 0) continue;
        const g = rng.int(-9, 9);
        k = { a, b, c, d: -(2 * a * xs + b * ys), e: -(b * xs + 2 * c * ys), g };
      }
      const fE = exprOf(fTerms(k));
      const fL = latexOf(fTerms(k));
      const profit = level === 4;
      partialSteps(k, fE, profit ? `\\pi(x, y) = ${fL}` : fL);
      const pt = pointAnswer(xs, ys);
      steps.push(solveFoc(k, xs, ys, pt, 'Solve for the critical point $(x, y)$.'));

      const piAt = (x: Q, y: Q): Q => {
        const [A, B, C, Dd, E, G] = [k.a, k.b, k.c, k.d, k.e, k.g].map((v) => q(v));
        return A.mul(x).mul(x).add(B.mul(x).mul(y)).add(C.mul(y).mul(y)).add(Dd.mul(x)).add(E.mul(y)).add(G);
      };
      const best = piAt(q(xs), q(ys));
      const one: [Q, Q] = [q(-k.d, 2 * k.a), q(-k.e, 2 * k.c)];
      const fw = factorWrong(k);
      let answer: AnswerSpec;
      let verify: VerifySpec;
      let cands: (MisconceptionInstance | null)[];
      if (profit) {
        answer = numberAnswer(best);
        verify = { type: 'evaluate', expr: exprOf(fTerms(k), `(${xs})`, `(${ys})`) };
        steps.push({
          key: 'value',
          instruction: `Substitute $x = ${xs}$ and $y = ${ys}$ into the profit function.`,
          math: `\\pi(${xs}, ${ys}) = ${best.toLatex()}`,
          why: 'The maximum profit is the value of the profit function at the optimal quantities. Here $f_{xx} < 0$ and $D = 4ac - b^2 > 0$ confirm a maximum.',
          ask: { prompt: `What is the maximum profit, $\\pi(${xs}, ${ys})$?`, answer, verify },
        });
        cands = [
          { id: 'foc-one-at-a-time', wrong: numberAnswer(piAt(one[0], one[1])) },
          fw ? { id: 'forgot-factor-2', wrong: numberAnswer(piAt(fw[0], fw[1])) } : null,
        ];
      } else {
        answer = pt;
        verify = { type: 'solve', equations: focEqs(k), unknowns: VARS };
        cands = [
          level === 2 ? { id: 'foc-one-at-a-time', wrong: pointAnswer(one[0], one[1]) } : null,
          fw ? { id: 'forgot-factor-2', wrong: pointAnswer(fw[0], fw[1]) } : null,
        ];
      }
      return {
        params: { a: k.a, b: k.b, c: k.c, xs, ys, g: k.g },
        prompt: profit
          ? `A firm makes two products in quantities $x$ and $y$ (hundreds of units). Its profit, in thousands of dollars, is $$\\pi(x, y) = ${fL}$$ Find the maximum profit.`
          : level === 1
            ? `Find the critical point of $$f(x, y) = ${fL}$$`
            : `Find the critical point $(x, y)$ of $$f(x, y) = ${fL}$$ by setting both partial derivatives to zero.`,
        answer,
        steps,
        misconceptions: distinctMisconceptions(answer, cands),
        verify,
      };
    }
  },
};
