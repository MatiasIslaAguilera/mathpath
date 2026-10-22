# Batch H skill specs: the algebra foundation

These six skills fill the gap between linear equations and the function/exponent/calculus
skills. Before this batch, prerequisites resolved *through* them, so the app jumped from linear
equations straight to functions and exponents. Quadratics and inverse functions were never
practiced, even though logarithm rules, optimization and profit maximization all lean on them.

**Rules for every skill:** follow `CLAUDE.md` → "Adding a skill". Copy the structure of the
reference skills:
- `src/skills/math/linear-equations.ts`: number answers, numeric misconceptions
- `src/skills/econ/supply-demand-equilibrium.ts`: tuple answers, choice steps, interpretation
- `src/skills/gre/gre-inequalities-absolute-value.ts`: a choice final answer whose wrong
  options are misconceptions

Requirements that apply to all of them:
- The id, track, unit and prerequisites must match `src/skills/tree.ts` exactly.
- **Every problem at a level must have the same `params` keys** (the harness compares the key
  set with the level's `ranges`). When a level mixes prompt types, add a `form` param (0, 1, …)
  and give every form the same keys (use 0 for keys a form doesn't need).
- Choose parameters **backwards from a clean answer**; reject bad draws with `continue`.
- Every misconception listed must be reachable at some level, computed from the params, and
  passed through `distinctMisconceptions`.
- Every step key needs a `stepLabels` entry. Every non-choice `ask` needs a `verify`. The last
  step's ask equals the final answer.
- `verify` is a **problem statement** the harness checks independently (an equation the answer
  satisfies), not the answer copied. The patterns below say which statement to use.
- Draw interpretation randomness **after** everything else in `generate()`.
- Tuple answers are ordered. For two roots, always use labels `['Smaller root', 'Larger root']`.
- `learn.whyItMatters`: 60–110 words, one concrete economics example whose arithmetic you have
  checked by hand.

---

## 1. `linear-inequalities`: Linear inequalities
Track math, unit "Linear equations & systems". Prerequisites `['linear-equations']`.
`maxDenominator: 6`.

The final answer is a **choice** among four solution sets, rendered like $x > 3$,
$x \le -\tfrac{5}{2}$, or for L5 $-2 < x \le 4$. Build the four options from candidate
(direction, boundary) pairs: the correct one, then the misconception ones, deduplicated, padded
with plausible fillers (the opposite direction of a wrong boundary, the boundary ± 1), then
shuffled with `rng`. Misconception instances point at their option id
(`{ kind: 'choice', options, correct: wrongId }`). Use `verify: { type: 'choice', note }`.

The relation symbol (`<`, `>`, `≤`, `≥`) is a random param `rel` (0–3) at every level.

**Levels:**
1. $ax + b \;\square\; c$ with a in [2, 9], integer boundary t in [−10, 10]. No flip.
2. $ax + b \;\square\; c$ with a in [−9, −2]. Dividing by a flips the sign.
3. $ax + b \;\square\; cx + d$, a ≠ c, a and c in [−9, 9]. The collected coefficient a − c
   can have either sign (so flips happen on some problems and not others).
4. $a(x + b) \;\square\; cx + d$, boundary may be a fraction with denominator ≤ 6.
5. Compound: $c_1 < ax + b \le c_2$ (the two relation symbols vary), a in [−6, 6] \ {0, ±1}.
   Subtract b from all three parts, divide all three by a; when a < 0 both signs flip and the
   bounds swap. Integer bounds.

**Steps** (keys and labels):
- `expand`: "Expand the parentheses" (L4). Ask: expanded left side, `expression`, verify
  `equivalent` with the unexpanded side.
- `collect`: "Collect x-terms and numbers". Ask: the number r in $kx \square r$, verify
  `evaluate` of `k*t` (k the collected coefficient, t the boundary).
- `flip`: "Decide whether the sign flips". Ask (choice): "You divide by k. Does the
  inequality sign flip?" Yes/No.
- `divide`: "Divide by the coefficient of x". Ask: the boundary t, verify `solve` with the
  boundary *equation* (the inequality with = in place of the relation).
- `answer`: "State the solution set". Ask: the final choice.
- L5 uses `subtract-all` ("Subtract from all three parts") and `divide-all` ("Divide all three
  parts") in place of `collect`/`divide`; ask for the lower and upper bound as numbers with
  `evaluate` verifies, then `flip` and `answer`.

**Misconceptions:**
- `no-flip`: "Didn't flip the sign when dividing by a negative". Same boundary, opposite
  direction (L2, L3, L5).
- `flip-positive`: "Flipped the sign when dividing by a positive". Reachable when the original
  x-coefficient on the left was negative but the collected coefficient is positive (L3), or
  any level where k > 0 (L1, L4). Same boundary, opposite direction.
- `sign-constant`: "Moved a number without changing its sign". Boundary (r + 2b)/k, i.e. the
  constant moved with the wrong sign; correct direction.
- `compound-one-side` (L5): "Subtracted from only one part of the compound inequality". One
  bound wrong (left bound computed from c₁ without subtracting b).

**Interpretation** (L1 and L4, one question, 50% of problems): a break-even framing. "A firm's
profit is $\pi(q) = $ …; the solution says profit is positive when q …. Which quantity
earns a profit?" Options are four specific numbers; exactly one satisfies the inequality.
Re-derive in the test.

**Test file** `tests/skills/linear-inequalities.test.ts`, required: for many seeds and every
level, check each option against the original inequality on a grid of x values (step 1/12,
from −30 to 30, plus each option's boundary ± 1/1000) and confirm that exactly the correct
option's set matches. Also re-derive the interpretation answer.

**whyItMatters** idea: break-even and budget constraints are inequalities. Revenue $12q$ beats
cost $300 + 7q$ when $5q > 300$, so the firm needs more than 60 units. A budget
$4x + 10y \le 100$ is an inequality too.

---

## 2. `systems-of-equations`: Systems of equations
Track math, unit "Linear equations & systems". Prerequisites `['linear-equations']`.
`maxDenominator: 4`.

Final answer: tuple `['x', 'y']`. Verify: `{ type: 'solve', equations: [eq1, eq2],
unknowns: ['x', 'y'] }`, the two original equations in mathjs syntax.

**Levels:**
1. Two cost plans: $y = b_1 + m_1 x$ and $y = b_2 + m_2 x$ (prompt in words: "Plan A costs
   \$b₁ plus \$m₁ per month…"). All positive, m₁ ≠ m₂, integer crossing x in [2, 20].
   Set the two right sides equal.
2. Substitution: $y = mx + k$ and $ax + by = c$. Integer solution, x, y in [−10, 10],
   b ≠ 0, and $a + bm \ne 0$.
3. Elimination by adding or subtracting directly: the y-coefficients are equal or opposite
   ($a_1x + by = c_1$, $a_2x \pm by = c_2$). Integer solution.
4. Elimination that needs one or both equations multiplied first. Coefficients in [−7, 7]
   \ {0}, determinant ≠ 0, integer solution.
5. Word problem: "3 coffees and 2 bagels cost \$13.50; 2 coffees and 4 bagels cost \$15."
   Prices are multiples of \$0.25 in [1, 8]; quantities in [1, 6]; determinant ≠ 0.
   Tuple labels `['Coffee', 'Bagel']` (use the item names actually drawn from a small list,
   with a `items` param index).

**Steps** (keys and labels):
- `set-equal` (L1): "Set the two expressions equal". Ask: x, verify `solve` of
  $b_1 + m_1x = b_2 + m_2x$.
- `substitute` (L2): "Substitute into the other equation". Ask: after substituting and
  collecting, $(a + bm)x = \;?$; verify `evaluate`.
- `multiply` (L4, L5): "Multiply to match a coefficient". Ask: the multiplier (or the new
  constant term); verify `evaluate`.
- `eliminate` (L3–L5): "Add or subtract to eliminate a variable". Ask: the value of the
  remaining variable, verify `solve` of the combined one-variable equation.
- `back-substitute`: "Substitute back to get the other variable". Ask: y, verify `solve` of
  the original equation 1 with x fixed.
- `answer`: "State the solution". Ask: the final tuple.

**Misconceptions:**
- `swapped-order`: "Wrote the solution as (y, x)". Reachable whenever x ≠ y.
- `elim-wrong-op` (L3–L5): "Added when you needed to subtract (or the reverse)". With equal
  coefficients, adding instead of subtracting: $x' = (c_1 + c_2)/(a_1 + a_2)$, then y from
  equation 1 with x'. And the mirror case for opposite coefficients.
- `multiply-one-side` (L4, L5): "Multiplied only the left side of an equation". The constant
  of the multiplied equation stays unscaled; solve the resulting system.
- `substitute-distribute` (L2): "Didn't distribute when substituting". $a x + b(mx + k) = c$
  computed as $ax + bmx + k = c$.

**Interpretation** (L1): "For more than x* months, which plan is cheaper?" Correct = the plan
with the smaller per-month price. Options: Plan A, Plan B, they cost the same, it depends on
the month. Also (L5, 50%): "If both bills were for twice the quantities, the prices would be"
→ the same (prices don't depend on quantity).

**whyItMatters** idea: market equilibrium is a system (supply and demand), and so is Cournot
competition (two best-response equations). Example: demand $P = 100 - 2Q$, supply
$P = 20 + 2Q$: setting them equal gives $Q = 20$, $P = 60$.

---

## 3. `quadratics-factoring`: Quadratics: factoring
Track math, unit "Quadratics". Prerequisites `['linear-equations']`. `maxDenominator: 5`.

Final answer: tuple `['Smaller root', 'Larger root']`, roots distinct at every level.
Verify: `solve` with unknowns `['r1', 'r2']` and equations
`a*r1^2 + b*r1 + c = 0`, `a*r2^2 + b*r2 + c = 0`, `r1 + r2 = -(b)/(a)`, where a, b, c are the
coefficients of the **standard form** (the sum equation rules out answering the same root
twice). Use the original (unrearranged) equation in L5 instead of the standard form for the
first two equations.

**Levels:**
1. Monic $x^2 + bx + c = 0$ with integer roots r₁ < r₂ in [−9, 9], both nonzero.
2. Special forms (`form` param): difference of squares $x^2 - k^2 = 0$ (k in [2, 12]) or a
   common factor $x^2 + bx = 0$ (roots 0 and −b).
3. A common numeric factor first: $a(x - r_1)(x - r_2)$ expanded, a in [2, 5] or [−5, −2],
   integer roots.
4. Non-monic $(px + q)(rx + s)$ expanded, p, r in [2, 5], at least one fractional root,
   denominators ≤ 5. Use the AC method (two numbers that multiply to ac and add to b).
5. Rearrange first (`form`): $x^2 + bx = cx + d$ or $(x + p)(x + q) = k$ with k ≠ 0. Move
   everything to one side, then factor. Integer roots.

**Steps** (keys and labels):
- `standard-form` (L5): "Move everything to one side". Ask: the constant term of the
  standard form; verify `evaluate`.
- `common-factor` (L2 common-factor form, L3): "Factor out the common factor". Ask: the factor
  (number); verify `evaluate`.
- `find-pair`: "Find two numbers that multiply to ac and add to b". Ask: the larger of the
  two numbers; verify `evaluate` of `(B + sqrt(B^2 - 4*AC))/2`, with B, AC the numbers being
  matched (the pair are the roots of $t^2 - Bt + AC$). Skip on the difference-of-squares form.
- `zero-product`: "Set each factor equal to zero". Ask: the smaller root, verify `solve` of
  the standard-form equation with `positive` unset (it's a single unknown; the harness just
  checks it satisfies the equation).
- `answer`: "State both roots". Ask: the final tuple.

**Misconceptions:**
- `root-sign`: "Read the roots off the factors with the wrong sign". $(x + 3)(x - 2) = 0$
  gives −3 and 2, not 3 and −2. Wrong tuple: the negated roots, re-sorted. All levels.
- `forgot-leading` (L4): "Ignored the coefficient in the factor". From $(2x + 3) = 0$ said
  x = −3 instead of −3/2.
- `factor-equals-k` (L5 product form): "Set each factor equal to k instead of 0". From
  $(x + p)(x + q) = k$: roots k − p and k − q. The zero-product rule only works when the
  other side is 0.
- `square-root-one-root` is NOT used (a one-root answer doesn't fit the tuple).

**Interpretation** (L3, L4): "Between the two roots, the expression $ax^2 + bx + c$ is…"
positive / negative / zero / it depends. Correct: the opposite of the sign of a. Framing for
negative a (50%): "Profit is $\pi(q) = …$. For quantities between the two roots, profit is…".

**whyItMatters** idea: a profit function with a price that falls as you sell more is a
quadratic, and its roots are the break-even quantities. Example: $\pi(q) = -q^2 + 14q - 40
= -(q - 4)(q - 10)$, so the firm breaks even at 4 and 10 units and profits in between
($\pi(7) = 9$).

---

## 4. `quadratic-formula`: Quadratic formula
Track math, unit "Quadratics". Prerequisites `['quadratics-factoring']`.
`maxDenominator: 6`, `irrationalAnswers: true`.

Final answers are exact: `(-(b) - sqrt(D))/(2*(a))`. The learner types a decimal to 2+
places. Verify for tuple answers: the same three-equation `solve` as quadratics-factoring
(both roots satisfy the equation; their sum is −b/a).

**Levels:**
1. Discriminant only: $D = b^2 - 4ac$ for $ax^2 + bx + c = 0$, a in [1, 5], b in [−12, 12],
   c in [−12, 12], a mix of D > 0, D = 0 and D < 0 (`form` 0/1/2, chosen first, then
   params built to hit it). Answer: D (number), verify `evaluate` of `b^2 - 4*a*c` written
   from params.
2. Perfect-square D, rational roots, a in [1, 4]. Tuple.
3. Monic $x^2 + bx + c = 0$ with D > 0 not a perfect square. Tuple of exact irrational roots.
4. Non-monic, a in [2, 5], D > 0 not a perfect square. Tuple.
5. Break-even: $\pi(q) = -aq^2 + bq - c$ with a in [1, 3], both roots positive (D > 0, not
   necessarily a perfect square). Prompt in words; tuple `['Smaller quantity', 'Larger
   quantity']`, verify with `positive: true`.

**Steps** (keys and labels):
- `identify` (L2–L5): "Read off a, b and c". Ask: b (careful with the sign); verify
  `evaluate`. For L5 the equation is $-aq^2 + bq - c = 0$ (a is negative in the formula).
- `discriminant`: "Compute the discriminant". Ask: D; verify `evaluate` of `b^2-4*a*c`.
- `sqrt` (L2 only): "Take the square root". Ask: √D; verify `evaluate` of `sqrt(D)`.
- `plug-in` (L2–L5): "Apply the formula". Ask: the smaller root; verify `solve` of the
  equation with one unknown.
- `answer`: "State both roots". Ask: the final tuple (or D at L1).

**Misconceptions:**
- `disc-sign` (L1, L3–L5 where meaningful): "Added 4ac instead of subtracting". D' = b² + 4ac;
  at L1 the wrong number, at L3–L5 the roots with D' when D' ≥ 0.
- `neg-b-squared` (L1): "Squared −b as −b²". D' = −b² − 4ac.
- `minus-b-sign` (L2–L5): "Used +b instead of −b". Roots negated and re-sorted.
- `divide-only-sqrt` (L2–L5): "Divided only the square root by 2a". $-b \pm \sqrt D / (2a)$.
- `two-not-2a` (L2, L4, L5 with |a| ≠ 1): "Divided by 2 instead of 2a".

**Interpretation:**
- L1: "How many real solutions does the equation have?" 0 / 1 / 2 / infinitely many. Correct
  from the sign of D.
- L5: "At which quantity does the firm earn a profit?" four numbers, one strictly between the
  roots (pick integers; recompute π at each to decide).

**whyItMatters** idea: not every profit function factors nicely. $\pi(q) = -q^2 + 10q - 20$
has $D = 100 - 80 = 20$, so the break-even quantities are $5 \pm \sqrt5 \approx 2.76$ and
$7.24$. The discriminant also tells you at a glance whether break-even exists at all.

**Test file**: re-derive the L1 and L5 interpretation answers; check every tuple is sorted.

---

## 5. `inverse-functions`: Inverse functions
Track math, unit "Functions". Prerequisites `['function-composition']`. `maxDenominator: 9`.

**Levels:**
1. $f(x) = mx + b$ (m in [−6, 6] \ {0, ±1}, b in [−12, 12]); find $f^{-1}(k)$, integer
   answer. Verify `solve` of `m*x + b = k`.
2. Write the inverse of $f(x) = mx + b$ as $f^{-1}(x) = px + q$. Tuple `['p', 'q']` (labels
   rendered as the slope and intercept of $f^{-1}$). Verify: `solve` with unknowns
   `['p', 'q']` and equations `m*(p*1 + q) + b = 1` and `m*(p*2 + q) + b = 2` — that is,
   $f(f^{-1}(x)) = x$ at two points, which pins down a line.
3. Inverse demand: $Q = a - bP$ (a in [20, 200], b in [1, 10]) → $P = c - dQ$. Tuple
   `['Intercept', 'Slope']` with the slope negative (so −d). Verify by composition, as L2.
4. Nonlinear (`form`): $f(x) = a x^3 + b$ or $f(x) = \frac{ax + b}{cx + d}$ ($ad - bc \ne 0$);
   find $f^{-1}(k)$, an integer (or a fraction with denominator ≤ 9 for the rational form).
   Verify `solve` of `f(x) = k`.
5. Restricted domain: $f(x) = (x - h)^2 + k$ for $x \ge h$ (h in [0, 6]); find
   $f^{-1}(K)$ with $K = k + s^2$, s in [1, 8]. Answer h + s. Verify `solve` with
   `positive: true`; the test file checks the branch (answer ≥ h).

**Steps** (keys and labels):
- `set-up`: "Write f(x) = k (or y = f(x))". Ask (L1, L4, L5): which equation do you solve?
  choice among $f(x) = k$, $x = f(k)$, $\frac{1}{f(k)}$, $f(k) = x$.
- `swap` (L2, L3): "Swap the roles of input and output". Ask: choice, which equation
  describes the inverse.
- `undo-add`: "Undo the addition first". Ask: the number after subtracting; verify `evaluate`.
- `undo-mult`: "Then undo the multiplication". Ask: the result / p; verify as appropriate.
- `cross-multiply` (L4 rational): "Clear the fraction". Ask: the x-coefficient after
  collecting; verify `evaluate`.
- `root` (L4 cubic, L5): "Take the root (keep the branch in the domain)". Ask: the root value;
  verify `evaluate`.
- `answer`: "State the answer". Ask: the final answer.

**Misconceptions:**
- `reciprocal`: "Read $f^{-1}$ as $1/f$". Wrong number 1/f(k) (L1, L4). Skip when f(k) = 0.
- `evaluate-instead`: "Computed f(k) instead of $f^{-1}(k)$" (L1, L4, L5).
- `undo-order`: "Undid the steps in the wrong order". L1: k/m − b. L2/L3: tuple
  [1/m, −b] instead of [1/m, −b/m].
- `negative-reciprocal-slope` (L2, L3): "Used −1/m (the perpendicular slope)". Tuple
  [−1/m, b/m] (the sign error carried into both parts).
- `wrong-branch` (L5): "Took the negative square root". Answer h − s (when ≠ h + s).

**Interpretation:**
- L1 (50%): "$f^{-1}(k)$ answers which question?" Correct: "Which input gives the output k?"
  Distractors: "What is f at k?", "What is 1/f(k)?", "What is f(−k)?".
- L3: "What does the intercept of the inverse demand mean?" Correct: "the choke price: the
  price at which quantity demanded falls to zero". Plus a slope question 50%: "If quantity
  rises by 1 unit, the price consumers will pay changes by…" → −d.

**Test file** `tests/skills/inverse-functions.test.ts`: L5 answer is on the domain branch;
L2/L3 tuples satisfy $f(f^{-1}(x)) = x$ at five points; interpretation answers re-derived.

**whyItMatters** idea: demand is often written both ways. $Q = 120 - 4P$ says how much people
buy at a price; the inverse demand $P = 30 - Q/4$ says what price sells a quantity, which is
what a monopolist uses to compute revenue $P(Q) \cdot Q$. Logs are the inverse of
exponentials, so this is also the key to the next unit.

---

## 6. `function-transformations`: Transformations
Track math, unit "Functions". Prerequisites `['functions-basics', 'quadratics-factoring']`.
`maxDenominator: 4`.

Core task: a point (p, f(p)) on a base function moves to (X, Y) on
$g(x) = A\,f(B(x - h)) + k$. Base functions (`base` param): 0 → $x^2$, 1 → $|x|$,
2 → $\sqrt{x}$, 3 → $x^3$. Pick p so f(p) is an integer (p a perfect square for √x).

Final answer for L1–L4: tuple `['x', 'y']`, the image point. Verify: `solve` with unknowns
`['X', 'Y']` and equations `Y = A*f(B*(X - h)) + k` (f substituted, `abs()`/`sqrt()`) and
`B*(X - h) = p`. That says "the point on g that came from input p", independently of the
answer.

**Levels:**
1. One shift: $f(x) + k$ or $f(x - h)$ (`form`), h, k in [−6, 6] \ {0}. The prompt writes
   $f(x + 3)$ for h = −3.
2. Both shifts $f(x - h) + k$, all four base functions.
3. Reflection and vertical stretch: $A f(x) + k$ with A in {−3, −2, −1, 2, 3}, or $f(-x) + k$
   (`form`).
4. Horizontal scaling with a shift, written as $f(Bx - c)$, B in {2, 3, 1/2}. Correct image:
   $X = (p + c)/B$. The learner must factor B out first.
5. Build from words: "Start with $y = x^2$. Shift right h, stretch vertically by A, reflect
   over the x-axis [optional], shift up k." Ask for $g(x_0)$, a number. Verify `evaluate` of
   the written formula at x₀ (build the formula string separately from the word order).

**Steps** (keys and labels):
- `horizontal`: "Find the new x (horizontal moves act on the input, in reverse)". Ask: X;
  verify `solve` of `B*(X - h) = p`.
- `factor-b` (L4): "Factor B out of the input". Ask: the shift c/B; verify `evaluate`.
- `vertical`: "Find the new y (vertical moves act on the output, as written)". Ask: Y;
  verify `evaluate`.
- `formula` (L5): "Write g(x)". Ask: g(x) as an `expression`, verify `equivalent` with the
  formula built from the words.
- `answer`: "State the point" (or the value at L5). Ask: the final answer.

**Misconceptions:**
- `horizontal-sign`: "Moved the wrong way horizontally". $f(x - 3)$ moves right, not left:
  X = p − h (when h ≠ 0).
- `horizontal-scale-inverted` (L4): "Multiplied x by B instead of dividing". X = Bp + c/B.
- `factor-b-first` (L4): "Shifted before factoring out B". X = p/B + c.
- `reflect-wrong-axis` (L3 both forms): "Confused −f(x) with f(−x)". Image (−p, q + k) instead
  of (p, −q + k), and the reverse.
- `vertical-order` (L3, L5): "Added before multiplying". Y = A(q + k) instead of Aq + k.

**Interpretation** (L2, 50%): "A per-unit tax of \$t shifts the supply curve $P = S(Q)$…" up by
t / down by t / right by t / left by t. Correct: up by t (sellers need t more per unit). Use
the drawn k as t when k > 0, otherwise draw t in [1, 6] (after all other draws).

**Test file**: re-derive the interpretation; for L4 check X numerically against
$g(X) = A f(p) + k$.

**whyItMatters** idea: shifting curves is how economists show policy. A \$2 per-unit tax
moves supply $P = 10 + Q$ up to $P = 12 + Q$. Against demand $P = 40 - Q$, equilibrium
quantity falls from 15 to 14 and price rises from 25 to 26.
