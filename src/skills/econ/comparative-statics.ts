// Comparative statics: how an equilibrium value moves when an outside parameter changes, and
// WHY the sign is what it is. Every answer is verified with `solve` on the TOTALLY DIFFERENTIATED
// equilibrium conditions (the shifter's change set to 1), never by the reduced-form formula.
// L1 demand shifter, L2 per-unit tax incidence, L3 taxed monopolist, L4 Keynesian multipliers,
// L5 two-country income model (Cramer's rule).

import { choiceAnswer, numberAnswer } from '../../engine/answers';
import { joinTerms } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type {
  ChoiceOption,
  InterpretationQuestion,
  SkillDefinition,
  Step,
  VerifySpec,
} from '../../engine/types';

const ID = 'comparative-statics';
type Body = ReturnType<SkillDefinition['generate']>;

// ---------- helpers ----------

const MAX_DEN = 12;
const denOk = (...vs: Q[]) => vs.every((v) => v.d <= MAX_DEN);

/** Integers, short decimals as decimals, anything else as a LaTeX fraction. */
const show = (x: Q): string => (x.isInt() || Number.isInteger(Number((x.valueOf() * 100).toFixed(6))) ? `${Number(x.valueOf().toFixed(4))}` : x.toLatex());
const lat = (x: Q) => x.toLatex();
/** coefficient times a symbol, dropping a coefficient of 1 */
const term = (c: Q, v: string) => (c.eq(1) ? v : c.eq(-1) ? `-${v}` : `${show(c)}${v}`);
/** Money-like text in prose. */
const dir = (x: Q): 'rises' | 'falls' | 'unchanged' => (x.sign() > 0 ? 'rises' : x.sign() < 0 ? 'falls' : 'unchanged');

function shuffledChoice(rng: Rng, correct: string, wrong: string[]): { options: ChoiceOption[]; correct: string } {
  const labels = [correct, ...wrong.filter((w, i, all) => w !== correct && all.indexOf(w) === i)];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: options.find((o) => o.label === correct)!.id };
}

function interp(rng: Rng, prompt: string, correct: string, wrong: string[], explanation: string): InterpretationQuestion {
  const c = shuffledChoice(rng, correct, wrong);
  return { prompt, options: c.options, correct: c.correct, explanation };
}

/** The "which way does it move?" step, a choice computed from the answer's sign. */
function signStep(what: string, shifter: string, ans: Q, why: string): Step {
  const word = dir(ans);
  const labels = { rises: `${what} rises`, falls: `${what} falls`, unchanged: `${what} does not change` };
  const options = (['rises', 'falls', 'unchanged'] as const).map((k) => ({ id: k, label: labels[k] }));
  return {
    key: 'sign',
    instruction: `Before solving, predict the direction: what happens to ${what} when ${shifter} goes up?`,
    math: `\\text{${what}: } ${word === 'rises' ? '\\uparrow' : word === 'falls' ? '\\downarrow' : '\\text{no change}'}`,
    why,
    ask: { prompt: `When ${shifter} rises, ${what}...`, answer: choiceAnswer(options, word) },
  };
}

const ev = (expr: string): VerifySpec => ({ type: 'evaluate', expr });

// ---------- L1: demand shifter ----------

