# Batch J skill specs: production, utility, the Lagrangian, comparative statics

Four econ skills that put batch I (partials, total differential, Cramer's rule, multivariable
optimization) to work on the models Econ 7370 and 8451 use: Cobb-Douglas production,
consumer choice, constrained optimization with the multiplier as a shadow price, and
comparative statics. All four are in `src/skills/tree.ts` (track econ, unit "Production &
utility"). Files go in `src/skills/econ/`.

| # | id | Prerequisites (tree.ts) |
|---|---|---|
| 1 | `cobb-douglas-production` | `partial-derivatives`, `exponent-rules` |
| 2 | `utility-maximization` | `cobb-douglas-production` |
| 3 | `lagrangian-optimization` | `utility-maximization`, `multivariable-optimization` |
| 4 | `comparative-statics` | `total-differential`, `cramers-rule` |

Problem shapes come from Hoy et al. ch. 13–14 (Lagrangian FOCs, eliminating λ, λ as marginal
cost and as the shadow value of an input; a taxed monopolist, a market with an outside shifter,
two-country income models by Cramer's rule) and Bergstrom & Varian, *Workouts* ch. 5–6
(Cobb-Douglas demand, budget shares, the cross-price property). See `book-archetypes.md`:
shapes only, original wording and computed numbers.

**Rules for every skill:** follow `CLAUDE.md` → "Adding a skill", and the shared requirements
at the top of `batch-h.md`. Lessons from batch I, enforced by the harness:
- Every LaTeX command in a JS string needs a doubled backslash (`'\\frac'`, `'\\cdot'`, `'\\lambda'`),
  in nested template literals and `.join(...)` too.
- At least 2 steps per problem. Same `params` keys at every level (unused = 0).
- Interpretation questions are **required** (econ track), computed from the params, drawn last,
  and re-derived in `tests/skills/<id>.test.ts`.

**Exact answers.** Fractional exponents make irrational numbers easy to hit. Choose inputs as
perfect powers (L = 16, K = 4 with exponents ½) so every answer is rational; never set
`irrationalAnswers`. Verify strings use `^(1/2)` exponents; mathjs and SymPy both handle them.
Variable names L, K, x, y, m are safe in both; avoid `E` (a mathjs constant).

**Verify for derivative-based answers.** Use `partial` (batch I) with `at`, e.g.
`{ type: 'partial', expr: '10*L^(1/2)*K^(1/2)', wrt: ['L'], variables: ['L', 'K'], at: { L: '16', K: '4' } }`.
Comparative statics answers use `solve` of the **totally differentiated** equilibrium conditions
with the shifter's change set to 1 (unknowns `dP`, `dQ`, …): that is the problem statement in
linear form, independent of the generator's reduced-form formula.

---

## 1. `cobb-douglas-production`: Cobb-Douglas production
`maxDenominator: 8`. $Q = A L^{\alpha} K^{\beta}$, α, β from {1/4, 1/3, 1/2, 2/3, 3/4} (and 1
for one of them only in L2 forms), A in [1, 20].

**Levels:**
1. Output at a point. Pick L and K as perfect powers for the exponents' denominators
   (e.g. α = β = ½: L, K perfect squares). Number. Example: $Q = 10L^{1/2}K^{1/2}$, L = 16,
   K = 4 → 80.
2. Returns to scale. `form` 0: classify (increasing / constant / decreasing). Choice. `form` 1:
   "If both inputs double, output is multiplied by" $2^{\alpha+\beta}$ with α + β ∈ {1, 2} or by
   a factor t in {4, 8, 9, 16, 27} where $t^{\alpha+\beta}$ is rational; number.
3. Marginal product of labor or capital (`which` param) at a point: $MP_L = \alpha Q / L$.
   Number; verify `partial` with `at`.
4. MRTS $= MP_L / MP_K = \frac{\alpha K}{\beta L}$ at a point. Number.
5. Growth accounting: $g_Q \approx g_A + \alpha g_L + \beta g_K$ (growth rates in percent).
   `form` 0: output growth from the others; `form` 1: TFP growth (the Solow residual) from the
   others. Number. Example: α = 1/3, β = 2/3, $g_L = 3$, $g_K = 6$, $g_Q = 7$ → $g_A = 2$.

**Steps:**
- `powers` (L1): "Evaluate each power". Ask: $L^{\alpha}$ (number); verify `evaluate`.
- `multiply` (L1): "Multiply A by the powers". Final.
- `sum-exponents` (L2): "Add the exponents". Ask: α + β; verify `evaluate`.
- `classify` / `scale` (L2): "Compare with 1" (choice) or "Raise the factor to α + β" (number).
- `differentiate` (L3, L4): "Take the partial derivative". Ask: the MP expression in L and K;
  verify `partial`.
- `evaluate-mp` (L3): "Substitute the point". Final.
- `mpk` (L4): "Find the other marginal product". Ask: number; verify `partial` with `at`.
- `ratio` (L4): "Divide MP_L by MP_K". Final.
- `weights` (L5): "Weight each input's growth by its exponent". Ask: $\alpha g_L$; verify
  `evaluate`.
- `residual` (L5): "Add (or subtract) to finish". Final.

**Misconceptions:**
- `exponent-as-multiplier` (L1): "Multiplied by the exponent instead of raising to it".
  $A\alpha L \cdot \beta K$.
- `diminishing-mp-as-drs` (L2 form 0): "Read α < 1 and β < 1 as decreasing returns to scale".
  Diminishing marginal product of each input says nothing about scale; only α + β does. Reachable
  when α, β < 1 but α + β ≥ 1.
- `product-of-exponents` (L2): "Multiplied the exponents instead of adding". Classify (or scale)
  with αβ.
- `power-not-reduced` (L3): "Didn't lower the power". $\alpha A L^{\alpha} K^{\beta}$ (i.e.
  $\alpha Q$).
- `mrts-inverted` (L4): "Divided MP_K by MP_L". $\frac{\beta L}{\alpha K}$.
- `unweighted-growth` (L5): "Added growth rates without the exponents".
- `residual-sign` (L5 form 1): "Added the input contributions instead of subtracting".

**Interpretation** (L3 and L5, 50% each):
- L3: "$MP_L = 2.5$ here. What does it mean?" Correct: one more unit of labor, capital fixed,
  adds about 2.5 units of output. Distractors: average product; output with one more unit of
  each input; "labor is 2.5 times as productive as capital". Second question (`question` 1):
  "If labor keeps rising with capital fixed, MP_L…" falls (α < 1) / stays / rises.
- L5: "The residual $g_A$ measures…" Correct: output growth not explained by input growth
  (technology, efficiency). Distractors: labor's share; capital growth; inflation.

**whyItMatters:** $Q = 10L^{1/2}K^{1/2}$ with L = 16, K = 4 gives Q = 80, and
$MP_L = \tfrac12 \cdot 80/16 = 2.5$: the next worker adds about 2.5 units. Exponents are input
shares; their sum is returns to scale; growth accounting uses them to split growth into inputs
and technology.

---

## 2. `utility-maximization`: Utility maximization
`maxDenominator: 4`. $U = x^{a} y^{b}$ with a, b positive integers in [1, 4] (show them, or the
equivalent $\alpha \ln x + \beta \ln y$ in L5 form 1). Demand:
$x^* = \frac{a}{a+b}\frac{m}{p_x}$, $y^* = \frac{b}{a+b}\frac{m}{p_y}$. Choose m as a multiple of
(a + b)·p_x·p_y so demands are integers.

**Levels:**
1. Budget line: `form` 0 the most x you can buy ($m/p_x$); `form` 1 the slope of the budget
   line in (x, y) space ($-p_x/p_y$); `form` 2 the cost of a bundle and whether it's affordable
   (choice). Number or choice.
2. The tangency condition: MRS $= \frac{a y}{b x} = \frac{p_x}{p_y}$. Given prices and x on the
   optimal path, find y. Number.
3. Full demand: $(x^*, y^*)$. Tuple `['x', 'y']`; verify `solve` of tangency
   (`a*y*py = b*x*px`) and the budget (`px*x + py*y = m`).
4. Budget shares and a price change: `form` 0 the spending on y ($\frac{b}{a+b}m$); `form` 1 the
   new $x^*$ after $p_x$ changes; `form` 2 the new $y^*$ after $p_x$ changes (unchanged: the
   Cobb-Douglas cross-price property). Number.
5. A Workouts-style two-part change: income and one price change together (a raise and a
   price rise); the new bundle. Tuple. `form` 1 states utility in logs (same demands).

**Steps:**
- `intercept` / `slope` / `cost` (L1).
- `mrs` (L2–L3): "Find the MRS". Ask: the MRS as an expression in x and y; verify `equivalent`
  with `(a*y)/(b*x)`.
- `tangency` (L2–L3): "Set MRS equal to the price ratio". Ask: y in terms of x (expression) or
  y at the given x; verify `solve`.
- `budget` (L3, L5): "Substitute into the budget line". Ask: $x^*$; verify `solve` of both
  equations (single unknown with the other pinned, as in `cramers-rule` L1).
- `share` (L4, L5): "Spend the share a/(a+b) on x". Ask: the share (a fraction); verify
  `evaluate`.
- `demand` (L4, L5): final.

**Misconceptions:**
- `slope-inverted` (L1 form 1): "Used $-p_y/p_x$".
- `mrs-inverted` (L2, L3): "Set $\frac{b x}{a y}$ equal to the price ratio".
- `equal-split` (L3–L5): "Split income equally between the goods". $x = \frac{m}{2p_x}$.
- `share-over-other` (L3, L4): "Used a/b as the share instead of a/(a+b)".
- `cross-price-effect` (L4 form 2, L5): "Changed y after only p_x changed". y rescaled by the
  price ratio.
- `forgot-price` (L3–L5): "Divided spending by the wrong price". $\frac{a}{a+b}\frac{m}{p_y}$.

**Interpretation** (L3–L5, 50%):
- "At the optimum, MRS = 3/2 = p_x/p_y. What does that mean?" Correct: the rate at which the
  consumer is willing to trade y for x equals the rate the market lets them trade. Distractors.
- "p_x rises. What happens to y*?" Correct: nothing, with Cobb-Douglas utility spending on y is a
  fixed share of income. (Only when the question's utility is Cobb-Douglas.)
- "What share of income goes to x?" a/(a+b).

**whyItMatters:** $U = x^{1/3}y^{2/3}$, m = 90, $p_x = 3$, $p_y = 2$: spend 1/3 on x (x* = 10)
and 2/3 on y (y* = 30); 30 + 60 = 90. Demand curves, price indices and welfare comparisons
in micro theory all start here.

---

## 3. `lagrangian-optimization`: Lagrangian optimization
`maxDenominator: 4`. Objectives with clean multipliers. The Lagrangian is written
$\mathcal{L} = f(x, y) + \lambda\,(c - g(x, y))$, so λ > 0 for a binding budget and λ is
$\partial f^* / \partial c$.

**Levels:**
1. Max $U = xy$ s.t. $p_x x + p_y y = m$. Tuple (x, y). Steps walk the FOCs.
2. Same problem, find λ* ($= y^*/p_x = x^*/p_y$). Number.
3. Cost minimization: min $wL + rK$ s.t. $LK = Q_0^2$ (i.e. $Q = (LK)^{1/2}$). Choose w, r with
   r/w a perfect-square ratio so L*, K* are integers: $L^* = Q_0\sqrt{r/w}$,
   $K^* = Q_0\sqrt{w/r}$. Tuple `['L', 'K']`.
4. The envelope theorem: given the problem and its λ*, approximate the change in the optimal
   value when the constraint loosens by Δc (Δc in {1, 2, 5, 10}): $\Delta f^* \approx \lambda^* \Delta c$.
   `form` 0 utility and income; `form` 1 cost and output (λ = marginal cost). Number.
5. Multi-plant allocation: min $c_1 q_1^2 + c_2 q_2^2$ s.t. $q_1 + q_2 = Q$, c₁, c₂ in [1, 6].
   $q_i \propto 1/c_i$; λ = $2c_1 q_1$ = marginal cost. Tuple `['q₁', 'q₂']` (expression
   checker needs x, y: write q₁ = x, q₂ = y in the steps, as in `multivariable-optimization` L5).
   A choice step asks whether the bordered Hessian makes it a min or max.

**Steps:**
- `lagrangian` (L1–L3): "Write the Lagrangian". Choice among four forms (right sign of λ term,
  the constraint written backwards, the objective missing, λ multiplying the objective).
- `foc-x`, `foc-y` (L1–L3, L5): "Differentiate with respect to x" / "… y". Ask: expression;
  verify `partial` of the Lagrangian expression (variables include `lam`).
- `eliminate` (L1–L3, L5): "Divide the two conditions to eliminate λ". Ask: y in terms of x at
  the optimum (expression) or the ratio; verify `equivalent`.
- `constraint` (L1, L3, L5): "Substitute into the constraint". Ask: x* (or L*, q₁*); verify
  `solve`.
- `multiplier` (L2, L4): "Solve a first-order condition for λ". Ask: number; verify `solve` of
  that FOC with x*, y* pinned.
- `envelope` (L4): "Multiply λ by the change". Final.
- `soc` (L5): "Check the bordered Hessian". Choice.

**Misconceptions:**
- `ignored-constraint` (L1, L3, L5): "Optimized without the constraint". For L5:
  $q_1 = q_2 = Q/2$ ("split output equally") instead.
- `lambda-reciprocal` (L2, L4): "Took λ as price over marginal utility". $p_x / MU_x$.
- `lambda-total` (L4): "Used λ as the new total, not the change".
- `ratio-inverted` (L3): "Swapped the input ratio". L and K swapped.
- `equal-allocation` (L5): "Gave both plants the same output".
- `allocation-inverted` (L5): "Gave more output to the costlier plant". $q_i \propto c_i$.

**Interpretation** (L2, L4, L5; 50%; units matter):
- L2/L4 form 0: "λ* = 5. What does it mean?" Correct: one more dollar of income raises maximum
  utility by about 5 (utils per dollar). Distractors: the price of x; utility at the optimum;
  how much utility one more unit of x adds.
- L4 form 1 / L5: "λ* = 12 in the cost problem. What is it?" Correct: the marginal cost of one
  more unit of output, in dollars. Distractors: average cost; the price of labor; total cost.
- L5: "Why does the cheaper plant produce more?" Correct: costs are minimized where marginal
  costs are equal, and the cheaper plant's MC rises more slowly.

**Test file** (required): re-derive the interpretations, the L1/L5 `lagrangian` choice, and the
L5 `soc` choice (the objective is convex on the constraint line, so it's a minimum).

**whyItMatters:** max $U = xy$ with $2x + 4y = 80$: x* = 20, y* = 10, λ* = 5. With \$81, utility
rises from 200 to about 205: λ is the value of the last dollar. In cost problems λ is marginal
cost, which is why it appears in every pricing rule.

---

## 4. `comparative-statics`: Comparative statics
`maxDenominator: 12`. The answer is a derivative of an equilibrium value with respect to an
outside parameter, and its sign is the economics.

**Levels:**
1. A market with a demand shifter: $Q_d = a - bP + cY$ (income Y), $Q_s = d + eP$. Find
   $dP^*/dY = \frac{c}{b + e}$. c may be negative (an inferior good). Number.
2. A per-unit tax t on sellers: $Q_s = d + e(P - t)$. Find $dP^*/dt = \frac{e}{b + e}$, the
   share of the tax buyers pay. Number. `form` 1 asks the sellers' share $\frac{b}{b+e}$.
   Example: $Q_d = 120 - 2P$, $Q_s = 3(P - t) - 30$: $dP/dt = 3/5$.
3. A monopolist with a per-unit tax: $P = A - Bq$, $C = cq$ (+ fixed cost), profit
   $(A - Bq)q - cq - tq$. Find $dq^*/dt = -\frac{1}{2B}$ (`form` 0) or $dP^*/dt = \frac12$
   (`form` 1). Number.
4. Keynesian model with taxes: $Y = C + I + G$, $C = a + b(Y - T)$. `form` 0 $dY/dG = \frac{1}{1-b}$;
   `form` 1 $dY/dT = -\frac{b}{1-b}$; `form` 2 the balanced-budget change (dG = dT = 1) = 1.
   b in {1/2, 3/5, 2/3, 3/4, 4/5}. Number.
5. Two-country income model (Hoy 14.2 shape): $Y_1 = a_1 + b_1 Y_1 + I_1 + m_2 Y_2 - m_1 Y_1$
   and the mirror for country 2 (mpc $b_i$, import propensities $m_i$, small fractions). Find
   $dY_1/dI_1$ (`which` 0) or $dY_2/dI_1$ (`which` 1) by totally differentiating and applying
   Cramer's rule. Reject draws whose answer's denominator exceeds 12. Number.

**Verify:** `solve` of the totally differentiated equations with the shifter's change = 1, e.g.
L1: `dQ = -b*dP + c*1`, `dQ = e*dP`, unknowns `dP, dQ` (the answer tuple is internal: the final
answer is dP, so pin dQ via a second step, or use the single-unknown pattern from
`cramers-rule` L1). L5 uses the two differentiated income equations with `det` steps.

**Steps:**
- `differentiate` (all): "Totally differentiate the equilibrium conditions". Ask: the coefficient
  of dP (or dY) after collecting terms; verify `evaluate`.
- `solve-d` (L1–L4): "Solve for the change". Final.
- `foc` (L3): "Write the first-order condition". Ask: q* as an expression in t; verify `solve`
  of the FOC.
- `det-d`, `det-1` (L5): "Determinant of the system" / "Replace the column". verify `det`.
- `sign` (L1, L2, L5): "Read the sign". Choice: rises / falls / unchanged.

**Misconceptions:**
- `sign-flipped` (L1, L3–L5): "Got the direction backwards". The answer negated.
- `forgot-supply-response` (L1, L2): "Left out the supply slope". $c/b$ (L1); full pass-through
  1 (L2).
- `seller-buyer-swapped` (L2): "Gave the other side's share". $\frac{b}{b+e}$ for buyers.
- `monopoly-full-pass` (L3 form 1): "Passed the whole tax to the price". dP/dt = 1.
- `multiplier-b` (L4): "Used 1/b as the multiplier".
- `tax-like-spending` (L4 form 1): "Treated a tax cut like a spending rise". $-\frac{1}{1-b}$.
- `closed-economy` (L5): "Ignored the trade linkage". $\frac{1}{1 - b_1 + m_1}$ for which 0;
  0 for which 1.

**Interpretation** (all levels, 50%): the sign and its source.
- L1: "dP*/dY = 2/5 > 0. Why positive?" Correct: the good is normal (c > 0), so higher income
  raises demand and the price. When c < 0, the inferior-good version.
- L2: "Buyers pay 3/5 of the tax. Why more than half?" Correct: quantity supplied responds more
  to price than quantity demanded (e > b), so the less responsive side, buyers, bears more.
- L4: "Why is the balanced-budget multiplier 1?" Correct: the spending rise adds 1/(1 − b), the
  tax rise subtracts b/(1 − b), leaving 1.
- L5: "Why does investment in country 1 raise income in country 2?" Correct: higher income in
  country 1 raises its imports, which are country 2's exports.

**whyItMatters:** $Q_d = 120 - 2P$, $Q_s = 3(P - t) - 30$ gives $P^* = 30 + \tfrac35 t$:
a \$1 tax raises the buyers' price by 60 cents, because supply responds more to price than
demand does. Comparative statics answers every "what happens if" question in theory courses,
and its sign is usually the whole point.

---

## Delegation and checks

1. Subagents (Sonnet), all four in parallel (no code dependencies between them). Each gets
   `CLAUDE.md`, PLAN §2.3 and §8, this spec's section, `book-archetypes.md`, and reference skills:
   `src/skills/econ/supply-demand-equilibrium.ts` (interpretation) plus the batch I skill closest
   to it (`partial-derivatives` for Cobb-Douglas, `multivariable-optimization` for the
   Lagrangian, `cramers-rule` for comparative statics, `systems-of-equations` for utility).
2. Lead: check every generator's math by hand on several seeds, run the backslash scan, then
   `npm test` and `npm run verify:sympy:skills -- <the four ids>`.
3. Placement: `MAX_ITEMS` (econ skills are placeable); raise it if acing no longer reaches every
   skill.
4. e2e and review PNGs (the garden gains four plots).
