# Batch G specs: GRE Quant track (14 skills)

GRE-style practice, procedurally generated and verified like every other skill. These are not
copied from ETS or any question bank. Same rules as `CLAUDE.md` → "Adding a skill", plus:

**Reference:** `src/skills/gre/gre-integers.ts` shows all four formats. Copy its structure.
Files go in `src/skills/gre/<id>.ts`, `track: 'gre'`, with ids, units and prerequisites
matching `src/skills/tree.ts` exactly.

**The four GRE formats.** Mix them within a skill; across its 5 levels, each skill should use
at least three.
- **Numeric entry:** a `numberAnswer`. Fractions and decimals are fine where the GRE would
  accept them.
- **Multiple choice, one answer:** a `choice` answer with 5 options (A–E style). Distractors
  must be the results of real mistakes, computed from the params.
- **Select all that apply:** a `multiAnswer` with 3–7 options and at least 1 correct. Always
  use `verify: { type: 'choice', note }` plus a skill test that re-derives every option.
- **Quantitative comparison (QC):** `qcAnswer(relation)` with the fixed `QC_OPTIONS`. Write
  the prompt like gre-integers' `QC_PROMPT`: optional centered setup, **Quantity A**,
  **Quantity B**.
  - **The generator must compute the relation exactly**, never by random sampling:
    - exact arithmetic when there are no variables;
    - exhaustive enumeration over a small integer domain;
    - or a proven case analysis (e.g. for x > 1, x² > x).
  - **Use `verify: { type: 'qc', ... }`** whenever both quantities are mathjs expressions. The
    harness then re-derives the relation independently by sampling with traps (0, ±1, ±½,
    bounds).
  - **If a quantity isn't expressible in mathjs** (e.g. "the number of divisors"), use a
    `choice` verify plus a skill test that brute-forces it.
  - **Bake the real GRE traps into the parameter choices:**
    - variables that may be negative, fractional, or 0;
    - "cannot be determined" whenever the constraints allow both directions;
    - figures not drawn to scale.

**Figures:** use `src/engine/figures.ts` (`triangleFigure`, `circleFigure`, `planeFigure`,
`barChartFigure`, `tableFigure`). Never hand-write SVG. Always give a meaningful `alt` text
that includes the given measurements. Say "Figure not drawn to scale" in the prompt whenever
the question depends on not trusting the picture (as the GRE does).

**Numbers:** GRE answers are usually integers or simple fractions/decimals. Use `Q` arithmetic.
`maxDenominator` should fit the skill (percents often need 100).

**Steps:** the GRE is about the *fastest correct method*. Put strategy into the steps where
it fits:
- plug in numbers
- back-solve from the options
- estimate
- in QC, simplify both sides the same way
- test 0, 1, negatives and fractions

**whyItMatters:** say how the skill shows up on the GRE, with a concrete example. Where
there's a genuine link to economics or statistics (percent change, rates, data interpretation,
the normal distribution), mention it.

---

## GRE · Arithmetic

### `gre-fractions-percents`: Fractions & percents (prereqs `['gre-integers']`)
1. **Percent of a number, and percent change:** "60 to 75 is what percent increase?"
   Numeric. Choose numbers so the answer is an integer percent.
2. **Successive percent changes:** +20% then −20%, so the net is −4%. Ask the net percent
   change (numeric), or a QC: "A: price after +x% then −x%; B: original price" → B.
3. **Fraction arithmetic and comparison:** QC of two fractions (cross-multiply). Or
   "which of the following are greater than 1/3?" (select-all, 5 fractions).
4. **Percent of a percent / reverse percent:** "after a 25% discount the price is \$60; what
   was the original?" Numeric 80. The trap is "60 × 1.25 = 75".
5. **Mixed QC with a variable:** x > 0, "A: x% of 80; B: 80% of x" → c (always equal).
   Also a ratio-of-percents trap.

Misconceptions:
- `percent-change-base`: divided by the new value instead of the original
- `successive-additive`: +20% then −20% read as 0%
- `reverse-percent-multiplied`: 60 × 1.25 instead of 60 / 0.75
- `fraction-compare-by-numerator`: compared fractions by their numerators

### `gre-ratios-rates`: Ratios, rates & work (prereqs `['gre-fractions-percents']`)
1. **Split a total in a ratio:** a:b of total T. Numeric.
2. **Combined work:** "A alone takes a hours, B alone b hours; together?" The answer is
   ab/(a+b). Choose a, b so it's clean. Numeric.