function level1(rng: Rng): Body {
  for (;;) {
    const b = rng.int(1, 6);
    const e = rng.int(1, 6);
    const c = rng.nonzero(-6, 6);
    const a = rng.int(60, 200);
    const d = rng.int(0, 40);
    const ans = q(c, b + e);
    if (!denOk(ans)) continue;
    const qd = joinTerms([`${a}`, `-${term(q(b), 'P')}`, term(q(c), 'Y')]);
    const qs = joinTerms([...(d ? [`${d}`] : []), term(q(e), 'P')]);

    const steps: Step[] = [
      {
        key: 'differentiate',
        instruction: 'Set $Q_d = Q_s$, differentiate totally, and set $dY = 1$. Collect the $dP$ terms on one side.',
        math: `\\begin{aligned} ${qd} &= ${qs} \\\\ ${joinTerms([`-${term(q(b), '\\,dP')}`, term(q(c), '\\,dY')])} &= ${term(q(e), '\\,dP')} \\\\ (${b} + ${e})\\,dP &= ${c}\\,dY \\end{aligned}`,
        why: 'In equilibrium $Q_d = Q_s$, so their changes are equal too. Constants ($a$, $d$) drop out of a differential; only slopes survive.',
        ask: {
          prompt: 'After collecting terms, what is the coefficient of $dP$ (the total slope $b + e$)?',
          answer: numberAnswer(q(b + e)),
          verify: ev(`${b} + ${e}`),
        },
      },
      signStep('the equilibrium price', 'income $Y$', ans, 'Income only enters demand. The denominator $b + e$ is positive (downward demand, upward supply), so the sign of the effect is the sign of $c$.'),
      {
        key: 'solve-d',
        instruction: 'Solve for $dP^*/dY$.',
        math: `\\frac{dP^*}{dY} = \\frac{c}{b + e} = \\frac{${c}}{${b + e}} = ${lat(ans)}`,
        why: 'A demand shift of $c$ per unit of income is absorbed by price moving along both curves, with total slope $b + e$.',
        ask: { prompt: 'What is $dP^*/dY$?', answer: numberAnswer(ans), verify: { type: 'solve', equations: [`-${b}*dP + ${q(c).toExpr()} = ${e}*dP`], unknowns: ['dP'] } },
      },
    ];

    const answer = numberAnswer(ans);
    const misconceptions = distinctMisconceptions(answer, [
      { id: 'sign-flipped', wrong: numberAnswer(ans.neg()) },
      { id: 'forgot-supply-response', wrong: numberAnswer(q(c, b)) },
    ]);

    // Interpretation (drawn LAST)
    let interpretation: InterpretationQuestion[] | undefined;
    if (rng.chance(0.5)) {
      const NORMAL = 'Normal good: higher income raises demand at every price, which pushes the price up';
      const INFERIOR = 'Inferior good: higher income lowers demand at every price, which pushes the price down';
      interpretation = [
        interp(
          rng,
          `Here $dP^*/dY = ${lat(ans)}$. Which explanation fits the sign?`,
          c > 0 ? NORMAL : INFERIOR,
          [
            c > 0 ? INFERIOR : NORMAL,
            'Higher income shifts supply out, which lowers the price',
            'Income does not enter supply, so the equilibrium price cannot change',
          ],
          `The sign of $dP^*/dY$ is the sign of $c$, the effect of income on demand (since $b + e > 0$). Here $c = ${c}$, so the good is ${c > 0 ? 'normal' : 'inferior'}.`,
        ),
      ];
    }
    return {
      params: { a, b, c, d, e },
      prompt: `A market has demand $Q_d = ${qd}$ and supply $Q_s = ${qs}$, where $Y$ is consumers' income. Treating $Y$ as an outside parameter, find $dP^*/dY$, the change in the equilibrium price per unit of income.`,
      answer,
      steps,
      misconceptions,
      interpretation,
      verify: { type: 'solve', equations: [`-${b}*dP + ${q(c).toExpr()} = ${e}*dP`], unknowns: ['dP'] },
    };
  }
}

// ---------- L2: tax incidence ----------

