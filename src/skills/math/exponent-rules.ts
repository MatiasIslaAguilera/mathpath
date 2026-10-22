// Exponent rules (math). Number and tuple answers; every number ask is checked by `evaluate`
// (or `solve` for tuples) written from the raw params in exponent arithmetic.

import { choiceAnswer, numberAnswer, tupleAnswer, wrongNumber } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { AnswerSpec, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';

const ID = 'exponent-rules';

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** base^e for an integer exponent e (exact). */
function powQ(base: Q, e: number): Q {
  let out = q(1);
  for (let i = 0; i < Math.abs(e); i++) out = out.mul(base);
  return e >= 0 ? out : q(1).div(out);
}

/** x^{e}, writing plain x for e = 1. */
const sup = (v: string, e: number) => (e === 1 ? v : `${v}^{${e}}`);

/** Multiple-choice step answer: first label is correct, order shuffled. */
function choice(rng: Rng, correct: string, wrong: string[]): AnswerSpec {
  const labels = [correct, ...wrong];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return choiceAnswer(options, 'o0');
}

const RULE_OPTIONS = ['Add the exponents', 'Multiply the exponents', 'Subtract the exponents'];
const ruleChoice = (rng: Rng, correct: string) =>
  choice(rng, correct, RULE_OPTIONS.filter((o) => o !== correct));

export const exponentRules: SkillDefinition = {
  id: ID,
  title: 'Exponent rules',
  track: 'math',
  unit: 'Exponents & logarithms',
  description: 'Combine powers, handle zero, negative and fractional exponents.',
  prerequisites: ['linear-equations'],
  maxDenominator: 1024,
  levels: {
    1: {
      description: 'Same base: add or subtract exponents',
      ranges: { form: [0, 1], a: [2, 9], b: [2, 9] },
    },
    2: {
      description: 'Power of a power, with a coefficient',
      ranges: { form: [0, 1], a: [2, 9], b: [2, 5], c: [2, 5] },
    },
    3: {
      description: 'Zero and negative exponents',
      ranges: { form: [0, 2], b: [2, 9], k: [1, 3], p: [2, 5], q: [2, 5], k2: [1, 3] },
    },
    4: {
      description: 'Fractional exponents',
      ranges: { form: [0, 2], r: [2, 5], n: [2, 3], m: [1, 3], s: [2, 5] },
    },
    5: {
      description: 'Combined rules with two variables',
      ranges: { a: [1, 4], b: [1, 4], c: [2, 3], d: [1, 9], e: [1, 9] },
    },
  },
  misconceptions: {
    'multiply-for-product': {
      name: 'Multiplied the exponents instead of adding',
      explanation:
        'Multiplying powers of the same base adds the exponents: $x^3\\cdot x^4 = x^{3+4} = x^7$, not $x^{12}$. Count the factors: three $x$\'s times four $x$\'s is seven $x$\'s.',
    },
    'add-for-power': {
      name: 'Added the exponents instead of multiplying',
      explanation:
        'A power of a power multiplies the exponents: $(x^3)^4 = x^{3\\cdot 4} = x^{12}$, not $x^7$. Four copies of $x^3$ is twelve $x$\'s.',
    },
    'power-as-product': {
      name: 'Read a power of a power as a product',
      explanation:
        '$(3x^4)^3$ is not $3x^{4+3}$. The power applies to the whole bracket, so multiply *both* exponents, including the coefficient\'s hidden exponent of 1: $(3x^4)^3 = 3^3\\,x^{12} = 27x^{12}$. Ask "power of a power, or multiplying two powers?" first.',
    },
    'divide-for-quotient': {
      name: 'Divided the exponents instead of subtracting',
      explanation:
        'Dividing powers of the same base subtracts the exponents: $\\frac{x^7}{x^3} = x^{7-3} = x^4$. Cancel three of the seven $x$\'s and four are left.',
    },
    'add-for-quotient': {
      name: 'Added the exponents in a quotient',
      explanation:
        'Adding is the rule for *multiplying*, not for dividing. Dividing powers of the same base subtracts: $\\frac{x^8}{x^5} = x^{8-5} = x^3$, not $x^{13}$. Say the rule out loud before you compute: same base, dividing → subtract.',
    },
    'coefficient-not-raised': {
      name: 'Forgot to raise the coefficient',
      explanation:
        'The power applies to everything inside the brackets, number included: $(2x^3)^2 = 2^2\\,x^6 = 4x^6$, not $2x^6$.',
    },
    'negative-means-negative': {
      name: 'Read a negative exponent as a negative number',
      explanation:
        'A negative exponent means *reciprocal*, not a negative value: $2^{-3} = \\frac{1}{2^3} = \\frac18$. The result of a positive base stays positive.',
    },
    'zero-power-is-zero': {
      name: 'Thought a number to the power 0 is 0',
      explanation:
        'Any nonzero number to the power 0 is $1$. Dividing $b^n$ by itself gives $b^{n-n} = b^0$, and anything divided by itself is $1$.',
    },
    'fraction-exponent-multiplied': {
      name: 'Multiplied the base by the fractional exponent',
      explanation:
        'A fractional exponent is a root and a power, not a product: $8^{2/3} = (\\sqrt[3]{8})^2 = 2^2 = 4$, not $8\\cdot\\frac23$.',
    },
    'root-power-swapped': {
      name: 'Swapped the root and the power',
      explanation:
        'In $b^{m/n}$ the *denominator* $n$ is the root and the numerator $m$ is the power. $9^{1/2}$ is the square root of 9, which is 3, not 9 squared.',
    },
  },
  stepLabels: {
    rule: 'Name the rule first',
    product: 'Add exponents (same base, multiplying)',
    quotient: 'Subtract exponents (dividing)',
    power: 'Multiply exponents (power of a power)',
    coefficient: 'Raise the coefficient too',
    negative: 'Negative exponent means reciprocal',
    zero: 'Anything (nonzero) to the 0 is 1',
    root: 'Take the root (denominator)',
    raise: 'Raise to the power (numerator)',
    combine: 'Combine and state the answer',
  },
  learn: {
    whyItMatters:
      'Growth compounds by multiplying factors. Two years at 5% is $1.05\\cdot 1.05 = 1.05^2$, and $(1.05^2)^3 = 1.05^6$ is six years of growth. Exponent rules are also how you simplify Cobb-Douglas production functions like $K^{0.3}L^{0.7}$: double both inputs and output is multiplied by $2^{0.3}\\cdot 2^{0.7} = 2^{0.3+0.7} = 2^1 = 2$, so it exactly doubles (constant returns to scale).',
    summary:
      'Same base, multiply: add the exponents. Same base, divide: subtract them. Power of a power: multiply them. A power applies to every factor inside the brackets, coefficient included. A zero exponent gives 1, a negative exponent flips to the reciprocal, and $b^{m/n}$ means take the $n$-th root, then raise to the $m$.',
    formulas: [
      { latex: 'x^a\\cdot x^b = x^{a+b}', note: 'Multiplying, same base.' },
      { latex: '\\frac{x^a}{x^b} = x^{a-b}', note: 'Dividing, same base.' },
      { latex: '(x^a)^b = x^{ab}, \\quad (cx^a)^b = c^b x^{ab}', note: 'Power of a power.' },
      { latex: 'b^0 = 1, \\quad b^{-k} = \\frac{1}{b^k}', note: 'For $b \\ne 0$.' },
      { latex: 'b^{m/n} = \\left(\\sqrt[n]{b}\\right)^m', note: 'Root first, then the power.' },
    ],
    example: { seed: 7, level: 4 },
    tips: [
      'Ask which rule it is *before* touching the numbers: same base multiplying or dividing, or a power of a power?',
      'For $b^{m/n}$, take the root first. The numbers stay small: $27^{2/3} = 3^2 = 9$.',
    ],
  },

  generate(rng, level) {
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

type Body = ReturnType<SkillDefinition['generate']>;

// ---------- Level 1: same base ----------

function level1(rng: Rng): Body {
  const form = rng.int(0, 1);
  let a: number;
  let b: number;
  if (form === 0) {
    a = rng.int(2, 9);
    b = rng.int(2, 9);
  } else {
    a = rng.int(3, 9);
    b = rng.int(2, a - 1);
  }
  const ans = form === 0 ? a + b : a - b;
  const answer = numberAnswer(ans);
  const expr = form === 0 ? `(${a})+(${b})` : `(${a})-(${b})`;
  const steps: Step[] = [
    {
      key: form === 0 ? 'product' : 'quotient',
      instruction: form === 0 ? 'Same base and multiplying: add the exponents.' : 'Same base and dividing: subtract the exponents.',
      math:
        form === 0
          ? `x^{${a}}\\cdot x^{${b}} = x^{${a}+${b}}`
          : `\\frac{x^{${a}}}{x^{${b}}} = x^{${a}-${b}}`,
      why: form === 0 ? 'Product rule: $x^a\\cdot x^b = x^{a+b}$.' : 'Quotient rule: $\\frac{x^a}{x^b} = x^{a-b}$.',
      ask: {
        prompt: form === 0 ? 'What do you do with the exponents when multiplying powers of the same base?' : 'What do you do with the exponents when dividing powers of the same base?',
        answer: ruleChoice(rng, form === 0 ? 'Add the exponents' : 'Subtract the exponents'),
      },
    },
    {
      key: 'combine',
      instruction: 'Do the arithmetic on the exponents.',
      math: `x^{${a}${form === 0 ? '+' : '-'}${b}} = x^{${ans}}`,
      why: 'The base stays the same; only the exponent changes.',
      ask: {
        prompt: `What is $${a} ${form === 0 ? '+' : '-'} ${b}$?`,
        answer,
        verify: { type: 'evaluate', expr },
      },
    },
  ];
  const mis: (MisconceptionInstance | null)[] =
    form === 0
      ? [wrongNumber('multiply-for-product', () => a * b)]
      : [wrongNumber('divide-for-quotient', () => q(a, b)), wrongNumber('add-for-quotient', () => a + b)];
  return {
    params: { form, a, b },
    prompt:
      form === 0
        ? `Fill in the exponent. $$x^{${a}}\\cdot x^{${b}} = x^{?}$$`
        : `Fill in the exponent. $$\\frac{x^{${a}}}{x^{${b}}} = x^{?}$$`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, mis),
    verify: { type: 'evaluate', expr },
  };
}

// ---------- Level 2: power of a power, coefficient ----------

function level2(rng: Rng): Body {
  const form = rng.int(0, 1);
  const a = form === 0 ? rng.int(2, 9) : rng.int(2, 6);
  const b = form === 0 ? rng.int(2, 5) : rng.int(2, 3);
  const c = rng.int(2, 5);
  const params = { form, a, b, c };

  if (form === 0) {
    const e = a * b;
    const answer = numberAnswer(e);
    const expr = `(${a})*(${b})`;
    return {
      params,
      prompt: `Fill in the exponent. $$(x^{${a}})^{${b}} = x^{?}$$`,
      answer,
      steps: [
        {
          key: 'power',
          instruction: 'A power of a power: multiply the exponents.',
          math: `(x^{${a}})^{${b}} = x^{${a}\\cdot ${b}}`,
          why: 'Power rule: $(x^a)^b = x^{ab}$.',
          ask: {
            prompt: 'What do you do with the exponents in a power of a power?',
            answer: ruleChoice(rng, 'Multiply the exponents'),
          },
        },
        {
          key: 'combine',
          instruction: 'Multiply the exponents.',
          math: `x^{${a}\\cdot ${b}} = x^{${e}}`,
          why: 'The base stays $x$; the new exponent is the product.',
          ask: { prompt: `What is $${a} \\times ${b}$?`, answer, verify: { type: 'evaluate', expr } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('add-for-power', () => a + b)]),
      verify: { type: 'evaluate', expr },
    };
  }

  const k = c ** b;
  const e = a * b;
  const answer = tupleAnswer(['Coefficient', 'Exponent'], [k, e]);
  return {
    params,
    prompt: `Simplify to the form $k\\,x^{e}$. $$(${c}x^{${a}})^{${b}} = k\\,x^{e}$$ Enter $k$ and $e$.`,
    answer,
    steps: [
      {
        key: 'rule',
        instruction: 'Name the rule before computing: a power of a power multiplies the exponents, and the outside power applies to the coefficient too.',
        math: `(${c}x^{${a}})^{${b}} \\;\\Rightarrow\\; ${c}^{${b}} \\text{ and } x^{${a}\\cdot ${b}}`,
        why: '$(cx^a)^b = c^b\\,x^{ab}$. Both exponents multiply; never add them, and never leave $c$ alone.',
        ask: {
          prompt: `Which rule applies to $(${c}x^{${a}})^{${b}}$?`,
          answer: choice(
            rng,
            'Raise the coefficient and multiply the exponents',
            ['Leave the coefficient alone and multiply the exponents', 'Raise the coefficient and add the exponents'],
          ),
        },
      },
      {
        key: 'coefficient',
        instruction: `Raise the coefficient ${c} to the power ${b}.`,
        math: `${c}^{${b}} = ${k}`,
        why: 'The power applies to every factor inside the brackets, the number too.',
        ask: { prompt: `What is $${c}^{${b}}$?`, answer: numberAnswer(k), verify: { type: 'evaluate', expr: `(${c})^(${b})` } },
      },
      {
        key: 'power',
        instruction: 'Multiply the exponents of $x$.',
        math: `(x^{${a}})^{${b}} = x^{${a}\\cdot ${b}} = x^{${e}}`,
        why: 'Power rule: $(x^a)^b = x^{ab}$.',
        ask: { prompt: `What is $${a} \\times ${b}$?`, answer: numberAnswer(e), verify: { type: 'evaluate', expr: `(${a})*(${b})` } },
      },
      {
        key: 'combine',
        instruction: 'Put the coefficient and the exponent together.',
        math: `(${c}x^{${a}})^{${b}} = ${k}x^{${e}}`,
        why: 'Coefficient $c^b$, exponent $ab$.',
        ask: {
          prompt: `So $(${c}x^{${a}})^{${b}} = k\\,x^{e}$. Enter $k$ and $e$.`,
          answer,
          verify: { type: 'solve', equations: [`u = (${c})^(${b})`, `v = (${a})*(${b})`], unknowns: ['u', 'v'] },
        },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [
      { id: 'coefficient-not-raised', wrong: tupleAnswer(['Coefficient', 'Exponent'], [c, e]) },
      { id: 'add-for-power', wrong: tupleAnswer(['Coefficient', 'Exponent'], [k, a + b]) },
      { id: 'power-as-product', wrong: tupleAnswer(['Coefficient', 'Exponent'], [c, a + b]) },
    ]),
    verify: { type: 'solve', equations: [`u = (${c})^(${b})`, `v = (${a})*(${b})`], unknowns: ['u', 'v'] },
  };
}

// ---------- Level 3: zero and negative exponents ----------

const COPRIME_PAIRS: [number, number][] = [];
for (let p = 2; p <= 5; p++) for (let r = 2; r <= 5; r++) if (p !== r && gcd(p, r) === 1) COPRIME_PAIRS.push([p, r]);

function level3(rng: Rng): Body {
  const form = rng.int(0, 2);
  const b = rng.int(2, 9);
  const k = rng.int(1, 3);
  const [p, qq] = rng.pick(COPRIME_PAIRS);
  const k2 = rng.int(1, 3);
  const params = { form, b, k, p, q: qq, k2 };

  if (form === 0) {
    const answer = numberAnswer(1);
    return {
      params,
      prompt: `Evaluate. $$${b}^{0}$$`,
      answer,
      steps: [
        {
          key: 'zero',
          instruction: 'Recall the zero-exponent rule.',
          math: `b^0 = 1 \\quad (b \\ne 0)`,
          why: `Dividing $${b}^n$ by itself gives $${b}^{n-n} = ${b}^0$, and anything divided by itself is 1.`,
          ask: {
            prompt: 'What is any nonzero number raised to the power 0?',
            answer: choice(rng, '$1$', ['$0$', 'The number itself', 'Undefined']),
          },
        },
        {
          key: 'combine',
          instruction: 'Apply the rule to this base.',
          math: `${b}^0 = 1`,
          why: 'Zero exponent: $b^0 = 1$.',
          ask: { prompt: `What is $${b}^0$?`, answer, verify: { type: 'evaluate', expr: `(${b})^0` } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('zero-power-is-zero', () => 0)]),
      verify: { type: 'evaluate', expr: `(${b})^0` },
    };
  }

  if (form === 1) {
    const bk = b ** k;
    const ans = q(1, bk);
    const answer = numberAnswer(ans);
    const expr = `(${b})^(-${k})`;
    return {
      params,
      prompt: `Evaluate. $$${b}^{-${k}}$$`,
      answer,
      steps: [
        {
          key: 'negative',
          instruction: 'A negative exponent means the reciprocal of the positive power.',
          math: `${b}^{-${k}} = \\frac{1}{${b}^{${k}}}`,
          why: '$b^{-k} = \\frac{1}{b^k}$.',
          ask: { prompt: `What is $${b}^{${k}}$?`, answer: numberAnswer(bk), verify: { type: 'evaluate', expr: `(${b})^(${k})` } },
        },
        {
          key: 'combine',
          instruction: 'Write the reciprocal.',
          math: `\\frac{1}{${bk}}`,
          why: 'The value stays positive.',
          ask: { prompt: `So $${b}^{-${k}} = \\,?$`, answer, verify: { type: 'evaluate', expr } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [
        wrongNumber('negative-means-negative', () => -bk),
        wrongNumber('negative-means-negative', () => q(-1, bk)),
      ]),
      verify: { type: 'evaluate', expr },
    };
  }

  // (p/q)^(-k2): flip, then raise
  const base = q(p, qq);
  const flipped = q(qq, p);
  const ans = powQ(flipped, k2);
  const answer = numberAnswer(ans);
  const expr = `(${p}/${qq})^(-${k2})`;
  return {
    params,
    prompt: `Evaluate. $$\\left(\\frac{${p}}{${qq}}\\right)^{-${k2}}$$`,
    answer,
    steps: [
      {
        key: 'negative',
        instruction: 'A negative exponent flips the fraction.',
        math: `\\left(\\frac{${p}}{${qq}}\\right)^{-${k2}} = \\left(\\frac{${qq}}{${p}}\\right)^{${k2}}`,
        why: '$\\left(\\frac{p}{q}\\right)^{-k} = \\left(\\frac{q}{p}\\right)^{k}$.',
        ask: { prompt: `What is $\\frac{${qq}}{${p}}$ as a fraction or decimal? (the flipped base)`, answer: numberAnswer(flipped), verify: { type: 'evaluate', expr: `(${qq}/${p})` } },
      },
      {
        key: 'combine',
        instruction: `Raise the flipped fraction to the power ${k2}.`,
        math: `\\left(\\frac{${qq}}{${p}}\\right)^{${k2}} = ${ans.toLatex()}`,
        why: 'Raise numerator and denominator separately.',
        ask: { prompt: `So $\\left(\\frac{${p}}{${qq}}\\right)^{-${k2}} = \\,?$`, answer, verify: { type: 'evaluate', expr } },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('negative-means-negative', () => powQ(base, k2).neg())]),
    verify: { type: 'evaluate', expr },
  };
}

// ---------- Level 4: fractional exponents ----------

function level4(rng: Rng): Body {
  const form = rng.int(0, 2); // 0: b^(m/n), 1: b^(-m/n), 2: (b/c)^(m/n)
  const r = rng.int(2, 5);
  const n = rng.int(2, 3);
  const m = rng.pick(n === 2 ? [1, 3] : [1, 2]); // gcd(m, n) = 1: the exponent is in lowest terms
  const s = rng.pick([2, 3, 4, 5].filter((t) => t !== r && gcd(t, r) === 1));
  const params = { form, r, n, m, s };

  const g = form === 2 ? q(r, s) : q(r); // the n-th root of the base
  const M = form === 1 ? -m : m; // signed numerator
  const baseQ = powQ(g, n); // b (or b/c)
  const baseLatex = baseQ.toLatex();
  const baseExpr = form === 2 ? `(${r ** n}/${s ** n})` : `${r ** n}`;
  const baseShown = form === 2 ? `\\left(${baseLatex}\\right)` : baseLatex;
  const expShown = `${M < 0 ? '-' : ''}\\frac{${m}}{${n}}`;
  const ans = powQ(g, M);
  const answer = numberAnswer(ans);
  const expr = `${baseExpr}^(${q(M, n).toExpr()})`;
  const rootSym = n === 2 ? `\\sqrt{${baseLatex}}` : `\\sqrt[${n}]{${baseLatex}}`;

  const steps: Step[] = [
    {
      key: 'root',
      instruction: `The denominator ${n} is the root: take the ${n === 2 ? 'square' : 'cube'} root of the base.`,
      math: `${rootSym} = ${g.toLatex()}`,
      why: '$b^{1/n} = \\sqrt[n]{b}$.',
      ask: {
        prompt: `What is $${rootSym}$?`,
        answer: numberAnswer(g),
        verify: { type: 'evaluate', expr: `${baseExpr}^(1/${n})` },
      },
    },
    {
      key: 'raise',
      instruction: `The numerator ${m} is the power: raise the root to the power ${m}.`,
      math: `\\left(${g.toLatex()}\\right)^{${m}} = ${powQ(g, m).toLatex()}`,
      why: '$b^{m/n} = \\left(\\sqrt[n]{b}\\right)^m$.',
      ask: {
        prompt: `What is $\\left(${g.toLatex()}\\right)^{${m}}$?`,
        answer: numberAnswer(powQ(g, m)),
        verify: { type: 'evaluate', expr: `${baseExpr}^(${q(m, n).toExpr()})` },
      },
    },
  ];
  if (form === 1) {
    steps.push({
      key: 'negative',
      instruction: 'The exponent was negative, so take the reciprocal.',
      math: `${baseShown}^{-\\frac{${m}}{${n}}} = \\left(${g.toLatex()}\\right)^{-${m}} = ${ans.toLatex()}`,
      why: '$b^{-x} = \\frac{1}{b^x}$.',
      ask: { prompt: `So $${baseShown}^{${expShown}} = \\,?$`, answer, verify: { type: 'evaluate', expr } },
    });
  } else {
    steps[1].ask = { ...steps[1].ask!, prompt: `So $${baseShown}^{${expShown}} = \\,?$`, answer };
    steps[1].math = `${baseShown}^{\\frac{${m}}{${n}}} = \\left(${g.toLatex()}\\right)^{${m}} = ${ans.toLatex()}`;
    steps[1].ask!.verify = { type: 'evaluate', expr };
  }

  // Misconceptions
  const mis: (MisconceptionInstance | null)[] = [
    wrongNumber('fraction-exponent-multiplied', () => baseQ.mul(q(M, n))),
    // b^(m/n) read as the m-th root of b^n = g^(n^2/m): only when that exponent is an integer.
    (n * n) % M === 0 ? wrongNumber('root-power-swapped', () => powQ(g, (n * n) / M)) : null,
  ];
  if (form === 1) {
    mis.push(wrongNumber('negative-means-negative', () => powQ(g, m).neg()));
    mis.push(wrongNumber('negative-means-negative', () => powQ(g, M).neg()));
  }

  return {
    params,
    prompt: `Evaluate. $$${baseShown}^{${expShown}}$$`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, mis),
    verify: { type: 'evaluate', expr },
  };
}

// ---------- Level 5: combined ----------

function level5(rng: Rng): Body {
  const a = rng.int(1, 4);
  const b = rng.int(1, 4);
  const c = rng.int(2, 3);
  const d = rng.int(1, 9);
  const e = rng.int(1, 9);
  const params = { a, b, c, d, e };
  const ex1 = a * c;
  const ey1 = b * c;
  const ex = ex1 - d;
  const ey = ey1 - e;
  const labels = ['Exponent of x', 'Exponent of y'];
  const answer = tupleAnswer(labels, [ex, ey], ['x', 'y']);
  const verify = {
    type: 'solve' as const,
    equations: [`u = (${a})*(${c}) - (${d})`, `v = (${b})*(${c}) - (${e})`],
    unknowns: ['u', 'v'],
  };
  const num = `(${sup('x', a)}${sup('y', b)})^{${c}}`;
  const den = `${sup('x', d)}${sup('y', e)}`;
  return {
    params,
    prompt: `Simplify to the form $x^{p}\\,y^{r}$. $$\\frac{${num}}{${den}}$$ Enter the exponent of $x$ and of $y$.`,
    answer,
    steps: [
      {
        key: 'power',
        instruction: `Raise each factor in the numerator to the power ${c}: multiply each exponent by ${c}.`,
        math: `${num} = x^{${a}\\cdot ${c}}\\,y^{${b}\\cdot ${c}} = x^{${ex1}}\\,y^{${ey1}}`,
        why: '$(x^a y^b)^c = x^{ac}\\,y^{bc}$.',
        ask: {
          prompt: `After distributing the power, what are the exponents of $x$ and $y$ in the numerator?`,
          answer: tupleAnswer(labels, [ex1, ey1], ['x', 'y']),
          verify: { type: 'solve', equations: [`u = (${a})*(${c})`, `v = (${b})*(${c})`], unknowns: ['u', 'v'] },
        },
      },
      {
        key: 'quotient',
        instruction: 'Divide: subtract the denominator exponent from the numerator exponent, separately for each variable.',
        math: `x^{${ex1}-${d}} = x^{${ex}}, \\qquad y^{${ey1}-${e}} = y^{${ey}}`,
        why: '$\\frac{x^a}{x^b} = x^{a-b}$, applied to $x$ and $y$ separately. A result of 0 means that variable cancels completely.',
        ask: {
          prompt: `What is the exponent of $x$: $${ex1} - ${d}$?`,
          answer: numberAnswer(ex),
          verify: { type: 'evaluate', expr: `(${a})*(${c}) - (${d})` },
        },
      },
      {
        key: 'combine',
        instruction: 'State both exponents.',
        math: `x^{${ex}}\\,y^{${ey}}`,
        why: 'Each variable keeps its own exponent.',
        ask: { prompt: 'Enter the exponent of $x$ and of $y$.', answer, verify },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [
      { id: 'add-for-power', wrong: tupleAnswer(labels, [a + c - d, b + c - e], ['x', 'y']) },
      { id: 'divide-for-quotient', wrong: tupleAnswer(labels, [q(ex1, d), q(ey1, e)], ['x', 'y']) },
    ]),
    verify,
  };
}
