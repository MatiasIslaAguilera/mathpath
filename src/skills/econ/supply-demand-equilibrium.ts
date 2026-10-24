// REFERENCE SKILL (econ, tuple answer + interpretation questions). Shows: multi-value answers,
// conceptual choice steps, several problem forms per skill, and "beyond the number"
// interpretation questions whose correct option is computed from the same params.

import { choiceAnswer, numberAnswer, tupleAnswer } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type {
  ChoiceOption,
  InterpretationQuestion,
  Level,
  MisconceptionInstance,
  SkillDefinition,
  Step,
} from '../../engine/types';

const ID = 'supply-demand-equilibrium';

// ---------- display helpers: econ problems show decimals (0.5P), not fractions ----------

const num = (x: Q | number): string => {
  const v = Q.of(x);
  return v.isInt() ? `${v.n}` : `${Number(v.valueOf().toFixed(4))}`;
};
/** Number with LaTeX for fractions that aren't short decimals (e.g. 7/3). */
const show = (x: Q | number): string => {
  const v = Q.of(x);
  const dec = v.valueOf();
  return v.isInt() || Number.isInteger(dec * 100) ? num(v) : v.toLatex();
};
const coef = (x: Q, v: string) => (x.eq(1) ? v : `${num(x)}${v}`);
/** a − bP */
const downLatex = (a: Q, b: Q, v: string) => `${num(a)} - ${coef(b, v)}`;
/** c + dP, written -10 + 3P when c < 0 and dP when c = 0 */
const upLatex = (c: Q, d: Q, v: string) =>
  c.isZero() ? coef(d, v) : `${num(c)} + ${coef(d, v)}`;
const money = (x: Q | number) => `\\$${show(x)}`;

type Form = 'standard' | 'inverse' | 'tax';

interface Market {
  form: Form;
  params: Record<string, number>;
  /** Standard/tax: Qd = a − bP, Qs = c + d(P − t). Inverse: P = a − bQ, P = c + dQ. */
  a: Q;
  b: Q;
  c: Q;
  d: Q;
  t: Q;
  P: Q; // equilibrium price (buyers' price when taxed)
  Qty: Q;
}

const QUARTERS = [q(1, 2), q(3, 2), q(5, 2), q(1, 4), q(3, 4), q(5, 4)];

function pick(rng: Rng, level: Level): Market {
  for (;;) {
    switch (level) {
      case 1:
      case 2: {
        const hi = level === 1 ? 5 : 10;
        const b = rng.int(1, hi);
        const d = rng.int(1, hi);
        const P = level === 1 ? rng.int(2, 20) : rng.int(5, 60);
        const Qty = level === 1 ? rng.int(5, 100) : rng.int(10, 300);
        const a = Qty + b * P;
        const c = Qty - d * P;
        if (level === 1 && c < 0) continue;
        return { form: 'standard', params: { a, b, c, d, P, Q: Qty }, a: q(a), b: q(b), c: q(c), d: q(d), t: q(0), P: q(P), Qty: q(Qty) };
      }
      case 3: {
        // inverse form: P = α − βQ, P = γ + δQ
        const b = rng.int(1, 6);
        const d = rng.int(1, 6);
        const Qty = rng.int(7, 40);
        const P = rng.int(5, 80);
        const a = P + b * Qty;
        const c = P - d * Qty;
        if (c < 0) continue;
        return { form: 'inverse', params: { a, b, c, d, P, Q: Qty }, a: q(a), b: q(b), c: q(c), d: q(d), t: q(0), P: q(P), Qty: q(Qty) };
      }
      case 4:
      case 5: {
        // per-unit tax t paid by sellers: Qs = c + d(P − t)
        let b: Q, d: Q, P: number, t: number;
        if (level === 4) {
          b = q(rng.int(1, 6));
          d = q(rng.int(1, 6));
          P = rng.int(5, 40);
          t = rng.int(1, 10);
        } else {
          b = rng.pick(QUARTERS);
          d = rng.pick(QUARTERS);
          P = 4 * rng.int(2, 20);
          t = 4 * rng.int(1, 3);
        }
        const Qty = rng.int(10, 200);
        const a = b.mul(P).add(Qty);
        const c = q(Qty).sub(d.mul(P - t));
        if (!a.isInt() || !c.isInt() || P - t <= 0) continue;
        return {
          form: 'tax',
          params: { a: a.n, b: b.valueOf(), c: c.n, d: d.valueOf(), t, P, Q: Qty },
          a, b, c, d, t: q(t), P: q(P), Qty: q(Qty),
        };
      }
    }
  }
}

