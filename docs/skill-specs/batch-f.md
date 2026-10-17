# Batch F skill specs: calculus core and first economics applications

Same rules as batch E (`docs/skill-specs/batch-e.md`, top section) and `CLAUDE.md` →
"Adding a skill". Ids, tracks and prerequisites must match `src/skills/tree.ts`.

**Derivatives:**
- Use expression answers with `verify: { type: 'diff', expr, variable: 'x' }` (or `q`).
- Every per-term or per-part step has its own `diff` or `equivalent` verify.
- Write `exp(...)` and `log(...)` (natural) in values. Show $e^{...}$ and $\ln$ in LaTeX.

**Limits:** use the new `verify: { type: 'limit', expr, variable, point, side? }`, where
point is a number string, or `'oo'` / `'-oo'`.

---

## 1. `limits`: Limits & continuity
Math. Prerequisites `['functions-basics']`. `maxDenominator: 12`.

**Levels:**
1. **Direct substitution** into a polynomial or a rational function that is continuous at
   the point. Number answer.
2. **0/0 by factoring.**
   - $\lim_{x\to r} \frac{(x - r)(x - s)}{x - r}$, displayed expanded:
     $\frac{x^2 - (r+s)x + rs}{x - r}$. The answer is r − s.
   - Also $\frac{x^2 - r^2}{x - r} = 2r$.
   - r, s in [−6, 6], r ≠ s.
3. **At infinity, equal or lower degree.**
   - $\frac{a x^2 + bx + c}{d x^2 + ex + f}$ → a/d.
   - Or numerator of lower degree → 0.
   - Number answers. Never an infinite limit at this level.
4. **Continuity of a piecewise function.**
   - $f(x) = ax + b$ for $x < c$ and $kx^2$ for $x \ge c$; find the k that makes f continuous:
     k = (ac + b)/c².
   - Choose so k is a simple fraction.
   - Verify `solve` with the equation `a*c + b = k*c^2` (unknown k).
5. **Conjugate.**
   - $\lim_{x\to 0}\frac{\sqrt{x + m^2} - m}{x} = \frac{1}{2m}$, with m in [1, 6].
   - Or $\lim_{x\to 0}\frac{\sqrt{a x + m^2} - m}{x} = \frac{a}{2m}$.

**Steps.** Keys and labels:
- `substitute`: "Try substituting the point"
- `zero-over-zero`: "0/0 means: simplify first"
- `factor`: "Factor the numerator"
- `cancel`: "Cancel the common factor"
- `leading-terms`: "Compare the leading terms"
- `match-sides`: "Make the two sides meet"
- `conjugate`: "Multiply by the conjugate"
- `evaluate`: "Evaluate the simplified expression"

**Misconceptions:**
- `zero-over-zero-is-zero`: "Treated 0/0 as 0". The wrong answer is 0; only include it when
  the true limit isn't 0.
- `cancel-wrong-factor`: "Cancelled the wrong factor" (L2: s − r, or r + s)
- `lower-terms-ratio`: "Used the constant terms instead of the leading terms" (L3: c/f, when
  f ≠ 0 and the result differs)
- `continuity-sign`: "Matched the wrong values" (L4: k from (ac − b)/c²)
- `conjugate-forgot-half`: "Forgot the 1/2 from the conjugate" (L5: 1/m or a/m)

**whyItMatters:** a derivative *is* a limit: the slope over smaller and smaller changes. In
economics, "marginal" means the limit of the change per extra unit as that unit shrinks.
Continuity is why a small price change causes a small quantity change.

---

## 2. `derivatives-product-quotient`: Product & quotient rules
Math. Prerequisites `['derivatives-power-rule']`.

**Levels:**
1. **Product of two linear factors** $(ax + b)(cx + d)$, solved with the product rule (not by
   expanding).
2. **Product** $(a x^m)(bx + c)$ or $(x^2 + b)(cx + d)$.
3. **Quotient** $\frac{ax + b}{cx + d}$, with $ad - bc \ne 0$. The answer is
   $\frac{ad - bc}{(cx + d)^2}$.
4. **Quotient** $\frac{ax^2 + b}{cx + d}$.
5. **Econ flavor: average cost.**
   - $AC(q) = \frac{C(q)}{q}$ with $C(q) = F + vq + wq^2$; find $AC'(q)$ (variable q).
   - Interpretation question: "AC is falling when…" → "MC < AC".

**Steps.** Keys and labels:
- `identify-parts`: "Name the two parts (f and g, or top and bottom)"
- `differentiate-parts`: "Differentiate each part"
- `apply-rule`: "Apply the product/quotient rule"
- `simplify`: "Simplify"

