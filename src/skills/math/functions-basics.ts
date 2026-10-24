// Functions: evaluating (L1-L2, number answers) and domain / range (L3-L5, multiple choice).
// Choice levels use verify { type: 'choice' }: tests/skills/functions-basics.test.ts re-derives
// the correct option from the raw params.

import { choiceAnswer, numberAnswer } from '../../engine/answers';
import { coefLatex, joinTerms, linLatex } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';

const ID = 'functions-basics';

type Generated = ReturnType<SkillDefinition['generate']>;

// ---------- helpers ----------

/** A number as an expression operand: negatives in parentheses. */
const par = (n: number) => (n < 0 ? `(${n})` : `${n}`);
/** c·x^2 + b·x + a (LaTeX), dropping zero terms. */
function quadLatex(a: number, b: number, c: number): string {
  const terms: string[] = [];
  if (a !== 0) terms.push(`${coefLatex(q(a))}x^{2}`);
  if (b !== 0) terms.push(`${coefLatex(q(b))}x`);
  if (c !== 0 || terms.length === 0) terms.push(`${c}`);
  return joinTerms(terms);
}
/** Coefficient times a parenthesized input: 3(-2), -(-2), (−2). */
const timesInput = (c: number, input: string) => (c === 1 ? input : c === -1 ? `-${input}` : `${c}${input}`);

type Opt = { id: string; label: string };
/** Shuffle options; the first entry is the correct one (id 'o0'). */
function shuffled(rng: Rng, labels: string[]): { options: ChoiceOption[]; correct: string } {
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: 'o0' };
}
const m = (x: string) => `$${x}$`;

/** Labelled options in a fixed order, e.g. the two pieces of a piecewise function. */
const fixed = (opts: Opt[]): ChoiceOption[] => opts;

// ---------- level 1: evaluate ax^2 + bx + c ----------

function evaluateQuadratic(rng: Rng): Generated {
  let a = 0;
  let b = 0;
  let c = 0;
  let x0 = 0;
  for (;;) {
    a = rng.chance(0.2) ? 0 : rng.nonzero(-3, 3);
    b = rng.int(-6, 6);
    c = rng.int(-9, 9);
    x0 = rng.int(-4, 4);
    if (a === 0 && b === 0) continue;
    break;
  }
  return buildQuadratic(a, b, c, x0);
}

/** Steps, answer and misconceptions for f(x0) = a x0^2 + b x0 + c (shared by plain and story problems). */
function buildQuadratic(a: number, b: number, c: number, x0: number): Generated {
  const value = a * x0 * x0 + b * x0 + c;
  const fLatex = quadLatex(a, b, c);
  const expr = `${a}*${par(x0)}^2 + ${b}*${par(x0)} + ${c}`;
  const verify = { type: 'evaluate' as const, expr };
  const answer = numberAnswer(value);
  const x0p = `(${x0})`;

  const subTerms: string[] = [];
  if (a !== 0) subTerms.push(`${timesInput(a, x0p)}^{2}`);
  if (b !== 0) subTerms.push(timesInput(b, x0p));
  if (c !== 0) subTerms.push(`${c}`);
  const firstAsk =
    a !== 0
      ? { prompt: `$(${x0})^{2} = \\;?$`, value: x0 * x0, expr: `${par(x0)}^2` }
      : { prompt: `$${b}\\cdot(${x0}) = \\;?$`, value: b * x0, expr: `${b}*${par(x0)}` };

  const numeric: string[] = [];
  if (a !== 0) numeric.push(`${a * x0 * x0}`);
  if (b !== 0) numeric.push(`${b * x0}`);
  if (c !== 0) numeric.push(`${c}`);

  const steps: Step[] = [
    {
      key: 'substitute',
      instruction: `Replace every $x$ with $${x0}$, keeping the input in parentheses.`,
      math: `f(${x0}) = ${joinTerms(subTerms)}`,
      why: 'Evaluating a function means replacing the variable by the input everywhere. Parentheses keep a negative input together with its sign.',
      ask: {
        prompt: firstAsk.prompt,
        answer: numberAnswer(firstAsk.value),
        verify: { type: 'evaluate', expr: firstAsk.expr },
      },
    },
    {
      key: 'order-of-operations',
      instruction: 'Powers first, then multiplication, then add and subtract.',
      math: `f(${x0}) = ${joinTerms(numeric)} = ${value}`,
      why: 'Order of operations: exponents before multiplication before addition. $(−2)^2 = 4$, because the parentheses square the whole input.',
      ask: { prompt: `$f(${x0}) = \\;?$`, answer, verify },
    },
  ];

  const wrongVal = a !== 0 && x0 < 0 ? value - 2 * a * x0 * x0 : null;
  const candidates: (MisconceptionInstance | null)[] = [
    wrongVal === null ? null : { id: 'negative-squared', wrong: numberAnswer(wrongVal) },
  ];

  return {
    params: { a, b, c, x0 },
    prompt: `Let $$f(x) = ${fLatex}$$ Find $f(${x0})$.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    verify,
  };
}

// ---------- level 2: evaluate with care (-ax^2 + bx, or piecewise) ----------

function evaluateCareful(rng: Rng): Generated {
  const form = rng.int(0, 1); // 0: -a x^2 + b x at a negative input; 1: piecewise
  if (form === 1) {
    const p = rng.nonzero(-4, 4);
    const qq = rng.int(-9, 9);
    const a = rng.int(1, 3);
    const b = rng.int(-9, 9);
    const k = rng.int(-3, 3);
    const x0 = k + rng.int(-2, 2);
    return buildPiecewise(a, b, p, qq, k, x0);
  }
  const a = rng.int(1, 3);
  const b = rng.nonzero(-6, 6);
  const x0 = rng.int(-5, -1);
  return buildNegQuad(a, b, x0);
}

/** f(x) = -a x^2 + b x at x0 (shared by plain and story problems). */
function buildNegQuad(a: number, b: number, x0: number): Generated {
  const form = 0;
  const value = -a * x0 * x0 + b * x0;
  const expr = `-${a}*${par(x0)}^2 + ${b}*${par(x0)}`;
  const steps: Step[] = [
    {
      key: 'substitute',
      instruction: `Replace $x$ with $${x0}$ in parentheses.`,
      math: `f(${x0}) = ${timesInput(-a, `(${x0})`)}^{2} ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}(${x0})`,
      why: 'The input goes in parentheses so its sign travels with it.',
      ask: {
        prompt: `$(${x0})^{2} = \\;?$`,
        answer: numberAnswer(x0 * x0),
        verify: { type: 'evaluate', expr: `${par(x0)}^2` },
      },
    },
    {
      key: 'order-of-operations',
      instruction: 'Square first, then apply the minus sign and the coefficient.',
      math: `f(${x0}) = -${a}\\cdot ${x0 * x0} ${b * x0 < 0 ? '-' : '+'} ${Math.abs(b * x0)} = ${value}`,
      why: 'The power binds tighter than the minus sign: $-x^2 = -(x^2)$. So at $x = -2$, $-x^2 = -4$, not $+4$.',
      ask: { prompt: `$f(${x0}) = \\;?$`, answer: numberAnswer(value), verify: { type: 'evaluate', expr } },
    },
  ];
  const answer = numberAnswer(value);
  return {
    // Unused entries are 0 so every level-2 problem reports the same parameter set.
    params: { form, a, b, p: 0, q: 0, k: 0, x0 },
    prompt: `Let $$f(x) = ${quadLatex(-a, b, 0)}$$ Find $f(${x0})$.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, [{ id: 'negative-squared', wrong: numberAnswer(value + 2 * a * x0 * x0) }]),
    verify: { type: 'evaluate', expr },
  };
}