function choice(rng: Rng, correctLabel: string, wrongLabels: string[]): { options: ChoiceOption[]; correct: string } {
  const labels = [correctLabel, ...wrongLabels.filter((w, i, all) => w !== correctLabel && all.indexOf(w) === i)];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: 'o0' };
}

// ---------- interpretation questions ("beyond the number") ----------

function surplusQuestion(rng: Rng, m: Market): InterpretationQuestion {
  // A price away from equilibrium, chosen so both quantities are whole numbers.
  // Inverse form: steps of b·d keep both quantities integers. Standard form: any integer step.
  const qd = (p: Q) => (m.form === 'inverse' ? m.a.sub(p).div(m.b) : m.a.sub(m.b.mul(p)));
  const qs = (p: Q) => (m.form === 'inverse' ? p.sub(m.c).div(m.d) : m.c.add(m.d.mul(p.sub(m.t))));
  const unit = m.form === 'inverse' ? m.b.mul(m.d) : q(1);
  const dir = rng.chance(0.5) ? 1 : -1;
  const mag = m.form === 'inverse' ? 1 : rng.int(1, 5);
  // Try the random offset first; one step above P* is always valid (pick() guarantees Q* ≥ b, d).
  const tries = [dir * mag, -dir * mag, dir, -dir, 1].map((s) => m.P.add(unit.mul(s)));
  const p1 = tries.find((p) => p.sign() > 0 && qd(p).sign() >= 0 && qs(p).sign() >= 0)!;
  const d1 = qd(p1);
  const s1 = qs(p1);
  const gap = s1.sub(d1).abs();
  const surplus = s1.valueOf() > d1.valueOf();
  const g = show(gap);
  const { options, correct } = choice(
    rng,
    surplus ? `Surplus of ${g} units; the price tends to fall` : `Shortage of ${g} units; the price tends to rise`,
    [
      surplus ? `Shortage of ${g} units; the price tends to rise` : `Surplus of ${g} units; the price tends to fall`,
      surplus ? `Surplus of ${g} units; the price tends to rise` : `Shortage of ${g} units; the price tends to fall`,
      'The market is in equilibrium at this price',
    ],
  );
  return {
    prompt: `Suppose the price were $${money(p1)}$ instead. What happens in this market?`,
    options,
    correct,
    explanation: `At $P = ${show(p1)}$: buyers want $Q_d = ${show(d1)}$ and sellers offer $Q_s = ${show(s1)}$. ${
      surplus
        ? `Sellers offer ${g} more units than buyers want (a surplus), so sellers compete by cutting prices, pushing $P$ down toward $P^* = ${show(m.P)}$.`
        : `Buyers want ${g} more units than sellers offer (a shortage), so buyers bid the price up toward $P^* = ${show(m.P)}$.`
    }`,
  };
}

const SHIFTS = [
  { what: 'Consumer incomes rise and demand increases (the demand curve shifts right).', ans: 'P* rises and Q* rises', why: 'More buyers at every price creates a shortage at the old price, so price rises, and sellers respond by supplying more.' },
  { what: 'A substitute good gets cheaper and demand decreases (the demand curve shifts left).', ans: 'P* falls and Q* falls', why: 'Fewer buyers at every price creates a surplus at the old price, so price falls and less is traded.' },
  { what: 'A new technology lowers production costs and supply increases (the supply curve shifts right).', ans: 'P* falls and Q* rises', why: 'Sellers offer more at every price, creating a surplus at the old price. Price falls, and buyers buy more at the lower price.' },
  { what: 'An input becomes more expensive and supply decreases (the supply curve shifts left).', ans: 'P* rises and Q* falls', why: 'Sellers offer less at every price, creating a shortage. Price rises and less is traded.' },
];
const SHIFT_ANSWERS = ['P* rises and Q* rises', 'P* falls and Q* falls', 'P* falls and Q* rises', 'P* rises and Q* falls'];
const latexStar = (s: string) => s.replace(/P\*/g, '$P^*$').replace(/Q\*/g, '$Q^*$');