Each part's derivative is an expression ask with a `diff` verify. The final answer can stay
unsimplified in the display, but the value must be correct.

**Misconceptions:**
- `product-of-derivatives`: "Multiplied the derivatives: (fg)′ = f′g′"
- `quotient-order`: "Subtracted in the wrong order in the quotient rule" (the sign is flipped)
- `quotient-no-square`: "Forgot to square the denominator"
- `quotient-of-derivatives`: "Divided the derivatives: (f/g)′ = f′/g′"

**whyItMatters:** revenue is price × quantity, and both change with output, so marginal
revenue needs the product rule: $R = P(q)\cdot q \Rightarrow R' = P'(q)\,q + P(q)$. Average cost
$C(q)/q$ needs the quotient rule; its derivative tells you AC falls exactly when MC < AC.

---

## 3. `derivatives-chain-rule`: Chain rule
Math. Prerequisites `['derivatives-product-quotient', 'function-composition']`.

**Levels:**
1. $(ax + b)^n$, with n in [2, 6].
2. $(ax^2 + bx + c)^n$, with n in [2, 4].
3. $\sqrt{ax^2 + b}$ and $\frac{1}{(ax + b)^k}$. Rewrite as powers first.
4. Chain inside a product: $x\,(ax + b)^n$.
5. Evaluate at a point: $\frac{d}{dx}(ax^2 + b)^n$ at $x = x_0$. Number answer, kept clean by
   small numbers.

**Steps.** Keys and labels:
- `identify-inner`: "Identify the inner function u(x)"
- `outer-derivative`: "Differentiate the outer function (leave the inside alone)"
- `inner-derivative`: "Differentiate the inner function"
- `multiply`: "Multiply: outer′ × inner′"
- `product-rule`: "Use the product rule for the outer product" (L4)
- `evaluate`: "Plug in the point" (L5)

**Misconceptions:**
- `forgot-inner`: "Forgot to multiply by the inner derivative"
- `inner-only`: "Differentiated only the inside"
- `outer-exponent-kept`: "Didn't lower the outer exponent"
- `inner-not-derivative`: "Multiplied by the inner function instead of its derivative"

**whyItMatters:** effects chain in economics: a tax changes the price, and the price changes
quantity. $\frac{dQ}{dt} = \frac{dQ}{dP}\cdot\frac{dP}{dt}$. Comparative statics in your theory
courses is mostly the chain rule.

---

## 4. `derivatives-exp-log`: Derivatives of exp & log
Math. Prerequisites `['derivatives-chain-rule', 'logarithm-rules']`.

**Levels:**
1. $c\,e^{kx}$ and $c\ln x$.
2. $\ln(kx)$ (its derivative is 1/x), $\ln(ax + b)$, $e^{ax + b}$.
3. $e^{x^2 + bx}$ and $\ln(x^2 + c)$, with c > 0.
4. Products: $x e^{kx}$, $x^2 \ln x$.
5. Econ: a growth rate.
   - $\frac{d}{dt}\ln(Y_0 e^{gt}) = g$.
   - Or $\frac{d}{dt}\ln\big(A t^{a}\big) = a/t$, evaluated at $t_0$ (number answer).
   - Interpretation: "the derivative of ln Y is the growth rate of Y".

**Steps.** Keys and labels:
- `exp-rule`: "d/dx e^u = e^u · u′"
- `log-rule`: "d/dx ln u = u′/u"
- `inner-derivative`: "Differentiate the inside"
- `product-rule`: "Product rule"
- `simplify`: "Simplify"
- `evaluate`: "Evaluate"

**Misconceptions:**
- `exp-forgot-k`: "Forgot the inner derivative of the exponent" ($e^{kx} \to e^{kx}$)
- `ln-k-over-x`: "Thought d/dx ln(kx) = k/x". It's 1/x, because ln(kx) = ln k + ln x.
- `exp-power-rule`: "Used the power rule on e^x" ($x\,e^{x-1}$)
- `ln-forgot-inner`: "Wrote 1/u without u′"

Note: `ln-k-over-x` gives `k/x`, which is equivalent to the correct answer only when k = 1, so
exclude k = 1. `distinctMisconceptions` drops it anyway.

**whyItMatters:** in economics, the derivative of ln Y is Y's growth rate:
$\frac{d}{dt}\ln Y = \frac{\dot Y}{Y}$. That's why growth models and log-linear regressions are
written in logs, and why $\ln$ differences are percentage changes.

---

