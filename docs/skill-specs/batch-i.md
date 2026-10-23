# Batch I skill specs: multivariable calculus and matrices

These seven skills are the core of Econ 7370 (PLAN §8 item 2): marginal products, total
differentials, matrices, and unconstrained optimization in two variables. They unlock the econ
skills that are waiting on them: Cobb-Douglas, utility maximization, the Lagrangian and
comparative statics.

Build order (each one's prerequisites come first):

| # | id | Prerequisites (tree.ts) |
|---|---|---|
| 1 | `partial-derivatives` | `derivatives-chain-rule` |
| 2 | `total-differential` | `partial-derivatives` |
| 3 | `matrix-operations` | `systems-of-equations` |
| 4 | `determinants` | `matrix-operations` |
| 5 | `matrix-inverse` | `determinants` |
| 6 | `cramers-rule` | `determinants` |
| 7 | `multivariable-optimization` | `partial-derivatives`, `optimization`, `determinants` |

All seven are already in `src/skills/tree.ts` (track math, units "Multivariable calculus" and
"Matrices"). Files go in `src/skills/math/`.

**Rules for every skill:** follow `CLAUDE.md` → "Adding a skill", and the shared requirements
at the top of `batch-h.md` (same `params` keys at every level, use a `form` param when a level
mixes prompt types, choose backwards from a clean answer, every misconception reachable, every
step key labelled, the last step's ask equals the answer, interpretation draws last).
Reference skills:
- `src/skills/math/derivatives-power-rule.ts`: expression answers, per-term steps
- `src/skills/math/systems-of-equations.ts`: tuple answers with a `solve` verify
- `src/skills/econ/supply-demand-equilibrium.ts`: choice steps, interpretation questions

**Matrices in text.** Display with `\begin{bmatrix} a & b \\ c & d \end{bmatrix}` (KaTeX supports
it). A matrix answer is a `tuple` with labels in reading order: `['Row 1, col 1', 'Row 1, col 2',
'Row 2, col 1', 'Row 2, col 2']`. Only 2×2 results are answers; 3×3 matrices appear only as
inputs (a determinant, one entry, a product with a vector).

---

## 0. Engine additions (done by the lead before the skill files; shared code)

Two new `VerifySpec` types, each checked independently in `tests/verify-check.ts` and
`verify/sympy_check.py`:

- `{ type: 'partial'; expr: string; wrt: string[]; variables: string[]; at?: Record<string, string> }`:
  the answer is $\partial^k f / \partial w_1 \cdots \partial w_k$ of `expr` (`wrt` in order, so
  `['x', 'y']` is $f_{xy}$). Without `at`, the answer is an expression in `variables`; with `at`,
  it is the number at that point. TS check: `math.derivative` applied in sequence, then compared by
  sampling all `variables` (or evaluated at `at`). SymPy: `sp.diff(f, *wrt).subs(at)`.
- `{ type: 'det'; matrix: string[][] }`: the answer is the determinant of `matrix` (entries as
  mathjs/SymPy strings). TS: `math.det`; SymPy: `sp.Matrix(...).det()`.

Use `partial` for every derivative step in these skills (the existing `diff` only scopes one
variable). Use `det` for every determinant step.

---

## 1. `partial-derivatives`: Partial derivatives
Unit "Multivariable calculus". `maxDenominator: 4`.

$f(x, y)$ is a sum of terms $k\,x^m y^n$. A param `wrt` (0 = x, 1 = y) picks the variable at
every level. Exponents m, n in [0, 3]; coefficients in [−9, 9] \ {0}. Every $f$ has at least one
mixed term (m, n ≥ 1) and one term without the variable you differentiate by.

**Levels:**
1. Two or three terms, one mixed term $k x^m y^n$ with n = 1 when `wrt` = x (or m = 1 when
   `wrt` = y), one term in the other variable only. Expression answer.
2. Three or four terms, mixed term with both exponents ≥ 1 (e.g. $3x^2y^3$). Expression answer.
3. Chain rule: `form` 0 $(ax + by)^n$, n in [2, 4]; `form` 1 $e^{ax + by}$; `form` 2
   $\ln(ax + by)$. a, b in [−5, 5] \ {0}. Expression answer.
4. Level-2 polynomial, evaluate $f_x$ or $f_y$ at an integer point $(x_0, y_0)$ in [−3, 3]².
   Number answer, `verify: partial` with `at`.
5. Second-order partial at a point: `which` 0 $f_{xx}$, 1 $f_{xy}$, 2 $f_{yy}$. Number answer.
   (These are the Hessian entries used by `multivariable-optimization`.)

**Steps:**
- `hold-constant` (L1–L3): "Treat the other variable as a constant". Choice: "When you
  differentiate with respect to $x$, how do you treat $y$?" Options: as a constant (correct);
  as a variable you also differentiate; as zero.
- `terms` (L1, L2, L4): "Differentiate term by term". Ask: the partial derivative as an expression;
  verify `partial`.
- `inner` (L3): "Differentiate the inside". Ask: the partial of the inner expression (a or b, a
  number); verify `partial` of the inner expression.
- `outer` (L3): "Apply the chain rule". Ask: the final expression; verify `partial`.
- `substitute` (L4, L5): "Substitute the point". Ask: the number; verify `partial` with `at`.
- `first` (L5): "Take the first partial". Ask: $f_x$ or $f_y$ as an expression; verify `partial`.

**Misconceptions:**
- `wrong-variable`: "Differentiated with respect to the other variable". The partial with respect
  to the other variable (at the point, for L4–L5). L1–L5.
- `differentiated-both`: "Differentiated the other variable too". Each mixed term
  $k x^m y^n$ becomes $k m n\, x^{m-1} y^{n-1}$. L1, L2, L4.
- `kept-constant-term`: "Kept a term without the variable (it should vanish)". Answer plus
  the terms that don't contain the variable. L1, L2, L4.
- `dropped-mixed-term`: "Dropped a term that has both variables". Answer minus the mixed term's
  derivative. L1, L2, L4.
- `forgot-inner` (L3): "Forgot to multiply by the inside's derivative". The answer divided by
  a (or b).
- `wrong-second` (L5): "Took the wrong second partial". Another of $f_{xx}, f_{xy}, f_{yy}$ at
  the point.

**Interpretation** (L4, 50%): "$Q = f(L, K)$ is output from $L$ hours of labor and $K$
machines. $f_L(L_0, K_0) = v$. What does this mean?" (variables renamed L, K in the prompt
only). Options: one more hour of labor, *with machines held fixed*, changes output by about v
(correct); one more hour of labor *and* one more machine change output by about v; output equals
v; labor's average product is v. When v < 0, the correct option says "lowers output by about
|v|". Re-derive in `tests/skills/partial-derivatives.test.ts` from the sign of the answer.

**whyItMatters** idea: the marginal product of labor is a partial derivative. With
$Q = 4L + 2LK + K^2$, $\partial Q/\partial L = 4 + 2K$; with $K = 5$ machines, one more hour
of labor adds about 14 units of output while capital stays fixed.

---

## 2. `total-differential`: Total differential
Unit "Multivariable calculus". `maxDenominator: 4`.

$df = f_x\,dx + f_y\,dy$. Changes dx, dy are multiples of 1/4 in [−2, 2] \ {0}.

**Levels:**
1. The partials are given as numbers ($f_x = 6$, $f_y = -2$ at the current point). Find the
   approximate change for given dx, dy. Example: $6(0.5) + (-2)(0.25) = 2.5$.
2. $f$ is a polynomial (as in partial-derivatives L2), with an integer point and dx, dy. Number.
3. Slope of a level curve: along $f(x, y) = c$, $dy/dx = -f_x / f_y$ at a point. Polynomial $f$,
   integer point, $f_y \ne 0$. Number (may be a fraction).
4. A production story: $Q = f(L, K)$ polynomial; labor rises by ΔL and capital *falls* by ΔK.
   Approximate change in output. Number.
5. Marginal rate of substitution for $U = x^a y^b$, a, b in [1, 3], integer point in [1, 6]²:
   the slope of the indifference curve, $dy/dx = -\frac{a y}{b x}$. Number. Example: $U = x^2 y$
   at $(3, 4)$: $U_x = 24$, $U_y = 9$, slope $-8/3$.

**Steps:**
- `fx`, `fy` (L2–L5): "Find the partial with respect to x" / "… y" at the point. Ask: number;
  verify `partial` with `at`. (L1 gives them.)
- `combine` (L1, L2, L4): "Multiply each partial by its change and add". Ask: the final number;
  verify `evaluate` of `fx*dx + fy*dy` written from the params (the partials are verified in their
  own steps).
- `sign-change` (L4): "Write the decrease as a negative change". Ask: dK as a number; verify
  `evaluate`.
- `slope` (L3, L5): "Divide: dy/dx = −f_x / f_y". Ask: the number; verify `solve` of
  `fx*1 + fy*m = 0` for m (moving along the curve keeps df = 0).

**Misconceptions:**
- `forgot-dy-term`: "Left out the f_y dy term". $f_x\,dx$ only. L1, L2, L4.
- `added-partials`: "Added the partials without the changes". $f_x + f_y$. L1, L2, L4.
- `sign-of-decrease` (L4): "Used a decrease as a positive change". ΔK entered with + sign.
- `slope-inverted` (L3, L5): "Divided the wrong way". $-f_y / f_x$.
- `slope-sign` (L3, L5): "Dropped the minus sign". $f_x / f_y$.

**Interpretation** (L5, 50%): "The slope is $-8/3$ at this bundle. What does it mean?" Correct:
the consumer would give up about 8/3 units of y for one more unit of x and be equally well off.
Distractors: gains 8/3 units of y; utility rises by 8/3; the price ratio is 8/3 (true only at
an optimum). Re-derive from the answer.

---

## 3. `matrix-operations`: Matrix operations
Unit "Matrices". `maxDenominator: 1`. Integer entries in [−9, 9] (L5: [0, 9]).

**Levels:**
1. `form` 0 $A + B$, 1 $A - B$, 2 $kA$ (k in [−5, 5] \ {0, 1}), 2×2. Tuple of four entries.
2. One entry of a product: "What is the entry in row i, column j of $AB$?" A is 2×3 and B is
   3×2, or both 2×2. Number.
3. Full 2×2 product $AB$. Tuple.
4. Dimensions: "A is m×n and B is p×q. What is the size of $AB$?" Options: the right size
   (or "Not defined" when n ≠ p), n×p, q×m, and "Not defined" or a filler. Choice; dimensions in
   [1, 5]; about a third of problems are undefined.
5. Cost story: three products, a 3-vector of quantities and a 3×3 input table (inputs per
   unit) times a price vector: total cost of each input type, or "matrix times vector" giving a
   3-entry tuple labelled by the input names. Interpretation lives here.

**Verify:** tuples use `solve` with one equation per entry from the definition, e.g.
`p11 = (2)*(5) + (3)*(7)`, unknowns `p11, p12, …`. L2 the same with one equation. L4 `choice`.

**Steps:**
- `entrywise` (L1): "Combine matching entries". Ask: the row 1, column 1 entry; verify `solve`.
- `row-col` (L2, L3, L5): "Row times column". Ask: the products to add for one entry, i.e. the
  entry itself (number); verify `solve`.
- `inner-dims` (L4): "Compare the inner dimensions". Choice: are n and p equal?
- `outer-dims` (L4): "Read the size from the outer dimensions". The final choice.
- `assemble` (L3, L5): "Fill in every entry". The final tuple.

**Misconceptions:**
- `entrywise-product` (L2, L3): "Multiplied matching entries". $a_{ij} b_{ij}$ (2×2 only).
- `wrong-order` (L2, L3): "Multiplied B times A". $(BA)_{ij}$.
- `reversed-subtraction` (L1, form 1): "Subtracted A from B". $B - A$.
- `scalar-first-row` (L1, form 2): "Multiplied only the first row". Second row unchanged.
- `inner-as-size` (L4): "Used the inner dimensions as the size". n×p.
- `defined-anyway` (L4): "Multiplied matrices whose inner sizes don't match". m×q when n ≠ p.

**Test file** `tests/skills/matrix-operations.test.ts` (required for L4): re-derive the right
option from m, n, p, q.

---

## 4. `determinants`: Determinants
Unit "Matrices". `maxDenominator: 1`. Number answers.

**Levels:**
1. 2×2, entries in [−9, 9]. $ad - bc$.
2. 2×2 with a parameter: "For which k is $\begin{bmatrix} k & 2 \\ 6 & 3 \end{bmatrix}$
   singular?" Integer k. Verify `solve` of `k*3 - 2*6 = 0`.
3. 3×3 triangular (or with a row of zeros, `form` 1, answer 0): product of the diagonal.
4. 3×3 general, entries in [−5, 5], by cofactor expansion along the first row.
5. Properties, given $\det A = d$ (and $\det B$) for 2×2 or 3×3 (`n` param): `form` 0
   $\det(kA) = k^n d$, 1 $\det(AB)$, 2 $\det(A^T)$, 3 swap two rows. Number.

**Steps:**
- `diagonals` (L1, L2): "Multiply the diagonals and subtract". Ask: the answer (L1) or the
  determinant as an expression in k (L2, verify `equivalent`).
- `minors` (L4): "Find the three 2×2 minors". One ask per minor (`minor-1`, `minor-2`,
  `minor-3`), each verify `det`.
- `signs` (L4): "Alternate the signs +, −, +". Choice: which sign goes with the middle term?
- `expand` (L4): "Add the signed terms". Final number; verify `det`.
- `triangular` (L3): "Multiply down the diagonal". Final number; verify `det`.
- `property` (L5): "Apply the determinant rule". Final number; verify `evaluate` from the rule
  (the rule is the problem statement here; the test file below checks it on random matrices).

**Misconceptions:**
- `added-diagonals` (L1, L2): "Added the diagonal products". $ad + bc$.
- `reversed-diagonals` (L1, L2): "Subtracted the wrong way". $bc - ad$.
- `cofactor-signs` (L4): "Left out the alternating signs". All three terms added.
- `scalar-once` (L5 form 0): "Multiplied by k only once". $k\,d$ instead of $k^n d$.
- `swap-keeps-sign` (L5 form 3): "Kept the sign after a row swap". d instead of −d.
- `product-as-sum` (L5 form 1): "Added the determinants". $\det A + \det B$.

**Test file** `tests/skills/determinants.test.ts`: for L5, build random integer matrices with
the given determinants and confirm each rule numerically with `math.det`.

**whyItMatters** idea: a zero determinant means the system has no unique solution. In a
two-market model, a nonzero determinant is what lets Cramer's rule give one equilibrium; in
optimization, the Hessian's determinant decides between a maximum and a saddle.

---

## 5. `matrix-inverse`: Matrix inverse
Unit "Matrices". `maxDenominator: 4`. 2×2 only: $A^{-1} = \frac{1}{ad - bc}\begin{bmatrix} d & -b \\ -c & a \end{bmatrix}$.

**Levels:**
1. det = ±1, integer inverse. Tuple.
2. det in {±2, ±4}, fractional inverse. Tuple.
3. "Which matrix has no inverse?" Four 2×2 matrices, exactly one singular. Choice.
4. Solve $A\mathbf{x} = \mathbf{b}$ as $\mathbf{x} = A^{-1}\mathbf{b}$, integer solution. Tuple
   `['x', 'y']`, verify `solve` of the two equations.
5. "Here is $A$ and its inverse with one entry missing. Find it." Number, verify `solve` of
   the entry of $A A^{-1}$ that involves the missing entry, set to the identity's entry.

**Verify** for L1–L2: `solve` of $A X = I$ (four equations, unknowns `a, b, c, d` for the
inverse's entries).

**Steps:**
- `det` (L1, L2, L4): "Find the determinant". Ask: number; verify `det`.
- `adjugate` (L1, L2): "Swap the diagonal, negate the off-diagonal". Ask: the row 1, column 1
  entry of the adjugate (d); verify `evaluate`.
- `scale` (L1, L2): "Divide every entry by the determinant". The final tuple.
- `singular` (L3): "A determinant of 0 means no inverse". The final choice.
- `multiply` (L4): "Multiply the inverse by b". The final tuple.
- `identity` (L5): "Use A times its inverse = I". The final number.

**Misconceptions:**
- `no-swap` (L1, L2): "Didn't swap the diagonal entries". $\frac{1}{\det}\begin{bmatrix} a & -b \\ -c & d \end{bmatrix}$.
- `negated-diagonal` (L1, L2): "Negated the diagonal instead". $\frac{1}{\det}\begin{bmatrix} -d & b \\ c & -a \end{bmatrix}$.
- `forgot-det` (L2): "Didn't divide by the determinant". The adjugate itself.
- `reciprocal-entries` (L1, L2): "Took 1 over each entry". $1/a_{ij}$ (only where all are nonzero).
- `a-times-b` (L4): "Multiplied A by b instead of its inverse". $A\mathbf{b}$.
- `zero-entry` (L3): "Picked the matrix with a zero in it". A distractor with a 0 entry and
  nonzero determinant; always present at L3.

**Test file** `tests/skills/matrix-inverse.test.ts` (required for L3): exactly one option has
determinant 0.

---

## 6. `cramers-rule`: Cramer's rule
Unit "Matrices". `maxDenominator: 6`.

$x_i = \det A_i / \det A$, where $A_i$ is A with column i replaced by b.

**Levels:**
1. 2×2 system, find x only. Integer solution. Number.
2. 2×2, both unknowns. Tuple `['x', 'y']`.
3. 2×2 with a fractional solution (denominator ≤ 6). Tuple.
4. 3×3 system, find one named unknown (x, y or z, `which` param), integer solution, entries in
   [−4, 4]. Number.
5. Keynesian model: $Y = C + I_0 + G_0$, $C = a + bY$ with b in {0.5, 0.6, 0.75, 0.8} (as
   fractions), a, I₀, G₀ multiples of 10 chosen so Y is an integer. Write it as a system in
   (Y, C) and solve: $Y = \frac{a + I_0 + G_0}{1 - b}$. Tuple `['Y', 'C']`. Example: a = 100,
   b = 3/4, I₀ = G₀ = 50 gives Y = 800, C = 700.

**Verify:** `solve` of the original equations, every level.

**Steps:**
- `det-a`: "Find det A". Ask: number; verify `det`.
- `det-x` / `det-y` / `det-z`: "Replace the column and take the determinant". Ask: number;
  verify `det` of the replaced matrix.
- `divide`: "Divide: det A_i / det A". The final answer (or the first component, L2–L3, with a
  second `divide-y` step for y).
- `rewrite` (L5): "Move the unknowns to the left". Choice: which matrix form is right (the
  coefficient matrix $\begin{bmatrix} 1 & -1 \\ -b & 1 \end{bmatrix}$ against sign-flipped
  distractors).

**Misconceptions:**
- `replaced-row` (L1–L4): "Replaced a row instead of a column". det of A with row i replaced
  by b, over det A (skip when that equals the answer).
- `ratio-inverted` (L1–L4): "Divided the wrong way". $\det A / \det A_i$.
- `wrong-column` (L1, L4): "Replaced the column of a different unknown". Gives that unknown's
  value.
- `multiplier-b` (L5): "Divided by b instead of 1 − b". $Y = (a + I_0 + G_0)/b$.

**Interpretation** (L5, 50%): "If government spending rises by 10, by how much does Y rise?"
Options: $10/(1 - b)$ (correct), 10, $10b$, $10/b$. Re-derive in
`tests/skills/cramers-rule.test.ts`.

---

## 7. `multivariable-optimization`: Multivariable optimization (FOC/SOC)
Unit "Multivariable calculus". `maxDenominator: 4`.

$f(x, y) = a x^2 + b xy + c y^2 + d x + e y + g$, so the first-order conditions are linear and
the Hessian $\begin{bmatrix} 2a & b \\ b & 2c \end{bmatrix}$ is constant. Choose the critical
point $(x^*, y^*)$ first (integers in [−6, 6]; L5 positive), then set d and e so the FOCs hold:
$d = -(2a x^* + b y^*)$, $e = -(b x^* + 2c y^*)$. Require $4ac - b^2 \ne 0$.

**Levels:**
1. b = 0 (the FOCs separate). Tuple `['x', 'y']`.
2. b ≠ 0. Tuple.
3. Classify a critical point from the Hessian. Give $f$ (or the second partials directly,
   `form` 1). Options: local maximum, local minimum, saddle point, test inconclusive. Choice.
   Mix the cases evenly; include $D = 0$ problems only in `form` 1.
4. A two-product firm's profit $\pi(x, y)$ (a, c < 0, $4ac - b^2 > 0$): find the maximum
   profit. Number, verify `evaluate` of π at the point (the point itself is verified in its steps).
5. Price discrimination: $P_1 = \alpha_1 - \beta_1 q_1$, $P_2 = \alpha_2 - \beta_2 q_2$, constant
   marginal cost m. Tuple `['q₁', 'q₂']`. Example: $P_1 = 100 - 2q_1$, $P_2 = 80 - q_2$, m = 20
   gives $q_1 = 20$, $q_2 = 30$ (prices 60 and 50).

**Steps:**
- `fx`, `fy`: "Take the partial with respect to x" / "… y". Ask: expression; verify `partial`.
- `foc`: "Set both partials to zero and solve". Ask: the point (tuple); verify `solve`.
- `hessian`: "Find the second partials". Ask: $f_{xx} f_{yy} - f_{xy}^2$ (number); verify
  `evaluate` from the `partial`-verified second partials.
- `classify`: "Use D and f_xx". Choice (max / min / saddle / inconclusive).
- `value` (L4): "Evaluate profit at the optimum". The final number.

**Misconceptions:**
- `foc-one-at-a-time` (L2, L4): "Solved each condition as if the other variable were 0".
  $x = -d/(2a)$, $y = -e/(2c)$.
- `forgot-factor-2` (L1, L2, L4, L5): "Differentiated $ax^2$ as $ax$". Solve the FOCs with a, c
  in place of 2a, 2c.
- `ignored-cross` (L3): "Left out $f_{xy}^2$". Classify using $f_{xx} f_{yy}$ alone (only where
  that changes the answer).
- `fxx-sign-swapped` (L3): "Read $f_{xx} < 0$ as a minimum". D > 0 cases with the max/min
  swapped.
- `saddle-as-extremum` (L3): "Called a point with D < 0 a maximum or minimum". The option
  matching the sign of $f_{xx}$.
- `mr-equals-price` (L5): "Set price equal to marginal cost". $q_i = (\alpha_i - m)/\beta_i$.

**Interpretation** (L5, 50%): "At the profit-maximizing quantities, which is true?" Correct:
marginal revenue is the same in both markets and equals marginal cost. Distractors: prices are
equal; quantities are equal; price equals marginal cost in each market.

**Test file** `tests/skills/multivariable-optimization.test.ts` (required for L3): classify
independently by sampling $f$ on a small circle around the point (all values lower → max, all
higher → min, both → saddle), and re-derive the L5 interpretation.

---

## Delegation and checks

1. Lead: the section 0 engine additions, then the full `npm test` and `npm run verify:sympy`
   (shared engine code changed).
2. Subagents (Sonnet), in two waves so prerequisites exist first: wave 1 `partial-derivatives`,
   `matrix-operations`, `determinants`; wave 2 the other four. Each gets `CLAUDE.md`, PLAN §8,
   this spec's section for its skill, and the matching reference skill file.
3. Lead reviews every generator's math by hand, then runs `npm test` and
   `npm run verify:sympy:skills -- <the seven ids>`.
4. Placement: these add leaf skills, so check `MAX_ITEMS` in `learning/placement.ts` still lets a
   perfect learner reach every skill (raise it if not).
5. Optional after the batch: the working pad on multivariable optimization L1–L2 and Cramer's
   rule L1–L3 (`solve` verifies with x, y already in place).