/** f(x) = p x + q for x < k, a x^2 + b for x >= k, evaluated at x0 (shared by plain and story problems). */
function buildPiecewise(a: number, b: number, p: number, qq: number, k: number, x0: number): Generated {
  const right = x0 >= k;
  const leftVal = p * x0 + qq;
  const rightVal = a * x0 * x0 + b;
  const value = right ? rightVal : leftVal;
  const leftL = linLatex(p, qq);
  const rightL = b === 0 ? `${coefLatex(q(a))}x^{2}` : `${coefLatex(q(a))}x^{2} ${b < 0 ? '-' : '+'} ${Math.abs(b)}`;
  const expr = right ? `${a}*${par(x0)}^2 + ${par(b)}` : `${p}*${par(x0)} + ${par(qq)}`;
  const steps: Step[] = [
    {
      key: 'pick-piece',
      instruction: `Compare the input $${x0}$ with the cut-off $${k}$ to choose the rule.`,
      math: `${x0} ${right ? '\\ge' : '<'} ${k} \\;\\Rightarrow\\; \\text{use the ${right ? 'second' : 'first'} rule}`,
      why: 'A piecewise function has one rule per region. At the cut-off itself, the piece with $\\ge$ (or $\\le$) is the one that applies.',
      ask: {
        prompt: `Which rule applies at $x = ${x0}$?`,
        answer: choiceAnswer(
          fixed([
            { id: 'left', label: `The first rule ($x < ${k}$)` },
            { id: 'right', label: `The second rule ($x \\ge ${k}$)` },
          ]),
          right ? 'right' : 'left',
        ),
      },
    },
    {
      key: 'substitute',
      instruction: `Substitute $x = ${x0}$ into the ${right ? 'second' : 'first'} rule.`,
      math: right ? `f(${x0}) = ${timesInput(a, `(${x0})`)}^{2} ${b < 0 ? '-' : '+'} ${Math.abs(b)}` : `f(${x0}) = ${timesInput(p, `(${x0})`)} ${qq < 0 ? '-' : '+'} ${Math.abs(qq)}`,
      why: 'Only the chosen rule is used; the other rule is ignored.',
      ask: right
        ? { prompt: `$(${x0})^{2} = \\;?$`, answer: numberAnswer(x0 * x0), verify: { type: 'evaluate', expr: `${par(x0)}^2` } }
        : { prompt: `$${p}\\cdot(${x0}) = \\;?$`, answer: numberAnswer(p * x0), verify: { type: 'evaluate', expr: `${p}*${par(x0)}` } },
    },
    {
      key: 'order-of-operations',
      instruction: 'Finish the arithmetic: powers, then multiplication, then adding.',
      math: right ? `f(${x0}) = ${a * x0 * x0} ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${value}` : `f(${x0}) = ${p * x0} ${qq < 0 ? '-' : '+'} ${Math.abs(qq)} = ${value}`,
      why: 'Powers first, then products, then sums.',
      ask: { prompt: `$f(${x0}) = \\;?$`, answer: numberAnswer(value), verify: { type: 'evaluate', expr } },
    },
  ];
  const candidates: (MisconceptionInstance | null)[] = [{ id: 'wrong-piece', wrong: numberAnswer(right ? leftVal : rightVal) }];
  if (right && x0 < 0) candidates.push({ id: 'negative-squared', wrong: numberAnswer(value - 2 * a * x0 * x0) });
  const answer = numberAnswer(value);
  return {
    params: { form: 1, a, b, p, q: qq, k, x0 },
    prompt: `Let $$f(x) = \\begin{cases} ${leftL} & x < ${k} \\\\ ${rightL} & x \\ge ${k} \\end{cases}$$ Find $f(${x0})$.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    verify: { type: 'evaluate', expr },
  };
}

// ---------- story variants (levels 1-2): the same evaluations as situations ----------

/** A setup step: write the situation as an expression in x (checked by equivalence). */
function setupStep(prompt: string, expr: string, display: string, why: string, key = 'setup'): Step {
  return {
    key,
    instruction: prompt,
    math: display,
    why,
    ask: {
      prompt,
      answer: { kind: 'expression', value: expr, variables: ['x'], display },
      verify: { type: 'equivalent', expr, variables: ['x'] },
    },
  };
}

function storyProfit(rng: Rng): Generated {
  // Profit = revenue - cost, in thousands of dollars, x in hundreds of units.
  let a = 0;
  let b = 0;
  let c = 0;
  let x0 = 0;
  for (;;) {
    a = -rng.int(1, 3);
    b = rng.int(1, 6);
    c = -rng.int(1, 9);
    x0 = rng.int(1, 4);
    if (a * x0 * x0 + b * x0 + c > 0) break; // a profit, not a loss
  }
  const years = rng.int(2, 9);
  const [maker, thing] = rng.pick([
    ['workshop', 'bracelets'],
    ['bakery', 'loaves'],
    ['print shop', 'posters'],
  ]);
  const body = buildQuadratic(a, b, c, x0);
  // Left out the fixed cost: the profit comes out too high by |c|.
  const noFixed: MisconceptionInstance = { id: 'fixed-cost-dropped', wrong: numberAnswer(a * x0 * x0 + b * x0) };
  body.misconceptions = distinctMisconceptions(body.answer, [noFixed, ...body.misconceptions]);
  const cost = quadLatex(-a, 0, -c);
  const profit = quadLatex(a, b, c);
  const expr = `${a}*x^2 + ${b}*x + ${c}`;
  return {
    ...body,
    prompt: `A ${maker} has been open for ${years} years. If it makes and sells $x$ hundred ${thing} a month, the sales bring in $${b === 1 ? '' : b}x$ thousand dollars and the cost of producing them is $${cost}$ thousand dollars, including a fixed amount that is paid whatever is made. Let $f(x)$ be the monthly profit in thousands of dollars. Find $f(${x0})$, the profit on ${x0} hundred ${thing}.`,
    steps: [
      setupStep(
        'Write the profit $f(x)$, in thousands of dollars, as an expression in $x$.',
        expr,
        `f(x) = ${profit}`,
        `Profit is revenue minus cost, so subtract the whole cost expression, fixed amount included. The ${years} years open doesn't enter the formula.`,
      ),
      ...body.steps,
    ],
  };
}