function level2(rng: Rng): Body {
  for (;;) {
    const b = rng.int(1, 6);
    const e = rng.int(1, 6);
    const P0 = rng.int(5, 30);
    const Q0 = rng.int(20, 120);
    const a = Q0 + b * P0;
    const d = Q0 - e * P0;
    const form = rng.int(0, 1);
    const buyers = q(e, b + e);
    const sellers = q(b, b + e);
    const ans = form === 0 ? buyers : sellers;
    if (!denOk(ans)) continue;

    const supply = joinTerms([...(d ? [`${d}`] : []), `${e === 1 ? '' : e}(P - t)`]);
    const demand = `${a} - ${term(q(b), 'P')}`;

    const steps: Step[] = [
      {
        key: 'differentiate',
        instruction:
          form === 0
            ? 'Set $Q_d = Q_s$, differentiate totally with $dt = 1$, and collect the $dP$ terms.'
            : 'Let $s$ be the sellers\' share of the tax, so buyers\' price rises by $1 - s$ and sellers\' net price $P - t$ falls by $s$. Differentiate $Q_d = Q_s$ with $dt = 1$ and collect the $s$ terms.',
        math:
          form === 0
            ? `-${b}\\,dP = ${e}(dP - dt) \\;\\Rightarrow\\; (${b} + ${e})\\,dP = ${e}\\,dt`
            : `-${b}(1 - s) = ${e}(-s) \\;\\Rightarrow\\; (${b} + ${e})\\,s = ${b}`,
        why: 'The tax enters supply only through $P - t$. Buyers\' price change plus sellers\' net price change must add up to the whole tax.',
        ask: { prompt: `After collecting terms, what is the coefficient of ${form === 0 ? '$dP$' : '$s$'} (the total slope $b + e$)?`, answer: numberAnswer(q(b + e)), verify: ev(`${b} + ${e}`) },
      },
    ];
    const heavier = e > b ? 'Buyers' : e < b ? 'Sellers' : 'Equal';
    const hopts = ['Buyers', 'Sellers', 'Equal'].map((l) => ({ id: l, label: l === 'Equal' ? 'Equal shares' : `${l} bear the larger share` }));
    steps.push({
      key: 'sign',
      instruction: 'Predict who bears more of the tax: the side whose quantity responds LESS to price.',
      math: `\\text{slopes: demand } b = ${b}, \\text{ supply } e = ${e}`,
      why: 'The side that can adjust quantity less easily (the smaller slope) is stuck with more of the price change.',
      ask: { prompt: `With demand slope $b = ${b}$ and supply slope $e = ${e}$, who bears the larger share of the tax?`, answer: choiceAnswer(hopts, heavier) },
    });
    const finalVerify: VerifySpec =
      form === 0
        ? { type: 'solve', equations: [`-${b}*dP = ${e}*(dP - 1)`], unknowns: ['dP'] }
        : { type: 'solve', equations: [`-${b}*(1 - s) = ${e}*(-s)`], unknowns: ['s'] };
    steps.push({
      key: 'solve-d',
      instruction: form === 0 ? 'Solve for $dP^*/dt$, the share of the tax buyers pay.' : 'Solve for $s$, the share of the tax sellers bear.',
      math: form === 0 ? `\\frac{dP^*}{dt} = \\frac{e}{b + e} = \\frac{${e}}{${b + e}} = ${lat(ans)}` : `s = \\frac{b}{b + e} = \\frac{${b}}{${b + e}} = ${lat(ans)}`,
      why: form === 0 ? 'Buyers\' share is the supply slope over the total slope.' : 'Sellers\' share is the demand slope over the total slope; the two shares add to 1.',
      ask: { prompt: form === 0 ? 'What is $dP^*/dt$?' : 'What share of the tax do sellers bear?', answer: numberAnswer(ans), verify: finalVerify },
    });

    const answer = numberAnswer(ans);
    const misconceptions = distinctMisconceptions(answer, [
      { id: 'forgot-supply-response', wrong: numberAnswer(q(1)) },
      { id: 'seller-buyer-swapped', wrong: numberAnswer(form === 0 ? sellers : buyers) },
    ]);

    let interpretation: InterpretationQuestion[] | undefined;
    if (rng.chance(0.5)) {
      const BUY = 'Buyers: demand responds less to price than supply does ($b < e$)';
      const SELL = 'Sellers: supply responds less to price than demand does ($e < b$)';
      const EQ = 'Neither: the tax is split equally because $b = e$';
      const LEGAL = 'Sellers, because the law charges the tax to them';
      const correct = e > b ? BUY : e < b ? SELL : EQ;
      interpretation = [
        interp(
          rng,
          `Buyers pay $${lat(buyers)}$ of the tax and sellers $${lat(sellers)}$. Who bears the larger share, and why?`,
          correct,
          [BUY, SELL, EQ, LEGAL],
          `Buyers' share is $e/(b+e)$ and sellers' share is $b/(b+e)$. With $b = ${b}$, $e = ${e}$, ${e > b ? 'supply is the more responsive side, so buyers, who respond less, bear more' : e < b ? 'demand is the more responsive side, so sellers, who respond less, bear more' : 'both sides respond equally, so the tax splits evenly'}. Who writes the check does not matter.`,
        ),
      ];
    }
    return {
      params: { a, b, d, e, form },
      prompt: `A market has demand $Q_d = ${demand}$ and supply $Q_s = ${supply}$, where $t$ is a per-unit tax collected from sellers. ${form === 0 ? 'Find $dP^*/dt$: how much the price buyers pay rises per dollar of tax.' : `Find the share of the tax that sellers bear, $1 - dP^*/dt$.`}`,
      answer,
      steps,
      misconceptions,
      interpretation,
      verify: finalVerify,
    };
  }
}

// ---------- L3: taxed monopolist ----------

