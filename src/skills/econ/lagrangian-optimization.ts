// Lagrangian optimization with one linear or product constraint. The solution is chosen first
// (integers), then prices / costs / the target are built backwards from it.
//   L1  max xy s.t. a budget line              -> (x*, y*)
//   L2  the same problem                       -> the multiplier lambda*
//   L3  min wL + rK s.t. LK = Q0^2             -> (L*, K*)
//   L4  envelope theorem: lambda times the change in the constraint (utility form / cost form)
//   L5  two-plant cost minimization            -> (q1, q2), with the bordered Hessian
// The Lagrangian is always written f + lambda (c - g), so lambda = d f* / d c. In expression
// strings the multiplier is `lam` (lambda is a Python keyword, so SymPy would choke on it).

import { choiceAnswer, expressionAnswer, numberAnswer, tupleAnswer } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { AnswerSpec, InterpretationQuestion, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';

const ID = 'lagrangian-optimization';

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
/** A coefficient in front of a letter: 1 is not written. */
const cl = (n: number) => (n === 1 ? '' : String(n));
const lamNote = ' (type the multiplier as `lam`)';

type Body = ReturnType<SkillDefinition['generate']>;

/** A choice step's options in a random order; the first label is the correct one. */
function shuffled(rng: Rng, labels: string[]) {
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: options.find((o) => o.label === labels[0])!.id };
}

/** The four candidate Lagrangians (the first is right). f and rest = c - g are LaTeX; the g - c form is unused (see below). */
function lagrangianLabels(f: string, rest: string, _back: string): string[] {
  return [
    `\\mathcal{L} = ${f} + \\lambda(${rest})`,
    // Not f + λ(g − c): that is a valid Lagrangian too (λ just comes out negative), so it can't
    // be a wrong option. Multiplying by the constraint without a multiplier is genuinely wrong.
    `\\mathcal{L} = ${f}\\,(${rest})`,
    `\\mathcal{L} = \\lambda(${rest})`,
    `\\mathcal{L} = \\lambda(${f}) + (${rest})`,
  ];
}

function lagrangianStep(rng: Rng, f: string, rest: string, back: string): Step {
  const labels = lagrangianLabels(f, rest, back);
  const { options, correct } = shuffled(rng, labels);
  return {
    key: 'lagrangian',
    instruction: 'Write the Lagrangian: the objective plus $\\lambda$ times (constraint constant minus constraint expression).',
    math: labels[0],
    why: 'Writing the constraint as $c - g(x, y) = 0$ makes $\\lambda$ the marginal value of relaxing it: $\\lambda = \\partial f^*/\\partial c$. Some books write $f - \\lambda(g - c)$, which is the same thing.',
    ask: { prompt: 'Which is the Lagrangian?', answer: choiceAnswer(options, correct) },
  };
}

function question(rng: Rng, prompt: string, labels: string[], explanation: string): InterpretationQuestion {
  const { options, correct } = shuffled(rng, labels);
  return { prompt, options, correct, explanation };
}

/** "What does lambda mean?" for the utility problem: utils per dollar. */
function utilityLambdaQuestion(rng: Rng, lam: number): InterpretationQuestion {
  return question(
    rng,
    `In the utility problem, $\\lambda^* = ${lam}$. What does it mean?`,
    [
      `One more dollar of income raises maximum utility by about ${lam} utils (utils per dollar).`,
      `The price of good $x$ is \\$${lam}.`,
      `The maximum utility at the optimum is ${lam} utils.`,
      `One more unit of good $x$ adds ${lam} utils.`,
    ],
    `$\\lambda = \\partial U^*/\\partial m$: the marginal utility of income, in utils per dollar. It is not a price, not the level of utility, and not the marginal utility of one good (that is $MU_x = \\lambda p_x$).`,
  );
}