function storySchedule(rng: Rng): Generated {
  // Usage charge: p x + q below the cut-off k, a x^2 + b from k on (a surcharge that grows with use).
  let p = 0;
  let qq = 0;
  let a = 0;
  let b = 0;
  let k = 0;
  let x0 = 0;
  for (;;) {
    p = rng.int(1, 4);
    qq = rng.int(1, 9);
    a = rng.int(1, 3);
    b = rng.int(0, 9);
    k = rng.int(1, 3);
    x0 = k + rng.int(-2, 2);
    // A surcharge never lowers the bill: at the cut-off the upper rule costs at least the lower one.
    if (x0 >= 1 && a * k * k + b >= p * k + qq) break;
  }
  const day = rng.int(3, 28);
  const right = x0 >= k;
  const body = buildPiecewise(a, b, p, qq, k, x0);
  const rightL = b === 0 ? `${coefLatex(q(a))}x^{2}` : `${coefLatex(q(a))}x^{2} + ${b}`;
  const rightExpr = `${a}*x^2 + ${b}`;
  const leftExpr = `${p}*x + ${qq}`;
  return {
    ...body,
    prompt: `A city bills water by the unit of use, $x$. Below ${k} unit${k === 1 ? '' : 's'}, the bill is $${linLatex(p, qq)}$ dollars. From ${k} unit${k === 1 ? '' : 's'} up, a conservation surcharge applies and the bill is $${rightL}$ dollars. Your meter was read on day ${day} of the month and showed ${x0} unit${x0 === 1 ? '' : 's'}. Let $f(x)$ be the bill in dollars. Find $f(${x0})$.`,
    steps: [
      setupStep(
        `Which billing rule applies at ${x0} unit${x0 === 1 ? '' : 's'}? Write it as an expression in $x$.`,
        right ? rightExpr : leftExpr,
        right ? `f(x) = ${rightL}` : `f(x) = ${linLatex(p, qq)}`,
        `${x0} is ${right ? 'at or above' : 'below'} the cut-off of ${k}, so the ${right ? 'surcharge' : 'lower'} rule applies. Compare the use with the cut-off first, then write only that rule. The reading date (day ${day}) doesn't matter.`,
      ),
      ...body.steps,
    ],
  };
}

// ---------- level 3: domain of a square root or a reciprocal ----------

type Cond = 'ge' | 'gt' | 'ne';

/** Four options for "what does x have to satisfy": correct first, then distractors. */
function condOptions(kind: Cond, v: number): string[] {
  switch (kind) {
    case 'ge':
      return [m(`x \\ge ${v}`), m(`x > ${v}`), m(`x \\le ${v}`), m(`x \\ne ${v}`)];
    case 'gt':
      return [m(`x > ${v}`), m(`x \\ge ${v}`), m(`x < ${v}`), m(`x \\ne ${v}`)];
    case 'ne':
      return [m(`x \\ne ${v}`), m(`x > ${v}`), m(`x < ${v}`), m(`x = ${v}`)];
  }
}

const SQRT_RULES = ['It must be at least 0 (zero is allowed)', 'It must be strictly greater than 0', 'It must not equal 0', 'It can be any number'];
const DENOM_RULES = ['It must not equal 0', 'It must be positive', 'It must be at least 0', 'It can be any number'];