function level3(rng: Rng): Body {
  const B = rng.int(1, 6);
  const q0 = rng.int(2, 15);
  const c = rng.int(2, 20);
  const A = c + 2 * B * q0;
  const F = rng.chance(0.5) ? 0 : 5 * rng.int(1, 10);
  const t0 = rng.int(1, 4);
  const form = rng.int(0, 1);
  const dq = q(-1, 2 * B);
  const dP = q(1, 2);
  const ans = form === 0 ? dq : dP;
  const qStar = q(A - c - t0, 2 * B);

  const steps: Step[] = [
    {
      key: 'foc',
      instruction: 'Write profit, set marginal revenue equal to marginal cost plus the tax, and find $q^*$ for the stated tax.',
      math: `\\begin{aligned} \\pi &= (${A} - ${term(q(B), 'q')})q - ${term(q(c), 'q')}${F ? ` - ${F}` : ''} - tq \\\\ \\pi' &= ${A} - ${2 * B}q - ${c} - t = 0 \\end{aligned}`,
      why: 'A monopolist sets $MR = MC$. The tax raises marginal cost by $t$ per unit. Fixed cost does not change the first-order condition.',
      ask: {
        prompt: `With a tax of $t = ${t0}$, what is the profit-maximizing quantity $q^*$?`,
        answer: numberAnswer(qStar),
        verify: { type: 'solve', equations: [`${A} - ${2 * B}*q - ${c} - ${t0} = 0`], unknowns: ['q'] },
      },
    },
    {
      key: 'differentiate',
      instruction: 'Totally differentiate the first-order condition with $dt = 1$ and collect the $dq$ terms.',
      math: `-${2 * B}\\,dq - dt = 0 \\;\\Rightarrow\\; ${2 * B}\\,dq = -dt`,
      why: 'The FOC holds for every $t$, so its total differential is zero. The constants $A$ and $c$ drop out.',
      ask: { prompt: 'What is the coefficient of $dq$ in the differentiated first-order condition (the second derivative of profit, $-2B$)?', answer: numberAnswer(q(-2 * B)), verify: ev(`-2*${B}`) },
    },
    {
      key: 'solve-d',
      instruction: 'Solve for $dq^*/dt$.',
      math: `\\frac{dq^*}{dt} = -\\frac{1}{2B} = ${lat(dq)}`,
      why: 'Each dollar of tax cuts output by $1/(2B)$: the profit-curve\'s curvature is $2B$ (the MR slope).',
      ask: { prompt: 'What is $dq^*/dt$?', answer: numberAnswer(dq), verify: { type: 'solve', equations: [`-${2 * B}*dq - 1 = 0`], unknowns: ['dq'] } },
    },
  ];
  let finalVerify: VerifySpec = { type: 'solve', equations: [`-${2 * B}*dq - 1 = 0`], unknowns: ['dq'] };
  if (form === 1) {
    finalVerify = { type: 'solve', equations: [`-${2 * B}*(-dP/${B}) - 1 = 0`], unknowns: ['dP'] };
    steps.push({
      key: 'price',
      instruction: 'The price comes off the demand curve, $P = A - Bq$, so $dP = -B\\,dq$. Find $dP^*/dt$.',
      math: `\\frac{dP^*}{dt} = -B\\cdot\\frac{dq^*}{dt} = -${B}\\cdot\\left(${lat(dq)}\\right) = ${lat(dP)}`,
      why: 'Half of any cost increase reaches the price when demand is linear: $B$ cancels.',
      ask: { prompt: 'What is $dP^*/dt$?', answer: numberAnswer(dP), verify: finalVerify },
    });
  } else {
    steps[2].ask!.verify = finalVerify;
  }

  const answer = numberAnswer(ans);
  const misconceptions = distinctMisconceptions(answer, [
    { id: 'sign-flipped', wrong: numberAnswer(ans.neg()) },
    form === 0 ? { id: 'forgot-mr-slope', wrong: numberAnswer(q(-1, B)) } : { id: 'monopoly-full-pass', wrong: numberAnswer(q(1)) },
  ]);

  let interpretation: InterpretationQuestion[] | undefined;
  if (rng.chance(0.5)) {
    const FALLS = 'Output falls: the tax raises marginal cost, so the monopolist moves up its marginal revenue curve';
    const RISES = 'Output rises: a higher price from the tax lets the monopolist sell more';
    const SAME = 'Output is unchanged: a per-unit tax is a fixed amount, so it does not affect the optimum';
    interpretation = [
      interp(
        rng,
        form === 0
          ? `$dq^*/dt = ${lat(dq)}$. Why is the sign negative?`
          : `$dP^*/dt = ${lat(dP)}$, and $dq^*/dt = ${lat(dq)}$. Why does output fall when the tax is passed on?`,
        FALLS,
        [RISES, SAME, 'Output falls because the tax shifts the demand curve inward'],
        `The tax raises marginal cost by $t$ for every unit, so the point where $MR = MC + t$ moves to a smaller quantity. Demand does not move; the monopolist slides along it. Only half of the tax reaches the price because the demand curve and the MR curve have slopes $B$ and $2B$.`,
      ),
    ];
  }
  return {
    params: { A, B, c, F, t0, form },
    prompt: `A monopolist faces inverse demand $P = ${A} - ${term(q(B), 'q')}$, has cost $C = ${term(q(c), 'q')}${F ? ` + ${F}` : ''}$, and pays a per-unit tax $t$ on each unit sold, so profit is $\\pi = Pq - C - tq$. Find ${form === 0 ? '$dq^*/dt$: how the profit-maximizing output changes per dollar of tax.' : '$dP^*/dt$: how the profit-maximizing price changes per dollar of tax.'}`,
    answer,
    steps,
    misconceptions,
    interpretation,
    verify: finalVerify,
  };
}

// ---------- L4: Keynesian multipliers ----------

const B_CHOICES: Q[] = [q(1, 2), q(3, 5), q(2, 3), q(3, 4), q(4, 5)];

