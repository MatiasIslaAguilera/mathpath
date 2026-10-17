# Batch E skill specs: exponents, logarithms, functions

These six skills cover the learner's weakest areas (functions, exponentials and logarithms).
They also sit on the critical path to derivatives, growth rates and log-regression
interpretation.

**Rules for every skill:** follow `CLAUDE.md` → "Adding a skill". Copy the structure of the
reference skills:
- `src/skills/math/linear-equations.ts`: number answers
- `src/skills/math/derivatives-power-rule.ts`: expression answers, interpretation questions
- `src/skills/econ/supply-demand-equilibrium.ts`: tuple and choice answers

Requirements that apply to all of them:
- The id, track and prerequisites must match `src/skills/tree.ts` exactly.
- Choose parameters **backwards from a clean answer**.
- Every misconception listed must be reachable at some level and computed from the params.
- Every step key needs a `stepLabels` entry.

**Avoid form problems:** prefer **number answers** (a missing exponent, a value, the argument
of a log) over "simplify this expression". The checker accepts any equivalent expression, so
it can't tell a simplified answer from the unsimplified original.

**Multiple-choice final answers** (domain and range):
- Use `verify: { type: 'choice', note }`.
- Add `tests/skills/<id>.test.ts`, which re-derives the correct option from the raw params.

---

## 1. `exponent-rules`: Exponent rules
Track math. Prerequisites `['linear-equations']`. `maxDenominator: 1024`.

**Levels** (each level mixes 2–3 prompt types, chosen with `rng.pick`):
1. **Same base.**
   - Prompts: $x^a \cdot x^b = x^{?}$ and $\frac{x^a}{x^b} = x^{?}$, with a, b in [2, 9].
     For quotients, a > b at this level.
   - Answer: the exponent (a number).
2. **Power of a power, and a coefficient.**
   - $(x^a)^b = x^{?}$
   - $(c\,x^a)^b = k\,x^{e}$: tuple `['Coefficient', 'Exponent']`, with c in [2, 5],
     b in [2, 3], and $k = c^b$.
3. **Zero and negative exponents.** Evaluate:
   - $b^0$
   - $b^{-k}$ = 1/b^k, with b in [2, 5] and k in [1, 3]
   - $\left(\frac{p}{q}\right)^{-k}$ = (q/p)^k, with p, q in [2, 5], p ≠ q, k in [1, 2]
   - Answers are exact fractions.
4. **Fractional exponents.** Evaluate $b^{m/n}$:
   - Choose $b = r^n$ with r in [2, 5] and n in [2, 3], so the answer $r^m$ is an integer.
   - m in [1, 3], sometimes negative (then the answer is 1/r^|m|).
   - Examples: $8^{2/3} = 4$, $27^{-1/3} = \tfrac13$.
5. **Combined.**
   - $\frac{(x^a y^b)^c}{x^d y^e} = x^{?}\,y^{?}$: tuple `['Exponent of x', 'Exponent of y']`.
   - Ranges: a, b in [1, 4]; c in [2, 3]; d, e in [1, 9]. Results may be negative or 0.

**Steps.** Keys and labels:
- `product`: "Add exponents (same base, multiplying)"
- `quotient`: "Subtract exponents (dividing)"
- `power`: "Multiply exponents (power of a power)"
- `coefficient`: "Raise the coefficient too"
- `negative`: "Negative exponent means reciprocal"
- `zero`: "Anything (nonzero) to the 0 is 1"
- `root`: "Take the root (denominator)"
- `raise`: "Raise to the power (numerator)"
- `combine`: "Combine and state the answer"

**Verification.** Every number ask uses `evaluate`. Express the claim in exponent arithmetic
from the raw params, e.g. `{ type: 'evaluate', expr: '(a)+(b)' }`. For L3 and L4, verify the
final value with `evaluate` of the original power written in mathjs/SymPy syntax, e.g.
`8^(2/3)`. SymPy evaluates rational powers of perfect powers exactly.