3. **Average speed over a round trip:** the harmonic mean, 2uv/(u+v).
   - QC: "A: average speed; B: (u+v)/2" → b when u ≠ v (the arithmetic mean is always
     greater).
   - Prove it: (u+v)/2 − 2uv/(u+v) = (u−v)²/(2(u+v)) > 0.
4. **Rate × time = amount**, with unit conversion (e.g. km/h and minutes). Numeric.
5. **Mixtures:** combine c1% of x liters with c2% of y liters. The resulting concentration
   (numeric), or the amount to add for a target.

Misconceptions:
- `work-rates-added-times`: added the times instead of the rates
- `average-speed-arithmetic-mean`: averaged the two speeds
- `ratio-part-vs-whole`: read a:b as a/b of the total
- `unit-conversion-missed`: mixed minutes and hours

### `gre-exponents-roots`: Exponents & roots (prereqs `['gre-integers']`)
1. **Simplify** $\sqrt{a^2 b}$ to integer × √b. Numeric: "√72 = k√2; k = ?". Or evaluate a
   numeric power.
2. **Same-base equations:** $2^{x+1} = 32$, $9^x = 27$ (fractional answer). Numeric.
3. **QC with powers of fractions and negatives:** "0 < x < 1: A: x²; B: √x" → b.
   "−1 < x < 0: A: x³; B: x²" → b. Use `qc` verify.
4. **Factor out common powers:** $\frac{2^{20} + 2^{18}}{2^{18}} = 5$. Numeric.
5. **Units digit of a power:** units digit of $7^{n}$, by its cycle. Numeric; the skill test
   computes it by modular exponentiation.

Misconceptions:
- `sqrt-of-sum`: √(a+b) = √a + √b
- `added-bases`: $2^{20} + 2^{18} = 2^{38}$
- `fraction-powers-grow`: thought squaring always makes a number bigger
- `units-cycle-off-by-one`: miscounted position in the units-digit cycle

## GRE · Algebra

### `gre-equations-word-problems`: Equations & word problems (prereqs `['gre-fractions-percents']`)
1. **Translate a sentence to an equation:** "5 more than twice a number is 17". Numeric.
2. **Ages / consecutive integers / coins:** set up a linear equation. Numeric.
3. **Systems from words:** tickets at two prices, totals given. Tuple answer, or numeric for
   one unknown.
4. **QC with a solved system:** "2x + y = 10, x − y = 2: A: x; B: y" → computed exactly.
5. **"Which of the following could be the value of n?"** (select-all) from an equation with a
   parity or integer constraint. The skill test checks each option.

Misconceptions:
- `translation-order`: "5 less than x" written as 5 − x
- `solved-for-wrong-variable`: gave the other unknown
- `consecutive-off-by-one`: misindexed consecutive integers

### `gre-inequalities-absolute-value`: Inequalities & absolute value (prereqs `['gre-equations-word-problems']`)
1. **Solve a linear inequality**, including multiplying by a negative. MC with 5 interval
   options.
2. **|x − a| = b**: two solutions. "What is the sum of the solutions?" Numeric 2a.
3. **|x − a| < b as an interval:** "how many integers satisfy it?" Numeric. The skill test
   enumerates.
4. **QC with inequality constraints:** "x < y < 0: A: xy; B: y²" → a (since x < y < 0 gives
   xy > y²). Use `qc` verify with constraints.
5. **Select-all "which must be true"** given constraints like a > b > 0. Options such as
   a² > b², 1/a < 1/b, a − b > 0, −a > −b (false). The skill test checks each by
   counterexample search over a grid.

Misconceptions:
- `inequality-not-flipped`: didn't flip when multiplying by a negative
- `abs-one-solution`: found only one solution of |x − a| = b
- `endpoint-inclusion`: counted endpoints for a strict inequality
- `must-vs-could`: picked an option that is only sometimes true

### `gre-quadratics-functions`: Quadratics & functions (prereqs `['gre-equations-word-problems', 'gre-exponents-roots']`)
1. **Factor and solve** $x^2 + bx + c = 0$ with integer roots. "Sum (or product) of roots?"
   Numeric.
2. **Special products:** $(a+b)^2$, $a^2 - b^2$. Given $x + y = s$ and $x - y = d$, find
   $x^2 - y^2 = sd$. Numeric.
3. **Function notation:** f(x) = …, find f(a) − f(b), or f(f(a)). Numeric.
4. **QC with a quadratic over a domain:** "A: (x−3)(x+2); B: x² − x − 6" → c. Or a vertex
   comparison.