function level4(rng: Rng): Body {
  const b = rng.pick(B_CHOICES);
  const a = 10 * rng.int(1, 20);
  const I = 10 * rng.int(1, 10);
  const G = 10 * rng.int(1, 10);
  const T = 10 * rng.int(1, 10);
  const form = rng.int(0, 2);
  const one = q(1).sub(b);
  const mG = q(1).div(one);
  const mT = b.neg().div(one);
  const ans = form === 0 ? mG : form === 1 ? mT : q(1);
  const bx = b.toExpr();

  const eq = [
    form === 0 ? `dY = ${bx}*dY + 1` : form === 1 ? `dY = ${bx}*(dY - 1)` : `dY = ${bx}*(dY - 1) + 1`,
  ];
  const change = form === 0 ? '$dG = 1$, $dT = 0$' : form === 1 ? '$dT = 1$, $dG = 0$' : '$dG = dT = 1$ (a balanced budget)';
  const math =
    form === 0
      ? `dY = dC + dG = ${show(b)}\\,dY + dG \\;\\Rightarrow\\; (1 - ${show(b)})\\,dY = dG`
      : form === 1
        ? `dY = dC = ${show(b)}(dY - dT) \\;\\Rightarrow\\; (1 - ${show(b)})\\,dY = -${show(b)}\\,dT`
        : `dY = ${show(b)}(dY - dT) + dG \\;\\Rightarrow\\; (1 - ${show(b)})\\,dY = dG - ${show(b)}\\,dT`;
  const finalMath =
    form === 0
      ? `\\frac{dY}{dG} = \\frac{1}{1 - b} = ${lat(mG)}`
      : form === 1
        ? `\\frac{dY}{dT} = -\\frac{b}{1 - b} = ${lat(mT)}`
        : `\\frac{dY}{dG} + \\frac{dY}{dT} = ${lat(mG)} + \\left(${lat(mT)}\\right) = 1`;

  const steps: Step[] = [
    {
      key: 'differentiate',
      instruction: `Totally differentiate $Y = C + I + G$ and $C = a + b(Y - T)$ with ${change} ($dI = 0$, $da = 0$). Substitute $dC$ and collect the $dY$ terms.`,
      math,
      why: 'Consumption depends on DISPOSABLE income $Y - T$, so a tax change enters through $dC$, and $dC$ feeds back into $dY$.',
      ask: { prompt: 'After collecting terms, what is the coefficient of $dY$, $1 - b$?', answer: numberAnswer(one), verify: ev(`1 - ${bx}`) },
    },
    {
      key: 'solve-d',
      instruction: 'Solve for the change in income.',
      math: finalMath,
      why: form === 2 ? 'The spending rise adds $1/(1-b)$ and the tax rise subtracts $b/(1-b)$; the difference is exactly 1.' : 'The multiplier $1/(1-b)$ is the sum of the rounds: spend, re-spend a fraction $b$, and so on.',
      ask: {
        prompt: form === 0 ? 'What is $dY/dG$?' : form === 1 ? 'What is $dY/dT$?' : 'What is the change in $Y$ when $G$ and $T$ both rise by 1?',
        answer: numberAnswer(ans),
        verify: { type: 'solve', equations: eq, unknowns: ['dY'] },
      },
    },
  ];
  const answer = numberAnswer(ans);
  const misconceptions = distinctMisconceptions(answer, [
    { id: 'sign-flipped', wrong: numberAnswer(ans.neg()) },
    {
      id: 'multiplier-b',
      wrong: numberAnswer(form === 0 ? q(1).div(b) : form === 1 ? q(-1) : q(1).div(b).sub(1)),
    },
    form === 1 ? { id: 'tax-like-spending', wrong: numberAnswer(mG.neg()) } : null,
  ]);

  let interpretation: InterpretationQuestion[] | undefined;
  if (rng.chance(0.5)) {
    const prompt =
      form === 0
        ? `$dY/dG = ${lat(mG)}$ is larger than 1. Why does \\$1 of government spending raise income by more than \\$1?`
        : form === 1
          ? `$dY/dT = ${lat(mT)}$, smaller in size than the spending multiplier $${lat(mG)}$. Why?`
          : 'Why is the balanced-budget multiplier exactly 1?';
    const correct =
      form === 0
        ? 'The spending becomes income, and a fraction $b$ of that is spent again, round after round'
        : form === 1
          ? 'A tax change first moves disposable income, and only the fraction $b$ of it is spent; the rest is saved'
          : 'The spending rise adds $1/(1-b)$ and the tax rise subtracts $b/(1-b)$, leaving 1';
    const distractors = [
      'Government spending crowds out investment, so the effect is partly offset',
      'Taxes and spending are both just transfers, so neither can change income',
      'The multiplier is just $b$, the fraction of income that is spent',
    ];
    interpretation = [
      interp(rng, prompt, correct, distractors, `With $b = ${lat(b)}$: spending multiplier $1/(1-b) = ${lat(mG)}$, tax multiplier $-b/(1-b) = ${lat(mT)}$, and together they give $${lat(mG.add(mT))}$.`),
    ];
  }
  return {
    params: { a, bn: b.n, bd: b.d, I, G, T, form },
    prompt: `An economy has $Y = C + I + G$ and $C = a + b(Y - T)$ with $a = ${a}$, $b = ${show(b)}$, $I = ${I}$, $G = ${G}$, $T = ${T}$ (lump-sum taxes). ${
      form === 0 ? 'Find the government-spending multiplier $dY/dG$.' : form === 1 ? 'Find the tax multiplier $dY/dT$.' : 'Find the change in $Y$ when $G$ and $T$ both rise by 1 (the balanced-budget multiplier).'
    }`,
    answer,
    steps,
    misconceptions,
    interpretation,
    verify: { type: 'solve', equations: eq, unknowns: ['dY'] },
  };
}