**Misconceptions:**
- `multiply-for-product`: "Multiplied the exponents instead of adding" ($x^3x^4 = x^{12}$)
- `add-for-power`: "Added the exponents instead of multiplying" ($(x^3)^4 = x^7$)
- `divide-for-quotient`: "Divided the exponents instead of subtracting"
- `coefficient-not-raised`: "Forgot to raise the coefficient" ($(2x^3)^2 = 2x^6$). The wrong
  tuple is `[c, a·b]`.
- `negative-means-negative`: "Read a negative exponent as a negative number"
  ($2^{-3} = -8$ or $-\tfrac18$). Use both candidates.
- `zero-power-is-zero`: "Thought $b^0 = 0$"
- `fraction-exponent-multiplied`: "Multiplied the base by the fractional exponent"
  ($8^{2/3} = \tfrac{16}{3}$)
- `root-power-swapped`: "Swapped root and power" ($b^{m/n}$ read as $\sqrt[m]{b^n}$). Use
  this only when that gives a different, well-defined number. Skip it if the result isn't
  rational; use `wrongNumber`, which returns null on errors, and also guard non-integer
  results yourself.

**whyItMatters** (with a checked example): growth compounds by multiplying factors. Two years
at 5% is $1.05 \cdot 1.05 = 1.05^2$, and $(1.05^{2})^{3} = 1.05^{6}$ is six years. Exponent
rules are what you use to simplify Cobb-Douglas functions like $K^{0.3}L^{0.7}$.

---

## 2. `logarithm-rules`: Logarithm rules
Track math. Prerequisites `['exponent-rules', 'inverse-functions']`. `maxDenominator: 1`.

**Levels:**
1. **Evaluate $\log_b(b^k)$.**
   - b in {2, 3, 5, 10}, k in [−3, 6].
   - Show the argument as a number (e.g. $\log_2 32$, $\log_3 \tfrac19$).
   - Answer k.
2. **Natural log and special values.** $\ln(e^k)$, $e^{\ln k}$, $\log_b 1$, $\log_b b$.
   Answer a number.
3. **Product and quotient rules.**
   - $\log_b A + \log_b B$ or $\log_b A - \log_b B$, where A·B (or A/B) is $b^k$ but A and B
     individually are not powers of b.
   - Example: $\log_2 24 - \log_2 3 = 3$.
   - Answer k.
4. **Condense to a single log.**
   - $p\log_b A + \log_b B - \log_b C = \log_b(?)$
   - Ask for the argument N = A^p·B/C (an integer by construction: build N first, then pick
     A, B, C).
   - p in [2, 3]. A, B, C small integers.
5. **Change of base / approximate.**
   - Given $\ln 2 \approx 0.693$ and $\ln 3 \approx 1.099$, compute $\ln(2^a 3^b)$ for
     a, b in [0, 3], not both 0. The answer is the exact expression `a*log(2)+b*log(3)`, so
     set `irrationalAnswers: true`; the learner types a decimal to 2+ places.
   - Or compute $\log_2 3$ etc. via $\frac{\ln 3}{\ln 2}$.

**Steps.** Keys and labels:
- `rewrite-power`: "Write the number as a power of the base"
- `inverse`: "log and exponent undo each other"
- `product-rule`: "log(A)+log(B) = log(AB)"
- `quotient-rule`: "log(A)−log(B) = log(A/B)"
- `power-rule`: "p·log(A) = log(A^p)"
- `change-base`: "Change of base"
- `evaluate`: "Evaluate"

**Verification.** `evaluate` with the expression in SymPy/mathjs syntax. Use `log(x)/log(b)`
for $\log_b x$; don't use a two-argument log, because mathjs `log(x, b)` and SymPy disagree on
argument order. Writing `log(x)/log(b)` explicitly avoids that.

**Misconceptions:**
- `log-of-sum`: "Treated log(A + B) as log A + log B". In L4 the condensed argument becomes
  `p·A + B − C` instead of `A^p·B/C`. In L3, someone computes log(A+B).
- `log-division-confusion`: "Treated log A − log B as log A / log B". The wrong value is the
  ratio of logs; it may be irrational, so use `irrationalAnswers` guards.