function domainBasic(rng: Rng): Generated {
  const form = rng.int(0, 2); // 0: sqrt(x-a)  1: sqrt(a-x)  2: 1/(x-a)
  const a = rng.nonzero(-12, 12);
  const all = m('\\text{all real numbers}');
  let fLatex = '';
  let labels: string[] = [];
  let solveMath = '';
  let solveWhy = '';

  if (form === 0) {
    fLatex = `\\sqrt{${linLatex(1, -a)}}`;
    labels = [m(`x \\ge ${a}`), m(`x > ${a}`), m(`x \\le ${a}`), all];
    solveMath = `${linLatex(1, -a)} \\ge 0 \\;\\Rightarrow\\; x \\ge ${a}`;
    solveWhy = 'Add the constant to both sides. Adding or subtracting does not flip the inequality.';
  } else if (form === 1) {
    fLatex = `\\sqrt{${a} - x}`;
    labels = [m(`x \\le ${a}`), m(`x < ${a}`), m(`x \\ge ${a}`), all];
    solveMath = `${a} - x \\ge 0 \\;\\Rightarrow\\; x \\le ${a}`;
    solveWhy = 'Moving $x$ to the other side (or dividing by $-1$) flips the inequality: $a - x \\ge 0$ means $x \\le a$.';
  } else {
    fLatex = `\\dfrac{1}{${linLatex(1, -a)}}`;
    labels = [m(`x \\ne ${a}`), m(`x \\ne ${-a}`), m(`x > ${a}`), all];
    solveMath = `${linLatex(1, -a)} \\ne 0 \\;\\Rightarrow\\; x \\ne ${a}`;
    solveWhy = 'Solve "denominator = 0" and exclude that value.';
  }

  const inner = form === 1 ? `${a} - x` : linLatex(1, -a);
  const rules = form === 2 ? DENOM_RULES : SQRT_RULES;
  const ruleChoice = shuffled(rng, rules);
  const ruleStep: Step = {
    key: form === 2 ? 'denominator-condition' : 'sqrt-condition',
    instruction: form === 2 ? 'A fraction is undefined when its denominator is 0.' : 'A real square root needs a non-negative number inside.',
    math: form === 2 ? `${inner} \\ne 0` : `${inner} \\ge 0`,
    why: form === 2 ? 'Division by zero is undefined, so the denominator can never be 0.' : 'The square root of a negative number is not a real number; $\\sqrt{0} = 0$ is fine, so 0 is allowed.',
    ask: {
      prompt: form === 2 ? `What condition must the denominator $${inner}$ satisfy?` : `What condition must the expression $${inner}$ inside the root satisfy?`,
      answer: choiceAnswer(ruleChoice.options, ruleChoice.correct),
    },
  };

  const finalChoice = shuffled(rng, labels);
  const answer = choiceAnswer(finalChoice.options, finalChoice.correct);
  const steps: Step[] = [
    ruleStep,
    {
      key: 'solve-condition',
      instruction: 'Solve that condition for $x$ to get the domain.',
      math: solveMath,
      why: solveWhy,
      ask: { prompt: `What is the domain of $f(x) = ${fLatex}$?`, answer },
    },
  ];

  const candidates: (MisconceptionInstance | null)[] = [];
  if (form !== 2) {
    candidates.push(
      { id: 'strict-vs-inclusive', wrong: choiceAnswer(finalChoice.options, 'o1') },
      { id: 'domain-flipped', wrong: choiceAnswer(finalChoice.options, 'o2') },
    );
  }
  return {
    params: { form, a },
    prompt: `What is the domain of $$f(x) = ${fLatex}$$`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    verify: {
      type: 'choice',
      note: form === 0 ? 'domain of sqrt(x - a) is x >= a' : form === 1 ? 'domain of sqrt(a - x) is x <= a' : 'domain of 1/(x - a) is x != a',
    },
  };
}

// ---------- level 4: range of a(x - h)^2 + k ----------

function rangeParabola(rng: Rng): Generated {
  let a = 0;
  let h = 0;
  let k = 0;
  for (;;) {
    a = rng.nonzero(-3, 3);
    h = rng.nonzero(-5, 5);
    k = rng.int(-9, 9);
    if (h !== k) break;
  }
  const up = a > 0;
  const ineq = (up: boolean, v: number) => m(`y ${up ? '\\ge' : '\\le'} ${v}`);
  const labels = [ineq(up, k), ineq(!up, k), ineq(up, h), m('\\text{all real numbers}')];
  const choice = shuffled(rng, labels);
  const answer = choiceAnswer(choice.options, choice.correct);
  const kPart = k === 0 ? '' : ` ${k < 0 ? '-' : '+'} ${Math.abs(k)}`;
  const fLatex = `${coefLatex(q(a))}(${linLatex(1, -h)})^{2}${kPart}`;

  const steps: Step[] = [
    {
      key: 'direction',
      instruction: `Look at the sign of the coefficient $a = ${a}$ in front of the squared term.`,
      math: `a = ${a} ${up ? '> 0' : '< 0'} \\;\\Rightarrow\\; \\text{the parabola opens ${up ? 'up' : 'down'}}`,
      why: 'A positive coefficient opens upward (the vertex is the lowest point); a negative one opens downward (the vertex is the highest point).',
      ask: {
        prompt: 'Does this parabola open up or down?',
        answer: choiceAnswer(
          fixed([
            { id: 'up', label: 'Up' },
            { id: 'down', label: 'Down' },
          ]),
          up ? 'up' : 'down',
        ),
      },
    },
    {
      key: 'vertex',
      instruction: `The squared term is smallest (0) at $x = ${h}$, so the vertex is $(${h}, ${k})$.`,
      math: `f(${h}) = ${a}(0)^{2} ${k < 0 ? '-' : '+'} ${Math.abs(k)} = ${k}`,
      why: 'In $a(x-h)^2 + k$ the vertex is $(h, k)$. The $y$-value of the vertex is $k$, not $h$.',
      ask: {
        prompt: `What is the $y$-value of the vertex, $f(${h})$?`,
        answer: numberAnswer(k),
        verify: { type: 'evaluate', expr: `${a}*(${h} - ${par(h)})^2 + ${par(k)}` },
      },
    },
    {
      key: 'state-range',
      instruction: `Because it opens ${up ? 'up' : 'down'}, every $y$ is ${up ? 'at or above' : 'at or below'} the vertex height $${k}$.`,
      math: `\\text{range: } y ${up ? '\\ge' : '\\le'} ${k}`,
      why: `The vertex is the ${up ? 'minimum' : 'maximum'} value; the graph goes ${up ? 'up' : 'down'} forever from there.`,
      ask: { prompt: `What is the range of $f(x) = ${fLatex}$?`, answer },
    },
  ];

  const candidates: (MisconceptionInstance | null)[] = [
    { id: 'range-direction', wrong: choiceAnswer(choice.options, 'o1') },
    { id: 'range-used-h', wrong: choiceAnswer(choice.options, 'o2') },
  ];
  return {
    params: { a, h, k },
    prompt: `What is the range of $$f(x) = ${fLatex}$$`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    verify: { type: 'choice', note: 'range of a(x-h)^2+k: y >= k if a > 0, y <= k if a < 0' },
  };
}