## 5. `concavity-second-derivative`: Concavity & second-derivative test
Math. Prerequisites `['derivatives-power-rule']`. `maxDenominator: 6`.

**Levels:**
1. $f''(x)$ of a cubic or quartic polynomial. Expression answer, `diff` verify of f′ (state
   f′ in a step).
2. $f''(x_0)$ value, then a concave up/down choice (interpretation, or a choice final answer
   with a skill test).
3. Inflection point of a cubic $ax^3 + bx^2 + cx + d$: x = −b/(3a). Number.
4. Classify the critical points of a cubic with integer critical points r1 < r2:
   - $f'(x) = 3a(x - r_1)(x - r_2)$. Integrate exactly: f has coefficients
     a, −3a(r1+r2)/2, 3a·r1·r2, 0.
   - Choose the parity so the coefficients are integers, or scale.
   - Ask "At x = r1, f has a…" as a choice: local max / local min / neither.
   - Choice final answer → skill test required.
5. Second-derivative test on a profit function π(q) = −aq³ + bq² + cq: find the q with
   π′(q) = 0 that is a max. Number. Construct π′ from chosen roots.

**Steps.** Keys and labels:
- `first-derivative`: "Find f′"
- `second-derivative`: "Differentiate again: f″"
- `evaluate`: "Evaluate f″ at the point"
- `sign`: "Read the sign"
- `solve-f2-zero`: "Set f″ = 0"
- `critical-points`: "Find where f′ = 0"
- `classify`: "f″ < 0 → max, f″ > 0 → min"

**Misconceptions:**
- `used-first-derivative`: "Used f′ instead of f″"
- `sign-flipped`: "Mixed up: f″ > 0 means a minimum (concave up)" (choice distractor)
- `inflection-wrong-formula`: "Used −b/(2a) (the parabola vertex formula)" (L3)
- `picked-min`: "Picked the minimum, not the maximum" (L5: the other root)

**whyItMatters:** the first derivative finds where the slope is zero; the second tells you
whether that's a hilltop (maximum profit) or a valley (minimum cost). Diminishing marginal
returns, $f'' < 0$, is concavity.

---

## 6. `optimization`: Optimization
Math (econ flavored). Prerequisites `['concavity-second-derivative']`. `maxDenominator: 4`.

**Levels:**
1. Maximize a quadratic $R(q) = aq - bq^2$: q* = a/(2b), plus the max value R(q*) as a tuple
   `['q*', 'Max value']`.
2. Minimize a quadratic cost or average cost, such as $AC(q) = \frac{F}{q} + wq$:
   q* = √(F/w). Choose F/w as a perfect square.
3. Profit $\pi(q) = pq - (F + vq + wq^2)$: q* = (p − v)/(2w). Tuple `['q*', 'Profit']`.
4. Cubic profit: the larger root of π′ = 0 is the max. Same construction as concavity L5.
5. A constrained-by-substitution classic: a fence or box, or "a firm sells at price
   P = A − Bq; choose q to maximize revenue" with a cost. Tuple.

**Steps.** Keys and labels:
- `objective`: "Write the function to optimize"
- `derivative`: "Differentiate"
- `set-zero`: "Set the derivative to 0"
- `solve`: "Solve for the critical point"
- `second-order`: "Check it's a max (or min)"
- `value`: "Evaluate the function there"

The final tuple uses `solve` with `derivative = 0` for q, and `evaluate` for the value.

**Misconceptions:**
- `forgot-two`: "Forgot the 2 from differentiating q²" (q* = a/b)
- `set-function-zero`: "Set the function to 0 instead of its derivative" (the roots of R)
- `value-at-wrong-point`: "Evaluated at the wrong point"
- `min-instead-of-max`: "Took the minimum" (cubic)

**Interpretation:** "At q*, what is marginal profit?" → "0: one more unit adds nothing". Or
units: "q* is measured in…".

**whyItMatters:** every "best choice" in micro theory is an optimization: firms maximize profit,
consumers maximize utility, and planners minimize cost. The recipe is always: derivative = 0,
then check it's the right kind of point.

---

## 7. `elasticity`: Elasticity
Econ. Prerequisites `['supply-demand-equilibrium', 'derivatives-power-rule']`.
`maxDenominator: 20`. Interpretation is central here.

**Levels:**
1. **Point elasticity of linear demand.**
   - $Q = a - bP$ at a price P0: $\varepsilon = -b\,\frac{P_0}{Q_0}$.
   - Choose so ε is a simple fraction. Answer the signed number.
2. **Classify and say what happens to revenue.**
   - Same setup. The final answer is a choice: elastic (|ε| > 1, revenue falls if P rises) /
     inelastic / unit elastic.
   - Choice final answer → skill test.