/** "What does lambda mean?" for the cost problem: marginal cost, in dollars. */
function costLambdaQuestion(rng: Rng, lam: number, extra: string): InterpretationQuestion {
  return question(
    rng,
    `In the cost-minimization problem, $\\lambda^* = ${lam}$. What is it?`,
    [
      `The marginal cost of one more unit of output, about \\$${lam}.`,
      extra,
      `The total cost of producing the target output, \\$${lam}.`,
      `The price of one unit of the output, \\$${lam}.`,
    ],
    `Here $\\lambda = \\partial C^*/\\partial Q$: raising the output target by one unit raises minimum cost by about \\$${lam}. That is the marginal cost, in dollars per unit of output.`,
  );
}

export const lagrangianOptimization: SkillDefinition = {
  id: ID,
  title: 'Lagrangian optimization',
  track: 'econ',
  unit: 'Production & utility',
  description: 'Constrained optimization with a Lagrange multiplier: first-order conditions, the multiplier as a shadow price, and the envelope theorem.',
  prerequisites: ['utility-maximization', 'multivariable-optimization'],
  maxDenominator: 4,
  levels: {
    1: { description: 'Maximize xy on a budget line', ranges: { px: [1, 5], py: [1, 5], lam: [1, 6] } },
    2: { description: 'The same problem: find the multiplier', ranges: { px: [1, 5], py: [1, 5], lam: [1, 6] } },
    3: { description: 'Minimize cost on an isoquant LK = Q0²', ranges: { a: [1, 3], b: [1, 3], u: [1, 3], n: [1, 2] } },
    4: {
      description: 'Envelope theorem: how the optimum moves when the constraint loosens',
      ranges: { form: [0, 1], px: [0, 5], py: [0, 5], lam: [0, 6], a: [0, 3], b: [0, 3], u: [0, 3], n: [0, 2], d: [1, 10] },
    },
    5: { description: 'Allocate output across two plants', ranges: { c1: [1, 6], c2: [1, 6], t: [1, 5] } },
  },
  misconceptions: {
    'ignored-constraint': {
      name: 'Optimized without the constraint',
      explanation:
        'The constraint ties the variables together: the budget (or the output target) is shared. Treating each good as if it could use the whole budget, or picking inputs without hitting the output target, violates it. Use the first-order conditions *and* the constraint together.',
    },
    'lambda-reciprocal': {
      name: 'Inverted the multiplier',
      explanation:
        'The first-order condition is $MU_x = \\lambda p_x$, so $\\lambda = MU_x / p_x$: marginal utility per dollar. Price over marginal utility ($p_x / MU_x$) is its reciprocal, dollars per util. In a cost problem likewise, $\\lambda$ is dollars per unit of output, not its reciprocal.',
    },
    'lambda-total': {
      name: 'Used the approximation as the new total',
      explanation:
        'The envelope theorem gives the *change*: $\\Delta f^* \\approx \\lambda\\,\\Delta c$. Adding it to the old optimal value gives the new total, which is a different quantity. Report just $\\lambda\\,\\Delta c$ when asked for the change.',
    },
    'ratio-inverted': {
      name: 'Swapped the input ratio',
      explanation:
        'The conditions $w = \\lambda K$ and $r = \\lambda L$ give $L/K = r/w$: the firm uses *more* of the input whose price is *lower* relative to the other. If capital is pricier, $K$ is the smaller number. Check that the pricier input has the smaller quantity.',
    },
    'equal-allocation': {
      name: 'Gave both plants the same output',
      explanation:
        'Cost is minimized where the marginal costs are equal, $2c_1q_1 = 2c_2q_2$, not where the outputs are equal. Plants with different cost parameters have different marginal costs at the same output, so an equal split is not optimal.',
    },
    'allocation-inverted': {
      name: 'Gave more output to the costlier plant',
      explanation:
        'Equal marginal costs mean $c_1 q_1 = c_2 q_2$, so $q_i$ is proportional to $1/c_i$: the plant with the larger cost parameter makes *less*. Giving it more raises total cost.',
    },
  },
  stepLabels: {
    lagrangian: 'Write the Lagrangian',
    'foc-x': 'Differentiate with respect to the first variable',
    'foc-y': 'Differentiate with respect to the second variable',
    eliminate: 'Divide the conditions to eliminate lambda',
    constraint: 'Substitute into the constraint',
    multiplier: 'Solve a first-order condition for lambda',
    envelope: 'Multiply lambda by the change',
    soc: 'Check the bordered Hessian',
  },
  learn: {
    whyItMatters:
      'A consumer maximizes $U = xy$ with income \\$80 and prices \\$2 and \\$4. The Lagrangian $\\mathcal{L} = xy + \\lambda(80 - 2x - 4y)$ gives $y = 2\\lambda$ and $x = 4\\lambda$, so $x^* = 20$, $y^* = 10$, $\\lambda^* = 5$ and $U^* = 200$. With \\$81, utility rises to about 205: $\\lambda$ is the value of one more dollar, the shadow price of the budget. In a cost problem $\\lambda$ is marginal cost, which is why it appears in every pricing rule.',
    summary:
      'To optimize $f(x, y)$ subject to $g(x, y) = c$, write $\\mathcal{L} = f + \\lambda(c - g)$ and set $\\partial\\mathcal{L}/\\partial x = \\partial\\mathcal{L}/\\partial y = 0$. Dividing the two conditions eliminates $\\lambda$ and gives the tangency condition; substitute it into the constraint to finish. The multiplier $\\lambda^* = \\partial f^*/\\partial c$ says how fast the best value changes when the constraint loosens.',
    formulas: [
      { latex: '\\mathcal{L} = f(x,y) + \\lambda\\,(c - g(x,y))', note: 'The Lagrangian. Its $\\lambda$-partial just returns the constraint.' },
      { latex: '\\frac{f_x}{f_y} = \\frac{g_x}{g_y}', note: 'Divide the two first-order conditions: tangency.' },
      { latex: '\\Delta f^* \\approx \\lambda^*\\,\\Delta c', note: 'Envelope theorem: $\\lambda$ is the shadow price of the constraint.' },
    ],
    example: { seed: 3, level: 1 },
    tips: [
      'In a budget problem $\\lambda$ is in utils per dollar; in a cost problem it is dollars per unit of output.',
      'The first-order conditions come in a pair plus the constraint: three equations for $x$, $y$ and $\\lambda$.',
    ],
  },

  generate(rng, level): Body {
    const steps: Step[] = [];
    /** FOC step builder: `expr` is the Lagrangian as a mathjs string. */
    const foc = (v: string, lagr: string, vars: string[], value: string, latex: string, label: string): Step => ({
      key: label,
      instruction: `Differentiate the Lagrangian with respect to $${v}$ (treat the other variable and $\\lambda$ as constants).`,
      math: `\\frac{\\partial \\mathcal{L}}{\\partial ${v}} = ${latex} = 0`,
      why: 'At the constrained optimum every partial of the Lagrangian is zero.',
      ask: {
        prompt: `What is $\\partial\\mathcal{L}/\\partial ${v}$?${lamNote}`,
        answer: expressionAnswer(value, latex, vars),
        verify: { type: 'partial', expr: lagr, wrt: [v], variables: vars },
      },
    });

    // ================= levels 1, 2: maximize xy on a budget line =================
    if (level === 1 || level === 2) {
      let px = 0;
      let py = 0;
      let lam = 0;
      for (;;) {
        px = rng.int(1, 5);
        py = rng.int(1, 5);
        lam = rng.int(1, 6);
        if (px === py) continue;
        break;
      }
      const x = lam * py;
      const y = lam * px;
      const m = 2 * lam * px * py;
      const lagr = `x*y + lam*(${m} - ${px}*x - ${py}*y)`;
      const vars = ['x', 'y', 'lam'];
      const ratio = q(px, py);

      steps.push(
        lagrangianStep(rng, 'xy', `${m} - ${cl(px)}x - ${cl(py)}y`, `${cl(px)}x + ${cl(py)}y - ${m}`),
        foc(`x`, lagr, vars, `y - ${px}*lam`, `y - ${cl(px)}\\lambda`, 'foc-x'),
        foc(`y`, lagr, vars, `x - ${py}*lam`, `x - ${cl(py)}\\lambda`, 'foc-y'),
        {
          key: 'eliminate',
          instruction: 'Both conditions equal $\\lambda$ once you solve them: $y = ' + `${cl(px)}\\lambda` + '$ and $x = ' + `${cl(py)}\\lambda` + '$. Divide to remove $\\lambda$, then write $y$ in terms of $x$.',
          math: `\\frac{y}{x} = \\frac{${px}}{${py}} \\;\\Rightarrow\\; y = ${ratio.toLatex()}\\,x`,
          why: 'The ratio of marginal utilities equals the price ratio: the tangency condition.',
          ask: {
            prompt: 'Write $y$ in terms of $x$.',
            answer: expressionAnswer(`${ratio.toExpr()}*x`, `${ratio.toLatex()}\\,x`, ['x', 'y']),
            verify: { type: 'equivalent', expr: `${px}*x/${py}`, variables: ['x', 'y'] },
          },
        },
      );
      const point: AnswerSpec = tupleAnswer(['x', 'y'], [x, y]);
      const pointStep: Step = {
        key: 'constraint',
        instruction: `Substitute $y = ${ratio.toLatex()}\\,x$ into the budget $${cl(px)}x + ${cl(py)}y = ${m}$ and solve.`,
        math: `${cl(px)}x + ${cl(py)}\\left(${ratio.toLatex()}\\,x\\right) = ${m} \\;\\Rightarrow\\; (x^*, y^*) = (${x},\\; ${y})`,
        why: 'The optimum must lie on the constraint as well as satisfy the tangency condition.',
        ask: {
          prompt: 'Find $(x^*, y^*)$.',
          answer: point,
          verify: { type: 'solve', equations: [`${py}*y = ${px}*x`, `${px}*x + ${py}*y = ${m}`], unknowns: ['x', 'y'] },
        },
      };
      const prompt = `A consumer maximizes $U = xy$ subject to the budget $${cl(px)}x + ${cl(py)}y = ${m}$.`;

      if (level === 1) {
        steps.push(pointStep);
        const wrong: AnswerSpec = tupleAnswer(['x', 'y'], [q(m, px), q(m, py)]);
        const cands: MisconceptionInstance[] = [{ id: 'ignored-constraint', wrong }];
        return {
          params: { px, py, lam },
          prompt: `${prompt} Find the utility-maximizing bundle $(x, y)$.`,
          answer: point,
          steps,
          misconceptions: distinctMisconceptions(point, cands),
          verify: { type: 'solve', equations: [`${py}*y = ${px}*x`, `${px}*x + ${py}*y = ${m}`], unknowns: ['x', 'y'] },
          working: { solutions: [{ x: String(x), y: String(y) }] },
        };
      }

      // level 2
      steps.push(pointStep);
      const answer = numberAnswer(lam);
      steps.push({
        key: 'multiplier',
        instruction: `Put $x^* = ${x}$, $y^* = ${y}$ into $y = ${cl(px)}\\lambda$ (or $x = ${cl(py)}\\lambda$) and solve for $\\lambda$.`,
        math: `${y} = ${cl(px)}\\lambda \\;\\Rightarrow\\; \\lambda^* = ${lam}`,
        why: '$\\lambda$ is marginal utility per dollar: $MU_x/p_x = y/p_x$, the same for both goods at the optimum.',
        ask: {
          prompt: 'What is $\\lambda^*$?',
          answer,
          verify: { type: 'solve', equations: [`${y} = lam*${px}`, `${x} = lam*${py}`], unknowns: ['lam'] },
        },
      });
      const cands: MisconceptionInstance[] = [{ id: 'lambda-reciprocal', wrong: numberAnswer(q(px, y)) }];
      const base: Body = {
        params: { px, py, lam },
        prompt: `${prompt} Find the multiplier $\\lambda^*$ at the optimum.`,
        answer,
        steps,
        misconceptions: distinctMisconceptions(answer, cands),
        verify: { type: 'solve', equations: [`${y} = lam*${px}`, `${x} = lam*${py}`], unknowns: ['lam'] },
      };
      // Interpretation randomness is drawn last.
      if (rng.chance(0.5)) return { ...base, interpretation: [utilityLambdaQuestion(rng, lam)] };
      return base;
    }

    // ================= pieces for the cost-minimization problems (L3, L4 form 1) =================
    const costInputs = () => {
      for (;;) {
        const a = rng.int(1, 3);
        const b = rng.int(1, 3);
        if (a === b || gcd(a, b) !== 1) continue;
        return { a, b, u: rng.int(1, 3), n: rng.int(1, 2) };
      }
    };

    // ================= level 3: min wL + rK s.t. LK = Q0^2 =================
    if (level === 3) {
      const { a, b, u, n } = costInputs();
      const w = b * b * u;
      const r = a * a * u;
      const Lv = n * a * a;
      const Kv = n * b * b;
      const Q0 = n * a * b;
      const Q2 = Q0 * Q0;
      const lagr = `${w}*L + ${r}*K + lam*(${Q2} - L*K)`;
      const vars = ['L', 'K', 'lam'];
      const ratio = q(r, w);

      steps.push(
        lagrangianStep(rng, `${w}L + ${r}K`, `${Q2} - LK`, `LK - ${Q2}`),
        foc('L', lagr, vars, `${w} - lam*K`, `${w} - \\lambda K`, 'foc-x'),
        foc('K', lagr, vars, `${r} - lam*L`, `${r} - \\lambda L`, 'foc-y'),
        {
          key: 'eliminate',
          instruction: 'The conditions say $w = \\lambda K$ and $r = \\lambda L$. Divide them to remove $\\lambda$ and write $L$ in terms of $K$.',
          math: `\\frac{w}{r} = \\frac{K}{L} \\;\\Rightarrow\\; L = \\frac{r}{w}K = ${ratio.toLatex()}\\,K`,
          why: 'The marginal rate of technical substitution equals the input price ratio: cost is minimized at tangency with the isoquant.',
          ask: {
            prompt: 'Write $L$ in terms of $K$.',
            answer: expressionAnswer(`${ratio.toExpr()}*K`, `${ratio.toLatex()}\\,K`, ['L', 'K']),
            verify: { type: 'equivalent', expr: `${r}*K/${w}`, variables: ['L', 'K'] },
          },
        },
      );
      const answer = tupleAnswer(['L', 'K'], [Lv, Kv]);
      const verify = { type: 'solve' as const, equations: [`${w}*L = ${r}*K`, `L*K = ${Q2}`], unknowns: ['L', 'K'], positive: true };
      steps.push({
        key: 'constraint',
        instruction: `Substitute $L = ${ratio.toLatex()}\\,K$ into $LK = ${Q2}$ and solve for the positive $K$, then $L$.`,
        math: `${ratio.toLatex()}\\,K^2 = ${Q2} \\;\\Rightarrow\\; (L^*, K^*) = (${Lv},\\; ${Kv})`,
        why: 'The output target $Q = \\sqrt{LK} = Q_0$ means $LK = Q_0^2$.',
        ask: { prompt: 'Find $(L^*, K^*)$.', answer, verify },
      });
      const cands: MisconceptionInstance[] = [
        { id: 'ratio-inverted', wrong: tupleAnswer(['L', 'K'], [Kv, Lv]) },
        { id: 'ignored-constraint', wrong: tupleAnswer(['L', 'K'], [Q0, Q0]) },
      ];
      return {
        params: { a, b, u, n },
        prompt: `A firm's output is $Q = \\sqrt{LK}$. Labor costs \\$${w} per unit and capital \\$${r} per unit. Find the cost-minimizing inputs $(L, K)$ for producing ${Q0} units.`,
        answer,
        steps,
        misconceptions: distinctMisconceptions(answer, cands),
        verify,
        working: { solutions: [{ L: String(Lv), K: String(Kv) }] },
      };
    }

    // ================= level 4: the envelope theorem =================
    if (level === 4) {
      const form = rng.int(0, 1);
      const d = rng.pick([1, 2, 5, 10]);
      if (form === 0) {
        let px = 0;
        let py = 0;
        let lam = 0;
        for (;;) {
          px = rng.int(1, 5);
          py = rng.int(1, 5);
          lam = rng.int(1, 6);
          if (px !== py) break;
        }
        const x = lam * py;
        const y = lam * px;
        const m = 2 * lam * px * py;
        const Ustar = x * y;
        const answer = numberAnswer(lam * d);
        steps.push(
          {
            key: 'multiplier',
            instruction: `Use $\\partial\\mathcal{L}/\\partial x = y - ${cl(px)}\\lambda = 0$ at $y^* = ${y}$ to find $\\lambda^*$.`,
            math: `${y} = ${cl(px)}\\lambda \\;\\Rightarrow\\; \\lambda^* = ${lam}`,
            why: '$\\lambda$ is marginal utility per dollar: $MU_x / p_x$.',
            ask: {
              prompt: 'What is $\\lambda^*$?',
              answer: numberAnswer(lam),
              verify: { type: 'solve', equations: [`${y} = lam*${px}`, `${x} = lam*${py}`], unknowns: ['lam'] },
            },
          },
          {
            key: 'envelope',
            instruction: `Multiply $\\lambda^*$ by the change in income, $\\Delta m = ${d}$.`,
            math: `\\Delta U^* \\approx \\lambda^*\\,\\Delta m = ${lam} \\cdot ${d} = ${lam * d}`,
            why: 'Envelope theorem: the optimal value changes at rate $\\lambda$ as the constraint constant moves.',
            ask: {
              prompt: 'By about how much does maximum utility rise?',
              answer,
              verify: { type: 'evaluate', expr: `(${y}/${px})*${d}` },
            },
          },
        );
        const cands: MisconceptionInstance[] = [
          { id: 'lambda-reciprocal', wrong: numberAnswer(q(px * d, y)) },
          { id: 'lambda-total', wrong: numberAnswer(Ustar + lam * d) },
        ];
        const base: Body = {
          params: { form, px, py, lam, a: 0, b: 0, u: 0, n: 0, d },
          prompt: `A consumer maximizes $U = xy$ subject to $${cl(px)}x + ${cl(py)}y = ${m}$. At the optimum she buys $(x^*, y^*) = (${x}, ${y})$ and $U^* = ${Ustar}$. Use the multiplier to estimate how much maximum utility rises if income increases by \\$${d}.`,
          answer,
          steps,
          misconceptions: distinctMisconceptions(answer, cands),
          verify: { type: 'evaluate', expr: `(${y}/${px})*${d}` },
        };
        if (rng.chance(0.5)) return { ...base, interpretation: [utilityLambdaQuestion(rng, lam)] };
        return base;
      }

      const { a, b, u, n } = costInputs();
      const w = b * b * u;
      const r = a * a * u;
      const Lv = n * a * a;
      const Kv = n * b * b;
      const Q0 = n * a * b;
      const Cstar = w * Lv + r * Kv;
      const lam = 2 * a * b * u;
      const answer = numberAnswer(lam * d);
      const half = q(b, 2 * a);
      steps.push(
        {
          key: 'multiplier',
          instruction: `With the output constraint $Q - \\sqrt{LK} = 0$, the condition for $L$ is $w = \\lambda \\cdot \\tfrac12\\sqrt{K/L}$. Put in $w = ${w}$, $L^* = ${Lv}$, $K^* = ${Kv}$ and solve for $\\lambda^*$.`,
          math: `${w} = \\lambda\\cdot\\tfrac12\\sqrt{\\tfrac{${Kv}}{${Lv}}} = ${half.toLatex()}\\,\\lambda \\;\\Rightarrow\\; \\lambda^* = ${lam}`,
          why: '$\\lambda$ is the marginal cost of output: the extra cost of one more unit.',
          ask: {
            prompt: 'What is $\\lambda^*$?',
            answer: numberAnswer(lam),
            verify: { type: 'solve', equations: [`${w} = lam*(1/2)*sqrt(${Kv})/sqrt(${Lv})`], unknowns: ['lam'] },
          },
        },
        {
          key: 'envelope',
          instruction: `Multiply $\\lambda^*$ by the change in the output target, $\\Delta Q = ${d}$.`,
          math: `\\Delta C^* \\approx \\lambda^*\\,\\Delta Q = ${lam} \\cdot ${d} = ${lam * d}`,
          why: 'Envelope theorem: minimum cost changes at rate $\\lambda$ as the output target moves.',
          ask: {
            prompt: 'By about how much does minimum cost rise?',
            answer,
            verify: { type: 'evaluate', expr: `2*${w}*sqrt(${Lv})/sqrt(${Kv})*${d}` },
          },
        },
      );
      const cands: MisconceptionInstance[] = [
        { id: 'lambda-reciprocal', wrong: numberAnswer(q(d, lam)) },
        { id: 'lambda-total', wrong: numberAnswer(Cstar + lam * d) },
      ];
      const base: Body = {
        params: { form, px: 0, py: 0, lam: 0, a, b, u, n, d },
        prompt: `A firm with output $Q = \\sqrt{LK}$ pays \\$${w} per unit of labor and \\$${r} per unit of capital. To produce $Q = ${Q0}$ at least cost it uses $(L^*, K^*) = (${Lv}, ${Kv})$, at a cost of \\$${Cstar}. Using the Lagrangian with the output constraint, estimate how much minimum cost rises if the output target increases by ${d} unit${d === 1 ? '' : 's'}.`,
        answer,
        steps,
        misconceptions: distinctMisconceptions(answer, cands),
        verify: { type: 'evaluate', expr: `2*${w}*sqrt(${Lv})/sqrt(${Kv})*${d}` },
      };
      // Interpretation randomness is drawn last.
      if (rng.chance(0.5)) {
        return { ...base, interpretation: [costLambdaQuestion(rng, lam, `The price of one unit of labor, \\$${lam}.`)] };
      }
      return base;
    }

    // ================= level 5: two plants, min c1 q1^2 + c2 q2^2 s.t. q1 + q2 = Q =================
    let c1 = 0;
    let c2 = 0;
    for (;;) {
      c1 = rng.int(1, 6);
      c2 = rng.int(1, 6);
      if (c1 !== c2) break;
    }
    const t = rng.int(1, 5);
    const g = gcd(c1, c2);
    const q1 = (t * c2) / g;
    const q2 = (t * c1) / g;
    const Qt = q1 + q2;
    const lamv = 2 * c1 * q1;
    const lagr = `${c1}*x^2 + ${c2}*y^2 + lam*(${Qt} - x - y)`;
    const vars = ['x', 'y', 'lam'];
    const ratio = q(c1, c2);
    const hb = 2 * (c1 + c2);
    const socLabels = [
      'A minimum: the bordered Hessian determinant is negative (cost curves upward along the constraint)',
      'A maximum: the bordered Hessian determinant is negative',
      'A maximum: the bordered Hessian determinant is positive',
      'A minimum: the bordered Hessian determinant is positive',
    ];
    const soc = shuffled(rng, socLabels);

    steps.push(
      lagrangianStep(rng, `${cl(c1)}x^2 + ${cl(c2)}y^2`, `${Qt} - x - y`, `x + y - ${Qt}`),
      foc('x', lagr, vars, `${2 * c1}*x - lam`, `${2 * c1}x - \\lambda`, 'foc-x'),
      foc('y', lagr, vars, `${2 * c2}*y - lam`, `${2 * c2}y - \\lambda`, 'foc-y'),
      {
        key: 'eliminate',
        instruction: 'Both conditions give $\\lambda$ (marginal cost). Set them equal and write $y$ in terms of $x$.',
        math: `${2 * c1}x = ${2 * c2}y \\;\\Rightarrow\\; y = ${ratio.toLatex()}\\,x`,
        why: 'Cost is minimized when the two plants have equal marginal cost.',
        ask: {
          prompt: 'Write $y$ in terms of $x$ (here $x = q_1$, $y = q_2$).',
          answer: expressionAnswer(`${ratio.toExpr()}*x`, `${ratio.toLatex()}\\,x`, ['x', 'y']),
          verify: { type: 'equivalent', expr: `${c1}*x/${c2}`, variables: ['x', 'y'] },
        },
      },
      {
        key: 'soc',
        instruction: 'Check the second-order condition with the bordered Hessian (the Hessian of $\\mathcal{L}$ bordered by the constraint gradient).',
        math: `|\\bar H| = \\begin{vmatrix} 0 & 1 & 1 \\\\ 1 & ${2 * c1} & 0 \\\\ 1 & 0 & ${2 * c2} \\end{vmatrix} = -${hb} < 0`,
        why: 'With two variables and one constraint, a negative bordered determinant means a constrained minimum, a positive one a maximum.',
        ask: { prompt: 'What does the bordered Hessian tell you?', answer: choiceAnswer(soc.options, soc.correct) },
      },
    );
    const answer = tupleAnswer(['q₁', 'q₂'], [q1, q2], ['q_1', 'q_2']);
    const verify = { type: 'solve' as const, equations: [`${c1}*x = ${c2}*y`, `x + y = ${Qt}`], unknowns: ['x', 'y'] };
    steps.push({
      key: 'constraint',
      instruction: `Substitute $y = ${ratio.toLatex()}\\,x$ into $x + y = ${Qt}$ and solve.`,
      math: `x + ${ratio.toLatex()}\\,x = ${Qt} \\;\\Rightarrow\\; (q_1^*, q_2^*) = (${q1},\\; ${q2})`,
      why: 'The two plants must together make exactly the required output.',
      ask: { prompt: 'Find $(q_1^*, q_2^*)$, i.e. $(x, y)$.', answer, verify },
    });
    const half = q(Qt, 2);
    const cands: MisconceptionInstance[] = [
      { id: 'equal-allocation', wrong: tupleAnswer(['q₁', 'q₂'], [half, half], ['q_1', 'q_2']) },
      { id: 'allocation-inverted', wrong: tupleAnswer(['q₁', 'q₂'], [q(Qt * c1, c1 + c2), q(Qt * c2, c1 + c2)], ['q_1', 'q_2']) },
    ];
    const base: Body = {
      params: { c1, c2, t },
      prompt: `A firm must produce ${Qt} units in two plants. Plant 1's cost is $C_1 = ${cl(c1)}q_1^2$ and plant 2's is $C_2 = ${cl(c2)}q_2^2$ (in dollars). Writing $x = q_1$ and $y = q_2$, minimize $${cl(c1)}x^2 + ${cl(c2)}y^2$ subject to $x + y = ${Qt}$. Find the cost-minimizing outputs.`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, cands),
      verify,
      working: { solutions: [{ x: String(q1), y: String(q2) }] },
    };
    // Interpretation randomness is drawn last.
    if (rng.chance(0.5)) {
      const cheaper = c1 < c2 ? 1 : 2;
      return {
        ...base,
        interpretation: [
          costLambdaQuestion(rng, lamv, 'The average cost per unit of output.'),
          question(
            rng,
            `Why does plant ${cheaper}, the cheaper plant, produce more output?`,
            [
              "Cost is minimized where marginal costs are equal, and the cheaper plant's marginal cost rises more slowly.",
              'Total cost must be equal across the plants, which needs more output from the cheaper one.',
              'The constraint forces the larger share onto the plant with the lower cost parameter.',
              "The costlier plant's marginal cost is zero at first, so it is used last.",
            ],
            'The first-order conditions set $2c_1q_1 = 2c_2q_2 = \\lambda$. A plant with a smaller $c$ has marginal cost that climbs more slowly, so it reaches the common marginal cost at a larger output.',
          ),
        ],
      };
    }
    return base;
  },
};