// ---------- level 5: domain of a combination ----------

function condChoice(rng: Rng, kind: Cond, v: number) {
  const c = shuffled(rng, condOptions(kind, v));
  return choiceAnswer(c.options, c.correct);
}

function domainCombined(rng: Rng): Generated {
  const form = rng.int(0, 2); // 0: sqrt(x-a)/(x-b)  1: ln(x-a)  2: 1/sqrt(x-a)
  const a = rng.int(-9, 5);
  const b = form === 0 ? a + rng.int(1, 4) : 0;
  const all = m('\\text{all real numbers}');
  const inner = linLatex(1, -a);
  let fLatex = '';
  let labels: string[] = [];
  const steps: Step[] = [];

  if (form === 0) {
    fLatex = `\\dfrac{\\sqrt{${inner}}}{${linLatex(1, -b)}}`;
    labels = [m(`x \\ge ${a},\\ x \\ne ${b}`), m(`x > ${a},\\ x \\ne ${b}`), m(`x \\ge ${a}`), m(`x \\ne ${b}`)];
    steps.push(
      {
        key: 'sqrt-condition',
        instruction: `The square root needs $${inner} \\ge 0$.`,
        math: `${inner} \\ge 0 \\;\\Rightarrow\\; x \\ge ${a}`,
        why: 'Inside a square root must be at least 0.',
        ask: { prompt: `What does the square root require of $x$?`, answer: condChoice(rng, 'ge', a) },
      },
      {
        key: 'denominator-condition',
        instruction: `The denominator $${linLatex(1, -b)}$ can't be 0.`,
        math: `${linLatex(1, -b)} \\ne 0 \\;\\Rightarrow\\; x \\ne ${b}`,
        why: 'A denominator can never be 0. Since $b > a$, the excluded value lies inside the square-root region, so it must be removed separately.',
        ask: { prompt: 'What does the denominator require of $x$?', answer: condChoice(rng, 'ne', b) },
      },
    );
  } else if (form === 1) {
    fLatex = `\\ln(${inner})`;
    labels = [m(`x > ${a}`), m(`x \\ge ${a}`), m(`x \\ne ${a}`), all];
    steps.push({
      key: 'log-condition',
      instruction: `A log needs a strictly positive argument: $${inner} > 0$.`,
      math: `${inner} > 0 \\;\\Rightarrow\\; x > ${a}`,
      why: '$\\ln$ is defined only for positive numbers (not 0).',
      ask: { prompt: 'What does the log require of $x$?', answer: condChoice(rng, 'gt', a) },
    });
  } else {
    fLatex = `\\dfrac{1}{\\sqrt{${inner}}}`;
    labels = [m(`x > ${a}`), m(`x \\ge ${a}`), m(`x \\ne ${a}`), all];
    steps.push(
      {
        key: 'sqrt-condition',
        instruction: `The square root needs $${inner} \\ge 0$.`,
        math: `${inner} \\ge 0 \\;\\Rightarrow\\; x \\ge ${a}`,
        why: 'Inside a square root must be at least 0.',
        ask: { prompt: 'What does the square root require of $x$?', answer: condChoice(rng, 'ge', a) },
      },
      {
        key: 'denominator-condition',
        instruction: `The denominator $\\sqrt{${inner}}$ can't be 0, so $${inner} \\ne 0$.`,
        math: `\\sqrt{${inner}} \\ne 0 \\;\\Rightarrow\\; x \\ne ${a}`,
        why: 'A denominator can never be 0, and $\\sqrt{u} = 0$ only when $u = 0$.',
        ask: { prompt: 'What does the denominator require of $x$?', answer: condChoice(rng, 'ne', a) },
      },
    );
  }

  const finalChoice = shuffled(rng, labels);
  const answer = choiceAnswer(finalChoice.options, finalChoice.correct);
  steps.push({
    key: 'combine-conditions',
    instruction: form === 0 ? 'Keep every $x$ that satisfies both conditions.' : form === 1 ? 'State the domain.' : 'Both conditions must hold: $x \\ge a$ and $x \\ne a$ leaves $x > a$.',
    math: form === 0 ? `x \\ge ${a} \\text{ and } x \\ne ${b}` : `x > ${a}`,
    why: 'The domain is where all conditions hold at once. Inequalities and exclusions combine with "and".',
    ask: { prompt: `What is the domain of $f(x) = ${fLatex}$?`, answer },
  });

  const candidates: (MisconceptionInstance | null)[] = [{ id: 'strict-vs-inclusive', wrong: choiceAnswer(finalChoice.options, 'o1') }];
  return {
    params: { form, a, b },
    prompt: `What is the domain of $$f(x) = ${fLatex}$$`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    verify: {
      type: 'choice',
      note: form === 0 ? 'domain of sqrt(x-a)/(x-b): x >= a and x != b' : form === 1 ? 'domain of ln(x-a): x > a' : 'domain of 1/sqrt(x-a): x > a',
    },
  };
}

// ---------- the skill ----------