// ---------- L5: two-country income model ----------

const B5: Q[] = [q(1, 2), q(3, 5), q(2, 3), q(3, 4), q(4, 5)];
const M5: Q[] = [q(1, 10), q(1, 5), q(1, 4), q(1, 3), q(2, 5)];

const bmat = (m: Q[][]) => `\\begin{bmatrix} ${m.map((r) => r.map(lat).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;
const exprM = (m: Q[][]) => m.map((r) => r.map((v) => v.toExpr()));

function level5(rng: Rng): Body {
  for (;;) {
    const b1 = rng.pick(B5);
    const b2 = rng.pick(B5);
    const m1 = rng.pick(M5);
    const m2 = rng.pick(M5);
    const which = rng.int(0, 1);
    const k1 = q(1).sub(b1).add(m1);
    const k2 = q(1).sub(b2).add(m2);
    const A = [[k1, m2.neg()], [m1.neg(), k2]];
    const D = k1.mul(k2).sub(m1.mul(m2));
    const num1 = k2; // det with column 1 replaced by (1, 0)
    const num2 = m1; // det with column 2 replaced by (1, 0)
    const Y1 = num1.div(D);
    const Y2 = num2.div(D);
    const ans = which === 0 ? Y1 : Y2;
    if (!denOk(k1, k2, D, Y1, Y2)) continue;
    const a1 = 10 * rng.int(1, 10);
    const a2 = 10 * rng.int(1, 10);
    const I1 = 10 * rng.int(1, 10);
    const I2 = 10 * rng.int(1, 10);

    const Aw = which === 0 ? [[q(1), m2.neg()], [q(0), k2]] : [[k1, q(1)], [m1.neg(), q(0)]];
    const numer = which === 0 ? num1 : num2;
    const pinned = which === 0 ? [`${k1.toExpr()}*dY1 - ${m2.toExpr()}*${Y2.toExpr()} = 1`, `-${m1.toExpr()}*dY1 + ${k2.toExpr()}*${Y2.toExpr()} = 0`] : [`${k1.toExpr()}*${Y1.toExpr()} - ${m2.toExpr()}*dY2 = 1`, `-${m1.toExpr()}*${Y1.toExpr()} + ${k2.toExpr()}*dY2 = 0`];
    const unk = which === 0 ? 'dY1' : 'dY2';
    const finalVerify: VerifySpec = { type: 'solve', equations: pinned, unknowns: [unk] };

    const steps: Step[] = [
      {
        key: 'differentiate',
        instruction: 'Totally differentiate both income equations with $dI_1 = 1$ ($dI_2 = 0$) and collect the $dY_1$, $dY_2$ terms.',
        math: `\\begin{aligned} (1 - b_1 + m_1)\\,dY_1 - m_2\\,dY_2 &= dI_1 \\\\ -m_1\\,dY_1 + (1 - b_2 + m_2)\\,dY_2 &= dI_2 \\end{aligned} \\qquad A = ${bmat(A)}`,
        why: 'Each country\'s income depends on the other\'s through trade: country 2\'s imports are country 1\'s exports, so $dY_2$ appears in country 1\'s equation.',
        ask: { prompt: 'What is the coefficient of $dY_1$ in the first equation, $1 - b_1 + m_1$?', answer: numberAnswer(k1), verify: ev(`1 - ${b1.toExpr()} + ${m1.toExpr()}`) },
      },
      {
        key: 'det-d',
        instruction: 'Find the determinant of the coefficient matrix $A$.',
        math: `\\det A = ${lat(k1)}\\cdot ${lat(k2)} - ${lat(m2)}\\cdot ${lat(m1)} = ${lat(D)}`,
        why: 'It is the same for both unknowns, and must be non-zero.',
        ask: { prompt: 'What is $\\det A$?', answer: numberAnswer(D), verify: { type: 'det', matrix: exprM(A) } },
      },
      {
        key: 'det-1',
        instruction: `For $dY_${which + 1}$, replace column ${which + 1} of $A$ with the right-hand side $(1, 0)$ and take the determinant.`,
        math: `\\det A_{${which + 1}} = \\det${bmat(Aw)} = ${lat(numer)}`,
        why: 'Only the column of the unknown you want is swapped for the constants $(dI_1, dI_2) = (1, 0)$.',
        ask: { prompt: `What is the determinant after replacing column ${which + 1}?`, answer: numberAnswer(numer), verify: { type: 'det', matrix: exprM(Aw) } },
      },
      signStep(`income in country ${which + 1}`, 'investment $I_1$ in country 1', ans, 'Both determinants are positive here, so the multiplier is positive: higher investment raises income at home and, through trade, abroad.'),
      {
        key: 'solve-d',
        instruction: `Divide to get $dY_${which + 1}/dI_1$.`,
        math: `\\frac{dY_${which + 1}}{dI_1} = \\frac{${lat(numer)}}{${lat(D)}} = ${lat(ans)}`,
        why: "Cramer's rule: each unknown is a ratio of determinants.",
        ask: { prompt: `What is $dY_${which + 1}/dI_1$?`, answer: numberAnswer(ans), verify: finalVerify },
      },
    ];
    const answer = numberAnswer(ans);
    const misconceptions = distinctMisconceptions(answer, [
      { id: 'sign-flipped', wrong: numberAnswer(ans.neg()) },
      { id: 'closed-economy', wrong: numberAnswer(which === 0 ? q(1).div(k1) : q(0)) },
    ]);

    let interpretation: InterpretationQuestion[] | undefined;
    if (rng.chance(0.5)) {
      if (which === 1) {
        const C = 'Higher income in country 1 raises its imports, which are country 2\'s exports';
        interpretation = [
          interp(
            rng,
            `$dY_2/dI_1 = ${lat(Y2)}$ is positive. Why does investment in country 1 raise income in country 2?`,
            C,
            [
              'Country 2 invests more to match country 1',
              'Higher income in country 1 lowers its imports from country 2',
              'Country 2\'s consumption falls, so its saving rises',
            ],
            `The effect is $m_1 \\cdot dY_1/dI_1$ spread over the whole system: country 1's extra income buys more imports (fraction $m_1 = ${lat(m1)}$), and those are country 2's exports. It is zero if $m_1 = 0$.`,
          ),
        ];
      } else {
        const closed = q(1).div(q(1).sub(b1));
        const rel: 'smaller' | 'larger' = Y1.valueOf() < closed.valueOf() ? 'smaller' : 'larger';
        const SM = 'Smaller: part of each round of spending leaks out as imports';
        const LG = 'Larger: trade adds extra demand for the home country\'s goods';
        const SAME = 'The same: the multiplier does not depend on trade';
        interpretation = [
          interp(
            rng,
            `If country 1 were closed (no trade), the multiplier would be $1/(1 - b_1) = ${lat(closed)}$. Is $dY_1/dI_1 = ${lat(Y1)}$ larger or smaller, and why?`,
            rel === 'smaller' ? SM : LG,
            [SM, LG, SAME],
            `Open: $${lat(Y1)}$. Closed: $${lat(closed)}$. Imports ($m_1 = ${lat(m1)}$) leak out of each round of spending; the feedback from country 2 recovers only part of it, so the open multiplier is ${rel}.`,
          ),
        ];
      }
    }
    return {
      params: {
        a1, a2, I1, I2, which,
        b1n: b1.n, b1d: b1.d, b2n: b2.n, b2d: b2.d,
        m1n: m1.n, m1d: m1.d, m2n: m2.n, m2d: m2.d,
      },
      prompt: `Two countries trade. Incomes satisfy $Y_1 = ${a1} + b_1 Y_1 + I_1 + m_2 Y_2 - m_1 Y_1$ and $Y_2 = ${a2} + b_2 Y_2 + I_2 + m_1 Y_1 - m_2 Y_2$ (spending propensity $b_i$, import propensity $m_i$), with $b_1 = ${lat(b1)}$, $b_2 = ${lat(b2)}$, $m_1 = ${lat(m1)}$, $m_2 = ${lat(m2)}$, $I_1 = ${I1}$, $I_2 = ${I2}$. Totally differentiate and use Cramer's rule to find $dY_${which + 1}/dI_1$.`,
      answer,
      steps,
      misconceptions,
      interpretation,
      verify: finalVerify,
    };
  }
}