5. **Symbol-defined operations:** "a ⊕ b = 2a − b², find 3 ⊕ (1 ⊕ 2)". Numeric.

Misconceptions:
- `square-term-by-term`: (a+b)² = a² + b²
- `root-sign`: roots of (x+3)(x−2) given as −2 and 3
- `operation-order`: evaluated the nested operation outside-in

### `gre-coordinate-geometry`: Coordinate geometry (prereqs `['gre-equations-word-problems']`)
1. **Slope** between two points, and the line equation. Numeric (slope, a simple fraction).
2. **Distance and midpoint.** Choose Pythagorean triples so the distance is an integer.
   Include a `planeFigure`.
3. **Parallel/perpendicular:** "slope of a line perpendicular to 3x + 4y = 12" → 4/3.
   Numeric.
4. **Intercepts and the area of the triangle** a line makes with the axes. Numeric. Use a
   `planeFigure`.
5. **QC from a graph:** "line ℓ passes through (a, b) and (c, d): A: the slope of ℓ; B: 1",
   computed exactly. Include a figure.

Misconceptions:
- `slope-inverted`: Δx/Δy
- `perpendicular-not-negated`: used the reciprocal without the sign change
- `distance-no-square-root`: forgot to take the square root

## GRE · Geometry
(Use `triangleFigure` / `circleFigure`. Every geometry prompt states which measurements are
given.)

### `gre-lines-angles-triangles`: Lines, angles & triangles (prereqs `['gre-integers']`)
1. **Angles in a triangle / on a line:** find x° from two given angles. Numeric, with a figure.
2. **Pythagorean triples** and multiples (3-4-5, 5-12-13, 8-15-17). Find a missing side.
   Numeric, with a figure and `rightAngleAt`.
3. **Special triangles:** 45-45-90 and 30-60-90, answers like 4√3. The value is an exact
   expression, e.g. `4*sqrt(3)`, with `irrationalAnswers: true`. Or give it as MC options.
4. **Isosceles triangle facts:** base angles, and the perimeter or area. Numeric.
5. **QC with "figure not drawn to scale":** in triangle ABC, AB > AC; A: angle C, B:
   angle B → a (the larger angle is opposite the longer side). Or the triangle inequality:
   "which of the following could be the third side?" (select-all; the skill test checks
   |a−b| < c < a+b).

Misconceptions:
- `pythagorean-added-legs`: c = a + b
- `special-triangle-ratio-swapped`: put √3 on the wrong side
- `trusted-the-figure`: answered from the picture
- `triangle-inequality-inclusive`: allowed c = a + b

### `gre-circles-polygons`: Circles & polygons (prereqs `['gre-lines-angles-triangles']`)
1. **Area and circumference from the radius or diameter.**
   - Ask for the coefficient of π: "area = kπ, k = ?" (numeric).
   - The verify compares kπ against the formula directly, e.g. `evaluate` of `r^2`.
2. **Arc length / sector area** from a central angle, with a figure (`sectorDegrees`).
   Numeric coefficient of π.
3. **Interior angle sum** (n−2)·180, and each interior angle of a regular n-gon. Numeric.
4. **Area of a composite figure:** a rectangle with a semicircle, or a square with an
   inscribed circle. Numeric or an exact expression.
5. **QC:** "A: the area of a circle with circumference 10π; B: the area of a square with
   diagonal 10" → 25π vs 50 → a. Exact comparison.

Misconceptions:
- `diameter-as-radius`: used d where r was needed
- `circumference-area-swap`: mixed up 2πr and πr²
- `polygon-sum-n-times-180`: used n·180
- `sector-fraction-wrong`: used angle/180 instead of angle/360

### `gre-solids`: Solids: volume & surface area (prereqs `['gre-circles-polygons']`)
1. Volume of a rectangular box. Numeric.
2. Surface area of a box: 2(lw + lh + wh). Numeric.
3. Cylinder volume and surface area: the coefficient of π. Numeric.
4. **Scaling:** double every edge → volume × 8. Numeric factor, or a QC.
5. **The longest diagonal of a box**, √(l² + w² + h²). Choose clean values: (2, 3, 6) → 7,
   (1, 4, 8) → 9, (2, 6, 9) → 11, (4, 4, 7) → 9.

Misconceptions:
- `surface-area-half`: lw + lh + wh, missing the 2
- `scaling-linear`: thought doubling the edges doubles the volume
- `cylinder-lateral-only`: forgot the two circles in the surface area