export const functionsBasics: SkillDefinition = {
  id: ID,
  title: 'Functions: domain & range',
  track: 'math',
  unit: 'Functions',
  description: 'Evaluate functions (including piecewise), and find the domain and range of common functions.',
  prerequisites: ['linear-equations'],
  maxDenominator: 1,
  levels: {
    1: { description: 'Evaluate ax² + bx + c at an integer', ranges: { a: [-3, 3], b: [-6, 6], c: [-9, 9], x0: [-4, 4] } },
    2: {
      description: 'Evaluate with care: -x² at negatives, piecewise',
      ranges: { form: [0, 1], a: [1, 3], b: [-9, 9], p: [-4, 4], q: [-9, 9], k: [-3, 3], x0: [-5, 5] },
    },
    3: { description: 'Domain of √(x - a), √(a - x), 1/(x - a)', ranges: { form: [0, 2], a: [-12, 12] } },
    4: { description: 'Range of a(x - h)² + k', ranges: { a: [-3, 3], h: [-5, 5], k: [-9, 9] } },
    5: { description: 'Domain of a combination', ranges: { form: [0, 2], a: [-9, 5], b: [-8, 9] } },
  },
  misconceptions: {
    'negative-squared': {
      name: 'Lost the sign rule for squaring a negative input',
      explanation:
        'Substitute negative inputs in parentheses and square the whole thing: $(-2)^2 = 4$. But $-x^2$ means "square, then negate": at $x = -2$ it is $-(4) = -4$, not $+4$. Mixing these up flips the sign of the squared term.',
    },
    'wrong-piece': {
      name: 'Used the wrong piece of the function',
      explanation:
        'Check the condition first. If $x < k$ use the first rule; if $x \\ge k$ use the second. At $x = k$ exactly, the rule with $\\ge$ (or $\\le$) applies.',
    },
    'strict-vs-inclusive': {
      name: 'Mixed up > and ≥',
      explanation:
        'A square root allows 0 ($\\sqrt{0} = 0$), so the inside only has to be $\\ge 0$. A log (or a root in a denominator) cannot take 0, so there the inside must be strictly $> 0$.',
    },
    'domain-flipped': {
      name: 'Flipped the inequality',
      explanation:
        'Check with a test value. For $\\sqrt{x - 3}$, $x = 0$ gives $\\sqrt{-3}$, which is not real, so small $x$ is excluded: $x \\ge 3$. For $\\sqrt{3 - x}$ it is the other way: $x \\le 3$.',
    },
    'fixed-cost-dropped': {
      name: 'Left out the fixed cost',
      explanation:
        'Profit is revenue minus *all* of the cost, including the part paid whatever is made (rent, a permit). Subtract it once, at every output level.',
    },
    'price-not-revenue': {
      name: 'Gave the price instead of the revenue',
      explanation:
        'Revenue is price times quantity. If 3 hundred cups sell at \\$4 each, revenue is $3 \\cdot 4 = 12$ hundred dollars, not 4.',
    },
    'wall-side-fenced': {
      name: 'Fenced the side along the wall too',
      explanation:
        'Against a wall only three sides need fence: two of length $x$ and one long side. With 6 m of fence the long side is $6 - 2x$, so the area is $x(6 - 2x)$.',
    },
    'clock-not-duration': {
      name: 'Used a clock time instead of the time parked',
      explanation:
        'The charge depends on how long you stayed: from 9:00 to 12:00 is $12 - 9 = 3$ hours. Work out the duration first, then put that into the rule.',
    },
    'time-direction': {
      name: 'Read "before" as a positive input',
      explanation:
        'When $x$ counts quarters *after* an event, quarters before it are negative: 3 quarters before is $x = -3$. Then square with parentheses: $(-3)^2 = 9$.',
    },
    'range-direction': {
      name: 'Flipped the range for the parabola',
      explanation:
        'The sign of $a$ decides the direction. $a > 0$: opens up, so the vertex is the minimum and $y \\ge k$. $a < 0$: opens down, so the vertex is the maximum and $y \\le k$.',
    },
    'range-used-h': {
      name: 'Used h instead of k for the range',
      explanation:
        'In $a(x - h)^2 + k$, $h$ only shifts the graph left or right, while $k$ is the height of the vertex. The range is about heights ($y$-values), so it uses $k$.',
    },
  },
  stepLabels: {
    substitute: 'Substitute the input',
    'order-of-operations': 'Powers before the minus sign',
    'pick-piece': 'Pick the right piece',
    'sqrt-condition': 'Inside a square root must be ≥ 0',
    'denominator-condition': "A denominator can't be 0",
    'log-condition': 'Inside a log must be > 0',
    vertex: 'Find the vertex value',
    direction: 'Opens up or down?',
    'combine-conditions': 'Combine the conditions',
    setup: 'Set up: write the situation as an expression',
    'setup-words': 'Set up: profit from words',
    'setup-revenue': 'Set up: revenue is price times quantity',
    'setup-area': 'Set up: an area from a fence',
    'setup-boundary': 'Set up: which rate at the cut-off',
    'setup-duration': 'Set up: the input is a duration',
    'setup-time': 'Set up: "before" is a negative input',
    'solve-condition': 'Solve the condition for x',
    'state-range': 'State the range',
  },
  learn: {
    whyItMatters:
      'A function is a rule: each input gives exactly one output. Demand $Q(P)$, cost $C(q)$ and utility $U(x, y)$ are all functions, and domain restrictions are economic facts. If demand is $Q(P) = \\sqrt{100 - P}$, prices above \\$100 would give a square root of a negative number, so the domain is $0 \\le P \\le 100$, and the quantity at $P = 36$ is $\\sqrt{64} = 8$ units. A log needs positive inputs, which matters for log-wage regressions.',
    summary:
      'Evaluate a function by replacing $x$ with the input (use parentheses for negatives). The *domain* is every input that works: no negative inside a square root, no zero denominator, only positive inside a log. The *range* is every output; for a parabola it starts at the vertex height.',
    formulas: [
      { latex: '\\sqrt{u}: \\; u \\ge 0 \\qquad \\frac{1}{u}: \\; u \\ne 0 \\qquad \\ln u: \\; u > 0', note: '$u$ is whatever is inside.' },
      { latex: 'a(x - h)^2 + k:\\; y \\ge k \\text{ if } a > 0,\\; y \\le k \\text{ if } a < 0', note: 'Vertex $(h, k)$.' },
    ],
    example: { seed: 5, level: 3 },
    tips: ['Test a value: if plugging it in breaks the function, it is outside the domain.'],
  },

  generate(rng, level) {
    switch (level) {
      case 1:
        return evaluateQuadratic(rng);
      case 2:
        return evaluateCareful(rng);
      case 3:
        return domainBasic(rng);
      case 4:
        return rangeParabola(rng);
      case 5:
        return domainCombined(rng);
    }
  },

  story: {
    levels: [1, 2],
    generate(rng, level) {
      const pattern = rng.int(0, 3);
      return pattern === 0 ? (level === 1 ? storyProfit(rng) : storySchedule(rng)) : NEW_PATTERNS[level as 1 | 2][pattern - 1](rng);
    },
    original: (rng, level) => (level === 1 ? storyProfit(rng) : storySchedule(rng)),
  },
};