- `power-rule-misplaced`: "Multiplied the argument by p instead of raising it to p"
  (the argument becomes p·A·B/C).
- `negative-k-sign`: "Lost the sign for a fraction argument" ($\log_3 \tfrac19 = 2$)
- `ln-e-confusion`: "Thought $\ln(e^k) = e^k$"

**whyItMatters:** logs turn multiplication into addition and percentage growth into slopes.
In econometrics, $\ln(\text{wage})$ rising by 0.05 means wages rose about 5%. A log-log
regression coefficient is an elasticity.

---

## 3. `exp-log-equations`: Exponential & log equations
Track math. Prerequisites `['logarithm-rules']`. `maxDenominator: 6`. `irrationalAnswers: true`
(L4 only).

**Levels:**
1. **$b^{x + c} = b^k$**, with the right side shown as a number (e.g. $3^{x+1} = 81$).
   Answer k − c.
2. **Common base.**
   - $a^{x} = c$, where a and c are powers of the same base r: $a = r^p$, $c = r^q$, with
     r in {2, 3}, p in [2, 3], q in [1, 6].
   - Answer q/p (a fraction). Example: $4^x = 8 \Rightarrow x = \tfrac32$.
3. **Log equations.**
   - $\log_b(mx + n) = k$, so $x = (b^k - n)/m$.
   - Choose x, m, n so mx + n = b^k > 0.
   - Integer answers.
4. **Natural exp.**
   - $A e^{kx} = B$, so $x = \ln(B/A)/k$.
   - The answer value is exact: `log(B/A)/k`, with B/A > 0 and not 1.
   - The prompt says "Round to 2 decimal places".
5. **Two logs, with an extraneous root.**
   - $\log_b x + \log_b(x - d) = k$, so x² − dx − b^k = 0.
   - Construct it from a positive root r > d: pick r and d, then require r(r − d) = b^k by
     choosing from small b, k combos. Simplest: pick b in {2, 3}, k in [2, 4], factor b^k as
     r(r − d) with an integer d > 0, and reject combos without one.
   - The other root, −(b^k)/r, is negative, so it must be rejected.
   - Answer r. Include a step that checks the domain (choice ask: "Which root is valid?").

**Steps.** Keys and labels:
- `same-base`: "Rewrite both sides with the same base"
- `equate-exponents`: "Set the exponents equal"
- `exponential-form`: "Rewrite the log as an exponent"
- `isolate`: "Isolate the exponential"
- `take-log`: "Take ln of both sides"
- `solve`: "Solve for x"
- `combine-logs`: "Combine the logs"
- `quadratic`: "Solve the quadratic"
- `check-domain`: "Check the domain (log arguments > 0)"

**Verification.** `solve` with the original equation: `log(x)/log(2) + log(x - 3)/log(2) = 2`.
SymPy must return exactly the valid root. The harness substitutes, so for L5 also verify the
`quadratic` step's roots via `evaluate`, or keep that step as a choice ask.

Note: SymPy's `solve` on log equations can return extra or complex roots. If the L5
cross-check disagrees, don't change the problem to make it pass. Report the exact disagreement;
the reviewer will decide whether it's a SymPy artifact or a real bug.

**Misconceptions:**
- `divide-not-log`: "Divided the numbers instead of matching exponents" ($4^x = 8 \Rightarrow x = 2$)
- `log-times`: "Multiplied base and exponent" ($\log_2 x = 5 \Rightarrow x = 10$)
- `log-power-swapped`: "Swapped base and exponent" ($\log_2 x = 5 \Rightarrow x = 25$)
- `ln-subtract`: "Subtracted instead of dividing after taking logs"
  ($e^{2x} = 5 \Rightarrow x = \ln 5 - 2$)
- `kept-extraneous`: "Kept a root that makes a log argument negative" (L5 negative root)

**whyItMatters:** how long until something doubles or halves? Solving $1.07^t = 2$ gives
$t = \ln 2/\ln 1.07 \approx 10.2$ years: money at 7% doubles in about a decade. Continuous-time
growth models in macro theory use $e^{gt}$.

---