## GRE · Data analysis

### `gre-descriptive-stats`: Mean, median, range & SD (prereqs `['gre-fractions-percents']`)
1. **Mean, median, mode and range** of a list of 5–9 integers. Numeric (ask one).
2. **Missing value given the mean:** "the average of 5 numbers is 12; four are …; find the
   fifth". Numeric.
3. **Weighted average** of two groups. Numeric.
4. **QC on standard deviation without computing it:**
   - "A: SD of {2, 4, 6}; B: SD of {12, 14, 16}" → c (a shift doesn't change spread).
   - Or {1, 5, 9} vs {4, 5, 6} → a.
   - Compute both exactly (population SD via the variance) in the generator, and use a
     `qc` verify with no variables (the quantities as explicit `sqrt(...)` expressions).
5. **Effect of adding a value** on the mean and median. Select-all ("which must increase?").
   The skill test recomputes each statistic.

Misconceptions:
- `median-unsorted`: took the middle of the unsorted list
- `mean-missing-total`: subtracted from the mean instead of the total
- `shift-changes-sd`: thought adding a constant changes the SD
- `weighted-simple-average`: averaged the group averages

### `gre-counting-probability`: Counting & probability (prereqs `['gre-integers']`)
1. **Fundamental counting principle:** outfits, license plates. Numeric.
2. **Permutations vs combinations:** committees (nCr), orderings (nPr). Numeric.
3. **Probability of simple events**, independent "and" (multiply), "at least one"
   (1 − none). A fraction answer.
4. **Venn diagrams:** both / neither from totals. Numeric. Use a `tableFigure` or the text.
5. **QC:** "A: the number of ways to choose 3 from 7; B: the number of ways to choose 4
   from 7" → c (symmetry). Exact.

Misconceptions:
- `permutation-for-combination`: counted order when it didn't matter
- `added-independent-probabilities`: used P(A) + P(B) for "and"
- `at-least-one-direct`: summed single-event probabilities
- `venn-double-count`: counted the overlap twice

### `gre-data-interpretation`: Data interpretation (prereqs `['gre-descriptive-stats', 'gre-ratios-rates']`)
Every problem has a figure: a `barChartFigure` or `tableFigure` generated from params (e.g.
sales by year, a budget by category, survey results by group). Several questions per "set"
are fine: generate the data, then ask one question per problem, varying by level.
1. **Read a value**, and the difference between two categories. Numeric.
2. **Percent change** between two years from the chart. Numeric, rounded to the nearest
   percent: choose data so it's exact.
3. **Share of total:** "what percent of the budget is housing?" Numeric.
4. **"Approximately what…"** estimation. MC with 5 options spread far apart, so estimating
   suffices.
5. **Select-all** "which of the following can be inferred from the table?" with
   statements checkable from the data. The skill test re-derives each statement from the
   generated data.

Misconceptions:
- `percent-change-base`: divided by the new value
- `share-of-wrong-total`: used the wrong total
- `misread-category`: read the adjacent bar

whyItMatters: the GRE always includes a data interpretation set. Reading charts carefully,
and percent change in particular, is the daily work of an economist.

### `gre-normal-distribution`: Normal distribution & percentiles (prereqs `['gre-descriptive-stats']`)
GRE level only: the 68-95-99.7 rule, symmetry and percentiles. No z-tables needed.
1. **The approximate percent within 1 or 2 SD** of the mean. Numeric: 68 or 95, or the
   halves 34, 47.5, 13.5.
2. **The value at mean ± k·SD.** Numeric.
3. **"Approximately what percent scored above x?"** with x = mean + 1 SD → 16. Numeric.
4. **QC comparing two distributions:** "A: the percent of scores in distribution 1 above 80
   (mean 70, SD 10); B: the percent in distribution 2 above 90 (mean 75, SD 15)" → both are
   1 SD above → c. Exact by z-scores.
5. **Percentile / quartile reading** from a list or a table. Numeric. The skill test sorts
   and recomputes using the GRE convention, stated in the prompt.

Misconceptions:
- `rule-half-forgotten`: gave 68% for one side
- `above-mean-plus-sd-as-34`: confused 34% (mean to +1 SD) with 16% (above +1 SD)
- `compared-raw-scores`: compared raw cutoffs instead of z-scores

whyItMatters: the normal curve underlies confidence intervals and t-tests in econometrics.
The 68-95-99.7 rule is the mental model behind "statistically significant at the 5% level".