3. **Arc (midpoint) elasticity** between (P1, Q1) and (P2, Q2):
   $\frac{(Q_2 - Q_1)/((Q_1+Q_2)/2)}{(P_2 - P_1)/((P_1+P_2)/2)}$. Clean fraction.
4. **Constant elasticity** $Q = A P^{-k}$: ε = −k, via the derivative.
   - Ask ε at a price (it's the same everywhere).
   - Interpretation: "a 1% price rise lowers quantity by k%".
5. **Revenue-maximizing price** for linear demand: where |ε| = 1, so P = a/(2b). Tuple
   `['Price', 'Elasticity there']`.

**Steps.** Keys and labels:
- `quantity`: "Find Q at the price"
- `slope`: "Find dQ/dP"
- `formula`: "ε = (dQ/dP)·(P/Q)"
- `evaluate`: "Plug in"
- `classify`: "Compare |ε| with 1"
- `percent-changes`: "Compute the percent changes (midpoint method)"
- `ratio`: "Divide the percent changes"

**Misconceptions:**
- `inverted-ratio`: "Inverted the ratio (used Q/P instead of P/Q)"
- `slope-not-elasticity`: "Gave the slope dQ/dP instead of the elasticity"
- `sign-dropped`: "Dropped the minus sign". Use this on a number answer only when the prompt
  asks for the signed value.
- `elastic-means-big-slope`: "Thought a steeper curve means more elastic" (choice distractor)
- `arc-endpoint-base`: "Used an endpoint instead of the midpoint" (L3)

**Interpretation** (most problems): "If price rises 1%, quantity…" → "falls about |ε|%". And
"Total revenue PQ will…" → "fall" if elastic, "rise" if inelastic. Explain *why*: the quantity
lost outweighs the higher price.

**Understanding beyond the number:** elasticity is unitless (a ratio of percentages), so
unlike the slope it doesn't change if price is measured in cents. Say this in the Learn card
and in one interpretation question.

**whyItMatters:** elasticity is how economists compare responsiveness across goods: gasoline
vs. restaurant meals, short run vs. long run. It decides who bears a tax, whether a price cut
raises revenue, and how much markup a monopolist charges.

---

## 8. `cost-profit-maximization`: Costs & profit maximization
Econ. Prerequisites `['derivatives-power-rule', 'optimization']`. `maxDenominator: 4`.

**Levels:**
1. **Marginal cost at q0** for $TC(q) = F + vq + wq^2$: MC(q0) = v + 2wq0. Number.
   - Interpretation: "The cost of producing the (q0+1)-th unit is about…"
2. **Average cost and AVC at q0.** Tuple `['AC', 'AVC']`.
3. **Competitive firm:** price p given; p = MC gives q*. Tuple `['q*', 'Profit']`.
4. **Minimum of AC (efficient scale):** MC = AC gives q = √(F/w). Choose F/w a perfect square.
   Tuple `['q', 'Minimum AC']`.
5. **Shutdown and cubic cost.**
   - $TC = F + aq - bq^2 + cq^3$; minimum AVC at q = b/(2c).
   - Choose b, c so it's clean. Answer the shutdown price (min AVC).

**Steps.** Keys and labels:
- `mc`: "Marginal cost = TC′(q)"
- `ac`: "Average cost = TC/q"
- `avc`: "Average variable cost = VC/q"
- `p-equals-mc`: "Set price = MC"
- `solve`: "Solve for q"
- `profit`: "Profit = revenue − cost"
- `mc-equals-ac`: "MC = AC at the bottom of AC"
- `min-avc`: "Find minimum AVC"

**Misconceptions:**
- `mc-as-ac`: "Used average cost as marginal cost"
- `fixed-in-mc`: "Kept the fixed cost in marginal cost". This shows up as an MC too high by F
  in some forms. Implement it as AC instead. Skip if it's identical to `mc-as-ac`.
- `fixed-in-avc`: "Included fixed cost in AVC"
- `p-equals-ac`: "Set price = average cost instead of marginal cost"
- `profit-forgot-fixed`: "Left the fixed cost out of profit"

**Interpretation:**
- "Should the firm produce at all if p is below min AVC?" → "No: shut down, since it loses
  less by paying only fixed costs."
- "Why is MC = p and not AC = p?" → "Profit rises while the next unit's revenue exceeds its
  cost."

**whyItMatters:** "produce until marginal revenue equals marginal cost" is the most-used rule
in micro theory. Competitive firms, monopolies and Cournot duopolies all start here.