export const comparativeStatics: SkillDefinition = {
  id: ID,
  title: 'Comparative statics',
  track: 'econ',
  unit: 'Production & utility',
  description: 'How an equilibrium moves when an outside parameter changes, and why the sign is what it is.',
  prerequisites: ['total-differential', 'cramers-rule'],
  maxDenominator: 12,
  levels: {
    1: {
      description: 'Demand shifter: dP*/dY (a normal or inferior good)',
      ranges: { a: [60, 200], b: [1, 6], c: [-6, 6], d: [0, 40], e: [1, 6] },
    },
    2: {
      description: 'Per-unit tax: who bears it',
      ranges: { a: [25, 300], b: [1, 6], d: [-160, 120], e: [1, 6], form: [0, 1] },
    },
    3: {
      description: 'A monopolist with a per-unit tax',
      ranges: { A: [6, 200], B: [1, 6], c: [2, 20], F: [0, 50], t0: [1, 4], form: [0, 1] },
    },
    4: {
      description: 'Keynesian multipliers with taxes',
      ranges: { a: [10, 200], bn: [1, 4], bd: [2, 5], I: [10, 100], G: [10, 100], T: [10, 100], form: [0, 2] },
    },
    5: {
      description: 'Two-country income model by Cramer\'s rule',
      ranges: {
        a1: [10, 100], a2: [10, 100], I1: [10, 100], I2: [10, 100], which: [0, 1],
        b1n: [1, 4], b1d: [2, 5], b2n: [1, 4], b2d: [2, 5],
        m1n: [1, 2], m1d: [3, 10], m2n: [1, 2], m2d: [3, 10],
      },
    },
  },
  misconceptions: {
    'sign-flipped': {
      name: 'Got the direction backwards',
      explanation: 'Check the sign against the economics: which curve moves, and which way? The magnitude can be right while the sign is wrong, and the sign is usually the point.',
    },
    'forgot-supply-response': {
      name: 'Left out the other curve\'s slope',
      explanation: 'The price change is absorbed along BOTH curves. The denominator is the sum of the demand and supply slopes ($b + e$), not just one of them. Dropping supply\'s response implies it is perfectly inelastic, so the whole shift lands on price.',
    },
    'seller-buyer-swapped': {
      name: 'Gave the other side\'s share',
      explanation: 'Buyers\' share is $e/(b+e)$ (the supply slope on top) and sellers\' share is $b/(b+e)$. The side with the smaller slope bears more.',
    },
    'monopoly-full-pass': {
      name: 'Passed the whole tax to the price',
      explanation: 'A monopolist facing linear demand passes through only half of a per-unit tax: $dP/dt = 1/2$. Full pass-through ($=1$) is a competitive result with constant marginal cost and flat supply.',
    },
    'forgot-mr-slope': {
      name: 'Used the demand slope instead of the marginal revenue slope',
      explanation: 'The monopolist equates MR and MC. With $P = A - Bq$, $MR = A - 2Bq$ has slope $2B$, so $dq/dt = -1/(2B)$, not $-1/B$.',
    },
    'multiplier-b': {
      name: 'Used 1/b as the multiplier',
      explanation: 'The multiplier is $1/(1 - b)$: the sum of the rounds $1 + b + b^2 + \\dots$. $1/b$ is the wrong way to count the leakage: the marginal propensity to save is $1 - b$.',
    },
    'tax-like-spending': {
      name: 'Treated a tax like spending',
      explanation: 'A tax cut works only through consumption: disposable income moves by 1, but only the fraction $b$ is spent. The tax multiplier is $-b/(1-b)$, smaller in size than $1/(1-b)$.',
    },
    'closed-economy': {
      name: 'Ignored the trade linkage',
      explanation: 'With trade, higher income in country 1 raises imports, which are country 2\'s exports, and country 2\'s response feeds back. Treating country 1 alone gives $1/(1 - b_1 + m_1)$ for its own income and 0 for country 2\'s, both wrong.',
    },
  },
  stepLabels: {
    differentiate: 'Totally differentiate the equilibrium conditions',
    sign: 'Predict the direction',
    'solve-d': 'Solve for the change',
    foc: 'Write the first-order condition',
    price: 'Pass through to the price',
    'det-d': 'Determinant of the system',
    'det-1': 'Replace the column and take the determinant',
  },
  learn: {
    whyItMatters:
      'Comparative statics answers every "what happens if" question in economic theory. Take demand $Q_d = 120 - 2P$ and supply $Q_s = 3(P - t) - 30$, where $t$ is a per-unit tax on sellers. Setting them equal gives $120 - 2P = 3P - 3t - 30$, so $5P = 150 + 3t$ and $P^* = 30 + \\tfrac35 t$. A \\$1 tax raises the price buyers pay by 60 cents, because supply responds more to price than demand does. Theory courses care less about the level than about the sign and size of an effect, and which assumption produces it.',
    summary:
      'Write the equilibrium conditions, differentiate them totally with the shifter\'s change set to 1, collect the changes in the endogenous variables on one side, and solve (by substitution, or Cramer\'s rule for two unknowns). Then read the sign and say which assumption produced it.',
    formulas: [
      { latex: '\\dfrac{dP^*}{dY} = \\dfrac{c}{b + e}', note: 'Demand $a - bP + cY$, supply $d + eP$: the sign is the sign of $c$.' },
      { latex: '\\dfrac{dP^*}{dt} = \\dfrac{e}{b + e}', note: 'Per-unit tax on sellers: the buyers\' share of the tax.' },
      { latex: '\\dfrac{dY}{dG} = \\dfrac{1}{1 - b}, \\quad \\dfrac{dY}{dT} = -\\dfrac{b}{1 - b}', note: 'Keynesian multipliers.' },
    ],
    example: { seed: 4, level: 2 },
    tips: [
      'Constants drop out when you differentiate; only slopes and the shifter survive.',
      'Always finish with the sign and the reason: which curve moved, and which slope decides the size.',
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
      default:
        return level5(rng);
    }
  },
};