function shiftQuestion(rng: Rng): InterpretationQuestion {
  const s = rng.pick(SHIFTS);
  const { options, correct } = choice(rng, latexStar(s.ans), SHIFT_ANSWERS.filter((a) => a !== s.ans).map(latexStar));
  return { prompt: `${s.what} What happens to the equilibrium?`, options, correct, explanation: s.why };
}

function taxBurdenQuestion(rng: Rng, m: Market): InterpretationQuestion {
  const p0 = m.a.sub(m.c).div(m.b.add(m.d)); // equilibrium price without the tax
  const buyers = m.P.sub(p0);
  const sellers = p0.sub(m.P.sub(m.t));
  const who = buyers.valueOf() > sellers.valueOf() ? 'Buyers' : buyers.eq(sellers) ? 'They split it equally' : 'Sellers';
  const labels = { Buyers: 'Buyers bear more of the tax', Sellers: 'Sellers bear more of the tax', 'They split it equally': 'They split it equally' };
  const { options, correct } = choice(rng, labels[who], Object.values(labels));
  return {
    prompt: `Who bears more of the $${money(m.t)}$ tax?`,
    options,
    correct,
    explanation: `Without the tax, $P_0 = ${show(p0)}$. With it, buyers pay $${show(m.P)}$ (${money(buyers)} more) and sellers keep $${show(m.P.sub(m.t))}$ (${money(sellers)} less). The side whose quantity responds *less* to price (the smaller slope: buyers ${num(m.b)}, sellers ${num(m.d)}) can't escape the tax as easily, so it bears more.`,
  };
}

function sellerPriceQuestion(rng: Rng, m: Market): InterpretationQuestion {
  const keep = m.P.sub(m.t);
  const { options, correct } = choice(rng, `$${money(keep)}$`, [`$${money(m.P)}$`, `$${money(m.P.add(m.t))}$`, `$${money(m.t)}$`]);
  return {
    prompt: 'How much do sellers keep per unit after paying the tax?',
    options,
    correct,
    explanation: `Buyers pay $P_b = ${show(m.P)}$, and sellers send $${show(m.t)}$ of that to the government, keeping $${show(m.P)} - ${show(m.t)} = ${show(keep)}$.`,
  };
}

// ---------- the skill ----------

