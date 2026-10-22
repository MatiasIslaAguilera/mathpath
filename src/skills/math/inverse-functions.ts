// Inverse functions: f^{-1}(k) for a line (L1), the inverse line (L2), inverse demand (L3),
// a cubic or a rational function (L4), and a quadratic on a restricted domain (L5).

import { choiceAnswer, numberAnswer, tupleAnswer, wrongNumber } from '../../engine/answers';
import { coefLatex, joinTerms, linLatex, parenIfNeg } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { InterpretationQuestion, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';

const ID = 'inverse-functions';

type Generated = ReturnType<SkillDefinition['generate']>;

/** A number inside a larger mathjs / SymPy expression. */
const lit = (x: Q | number) => Q.of(x).toExpr();

function options(rng: Rng, labels: string[]) {
  return rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
}

/** "Write f(x) = k": the correct option is always o0 before shuffling, and keeps its id. */
function setUpStep(rng: Rng, k: string): Step {
  const labels = [`$f(x) = ${k}$`, `$x = f(${k})$`, `$\\frac{1}{f(${k})}$`, `$f(${k}) = x$`];
  return {
    key: 'set-up',
    instruction: `$f^{-1}(${k})$ is the input $x$ that $f$ turns into ${k}. Write that as an equation and solve it for $x$.`,
    math: `f^{-1}(${k}) = x \\iff f(x) = ${k}`,
    why: 'The inverse undoes $f$: $f^{-1}(k)$ is the input whose output is $k$. So you solve $f(x) = k$ for $x$. It is not $1/f$.',
    ask: { prompt: `Which equation do you solve to find $f^{-1}(${k})$?`, answer: choiceAnswer(options(rng, labels), 'o0') },
  };
}

// ---------- Level 1: f^{-1}(k) for a line ----------

function linearPoint(rng: Rng): Generated {
  let m = 0;
  let b = 0;
  let x = 0;
  for (;;) {
    m = rng.nonzero(-6, 6);
    if (Math.abs(m) < 2) continue;
    b = rng.nonzero(-12, 12);
    x = rng.nonzero(-10, 10);
    break;
  }
  const k = m * x + b;
  const answer = numberAnswer(x);
  const eq = `${lit(m)}*x + ${lit(b)} = ${lit(k)}`;
  const verify = { type: 'solve' as const, equations: [eq], unknowns: ['x'] };
  const fk = linLatex(m, b);

  const steps: Step[] = [
    setUpStep(rng, `${k}`),
    {
      key: 'undo-add',
      instruction: `Undo the addition first: subtract ${b} from both sides of $${fk} = ${k}$.`,
      math: `${coefLatex(q(m))}x = ${k} - ${parenIfNeg(b)} = ${k - b}`,
      why: 'To undo $f$, reverse its steps in the opposite order. $f$ multiplies and then adds, so the inverse subtracts first and then divides.',
      ask: { prompt: `$${coefLatex(q(m))}x = \\;?$`, answer: numberAnswer(k - b), verify: { type: 'evaluate', expr: `${lit(k)} - ${lit(b)}` } },
    },
    {
      key: 'undo-mult',
      instruction: `Then undo the multiplication: divide both sides by ${m}.`,
      math: `x = \\frac{${k - b}}{${parenIfNeg(m)}} = ${x}`,
      why: 'Division undoes multiplication. Doing it second keeps the whole right side divided by $m$.',
      ask: { prompt: `$x = \\;?$`, answer, verify },
    },
    {
      key: 'answer',
      instruction: `So $f^{-1}(${k}) = ${x}$. Check: $f(${x}) = ${m * x + b}$.`,
      math: `f^{-1}(${k}) = ${x}`,
      why: 'You can always check an inverse by feeding the answer back into $f$: you should get $k$.',
      ask: { prompt: `$f^{-1}(${k}) = \\;?$`, answer, verify },
    },
  ];

  const candidates: (MisconceptionInstance | null)[] = [
    wrongNumber('reciprocal', () => q(1).div(q(m * k + b))),
    wrongNumber('evaluate-instead', () => q(m * k + b)),
    wrongNumber('undo-order', () => q(k, m).sub(b)),
  ];

  // Interpretation: drawn last so the problem itself is unchanged.
  let interpretation: InterpretationQuestion[] | undefined;
  if (rng.chance(0.5)) {
    const labels = [
      `Which input gives the output ${k}?`,
      `What is $f$ at ${k}?`,
      `What is $\\frac{1}{f(${k})}$?`,
      `What is $f(${-k})$?`,
    ];
    interpretation = [
      {
        prompt: `$f^{-1}(${k})$ answers which question?`,
        options: options(rng, labels),
        correct: 'o0',
        explanation: `The inverse runs $f$ backwards: it takes an output and returns the input that produced it. So $f^{-1}(${k})$ is the input $x$ with $f(x) = ${k}$. It is not $f$ evaluated at ${k}, and it is not a reciprocal.`,
      },
    ];
  }

  return {
    params: { m, b, k },
    prompt: `Let $f(x) = ${fk}$. Find $f^{-1}(${k})$.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    interpretation,
    verify,
  };
}

// ---------- Level 2: the inverse of a line, as a line ----------

function linearInverse(rng: Rng): Generated {
  let m = 0;
  let b = 0;
  for (;;) {
    m = rng.nonzero(-6, 6);
    if (Math.abs(m) < 2) continue;
    b = rng.nonzero(-12, 12);
    break;
  }
  const p = q(1, m);
  const qq = q(-b, m);
  const answer = tupleAnswer(['Slope p', 'Intercept q'], [p, qq], ['p', 'q']);
  const verify = {
    type: 'solve' as const,
    equations: [`${lit(m)}*(p*1 + q) + ${lit(b)} = 1`, `${lit(m)}*(p*2 + q) + ${lit(b)} = 2`],
    unknowns: ['p', 'q'],
  };
  const fy = linLatex(m, b, 'y');
  const fx = linLatex(m, b, 'x');
  const swapLabels = [`$x = ${fy}$`, `$y = ${fx}$`, `$y = \\frac{1}{${fx}}$`, `$x = \\frac{1}{${fy}}$`];

  const steps: Step[] = [
    {
      key: 'swap',
      instruction: 'Write $y = f(x)$, then swap the roles of input and output: put $x$ where the output was and $y$ where the input was.',
      math: `y = ${fx} \\;\\Rightarrow\\; x = ${fy}`,
      why: 'The inverse takes the old output as its input. Swapping $x$ and $y$ and solving for $y$ builds it.',
      ask: { prompt: 'After swapping $x$ and $y$, which equation do you solve for $y$?', answer: choiceAnswer(options(rng, swapLabels), 'o0') },
    },
    {
      key: 'undo-add',
      instruction: `Undo the addition first: subtract ${b} from both sides.`,
      math: `${coefLatex(q(m))}y = x ${b < 0 ? '+' : '-'} ${Math.abs(b)}`,
      why: 'Reverse the order of operations: undo the addition, then the multiplication.',
      ask: {
        prompt: `$${coefLatex(q(m))}y = x + c$. What is $c$?`,
        answer: numberAnswer(-b),
        verify: { type: 'evaluate', expr: `-${lit(b)}` },
      },
    },
    {
      key: 'undo-mult',
      instruction: `Then divide everything on the right by ${m}, including the constant.`,
      math: `y = \\frac{1}{${parenIfNeg(m)}}x ${qq.sign() < 0 ? '-' : '+'} ${qq.abs().toLatex()}`,
      why: 'Dividing both sides by $m$ divides every term on the other side, so the intercept becomes $-b/m$, not $-b$.',
      ask: { prompt: 'What is the slope $p$ of the inverse?', answer: numberAnswer(p), verify: { type: 'evaluate', expr: `1/${lit(m)}` } },
    },
    {
      key: 'answer',
      instruction: `So $f^{-1}(x) = ${linLatex(p, qq)}$.`,
      math: `f^{-1}(x) = ${linLatex(p, qq)}`,
      why: 'Check with one point: $f(f^{-1}(x))$ must equal $x$.',
      ask: { prompt: '$f^{-1}(x) = px + q$. Give $p$ and $q$.', answer, verify },
    },
  ];

  const candidates: (MisconceptionInstance | null)[] = [
    { id: 'undo-order', wrong: tupleAnswer(['Slope p', 'Intercept q'], [p, -b], ['p', 'q']) },
    { id: 'negative-reciprocal-slope', wrong: tupleAnswer(['Slope p', 'Intercept q'], [p.neg(), q(b, m)], ['p', 'q']) },
  ];

  return {
    params: { m, b },
    prompt: `Let $f(x) = ${fx}$. Its inverse is also a line, $f^{-1}(x) = px + q$. Find $p$ and $q$.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    verify,
  };
}

// ---------- Level 3: inverse demand ----------

const money = (x: Q) => `\\$${x.isInt() ? x.n : x.toLatex()}`;

function inverseDemand(rng: Rng): Generated {
  let a = 0;
  let b = 0;
  for (;;) {
    b = rng.int(1, 9);
    a = rng.chance(0.5) ? b * rng.int(Math.ceil(20 / b), Math.floor(200 / b)) : rng.int(20, 200);
    if (a < 20 || a > 200) continue;
    if (q(a, b).d > 9 || q(1, b).d > 9) continue;
    break;
  }
  const c = q(a, b);
  const s = q(-1, b);
  const labels = ['Intercept', 'Slope'];
  const answer = tupleAnswer(labels, [c, s], ['c', 's']);
  const verify = {
    type: 'solve' as const,
    equations: [`${a} - ${b}*(c + s*1) = 1`, `${a} - ${b}*(c + s*2) = 2`],
    unknowns: ['c', 's'],
  };
  const demand = `${a} - ${b === 1 ? '' : b}P`;
  const bP = `${b === 1 ? '' : b}P`;
  const slopeTerm = b === 1 ? 'Q' : `${q(1, b).toLatex()}Q`;

  const swapLabels = [
    `Solve $Q = ${demand}$ for $P$`,
    `Solve $Q = ${demand}$ for $Q$`,
    `Take the reciprocal: $P = \\frac{1}{${demand}}$`,
    `Replace $Q$ by $-Q$`,
  ];

  const steps: Step[] = [
    {
      key: 'swap',
      instruction: 'The demand curve gives quantity as a function of price. Inverse demand swaps the roles: price becomes the output.',
      math: `Q = ${demand} \\;\\to\\; P = c + sQ`,
      why: 'Inverse demand answers "what price sells this quantity?" To get it, solve the demand equation for $P$.',
      ask: { prompt: 'How do you get the inverse demand from $Q = ' + demand + '$?', answer: choiceAnswer(options(rng, swapLabels), 'o0') },
    },
    {
      key: 'undo-mult',
      instruction: `Isolate the $P$ term: $${bP} = ${a} - Q$.${b === 1 ? '' : ` Then divide both sides by ${b}, including the $Q$ term.`}`,
      math: `${bP} = ${a} - Q \\;\\Rightarrow\\; P = ${c.toLatex()} - ${slopeTerm}`,
      why: 'Divide the whole right side by the coefficient of $P$: both the constant and the $Q$ term. The slope is negative because a higher quantity needs a lower price.',
      ask: { prompt: 'What is the intercept $c$ (the price when $Q = 0$)?', answer: numberAnswer(c), verify: { type: 'evaluate', expr: `${a}/${b}` } },
    },
    {
      key: 'answer',
      instruction: `So $P = ${c.toLatex()} - ${slopeTerm}$.`,
      math: `P = ${c.toLatex()} - ${slopeTerm}`,
      why: 'Check: plug a price into the demand equation to get a quantity, then plug that quantity into the inverse. You should get the price back.',
      ask: { prompt: '$P = c + sQ$. Give $c$ and $s$.', answer, verify },
    },
  ];

  const candidates: (MisconceptionInstance | null)[] = [
    { id: 'undo-order', wrong: tupleAnswer(labels, [a, s], ['c', 's']) },
    { id: 'negative-reciprocal-slope', wrong: tupleAnswer(labels, [c.neg(), q(1, b)], ['c', 's']) },
  ];

  // Interpretation, drawn last. The choke-price question always comes first.
  const choke: InterpretationQuestion = (() => {
    const lbl = [
      'The choke price: the price at which quantity demanded falls to zero',
      'The quantity demanded when the price is zero',
      'The equilibrium price of the market',
      'The price that maximizes revenue',
    ];
    const opts = options(rng, lbl);
    return {
      prompt: `For the inverse demand $P = ${c.toLatex()} - ${slopeTerm}$, what does the intercept ${money(c)} mean?`,
      options: opts,
      correct: opts.find((o) => o.label === lbl[0])!.id,
      explanation: `Setting $Q = 0$ gives $P = ${c.toLatex()}$. At that price nobody wants to buy, so it is the highest price anyone will pay (the choke price). The quantity demanded at a price of zero is the other intercept, $Q = ${a}$.`,
    };
  })();
  const iqs: InterpretationQuestion[] = [choke];
  if (rng.chance(0.5)) {
    const inv = q(1, b);
    const cands: Q[] = [inv.neg(), inv, q(-b), q(b), inv.neg().mul(2), q(-b - 1), q(2), q(-3)];
    const labelOf = (v: Q) => `${v.sign() < 0 ? 'Falls' : 'Rises'} by $${v.abs().toLatex()}$`;
    const lbls: string[] = [];
    for (const v of cands) {
      const l = labelOf(v);
      if (!lbls.includes(l)) lbls.push(l);
      if (lbls.length === 4) break;
    }
    const opts = options(rng, lbls);
    iqs.push({
      prompt: 'If the quantity sold rises by 1 unit, the price consumers will pay changes by how much?',
      options: opts,
      correct: opts.find((o) => o.label === lbls[0])!.id,
      explanation: `The slope of the inverse demand is $-\\frac{1}{${b}}$ (that is $-${inv.toLatex()}$): each extra unit sells only if the price falls by $${inv.toLatex()}$. It is the reciprocal of the slope of the demand curve, $-${b}$.`,
    });
  }

  return {
    params: { a, b },
    prompt: `The demand for a good is $Q = ${demand}$, where $P$ is the price and $Q$ the quantity demanded. Write the inverse demand as $P = c + sQ$ and give $c$ and $s$.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    interpretation: iqs,
    verify,
  };
}

// ---------- Level 4: a cubic or a rational function ----------

/** Mathjs / SymPy expression for the real cube root of the integer r. */
function cubeRootExpr(r: number): string {
  return r >= 0 ? `(${r})^(1/3)` : `-(abs(${r}))^(1/3)`;
}

function nonlinear(rng: Rng): Generated {
  const form = rng.int(0, 1); // 0: a x^3 + b   1: (a x + b)/(c x + d)
  if (form === 0) {
    const a = rng.nonzero(-3, 3);
    const b = rng.nonzero(-10, 10);
    const s = rng.nonzero(-4, 4);
    const k = a * s ** 3 + b;
    const S3 = s ** 3;
    const answer = numberAnswer(s);
    const eq = `${lit(a)}*x^3 + ${lit(b)} = ${lit(k)}`;
    // SymPy returns three (complex) cube roots for a plain symbol; a positive symbol picks the real one.
    const verify =
      s > 0
        ? { type: 'solve' as const, equations: [eq], unknowns: ['x'], positive: true }
        : { type: 'evaluate' as const, expr: cubeRootExpr(S3) };
    const fx = `${coefLatex(q(a))}x^{3} ${b < 0 ? '-' : '+'} ${Math.abs(b)}`;
    const rootVerify = { type: 'evaluate' as const, expr: cubeRootExpr(S3) };
    const steps: Step[] = [
      setUpStep(rng, `${k}`),
      {
        key: 'undo-add',
        instruction: `Undo the addition: subtract ${b} from both sides.`,
        math: `${coefLatex(q(a))}x^{3} = ${k} - ${parenIfNeg(b)} = ${k - b}`,
        why: 'Peel off the operations from the outside in: first the constant, then the multiplier, then the cube.',
        ask: { prompt: `$${coefLatex(q(a))}x^{3} = \\;?$`, answer: numberAnswer(k - b), verify: { type: 'evaluate', expr: `${lit(k)} - ${lit(b)}` } },
      },
      {
        key: 'undo-mult',
        instruction: `Undo the multiplication: divide both sides by ${a}.`,
        math: `x^{3} = \\frac{${k - b}}{${parenIfNeg(a)}} = ${S3}`,
        why: 'Divide the whole side by the coefficient of $x^3$.',
        ask: { prompt: '$x^{3} = \\;?$', answer: numberAnswer(S3), verify: { type: 'evaluate', expr: `(${lit(k)} - ${lit(b)})/${lit(a)}` } },
      },
      {
        key: 'root',
        instruction: `Take the cube root. A cube root has one real value, and it keeps the sign: $\\sqrt[3]{${S3}} = ${s}$.`,
        math: `x = \\sqrt[3]{${S3}} = ${s}`,
        why: 'The cube undoes with a cube root. Unlike a square root there is only one real answer, and negatives are allowed.',
        ask: { prompt: `$\\sqrt[3]{${S3}} = \\;?$`, answer, verify: rootVerify },
      },
      {
        key: 'answer',
        instruction: `So $f^{-1}(${k}) = ${s}$.`,
        math: `f^{-1}(${k}) = ${s}`,
        why: 'Check by feeding the answer back into $f$.',
        ask: { prompt: `$f^{-1}(${k}) = \\;?$`, answer, verify },
      },
    ];
    const candidates: (MisconceptionInstance | null)[] = [
      wrongNumber('reciprocal', () => q(1).div(q(a * k ** 3 + b))),
      wrongNumber('evaluate-instead', () => q(a * k ** 3 + b)),
    ];
    return {
      params: { form, a, b, c: 0, d: 0, k },
      prompt: `Let $f(x) = ${fx}$. Find $f^{-1}(${k})$.`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, candidates),
      verify,
    };
  }

  // rational: x = (d k - b) / (a - c k)
  let a = 0;
  let b = 0;
  let c = 0;
  let d = 0;
  let k = 0;
  let x = q(0);
  for (;;) {
    a = rng.nonzero(-5, 5);
    b = rng.nonzero(-5, 5);
    c = rng.nonzero(-5, 5);
    d = rng.int(-5, 5);
    k = rng.nonzero(-5, 5); // b = 0 or k = 0 collapses the steps to 0 = 0
    if (a * d - b * c === 0) continue;
    const den = a - c * k;
    if (den === 0) continue;
    x = q(d * k - b, den);
    if (x.isZero()) continue;
    if (x.d > 9 || Math.abs(x.n) > 40) continue;
    break;
  }
  const answer = numberAnswer(x);
  const verify = {
    type: 'solve' as const,
    equations: [`(${lit(a)}*x + ${lit(b)})/(${lit(c)}*x + ${lit(d)}) = ${lit(k)}`],
    unknowns: ['x'],
  };
  const num = linLatex(a, b);
  const den = linLatex(c, d);
  const coefX = a - c * k;
  const rhs = d * k - b;
  const steps: Step[] = [
    setUpStep(rng, `${k}`),
    {
      key: 'cross-multiply',
      instruction: `Clear the fraction: multiply both sides by $${den}$, then collect the $x$ terms on one side.`,
      math: `${k}(${den}) = ${num} \\;\\Rightarrow\\; (${a} - ${parenIfNeg(c * k)})x = ${parenIfNeg(d * k)} - ${parenIfNeg(b)}`,
      why: 'Multiply by the denominator, then gather everything with $x$ on one side so you can factor $x$ out.',
      ask: {
        prompt: 'After collecting, the equation is $(\\text{number})\\,x = \\text{number}$. What is the coefficient of $x$?',
        answer: numberAnswer(coefX),
        verify: { type: 'evaluate', expr: `${lit(a)} - ${lit(c)}*${lit(k)}` },
      },
    },
    {
      key: 'undo-add',
      instruction: 'The numbers on the other side combine into one constant.',
      math: `${coefLatex(q(coefX))}x = ${d * k} - ${parenIfNeg(b)} = ${rhs}`,
      why: 'After collecting, the right side is $dk - b$.',
      ask: {
        prompt: `$${coefLatex(q(coefX))}x = \\;?$`,
        answer: numberAnswer(rhs),
        verify: { type: 'evaluate', expr: `${lit(d)}*${lit(k)} - ${lit(b)}` },
      },
    },
    {
      key: 'answer',
      instruction: `Divide by ${coefX}: $x = \\frac{${rhs}}{${parenIfNeg(coefX)}} = ${x.toLatex()}$.`,
      math: `f^{-1}(${k}) = ${x.toLatex()}`,
      why: 'The coefficient was built from the denominator of $f$, so it is never zero when $f(x) = k$ has a solution.',
      ask: { prompt: `$f^{-1}(${k}) = \\;?$`, answer, verify },
    },
  ];
  const candidates: (MisconceptionInstance | null)[] = [
    wrongNumber('reciprocal', () => q(1).div(q(a * k + b, c * k + d))),
    wrongNumber('evaluate-instead', () => q(a * k + b, c * k + d)),
  ];
  return {
    params: { form, a, b, c, d, k },
    prompt: `Let $f(x) = \\dfrac{${num}}{${den}}$. Find $f^{-1}(${k})$.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    verify,
  };
}

// ---------- Level 5: restricted domain ----------

function restricted(rng: Rng): Generated {
  const h = rng.int(0, 6);
  const k = rng.int(-8, 8);
  const s = rng.int(1, 8);
  const K = k + s * s;
  const x = h + s;
  const answer = numberAnswer(x);
  const verify = { type: 'evaluate' as const, expr: `${h} + sqrt(${lit(K)} - ${lit(k)})` };
  const sq = h === 0 ? 'x^{2}' : `(x - ${h})^{2}`;
  const fx = joinTerms([sq, ...(k === 0 ? [] : [`${k}`])]);
  const xh = h === 0 ? 'x' : `x - ${h}`;

  const steps: Step[] = [
    setUpStep(rng, `${K}`),
    {
      key: 'undo-add',
      instruction: `Undo the constant: subtract ${k} from both sides of $${fx} = ${K}$.`,
      math: `${sq} = ${K} - ${parenIfNeg(k)} = ${K - k}`,
      why: 'Isolate the squared part first.',
      ask: { prompt: `$${sq} = \\;?$`, answer: numberAnswer(K - k), verify: { type: 'evaluate', expr: `${lit(K)} - ${lit(k)}` } },
    },
    {
      key: 'root',
      instruction: `Take the square root. There are two, $\\pm ${s}$, but the domain is $x \\ge ${h}$, so $${xh}$ must be the non-negative one.`,
      math: `${xh} = \\sqrt{${K - k}} = ${s}`,
      why: 'The domain restriction is what makes $f$ invertible: it picks one branch of the square root. Always keep the branch that lies in the domain.',
      ask: { prompt: `$${xh} = \\;?$ (the branch with $x \\ge ${h}$)`, answer: numberAnswer(s), verify: { type: 'evaluate', expr: `sqrt(${lit(K - k)})` } },
    },
    {
      key: 'answer',
      instruction: h === 0 ? `So $x = ${s}$.` : `Add ${h} back: $x = ${h} + ${s} = ${x}$.`,
      math: `f^{-1}(${K}) = ${x}`,
      why: 'Check: $x = ' + x + ' \\ge ' + h + '$ is in the domain, and $f(' + x + ') = ' + K + '$.',
      ask: { prompt: `$f^{-1}(${K}) = \\;?$`, answer, verify },
    },
  ];

  const candidates: (MisconceptionInstance | null)[] = [
    wrongNumber('evaluate-instead', () => q((K - h) ** 2 + k)),
    wrongNumber('wrong-branch', () => q(h - s)),
  ];

  return {
    params: { h, k, s },
    prompt: `Let $f(x) = ${fx}$ for $x \\ge ${h}$. Find $f^{-1}(${K})$.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    verify,
  };
}

// ---------- the skill ----------

export const inverseFunctions: SkillDefinition = {
  id: ID,
  title: 'Inverse functions',
  track: 'math',
  unit: 'Functions',
  description: 'Undo a function: find f^{-1}(k), the inverse of a line or demand curve, and handle restricted domains.',
  prerequisites: ['function-composition'],
  maxDenominator: 9,
  levels: {
    1: { description: 'f^{-1}(k) for a linear function', ranges: { m: [-6, 6], b: [-12, 12], k: [-72, 72] } },
    2: { description: 'Write the inverse of a line as a line', ranges: { m: [-6, 6], b: [-12, 12] } },
    3: { description: 'Inverse demand: price as a function of quantity', ranges: { a: [20, 200], b: [1, 9] } },
    4: {
      description: 'Inverse of a cubic or a rational function',
      ranges: { form: [0, 1], a: [-5, 5], b: [-10, 10], c: [-5, 5], d: [-5, 5], k: [-212, 212] },
    },
    5: { description: 'Inverse on a restricted domain', ranges: { h: [0, 6], k: [-8, 8], s: [1, 8] } },
  },
  misconceptions: {
    reciprocal: {
      name: 'Read f^{-1} as 1/f',
      explanation:
        'The $-1$ in $f^{-1}$ does not mean a reciprocal. $f^{-1}(k)$ is the input that $f$ sends to $k$. Solve $f(x) = k$ for $x$ instead of computing $1/f(k)$.',
    },
    'evaluate-instead': {
      name: 'Computed f(k) instead of the inverse',
      explanation:
        '$f(k)$ feeds $k$ in as an input. $f^{-1}(k)$ treats $k$ as an output and asks which input produced it. Write $f(x) = k$ and solve for $x$.',
    },
    'undo-order': {
      name: 'Undid the steps in the wrong order',
      explanation:
        'To undo $f(x) = mx + b$ (multiply, then add), reverse the order: subtract $b$ first, then divide by $m$. Dividing first leaves $b$ undivided: the inverse is $\\frac{x - b}{m} = \\frac{x}{m} - \\frac{b}{m}$.',
    },
    'negative-reciprocal-slope': {
      name: 'Used the perpendicular slope',
      explanation:
        'The inverse of a line with slope $m$ has slope $\\frac{1}{m}$, not $-\\frac{1}{m}$. The negative reciprocal gives a line perpendicular to the original, which is a different idea. Reflecting over $y = x$ keeps the sign.',
    },
    'wrong-branch': {
      name: 'Took the negative square root',
      explanation:
        'Squares have two roots, $\\pm s$, but the domain restriction keeps only one. For $x \\ge h$, $x - h$ must be non-negative, so $x = h + s$, not $h - s$.',
    },
  },
  stepLabels: {
    'set-up': 'Write f(x) = k',
    swap: 'Swap the roles of input and output',
    'undo-add': 'Undo the addition first',
    'undo-mult': 'Then undo the multiplication',
    'cross-multiply': 'Clear the fraction',
    root: 'Take the root (keep the branch in the domain)',
    answer: 'State the answer',
  },
  learn: {
    whyItMatters:
      'Demand is often written both ways. $Q = 120 - 4P$ says how much people buy at a price. The inverse demand $P = 30 - Q/4$ says what price sells a quantity, and that is what a monopolist needs to compute revenue $P(Q)\\cdot Q$. Check: at $Q = 40$ the price is $30 - 10 = 20$, and $120 - 4(20) = 40$, so revenue is $20 \\times 40 = 800$. Logarithms are the inverse of exponentials, so this skill is also the doorway to the next unit.',
    summary:
      'The inverse $f^{-1}$ undoes $f$: $f^{-1}(k)$ is the input $x$ with $f(x) = k$. To find it, write $f(x) = k$ and undo the operations in reverse order (subtract before dividing, take a root last). To get a formula, swap $x$ and $y$ and solve for $y$. If $f$ is not one-to-one (like $x^2$), restrict the domain and keep the matching branch.',
    formulas: [
      { latex: 'f(f^{-1}(x)) = x \\quad\\text{and}\\quad f^{-1}(f(x)) = x', note: 'Use this to check an inverse.' },
      { latex: 'f(x) = mx + b \\;\\Rightarrow\\; f^{-1}(x) = \\frac{x - b}{m}' },
      { latex: 'f^{-1}(x) \\neq \\frac{1}{f(x)}', note: 'The $-1$ is not an exponent here.' },
    ],
    example: { seed: 4, level: 2 },
    tips: ['Undo operations in the reverse order: the last thing $f$ did is the first thing the inverse undoes.'],
  },

  generate(rng, level) {
    switch (level) {
      case 1:
        return linearPoint(rng);
      case 2:
        return linearInverse(rng);
      case 3:
        return inverseDemand(rng);
      case 4:
        return nonlinear(rng);
      case 5:
        return restricted(rng);
    }
  },
};