// ---------- Story patterns added in batch S2 (docs/skill-specs/batch-s2-stories.md) ----------
// The original stories hand over the formula; these make the learner build it from words (profit
// from prices and costs, revenue as price times quantity, an area from a fence), or work out the
// input first (a duration from two clock times, "3 quarters before" as a negative input).

/** Setup first, and the story's misreadings ahead of the algebra slips. */
function withSetup(body: Generated, setup: Step, readings: (MisconceptionInstance | null)[]): Generated {
  return {
    ...body,
    steps: [setup, ...body.steps],
    misconceptions: distinctMisconceptions(body.answer, [...readings, ...body.misconceptions]),
  };
}

/** L1: profit from words: price per unit, a cost that grows with the square, and rent. */
function profitInWords(rng: Rng): Generated {
  for (;;) {
    const a = -rng.int(1, 3);
    const b = rng.int(1, 6);
    const c = -rng.int(1, 9);
    const x0 = rng.int(1, 4);
    const value = a * x0 * x0 + b * x0 + c;
    if (value <= 0) continue;
    const [maker, thing] = rng.pick([
      ['A furniture workshop', 'stools'],
      ['A jam maker', 'jars'],
    ]);
    const body = buildQuadratic(a, b, c, x0);
    return {
      ...withSetup(
        body,
        setupStep(
          'Write the monthly profit $f(x)$, in thousands of dollars, as an expression in $x$.',
          `${a}*x^2 + ${b}*x + ${c}`,
          `f(x) = ${quadLatex(a, b, c)}`,
          `Revenue is $${b === 1 ? '' : b}x$. The cost is $${-a === 1 ? '' : -a}x^2$ plus the rent of ${-c}, and profit is revenue minus *all* of the cost: $${b === 1 ? '' : b}x - ${-a === 1 ? '' : -a}x^2 - ${-c}$.`,
          'setup-words',
        ),
        // Forgot the rent: the profit comes out too high by the fixed cost.
        [{ id: 'fixed-cost-dropped', wrong: numberAnswer(value - c) }],
      ),
      prompt: `${maker} sells $x$ hundred ${thing} a month. Each hundred brings in ${b} thousand dollars. Making them costs ${-a === 1 ? '' : `${-a} times `}the square of $x$, in thousands of dollars, because the workshop gets crowded, and on top of that the rent is ${-c} thousand dollars a month. Let $f(x)$ be the monthly profit in thousands of dollars. Find $f(${x0})$.`,
    };
  }
}

/** L1: revenue when the price falls as more is sold: x(b − |a|x). */
function fallingPrice(rng: Rng): Generated {
  for (;;) {
    const a = -rng.int(1, 3);
    const b = rng.int(3, 6);
    const x0 = rng.int(2, 4); // at x = 1 the revenue equals the price, which hides the misreading
    const price = b + a * x0;
    if (price < 1) continue;
    const body = buildQuadratic(a, b, 0, x0);
    const [seller, thing] = rng.pick([
      ['A coffee cart', 'cups'],
      ['A museum shop', 'posters'],
    ]);
    return {
      ...withSetup(
        body,
        setupStep(
          'Write the revenue $f(x)$, in hundreds of dollars, as an expression in $x$.',
          `x*(${b} - ${-a}*x)`,
          `f(x) = x(${b} - ${-a === 1 ? '' : -a}x)`,
          `Revenue is price times quantity. The price is $${b} - ${-a === 1 ? '' : -a}x$ dollars and the quantity is $x$ hundred, so the revenue is $x(${b} - ${-a === 1 ? '' : -a}x)$ hundred dollars.`,
          'setup-revenue',
        ),
        // Gave the price at x0, not the revenue.
        [{ id: 'price-not-revenue', wrong: numberAnswer(price) }],
      ),
      prompt: `${seller} finds that to sell $x$ hundred ${thing} a week it has to set the price at $${b}$ dollars minus $${-a}$ dollar${-a === 1 ? '' : 's'} for each hundred sold, that is, $${b} - ${-a === 1 ? '' : -a}x$ dollars each. Let $f(x)$ be the weekly revenue in hundreds of dollars. Find $f(${x0})$.`,
    };
  }
}

/** L1: a pen against a wall: two sides of x and one side of L − 2x; area x(L − 2x). */
function penArea(rng: Rng): Generated {
  for (;;) {
    const L = rng.int(3, 6);
    const x0 = rng.int(1, 2);
    if (L - 2 * x0 < 1) continue;
    const body = buildQuadratic(-2, L, 0, x0);
    const [animal, wall] = rng.pick([
      ['rabbits', 'the back wall of a shed'],
      ['chickens', 'a garden wall'],
    ]);
    return {
      ...withSetup(
        body,
        setupStep(
          'Write the area $f(x)$, in square metres, as an expression in $x$.',
          `x*(${L} - 2*x)`,
          `f(x) = x(${L} - 2x)`,
          `The wall makes the fourth side, so the fencing covers two sides of $x$ and one long side. The long side is what is left: $${L} - 2x$. Area is width times length.`,
          'setup-area',
        ),
        // Fenced all four sides: the long side would be (L − 2x)/2.
        [{ id: 'wall-side-fenced', wrong: numberAnswer(q(x0 * (L - 2 * x0), 2)) }],
      ),
      prompt: `A rectangular pen for ${animal} is built against ${wall}, so only three sides need fencing. There are ${L} m of fence. The two sides that meet the wall are each $x$ m long. Let $f(x)$ be the area of the pen in square metres. Find $f(${x0})$.`,
    };
  }
}