export const supplyDemandEquilibrium: SkillDefinition = {
  id: ID,
  title: 'Supply & demand equilibrium',
  track: 'econ',
  unit: 'Supply & demand',
  description: 'Find the price and quantity where quantity demanded equals quantity supplied.',
  prerequisites: ['linear-equations'],
  maxDenominator: 1,
  workingPad: [1, 2, 3, 4, 5],
  levels: {
    1: { description: 'Small whole numbers', ranges: { a: [7, 200], b: [1, 5], c: [0, 100], d: [1, 5], P: [2, 20], Q: [5, 100] } },
    2: { description: 'Larger numbers, negative supply intercept', ranges: { a: [15, 900], b: [1, 10], c: [-590, 300], d: [1, 10], P: [5, 60], Q: [10, 300] } },
    3: { description: 'Inverse form: P as a function of Q', ranges: { a: [12, 320], b: [1, 6], c: [0, 80], d: [1, 6], P: [5, 80], Q: [7, 40] } },
    4: { description: 'A per-unit tax on sellers', ranges: { a: [15, 440], b: [1, 6], c: [-224, 200], d: [1, 6], t: [1, 10], P: [5, 40], Q: [10, 200] } },
    5: { description: 'Tax with decimal slopes', ranges: { a: [11, 400], b: [0.25, 2.5], c: [-190, 200], d: [0.25, 2.5], t: [4, 12], P: [8, 80], Q: [10, 200] } },
  },
  misconceptions: {
    'collect-sign': {
      name: 'Sign error when collecting P terms',
      explanation:
        'From $a - bP = c + dP$, add $bP$ to both sides: $a - c = (b + d)P$. The slopes *add*. Getting $(b - d)$ means a term crossed the equals sign without changing sign.',
    },
    'swapped-pq': {
      name: 'Swapped price and quantity',
      explanation:
        'Your numbers are right but in the wrong slots. $P$ is the price in dollars and $Q$ is the number of units. With inverse curves ($P = a - bQ$) you solve for $Q$ first, so it is easy to report it as the price. Reading $P = a - bQ$ as if it were $Q = a - bP$ produces the same swap.',
    },
    'tax-wrong-direction': {
      name: 'Shifted supply the wrong way',
      explanation:
        'With a per-unit tax on sellers, a seller only keeps $P - t$ of the price. So supply becomes $Q_s = c + d(P - t)$, not $c + d(P + t)$. The tax makes sellers offer *less* at any price buyers pay.',
    },
    'tax-ignored': {
      name: 'Ignored the tax',
      explanation:
        'That is the equilibrium without the tax. Rewrite supply with the price sellers actually keep, $P - t$, then solve again.',
    },
    'seller-price': {
      name: 'Gave the price sellers keep, not the price buyers pay',
      explanation:
        'With the tax, there are two prices: buyers pay $P_b$ and sellers keep $P_b - t$. The question asks for the price buyers pay.',
    },
    'slope-dropped': {
      name: 'Left the per-dollar change out of demand',
      explanation:
        '"Each \\$1 on the price cuts the quantity by $b$" means demand is $a - bP$, not $a - P$. The number of units lost per dollar is the slope, so it multiplies $P$.',
    },
    'slope-inverted': {
      name: 'Turned the slope upside down',
      explanation:
        'The slope of demand in $Q = a - bP$ is units per dollar: $\\Delta Q / \\Delta P$, from the two observations. Dividing the other way ($\\Delta P / \\Delta Q$) gives dollars per unit, the slope of the inverse curve. Then find the intercept from either point.',
    },
    'shift-ignored': {
      name: 'Ignored the shift in demand',
      explanation:
        'Extra demand "at every price" adds a constant to the demand curve: the new intercept is the old one plus the shift. Solve with the new curve, not the normal one.',
    },
  },
  stepLabels: {
    'setup-words': 'Write demand from the description',
    'setup-points': 'Write demand from two observations',
    'setup-shift': 'Write demand after the shift',
    'setup-right': 'Write supply from the description',
    'tax-supply': 'Rewrite supply with the tax',
    'equilibrium-condition': 'Set up the equilibrium condition',
    collect: 'Collect the P (or Q) terms',
    'solve-first': 'Solve for the first unknown',
    substitute: 'Substitute back for the other value',
    check: 'Check with the other curve',
  },
  learn: {
    whyItMatters:
      'Equilibrium is where the plans of buyers and sellers match. Say demand is $Q_d = 100 - 2P$ and supply is $Q_s = 10 + 3P$. Setting them equal gives $100 - 2P = 10 + 3P$, so $P^* = 18$ and $Q^* = 64$. Check: $100 - 36 = 64$ and $10 + 54 = 64$. This is the starting point for taxes, surplus, and policy analysis in micro theory.',
    summary:
      'Equilibrium is the price at which the quantity buyers want equals the quantity sellers offer. Set $Q_d = Q_s$, solve for $P^*$, then plug $P^*$ into either curve to get $Q^*$. Price is in dollars per unit and quantity is in units.',
    formulas: [
      { latex: 'Q_d = a - bP, \\quad Q_s = c + dP', note: 'Demand slopes down, supply slopes up.' },
      { latex: 'Q_d = Q_s \\;\\Rightarrow\\; P^* = \\frac{a - c}{b + d}', note: 'Then $Q^* = a - bP^*$.' },
      { latex: 'Q_s = c + d(P - t)', note: 'A per-unit tax $t$ on sellers: they keep $P - t$.' },
    ],
    example: { seed: 3, level: 2 },
    tips: ['Always check $Q^*$ with both curves. If they disagree, there is an arithmetic slip.'],
  },

  generate(rng, level) {
    return build(rng, pick(rng, level));
  },

  story: {
    levels: [1, 4],
    generate: (rng, level) => tellStory(rng, level),
  },
};

type Body = ReturnType<SkillDefinition['generate']>;