## 4. `growth-decay`: Growth & decay
Track math (economics flavored). Prerequisites `['exp-log-equations']`. `maxDenominator: 100`
(cents). `irrationalAnswers: true`.

**Levels** (always state units: dollars, years, percent):
1. **Compound annually.**
   - $A = P(1 + r)^t$, with P in {100, 200, 500, 1000, 2000}, r in {2, 4, 5, 10, 20}%,
     t in [1, 3].
   - Compute A exactly with Q arithmetic and **reject** draws where A isn't a whole number of
     cents (denominator > 100). For example, $1000 \cdot 1.02^3 = 1061.208$ is rejected.
   - Answer in dollars.
2. **Decay / depreciation.** $A = P(1 - r)^t$, same constraints.
3. **Continuous.**
   - $A = Pe^{rt}$. Exact answer `P*exp(r*t)`, irrational.
   - The prompt says "Round to the nearest cent".
4. **Solve for time.**
   - Find t with $P(1+r)^t = kP$, k in {2, 3}. The exact answer is `log(k)/log(1+r)`.
   - Round to 2 decimals.
   - Include an interpretation question comparing with the rule of 70.
5. **Solve for the rate.**
   - $P(1 + r)^t = A$, choosing A so $(A/P)^{1/t}$ is rational: A/P in {1.21, 1.44, 1.1025,
     1.331} with t matching (2, 2, 2, 3).
   - Answer the percent rate (10, 20, 5, 10).

**Steps.** Keys and labels:
- `growth-factor`: "Find the growth factor (1 + r)"
- `raise`: "Raise to the number of periods"
- `multiply`: "Multiply by the starting amount"
- `continuous`: "Use e^(rt) for continuous growth"
- `divide`: "Divide both sides by P"
- `take-log`: "Take logs"
- `solve`: "Solve"
- `root`: "Take the t-th root"
- `to-percent`: "Convert to a percent"

**Misconceptions:**
- `simple-interest`: "Used simple interest" (P(1 + rt))
- `percent-not-decimal`: "Used r = 5 instead of 0.05". The wrong value is huge; only include
  it if it's finite and within ±1e12.
- `decay-plus`: "Added the rate for a decay" (P(1 + r)^t in L2)
- `rule-of-70-exact`: "Used 70/r as if it were exact" (L4: the answer 70/(100r) when it
  differs from the exact one at 2 decimals)
- `rate-not-subtract-one`: "Forgot to subtract 1 from the growth factor" (L5: answer
  (A/P)^{1/t} × 100)

**Interpretation** (choice, generated from params):
- L1/L2: "Over the t years, the total gain is $X$. Why is it more than t × (r × P)?"
  → "Interest earns interest (compounding)".
- L4: rule of 70 estimate vs exact: "Which is closer to the exact answer?" Or:
  "If the rate doubled, the doubling time would roughly…" → "halve".

**whyItMatters:** GDP, prices and investments grow by percentages, so they grow
exponentially. At 3% a year an economy doubles in about $70/3 \approx 23$ years. Discounting
and present value (an econ skill coming later) run the same formula backwards.

---

## 5. `functions-basics`: Functions: domain & range
Track math. Prerequisites `['linear-equations']`. `maxDenominator: 1`. Has choice answers →
needs `tests/skills/functions-basics.test.ts`.

**Levels:**
1. **Evaluate a linear or quadratic f at an integer.**
   - $f(x) = ax^2 + bx + c$ at x0 in [−4, 4], including negatives.
   - Number answer.
2. **Evaluate with care.**
   - $f(x) = -x^2 + bx$ at a negative x0, or a two-piece piecewise function:
     $f(x) = \begin{cases} \dots & x < k \\ \dots & x \ge k \end{cases}$ at x0 near k.
   - Number answer.
3. **Domain of $\sqrt{x - a}$ or $\frac{1}{x - a}$** (also $\sqrt{a - x}$).
   - Choice among 4 options, e.g. "$x \ge 3$", "$x > 3$", "$x \le 3$", "all real numbers";
     for 1/(x−a): "$x \ne 3$".
   - Options are generated from a.