/** L2: a courier's two rates, given in words; parcels at the cut-off are common. */
function courier(rng: Rng): Generated {
  for (;;) {
    const p = rng.int(1, 4);
    const qq = rng.int(1, 9);
    const a = rng.int(1, 3);
    const b = rng.int(0, 9);
    const k = rng.int(1, 3);
    const x0 = rng.chance(0.5) ? k : k + rng.int(-1, 2);
    if (x0 < 1 || a * k * k + b < p * k + qq) continue;
    const right = x0 >= k;
    const body = buildPiecewise(a, b, p, qq, k, x0);
    const rightL = b === 0 ? `${coefLatex(q(a))}x^{2}` : `${coefLatex(q(a))}x^{2} + ${b}`;
    return {
      ...withSetup(
        body,
        setupStep(
          `Which rate applies to a ${x0} kg parcel? Write it as an expression in $x$.`,
          right ? `${a}*x^2 + ${b}` : `${p}*x + ${qq}`,
          right ? `f(x) = ${rightL}` : `f(x) = ${linLatex(p, qq)}`,
          `"${k} kg or more" includes ${k} kg itself. ${x0} kg is ${right ? `at least ${k}` : `under ${k}`}, so the ${right ? 'bulky' : 'standard'} rate applies.`,
          'setup-boundary',
        ),
        [],
      ),
      prompt: `A courier prices parcels by weight, $x$ kg. Parcels under ${k} kg cost \\$${p} per kg plus a \\$${qq} handling fee. Parcels of ${k} kg or more count as bulky: they cost ${a === 1 ? '' : `${a} times `}the square of the weight${b === 0 ? '' : `, plus \\$${b}`}. Let $f(x)$ be the price in dollars. Your parcel weighs ${x0} kg. Find $f(${x0})$.`,
    };
  }
}

/** L2: a car park charged by the hours parked; the input is a duration between two clock times. */
function parking(rng: Rng): Generated {
  for (;;) {
    const p = rng.int(1, 4);
    const qq = rng.int(1, 9);
    const a = rng.int(1, 3);
    const b = rng.int(0, 9);
    const k = rng.int(1, 3);
    const x0 = k + rng.int(-2, 2);
    if (x0 < 1 || a * k * k + b < p * k + qq) continue;
    const arrive = rng.int(8, 12);
    const leave = arrive + x0;
    const right = x0 >= k;
    const body = buildPiecewise(a, b, p, qq, k, x0);
    const rightL = b === 0 ? `${coefLatex(q(a))}x^{2}` : `${coefLatex(q(a))}x^{2} + ${b}`;
    return {
      ...withSetup(
        body,
        setupStep(
          'First find the hours parked. Which rule applies to that stay? Write it as an expression in $x$.',
          right ? `${a}*x^2 + ${b}` : `${p}*x + ${qq}`,
          right ? `f(x) = ${rightL}` : `f(x) = ${linLatex(p, qq)}`,
          `From ${arrive}:00 to ${leave}:00 is ${leave} − ${arrive} = ${x0} hours. That is ${right ? `at least ${k}` : `under ${k}`}, so the ${right ? 'second' : 'first'} rule applies.`,
          'setup-duration',
        ),
        // Put the clock time in for x.
        [{ id: 'clock-not-duration', wrong: numberAnswer(leave >= k ? a * leave * leave + b : p * leave + qq) }],
      ),
      prompt: `A car park charges by the number of hours parked, $x$. Stays under ${k} hour${k === 1 ? '' : 's'} cost $${linLatex(p, qq)}$ dollars; stays of ${k} hour${k === 1 ? '' : 's'} or more cost $${rightL}$ dollars. You arrive at ${arrive}:00 and leave at ${leave}:00. Let $f(x)$ be the charge in dollars. What do you pay?`,
    };
  }
}

/** L2: an index around a launch date: x quarters after (negative = before). */
function beforeLaunch(rng: Rng): Generated {
  const a = rng.int(1, 3);
  const b = rng.nonzero(-6, 6);
  const x0 = rng.int(-5, -1);
  const body = buildNegQuad(a, b, x0);
  const [what, intro, event] = rng.pick([
    ['a sales index', 'the launch of a new phone', 'the launch'],
    ['an attendance index', 'the reopening of a stadium', 'the reopening'],
  ]);
  const bWords = b === 1 ? '$x$' : b > 0 ? `${b} times $x$` : `minus ${b === -1 ? '' : `${-b} times `}$x$`;
  const aWords = a === 1 ? 'the square of $x$' : `${a} times the square of $x$`;
  return {
    ...withSetup(
      body,
      setupStep(
        'Write the index $f(x)$ as an expression in $x$.',
        `-${a}*x^2 + ${b}*x`,
        `f(x) = ${quadLatex(-a, b, 0)}`,
        `Translate the words term by term: ${bWords.replace(/\$/g, '')}, then take away ${aWords.replace(/\$/g, '')}. Quarters *before* ${event} are negative inputs, so ${-x0} quarters before is $x = ${x0}$.`,
        'setup-time',
      ),
      // Used +|x0| for "before".
      [{ id: 'time-direction', wrong: numberAnswer(-a * x0 * x0 - b * x0) }],
    ),
    prompt: `An analyst models ${what} around ${intro}. With $x$ the number of quarters after ${event} (negative for quarters before it), the index $f(x)$ is ${bWords}, minus ${aWords}. What was the index ${-x0} quarter${x0 === -1 ? '' : 's'} before ${event}?`,
  };
}

const NEW_PATTERNS: Record<1 | 2, ((rng: Rng) => Generated)[]> = {
  1: [profitInWords, fallingPrice, penArea],
  2: [courier, parking, beforeLaunch],
};