/** Steps, answer and misconceptions for a picked market (shared by plain and story problems). */
function build(rng: Rng, m: Market): Body {
    const { a, b, c, d, t, P, Qty } = m;
    const steps: Step[] = [];
    const sum = b.add(d);
    const isInverse = m.form === 'inverse';
    const isTax = m.form === 'tax';

    const prompt = isInverse
      ? `The inverse demand and supply curves are $$P = ${downLatex(a, b, 'Q')} \\quad\\text{(demand)} \\qquad P = ${upLatex(c, d, 'Q')} \\quad\\text{(supply)}$$ where $P$ is the price in dollars and $Q$ is the quantity in units. Find the equilibrium price $P^*$ and quantity $Q^*$.`
      : `In a market, demand and supply are $$Q_d = ${downLatex(a, b, 'P')} \\qquad Q_s = ${upLatex(c, d, 'P')}$$ where $P$ is the price in dollars and $Q$ is the quantity in units. ${
          isTax
            ? `The government charges sellers a tax of $${money(t)}$ per unit sold. Find the price buyers pay, $P_b$, and the quantity traded, $Q^*$.`
            : 'Find the equilibrium price $P^*$ and quantity $Q^*$.'
        }`;

    const demandEq = isInverse ? `P = ${a.toExpr()} - ${b.toExpr()}*Q` : `Q = ${a.toExpr()} - ${b.toExpr()}*P`;
    const supplyEq = isInverse
      ? `P = ${c.toExpr()} + ${d.toExpr()}*Q`
      : `Q = ${c.toExpr()} + ${d.toExpr()}*(P - ${t.toExpr()})`;
    const verify = { type: 'solve' as const, equations: [demandEq, supplyEq], unknowns: ['P', 'Q'] };
    const labels = isTax ? ['Price buyers pay', 'Quantity'] : ['Price', 'Quantity'];
    const displayLabels = isTax ? ['P_b', 'Q^*'] : ['P^*', 'Q^*'];
    const answer = tupleAnswer(labels, [P, Qty], displayLabels);

    if (isTax) {
      const c2 = c.sub(d.mul(t));
      steps.push({
        key: 'tax-supply',
        instruction: `Rewrite supply using the price sellers keep, $P - ${num(t)}$.`,
        math: `Q_s = ${upLatex(c, d, `(P - ${num(t)})`)} = ${upLatex(c2, d, 'P')}`,
        why: 'Sellers respond to the price they actually keep. A per-unit tax $t$ on sellers replaces $P$ with $P - t$ in the supply curve.',
        ask: {
          prompt: `Write the new supply curve: $Q_s = \\;?$ (in terms of $P$)`,
          answer: { kind: 'expression', value: `${c2.toExpr()} + ${d.toExpr()}*P`, variables: ['P'], display: upLatex(c2, d, 'P') },
          verify: { type: 'equivalent', expr: `${c.toExpr()} + ${d.toExpr()}*(P - ${t.toExpr()})`, variables: ['P'] },
        },
      });
    }

    const v = isInverse ? 'Q' : 'P';
    const cEff = isTax ? c.sub(d.mul(t)) : c;
    const left = downLatex(a, b, v);
    const right = upLatex(cEff, d, v);
    const eqChoice = choice(rng, isInverse ? 'Demand price = supply price' : 'Quantity demanded = quantity supplied', [
      isInverse ? 'Demand price = 0' : 'Quantity demanded = 0',
      'Price = quantity',
      isInverse ? 'Demand price + supply price = 0' : 'Quantity demanded + quantity supplied = 0',
    ]);
    steps.push({
      key: 'equilibrium-condition',
      instruction: isInverse ? 'Set the demand price equal to the supply price.' : 'Set quantity demanded equal to quantity supplied.',
      math: `${left} = ${right}`,
      why: 'At equilibrium, buyers want to buy exactly as much as sellers want to sell, so there is no shortage or surplus.',
      ask: { prompt: 'Which condition defines the equilibrium?', answer: choiceAnswer(eqChoice.options, eqChoice.correct) },
    });

    const firstVal = isInverse ? Qty : P;
    const rhs = a.sub(cEff);
    steps.push({
      key: 'collect',
      instruction: `Collect the $${v}$ terms on one side and the numbers on the other.`,
      math: `${num(a)} - ${num(cEff).startsWith('-') ? `(${num(cEff)})` : num(cEff)} = ${coef(b, v)} + ${coef(d, v)} \\;\\Rightarrow\\; ${coef(sum, v)} = ${show(rhs)}`,
      why: `Adding $${coef(b, v)}$ to both sides and subtracting the constant keeps the equation balanced. The slopes add.`,
      ask: {
        prompt: `After collecting terms: $${coef(sum, v)} = \\;?$`,
        answer: numberAnswer(rhs),
        verify: { type: 'evaluate', expr: `${sum.toExpr()}*${firstVal.toExpr()}` },
      },
    });

    const solveEq = `${a.toExpr()} - ${b.toExpr()}*${v} = ${cEff.toExpr()} + ${d.toExpr()}*${v}`;
    const firstName = isInverse ? 'Q^*' : isTax ? 'P_b' : 'P^*';
    steps.push({
      key: 'solve-first',
      instruction: `Divide to find ${isInverse ? 'the equilibrium quantity' : isTax ? 'the price buyers pay' : 'the equilibrium price'}.`,
      math: `${firstName} = \\frac{${show(rhs)}}{${num(sum)}} = ${show(firstVal)}`,
      why: `Divide both sides by the coefficient of $${v}$.`,
      ask: {
        prompt: `$${firstName} = \\;?$`,
        answer: numberAnswer(firstVal),
        verify: { type: 'solve', equations: [solveEq], unknowns: [v] },
      },
    });

    const secondVal = isInverse ? P : Qty;
    const secondName = isInverse ? 'P^*' : 'Q^*';
    steps.push({
      key: 'substitute',
      instruction: `Substitute $${firstName} = ${show(firstVal)}$ into the demand curve.`,
      math: isInverse
        ? `P^* = ${num(a)} - ${num(b)}\\cdot ${show(Qty)} = ${show(P)}`
        : `Q^* = ${num(a)} - ${num(b)}\\cdot ${show(P)} = ${show(Qty)}`,
      why: 'At equilibrium both curves pass through the same point, so either curve gives the other value.',
      ask: {
        prompt: `$${secondName} = \\;?$`,
        answer: numberAnswer(secondVal),
        verify: { type: 'evaluate', expr: `${a.toExpr()} - ${b.toExpr()}*${firstVal.toExpr()}` },
      },
    });

    steps.push({
      key: 'check',
      instruction: 'Check with the supply curve, then state the answer.',
      math: isInverse
        ? `P = ${num(c)} + ${num(d)}\\cdot ${show(Qty)} = ${show(P)} \\;\\checkmark`
        : `Q_s = ${num(cEff)} + ${num(d)}\\cdot ${show(P)} = ${show(Qty)} \\;\\checkmark${isTax ? `\\qquad \\text{sellers keep } ${show(P)} - ${num(t)} = ${show(P.sub(t))}` : ''}`,
      why: 'If both curves give the same value, the point is on both curves: that is the equilibrium.',
      ask: { prompt: isTax ? 'State $P_b$ and $Q^*$.' : 'State $P^*$ and $Q^*$.', answer, verify },
    });

    // ---------- misconceptions ----------
    const tuple = (id: string, p: () => Q, qq: (p: Q) => Q): MisconceptionInstance | null => {
      try {
        const pv = p();
        return { id, wrong: tupleAnswer(labels, [pv, qq(pv)], displayLabels) };
      } catch {
        return null;
      }
    };
    const qOfP = (p: Q) => a.sub(b.mul(p));
    const candidates: (MisconceptionInstance | null)[] = [{ id: 'swapped-pq', wrong: tupleAnswer(labels, [Qty, P], displayLabels) }];
    if (isInverse) {
      // Collect-sign: Q' = (a − c)/(b − d), then P' from demand.
      try {
        const qw = a.sub(c).div(b.sub(d));
        candidates.push({ id: 'collect-sign', wrong: tupleAnswer(labels, [a.sub(b.mul(qw)), qw], displayLabels) });
      } catch {
        /* b = d: not applicable */
      }
    } else {
      candidates.push(tuple('collect-sign', () => a.sub(cEff).div(b.sub(d)), qOfP));
    }
    if (isTax) {
      candidates.push(
        tuple('tax-wrong-direction', () => a.sub(c.add(d.mul(t))).div(sum), qOfP),
        tuple('tax-ignored', () => a.sub(c).div(sum), qOfP),
        { id: 'seller-price', wrong: tupleAnswer(labels, [P.sub(t), Qty], displayLabels) },
      );
    }

    const interpretation: InterpretationQuestion[] = isTax
      ? [taxBurdenQuestion(rng, m), sellerPriceQuestion(rng, m)]
      : [surplusQuestion(rng, m), shiftQuestion(rng)];

    return {
      params: m.params,
      prompt,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, candidates),
      interpretation,
      verify,
      // Working pad: quantity demanded and supplied are Q at equilibrium; with a tax, buyers pay P
      // and sellers keep P − t.
      working: {
        names: {
          Qd: Qty.toExpr(),
          Q_d: Qty.toExpr(),
          Qs: Qty.toExpr(),
          Q_s: Qty.toExpr(),
          ...(isTax ? { Pb: P.toExpr(), P_b: P.toExpr(), Ps: P.sub(t).toExpr(), P_s: P.sub(t).toExpr() } : {}),
        },
      },
    };
}