4. **Range of $a(x - h)^2 + k$.**
   - Choice: "$y \ge k$", "$y \le k$", "$y \ge h$", "all real numbers". The sign of a decides
     the answer.
5. **Domain of a combination.**
   - $\frac{\sqrt{x - a}}{x - b}$ with b > a: "$x \ge a,\ x \ne b$".
   - Or $\ln(x - a)$: "$x > a$".
   - Choice.

**Steps.** Keys and labels:
- `substitute`: "Substitute the input"
- `order-of-operations`: "Powers before the minus sign"
- `pick-piece`: "Pick the right piece"
- `sqrt-condition`: "Inside a square root must be ≥ 0"
- `denominator-condition`: "A denominator can't be 0"
- `log-condition`: "Inside a log must be > 0"
- `vertex`: "Find the vertex value"
- `direction`: "Opens up or down?"
- `combine-conditions`: "Combine the conditions"

Number asks use `evaluate`. Choice asks need no verify.

**Misconceptions:**
- `negative-squared`: "Squared before applying the sign incorrectly"
  ($-x^2$ at x = −2 read as +4). Generate the wrong value for L1 and L2 when x0 < 0.
- `wrong-piece`: "Used the wrong piece of the piecewise function"
- `strict-vs-inclusive`: "Mixed up > and ≥". This is a choice distractor: in the skill-level
  check, map the chosen distractor id to a misconception.

  Misconception matching for choice answers works like everything else: a
  `MisconceptionInstance` with `wrong: choiceAnswer(options, distractorId)`. Matching compares
  the chosen id.
- `range-direction`: "Flipped the range for a downward parabola"
- `range-used-h`: "Used h instead of k for the range"

**whyItMatters:** a function is a rule: input → one output. Demand $Q(P)$, cost $C(q)$ and
utility $U(x, y)$ are all functions, and domain restrictions are economic facts (prices and
quantities can't be negative, $\ln$ needs positive values).

---

## 6. `function-composition`: Function composition
Track math. Prerequisites `['functions-basics']`. `maxDenominator: 1`.

**Levels:**
1. **$f(g(a))$, both linear, number answer.** Coefficients in [−6, 6], a in [−5, 5].
2. **$f(g(a))$ with f quadratic or g quadratic.** Number answer.
3. **$f(g(x))$ as an expression**, f and g linear, or f quadratic and g linear.
   - Expression answer; verify `equivalent` to the literal composition string.
4. **$g(f(x))$ vs $f(g(x))$.** Ask for the one specified; expression. A choice step "Which
   function goes inside?"
5. **Decomposition.**
   - Given $h(x) = (mx + n)^k$ (or $\sqrt{mx + n}$, or $e^{mx + n}$) and the outer
     $f(u) = u^k$, find the inner $g(x)$.
   - Expression answer $mx + n$. This is the inner function the chain rule will
     differentiate.

**Steps.** Keys and labels:
- `inner-first`: "Evaluate the inner function first"
- `substitute-inner`: "Substitute the inner result into the outer function"
- `expand`: "Expand and simplify"
- `identify-inner`: "Identify the inner function"
- `identify-outer`: "Identify the outer function"

**Misconceptions:**
- `order-swapped`: "Applied the functions in the wrong order" (g(f(·)) instead of f(g(·)))
- `multiplied-functions`: "Multiplied f and g instead of composing" (f(a)·g(a), or the
  expression f(x)·g(x))
- `square-not-expanded`: "Squared term by term" ($(3x+1)^2 = 9x^2 + 1$). The wrong expression
  uses this, for L3 when f is quadratic.
- `outer-as-inner`: "Gave the outer function as the inner one" (L5: the answer $x^k$)

**Interpretation** (L1/L2, choice, about half the problems): the economic reading of a
composition, generated from params. "Price depends on cost, $P = g(c)$, and quantity on price,
$Q = f(P)$. What does $f(g(c))$ give?" → "Quantity sold, as a function of cost".

**whyItMatters:** much of economics chains effects together: a tax changes the price, and the
price changes quantity demanded, so quantity depends on the tax through a composition. The
chain rule (coming in derivatives) is how you differentiate those chains.
