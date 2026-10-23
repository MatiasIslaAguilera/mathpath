// Partial derivatives of f(x, y): polynomial terms k·xᵐyⁿ, chain-rule forms, a value at a
// point, and second-order partials (the Hessian entries used by multivariable optimization).

import { choiceAnswer, expressionAnswer, numberAnswer } from '../../engine/answers';
import { coefLatex, joinTerms } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { AnswerSpec, InterpretationQuestion, MisconceptionInstance, SkillDefinition, Step, VerifySpec } from '../../engine/types';

const ID = 'partial-derivatives';
const VARS = ['x', 'y'];

/** k·xᵐ·yⁿ with integer k. */
interface Term {
  k: number;
  m: number;
  n: number;
}

// ---------- polynomial helpers ----------

/** Merge like monomials, drop zero coefficients. */
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

function termLatex(t: Term): string {
  const body = pw('x', t.m) + pw('y', t.n);
  return body === '' ? q(t.k).toLatex() : `${coefLatex(q(t.k))}${body}`;
}

function termExpr(t: Term): string {
  const parts = [q(t.k).toExpr()];
  if (t.m > 0) parts.push(t.m === 1 ? 'x' : `x^${t.m}`);
  if (t.n > 0) parts.push(t.n === 1 ? 'y' : `y^${t.n}`);
  return parts.join('*');
}

const polyLatex = (terms: Term[]) => joinTerms(normalize(terms).map(termLatex));
const polyExpr = (terms: Term[]) => {
  const ts = normalize(terms);
  return ts.length ? ts.map(termExpr).join(' + ') : '0';
};

/** ∂/∂v of one term (v = 0 for x, 1 for y); null when it vanishes. */
function dTerm(t: Term, v: number): Term | null {
  if (v === 0) return t.m === 0 ? null : { k: t.k * t.m, m: t.m - 1, n: t.n };
  return t.n === 0 ? null : { k: t.k * t.n, m: t.m, n: t.n - 1 };
}
function dPoly(terms: Term[], v: number): Term[] {
  return normalize(terms.map((t) => dTerm(t, v)).filter((t): t is Term => t !== null));
}

function powQ(b: number, e: number): Q {
  let r = q(1);
  for (let i = 0; i < e; i++) r = r.mul(q(b));
  return r;
}
function evalPoly(terms: Term[], x0: number, y0: number): Q {
  return terms.reduce((s, t) => s.add(q(t.k).mul(powQ(x0, t.m)).mul(powQ(y0, t.n))), q(0));
}

const letter = (v: number) => (v === 0 ? 'x' : 'y');
const isMixed = (t: Term) => t.m >= 1 && t.n >= 1;
const own = (t: Term, v: number) => (v === 0 ? t.m : t.n);

// ---------- chain-rule forms (level 3) ----------

function innerLatex(a: number, b: number): string {
  return joinTerms([`${coefLatex(q(a))}x`, `${coefLatex(q(b))}y`]);
}
const innerExpr = (a: number, b: number) => `(${a})*x + (${b})*y`;

// ---------- interpretation (level 4) ----------

function choice(rng: Rng, correct: string, wrong: string[]) {
  const options = rng.shuffle([correct, ...wrong].map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: 'o0' };
}

function interpretationFor(rng: Rng, wrt: number, x0: number, y0: number, v: Q): InterpretationQuestion {
  const sign = v.sign();
  const abs = v.abs().toLatex();
  const vl = v.toLatex();
  const inL = wrt === 0;
  const sub = inL ? 'L' : 'K';
  const move = inL ? 'One more hour of labor' : 'One more machine';
  const held = inL ? 'machines held fixed' : 'labor hours held fixed';
  const both = inL ? 'One more hour of labor *and* one more machine' : 'One more machine *and* one more hour of labor';
  const avg = inL ? "Labor's average product is" : "A machine's average product is";
  const dir = sign > 0 ? 'raises' : 'lowers';
  const { options, correct } = choice(rng, `${move}, with ${held}, ${dir} output by about $${abs}$ units`, [
    `${both} together ${dir} output by about $${abs}$ units`,
    `Output is $${vl}$ units at this point`,
    `${avg} $${vl}$ units`,
  ]);
  return {
    prompt: `$Q = f(L, K)$ is a firm's output from $L$ hours of labor and $K$ machines. Using your answer, $f_${sub}(${x0}, ${y0}) = ${vl}$. What does that mean?`,
    options,
    correct,
    explanation: `A partial derivative changes *one* input and holds the others fixed. $f_${sub}$ is the marginal product of ${inL ? 'labor' : 'capital'}: the change in output from ${move.toLowerCase()} while ${inL ? 'machines' : 'labor hours'} stay fixed. It is a rate of change, not the output level and not output per worker. Here it is ${sign > 0 ? 'positive, so output rises' : 'negative, so output falls'}.`,
  };
}