// ---------- story variants: the same market told in words, from data, or after a shift ----------

interface Setting {
  market: string;
  items: string;
  per: string;
  time: string;
}
const SETTINGS: Setting[] = [
  { market: 'the market for bread in a small town', items: 'loaves', per: 'loaf', time: 'day' },
  { market: 'the tomato market of a small city', items: 'kilograms of tomatoes', per: 'kilogram', time: 'week' },
  { market: 'a campus concert hall', items: 'tickets', per: 'ticket', time: 'night' },
];
const EVENTS = ['A street festival', 'A heat wave', 'A viral video about the product'];

/** A setup step: write a curve as an expression in one variable (checked by equivalence). */
function setupCurve(key: string, prompt: string, latex: string, expr: string, v: string, why: string): Step {
  return {
    key,
    instruction: prompt,
    math: latex,
    why,
    ask: { prompt, answer: { kind: 'expression', value: expr, variables: [v], display: latex }, verify: { type: 'equivalent', expr, variables: [v] } },
  };
}

function tellStory(rng: Rng, level: Level): Body {
  const pattern = rng.int(0, 2); // 0 words, 1 two observations, 2 shift
  const isTax = level === 4;
  let m = pick(rng, level);
  // Supply is told in words ("brings c even at a price of zero"), so its intercept is not negative.
  while (m.c.sign() < 0) m = pick(rng, level);
  const s = rng.pick(SETTINGS);
  const { a, b, c, d, t } = m;
  const cEff = c.sub(d.mul(t));
  const sum = b.add(d);
  const labels = isTax ? ['Price buyers pay', 'Quantity'] : ['Price', 'Quantity'];
  const displayLabels = isTax ? ['P_b', 'Q^*'] : ['P^*', 'Q^*'];
  const reading = (id: string, p: () => Q, qq: (p: Q) => Q): MisconceptionInstance | null => {
    try {
      const pv = p();
      return { id, wrong: tupleAnswer(labels, [pv, qq(pv)], displayLabels) };
    } catch {
      return null;
    }
  };

  // Supply in words (plain: at a price of zero; taxed: at a zero price the seller keeps).
  const supplyWords = isTax
    ? c.isZero()
      ? `Sellers would bring nothing if the price they keep were zero, and ${num(d)} ${s.items} per ${s.time} for every \\$1 they keep.`
      : `Sellers would bring ${num(c)} ${s.items} per ${s.time} if the price they keep were zero, and ${num(d)} more for every \\$1 they keep.`
    : c.isZero()
      ? `Sellers bring nothing at a price of zero, and ${num(d)} ${s.items} per ${s.time} for every \\$1 on the price.`
      : `Sellers bring ${num(c)} ${s.items} per ${s.time} even at a price of zero, and ${num(d)} more for every \\$1 on the price.`;
  const taxWords = isTax ? ` For every ${s.per} sold, the seller sends \\$${num(t)} to the government.` : '';
  const closing = isTax
    ? ` Let $P$ be the price buyers pay, in dollars per ${s.per}, and $Q$ the ${s.items} traded per ${s.time}. Find the price buyers pay, $P_b$, and the quantity traded, $Q^*$.`
    : ` Let $P$ be the price in dollars per ${s.per} and $Q$ the ${s.items} traded per ${s.time}. Find the equilibrium price $P^*$ and quantity $Q^*$.`;

  // The supply setup step: plain in P, or (taxed) in the price the seller keeps, s.
  const supplyStep = isTax
    ? setupCurve(
        'setup-right',
        'Let $s$ be the price a seller keeps, in dollars per unit. Write the quantity supplied in terms of $s$.',
        upLatex(c, d, 's'),
        c.isZero() ? `${d.toExpr()}*s` : `${c.toExpr()} + ${d.toExpr()}*s`,
        's',
        'Supply is the quantity at a zero price plus the extra per dollar times the price: the intercept is where sellers start, the slope is the extra per \\$1.',
      )
    : setupCurve(
        'setup-right',
        'Write the quantity supplied, $Q_s$, in terms of the price $P$.',
        upLatex(c, d, 'P'),
        c.isZero() ? `${d.toExpr()}*P` : `${c.toExpr()} + ${d.toExpr()}*P`,
        'P',
        'Supply is the quantity at a zero price plus the extra per dollar times the price: the intercept is where sellers start, the slope is the extra per \\$1.',
      );
  const demandStep = (key: string, prompt: string, why: string) =>
    setupCurve(key, prompt, downLatex(a, b, 'P'), `${a.toExpr()} - ${b.toExpr()}*P`, 'P', why);

  let prompt: string;
  let setup: Step[];
  let mis: (MisconceptionInstance | null)[];

  if (pattern === 0) {
    prompt = `In ${s.market}, buyers would take ${num(a)} ${s.items} per ${s.time} if the price were zero, and each \\$1 on the price cuts that by ${num(b)}. ${supplyWords}${taxWords}${closing}`;
    setup = [
      demandStep('setup-words', 'Write the quantity demanded, $Q_d$, in terms of the price $P$.', 'The quantity at a zero price is the intercept, and each \\$1 on the price subtracts the same amount: the slope is negative.'),
      supplyStep,
    ];
    mis = [reading('slope-dropped', () => a.sub(cEff).div(q(1).add(d)), (p) => a.sub(p))];
  } else if (pattern === 1) {
    // Two observations on the demand line a − bP, both with positive quantity, at prices unlike each other.
    const pMax = Math.floor((a.valueOf() - 1) / b.valueOf());
    const p1 = rng.int(1, pMax);
    let p2 = rng.int(1, pMax - 1);
    if (p2 >= p1) p2 += 1;
    const q1 = a.sub(b.mul(p1));
    const q2 = a.sub(b.mul(p2));
    prompt = `In ${s.market}, buyers' demand is a straight line in the price. At \\$${p1} buyers took ${num(q1)} ${s.items} per ${s.time}; at \\$${p2} they took ${num(q2)}. ${supplyWords}${taxWords}${closing}`;
    setup = [
      demandStep('setup-points', 'Write the quantity demanded, $Q_d$, in terms of the price $P$, from the two observations.', 'The slope is the change in quantity over the change in price, $(Q_2 - Q_1)/(P_2 - P_1)$, and it is negative. Then the line through a point gives the intercept.'),
      supplyStep,
    ];
    mis = [reading('slope-inverted', () => q1.add(q(p1).div(b)).sub(cEff).div(d.add(q(1).div(b))), (p) => q1.add(q(p1).sub(p).div(b)))];
  } else {
    const k = rng.int(5, Math.min(30, a.n - 1));
    const a0 = a.sub(k);
    const event = rng.pick(EVENTS);
    const days = rng.int(2, 9);
    const lasts = isTax ? ` It lasts ${days} days.` : '';
    prompt = `In ${s.market}, buyers' demand is normally $Q_d = ${downLatex(a0, b, 'P')}$. ${event} adds ${k} ${s.items} per ${s.time} to demand at every price.${lasts} ${supplyWords}${taxWords}${closing}`;
    setup = [
      demandStep(
        'setup-shift',
        'Write the new quantity demanded, $Q_d$, in terms of the price $P$.',
        `Extra demand at every price lifts the intercept by ${k}, to ${num(a)}; the slope is unchanged.${isTax ? ' How long the event lasts does not enter.' : ''}`,
      ),
      supplyStep,
    ];
    mis = [reading('shift-ignored', () => a0.sub(cEff).div(sum), (p) => a0.sub(b.mul(p)))];
  }

  const body = build(rng, m);
  return {
    ...body,
    prompt,
    steps: [...setup, ...body.steps],
    misconceptions: distinctMisconceptions(body.answer, [...mis, ...body.misconceptions]),
  };
}