// ---------- skill ----------

const rangesPoly: Record<string, [number, number]> = {
  wrt: [0, 1],
  k1: [-9, 9],
  m1: [1, 3],
  n1: [1, 3],
  k2: [-9, 9],
  p2: [1, 3],
  k3: [-9, 9],
  q3: [1, 3],
  k4: [-9, 9],
};

export const partialDerivatives: SkillDefinition = {
  id: ID,
  title: 'Partial derivatives',
  track: 'math',
  unit: 'Multivariable calculus',
  description: 'Differentiate f(x, y) with respect to one variable, holding the other fixed; second-order partials.',
  prerequisites: ['derivatives-chain-rule'],
  maxDenominator: 4,
  levels: {
    1: {
      description: 'Simple terms: one mixed term',
      ranges: { wrt: [0, 1], k1: [-9, 9], a1: [1, 3], k2: [-9, 9], p2: [1, 3], k3: [-9, 9], p3: [1, 3] },
    },
    2: { description: 'Mixed terms with both exponents', ranges: rangesPoly },
    3: {
      description: 'Chain rule: (ax+by)ⁿ, e^(ax+by), ln(ax+by)',
      ranges: { wrt: [0, 1], form: [0, 2], a: [-5, 5], b: [-5, 5], n: [2, 4] },
    },
    4: { description: 'Evaluate a partial at a point', ranges: { ...rangesPoly, x0: [-3, 3], y0: [-3, 3] } },
    5: {
      description: 'Second-order partials at a point',
      ranges: {
        which: [0, 2],
        k1: [-9, 9],
        m1: [1, 3],
        n1: [1, 3],
        k2: [-9, 9],
        p2: [1, 3],
        k3: [-9, 9],
        q3: [1, 3],
        k4: [-9, 9],
        x0: [-3, 3],
        y0: [-3, 3],
      },
    },
  },
  misconceptions: {
    'wrong-variable': {
      name: 'Differentiated with respect to the other variable',
      explanation:
        'The subscript or the "∂/∂x" says which variable moves. For $f_x$, differentiate with respect to $x$ and treat $y$ as a constant; for $f_y$, the reverse. Check which letter you differentiated by.',
    },
    'differentiated-both': {
      name: 'Differentiated the other variable too',
      explanation:
        'In $f_x$ only $x$ moves. The $y$ part of a term such as $3x^2y^3$ is just a constant multiplier, so $f_x = 6xy^3$, not $18xy^2$. Differentiating both letters gives something else entirely.',
    },
    'kept-constant-term': {
      name: 'Kept a term without the variable (it should vanish)',
      explanation:
        'A term that does not contain the variable you differentiate by is a constant for that derivative, and constants have derivative 0. In $f_x$, a term like $5y^2$ disappears.',
    },
    'dropped-mixed-term': {
      name: 'Dropped a term that has both variables',
      explanation:
        'A term like $3xy$ does depend on $x$. Holding $y$ fixed, $3y$ is just its coefficient, so $\\frac{\\partial}{\\partial x}3xy = 3y$. It does not vanish; only terms free of $x$ do.',
    },
    'forgot-inner': {
      name: "Forgot to multiply by the inside's derivative",
      explanation:
        'The chain rule needs the derivative of the inside too. For $(ax + by)^n$, $f_x = n(ax+by)^{n-1}\\cdot a$ and $f_y = n(ax+by)^{n-1}\\cdot b$. The inner partial is the number multiplying the variable you differentiate by.',
    },
    'wrong-second': {
      name: 'Took the wrong second partial',
      explanation:
        '$f_{xx}$ differentiates by $x$ twice, $f_{yy}$ by $y$ twice, and $f_{xy}$ once by each (first $x$, then $y$). Read the subscripts left to right and apply them one at a time.',
    },
  },
  stepLabels: {
    'hold-constant': 'Treat the other variable as a constant',
    terms: 'Differentiate term by term',
    inner: 'Differentiate the inside',
    outer: 'Apply the chain rule',
    substitute: 'Substitute the point',
    first: 'Take the first partial',
    second: 'Take the second partial',
  },
  learn: {
    whyItMatters:
      'Most economic quantities depend on several inputs, and a partial derivative asks how one input matters while the rest stay fixed. The marginal product of labor is $\\partial Q/\\partial L$. For $Q = 4L + 2LK + K^2$, $\\partial Q/\\partial L = 4 + 2K$. With $K = 5$ machines, that is $4 + 10 = 14$: one more hour of labor adds about 14 units of output while capital stays fixed. Marginal utilities, Cobb-Douglas models, and comparative statics all start with partial derivatives.',
    summary:
      "To find $f_x$, differentiate with respect to $x$ and treat every other variable as a constant. Terms with no $x$ vanish; a $y$ multiplying an $x$-term just rides along as a coefficient. Chain-rule forms multiply by the inside's partial. A second-order partial applies two partials in turn, left to right.",
    formulas: [
      { latex: '\\frac{\\partial}{\\partial x}\\left(k\\,x^m y^n\\right) = k\\,m\\,x^{m-1}y^n', note: '$y$ is held constant.' },
      { latex: 'f_{xy} = \\frac{\\partial}{\\partial y}\\left(f_x\\right)', note: 'Differentiate by $x$ first, then by $y$.' },
      { latex: "\\frac{\\partial}{\\partial x}\\,g(ax+by) = a\\,g'(ax+by)", note: "Chain rule: multiply by the inner partial." },
    ],
    example: { seed: 3, level: 2 },
    tips: ['Before differentiating, say which letter is the variable and which is just a number.'],
  },

  generate(rng, level) {
    const steps: Step[] = [];
    const holdStep = (v: number): Step => {
      const a = letter(v);
      const b = letter(1 - v);
      const { options, correct } = choice(rng, 'As a constant (a fixed number)', ['As a variable you also differentiate', 'As zero']);
      return {
        key: 'hold-constant',
        instruction: `Treat $${b}$ as a constant.`,
        math: `\\frac{\\partial}{\\partial ${a}}\\left(c\\,${b}\\right) = c`,
        why: 'A partial derivative changes one variable and holds the others fixed.',
        ask: {
          prompt: `When you differentiate with respect to $${a}$, how do you treat $${b}$?`,
          answer: choiceAnswer(options, correct),
        },
      };
    };
    const verifyPartial = (expr: string, wrt: string[], at?: Record<string, string>): VerifySpec => ({
      type: 'partial',
      expr,
      wrt,
      variables: VARS,
      ...(at ? { at } : {}),
    });

    // ================= level 3: chain rule =================
    if (level === 3) {
      const wrt = rng.int(0, 1);
      const form = rng.int(0, 2);
      const a = rng.nonzero(-5, 5);
      const b = rng.nonzero(-5, 5);
      const n = form === 0 ? rng.int(2, 4) : 2;
      const v = letter(wrt);
      const c = wrt === 0 ? a : b;
      const otherC = wrt === 0 ? b : a;
      const inL = innerLatex(a, b);
      const inE = innerExpr(a, b);
      let fL: string, fE: string, ansL: string, ansE: string, noInnerL: string, noInnerE: string, wrongVarL: string, wrongVarE: string;
      if (form === 0) {
        const pl = n - 1 === 1 ? `(${inL})` : `(${inL})^{${n - 1}}`;
        fL = `(${inL})^{${n}}`;
        fE = `(${inE})^${n}`;
        ansL = `${coefLatex(q(c * n))}${pl}`;
        ansE = `(${c * n})*(${inE})^${n - 1}`;
        noInnerL = `${coefLatex(q(n))}${pl}`;
        noInnerE = `(${n})*(${inE})^${n - 1}`;
        wrongVarL = `${coefLatex(q(otherC * n))}${pl}`;
        wrongVarE = `(${otherC * n})*(${inE})^${n - 1}`;
      } else if (form === 1) {
        fL = `e^{${inL}}`;
        fE = `exp(${inE})`;
        ansL = `${coefLatex(q(c))}e^{${inL}}`;
        ansE = `(${c})*exp(${inE})`;
        noInnerL = `e^{${inL}}`;
        noInnerE = `exp(${inE})`;
        wrongVarL = `${coefLatex(q(otherC))}e^{${inL}}`;
        wrongVarE = `(${otherC})*exp(${inE})`;
      } else {
        fL = `\\ln(${inL})`;
        fE = `log(${inE})`;
        ansL = `\\frac{${c}}{${inL}}`;
        ansE = `(${c})/(${inE})`;
        noInnerL = `\\frac{1}{${inL}}`;
        noInnerE = `1/(${inE})`;
        wrongVarL = `\\frac{${otherC}}{${inL}}`;
        wrongVarE = `(${otherC})/(${inE})`;
      }

      steps.push(
        holdStep(wrt),
        {
          key: 'inner',
          instruction: `Differentiate the inside, $${inL}$, with respect to $${v}$.`,
          math: `\\frac{\\partial}{\\partial ${v}}\\left(${inL}\\right) = ${c}`,
          why: `With $${letter(1 - wrt)}$ held constant, only the $${v}$-term of the inside changes.`,
          ask: {
            prompt: `What is $\\frac{\\partial}{\\partial ${v}}\\left(${inL}\\right)$?`,
            answer: numberAnswer(c),
            verify: verifyPartial(inE, [v]),
          },
        },
        {
          key: 'outer',
          instruction: "Differentiate the outside function, then multiply by the inside's derivative.",
          math: `f_${v} = ${ansL}`,
          why: 'Chain rule: outer derivative (inside left alone) times inner derivative.',
          ask: {
            prompt: `So $f_${v} = \\;?$`,
            answer: expressionAnswer(ansE, ansL, VARS),
            verify: verifyPartial(fE, [v]),
          },
        },
      );
      const answer = expressionAnswer(ansE, ansL, VARS);
      const cands: MisconceptionInstance[] = [
        { id: 'wrong-variable', wrong: expressionAnswer(wrongVarE, wrongVarL, VARS) },
        { id: 'forgot-inner', wrong: expressionAnswer(noInnerE, noInnerL, VARS) },
      ];
      return {
        params: { wrt, form, a, b, n },
        prompt: `Find $f_${v}$, the partial derivative with respect to $${v}$, of $$f(x, y) = ${fL}$$`,
        answer,
        steps,
        misconceptions: distinctMisconceptions(answer, cands),
        verify: verifyPartial(fE, [v]),
      };
    }

    // ================= level 5: second-order partials =================
    if (level === 5) {
      const SEQ = [
        [0, 0],
        [0, 1],
        [1, 1],
      ];
      const names = ['f_{xx}', 'f_{xy}', 'f_{yy}'];
      const wrts = [
        ['x', 'x'],
        ['x', 'y'],
        ['y', 'y'],
      ];
      for (;;) {
        const which = rng.int(0, 2);
        const k1 = rng.nonzero(-9, 9);
        const m1 = rng.int(1, 3);
        const n1 = rng.int(1, 3);
        const k2 = rng.nonzero(-9, 9);
        const p2 = rng.int(1, 3);
        const k3 = rng.nonzero(-9, 9);
        const q3 = rng.int(1, 3);
        const k4 = rng.int(-9, 9);
        const x0 = rng.int(-3, 3);
        const y0 = rng.int(-3, 3);
        const terms: Term[] = rng.shuffle<Term>([
          { k: k1, m: m1, n: n1 },
          { k: k2, m: p2, n: 0 },
          { k: k3, m: 0, n: q3 },
          ...(k4 !== 0 ? [{ k: k4, m: 0, n: 0 }] : []),
        ]);
        const valueOf = (w: number) => evalPoly(dPoly(dPoly(terms, SEQ[w][0]), SEQ[w][1]), x0, y0);
        const val = valueOf(which);
        if (val.isZero()) continue;
        const at = { x: String(x0), y: String(y0) };
        const fE = polyExpr(terms);
        const first = dPoly(terms, SEQ[which][0]);
        const secondPoly = dPoly(first, SEQ[which][1]);
        const fv = letter(SEQ[which][0]);
        const sv = letter(SEQ[which][1]);
        steps.push(
          {
            key: 'first',
            instruction: `Take the first partial with respect to $${fv}$.`,
            math: `f_${fv} = ${polyLatex(first)}`,
            why: `Differentiate by $${fv}$, holding $${fv === 'x' ? 'y' : 'x'}$ constant.`,
            ask: {
              prompt: `What is $f_${fv}$?`,
              answer: expressionAnswer(polyExpr(first), polyLatex(first), VARS),
              verify: verifyPartial(fE, [fv]),
            },
          },
          {
            key: 'second',
            instruction: `Differentiate that result with respect to $${sv}$.`,
            math: `${names[which]} = ${polyLatex(secondPoly)}`,
            why: 'A second-order partial applies one partial after another, left to right.',
            ask: {
              prompt: `What is $${names[which]}$?`,
              answer: expressionAnswer(polyExpr(secondPoly), polyLatex(secondPoly), VARS),
              verify: verifyPartial(fE, wrts[which]),
            },
          },
          {
            key: 'substitute',
            instruction: `Substitute $x = ${x0}$, $y = ${y0}$.`,
            math: `${names[which]}(${x0}, ${y0}) = ${val.toLatex()}`,
            why: 'Evaluate the expression at the point.',
            ask: {
              prompt: `What is $${names[which]}(${x0}, ${y0})$?`,
              answer: numberAnswer(val),
              verify: verifyPartial(fE, wrts[which], at),
            },
          },
        );
        const answer = numberAnswer(val);
        const cands: (MisconceptionInstance | null)[] = [
          which === 1 ? null : { id: 'wrong-variable', wrong: numberAnswer(valueOf(which === 0 ? 2 : 0)) },
          ...[0, 1, 2].filter((w) => w !== which).map((w) => ({ id: 'wrong-second', wrong: numberAnswer(valueOf(w)) })),
        ];
        return {
          params: { which, k1, m1, n1, k2, p2, k3, q3, k4, x0, y0 },
          prompt: `Find $${names[which]}(${x0}, ${y0})$ for $$f(x, y) = ${polyLatex(terms)}$$`,
          answer,
          steps,
          misconceptions: distinctMisconceptions(answer, cands),
          verify: verifyPartial(fE, wrts[which], at),
        };
      }
    }

    // ================= levels 1, 2, 4: polynomials =================
    for (;;) {
      const wrt = rng.int(0, 1);
      const v = letter(wrt);
      const o = letter(1 - wrt);
      let params: Record<string, number>;
      let terms: Term[];
      // a monomial with `ownExp` in the differentiated variable and `othExp` in the other
      const mono = (k: number, ownExp: number, othExp: number): Term => (wrt === 0 ? { k, m: ownExp, n: othExp } : { k, m: othExp, n: ownExp });
      if (level === 1) {
        const k1 = rng.nonzero(-9, 9);
        const a1 = rng.int(1, 3);
        const k2 = rng.nonzero(-9, 9);
        const p2 = rng.int(1, 3);
        const k3 = rng.int(-9, 9);
        const p3 = rng.int(1, 3);
        params = { wrt, k1, a1, k2, p2, k3, p3 };
        terms = rng.shuffle<Term>([mono(k1, a1, 1), mono(k2, 0, p2), ...(k3 !== 0 ? [mono(k3, p3, 0)] : [])]);
      } else {
        const k1 = rng.nonzero(-9, 9);
        const m1 = rng.int(1, 3);
        const n1 = rng.int(1, 3);
        const k2 = rng.nonzero(-9, 9);
        const p2 = rng.int(1, 3);
        const k3 = rng.nonzero(-9, 9);
        const q3 = rng.int(1, 3);
        const k4 = rng.int(-9, 9);
        params = { wrt, k1, m1, n1, k2, p2, k3, q3, k4 };
        terms = rng.shuffle<Term>([{ k: k1, m: m1, n: n1 }, mono(k2, p2, 0), mono(k3, 0, q3), ...(k4 !== 0 ? [{ k: k4, m: 0, n: 0 }] : [])]);
      }
      const point = level === 4;
      let x0 = 0;
      let y0 = 0;
      if (point) {
        x0 = rng.int(-3, 3);
        y0 = rng.int(-3, 3);
        params = { ...params, x0, y0 };
      }
      const poly = dPoly(terms, wrt);
      const val = point ? evalPoly(poly, x0, y0) : q(0);
      if (point && val.isZero()) continue;

      const fE = polyExpr(terms);
      const at = { x: String(x0), y: String(y0) };
      const asAnswer = (p: Term[]): AnswerSpec => (point ? numberAnswer(evalPoly(p, x0, y0)) : expressionAnswer(polyExpr(p), polyLatex(p), VARS));

      const termsStep: Step = {
        key: 'terms',
        instruction: `Differentiate each term with respect to $${v}$, treating $${o}$ as a constant.`,
        math: `f_${v} = ${polyLatex(poly)}`,
        why: `Terms without $${v}$ vanish; in a mixed term, $${o}$ stays as a coefficient.`,
        ask: {
          prompt: `What is $f_${v}(x, y)$?`,
          answer: expressionAnswer(polyExpr(poly), polyLatex(poly), VARS),
          verify: verifyPartial(fE, [v]),
        },
      };
      if (point) {
        steps.push(termsStep, {
          key: 'substitute',
          instruction: `Substitute $x = ${x0}$, $y = ${y0}$.`,
          math: `f_${v}(${x0}, ${y0}) = ${val.toLatex()}`,
          why: 'Evaluate the partial derivative at the point.',
          ask: {
            prompt: `What is $f_${v}(${x0}, ${y0})$?`,
            answer: numberAnswer(val),
            verify: verifyPartial(fE, [v], at),
          },
        });
      } else {
        steps.push(holdStep(wrt), termsStep);
      }

      const answer = asAnswer(poly);
      const nonVar = terms.filter((t) => own(t, wrt) === 0);
      const hasMixed = terms.some(isMixed);
      const cands: (MisconceptionInstance | null)[] = [
        { id: 'wrong-variable', wrong: asAnswer(dPoly(terms, 1 - wrt)) },
        {
          id: 'differentiated-both',
          wrong: asAnswer(
            normalize(terms.map((t) => (isMixed(t) ? { k: t.k * t.m * t.n, m: t.m - 1, n: t.n - 1 } : dTerm(t, wrt))).filter((t): t is Term => t !== null)),
          ),
        },
        nonVar.length ? { id: 'kept-constant-term', wrong: asAnswer([...poly, ...nonVar]) } : null,
        hasMixed ? { id: 'dropped-mixed-term', wrong: asAnswer(dPoly(terms.filter((t) => !isMixed(t)), wrt)) } : null,
      ];

      const base = {
        params,
        prompt: point
          ? `Find $f_${v}(${x0}, ${y0})$ for $$f(x, y) = ${polyLatex(terms)}$$`
          : `Find $f_${v}$, the partial derivative with respect to $${v}$, of $$f(x, y) = ${polyLatex(terms)}$$`,
        answer,
        steps,
        misconceptions: distinctMisconceptions(answer, cands),
        verify: point ? verifyPartial(fE, [v], at) : verifyPartial(fE, [v]),
      };
      // Interpretation randomness is drawn last.
      if (point && rng.chance(0.5)) return { ...base, interpretation: [interpretationFor(rng, wrt, x0, y0, val)] };
      return base;
    }
  },
};
