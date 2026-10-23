# Batch K skill specs: time and growth

Four skills that put a time index on money and output: sequences and series (the math under
every discounting formula), present value, growth rates in logs, and the two models first-year
macro and micro build on them (two-period consumption and the Solow model). All four are in
`src/skills/tree.ts`:

| # | id | Track, unit | Prerequisites (tree.ts) |
|---|---|---|---|
| 1 | `geometric-series` | math, "Sequences & series" | `exponent-rules` |
| 2 | `present-value` | econ, "Time & growth" | `exponent-rules`, `geometric-series` |
| 3 | `growth-rates-logs` | econ, "Time & growth" | `logarithm-rules` |
| 4 | `intertemporal-solow` | econ, "Time & growth" | `present-value`, `optimization` |

Files go in `src/skills/math/` (1) and `src/skills/econ/` (2–4).

Problem shapes come from Rosser & Lis ch. 7 (discounting a single sum, NPV of a project,
geometric series and annuities, perpetuities, loan repayments, sinking funds, resource depletion
at a growth rate), Hoy et al. ch. 3 (sequences, present value, the limit of a geometric sum) and
Bergstrom & Varian, *Workouts* ch. 10 (the intertemporal budget line, present and future value of
an endowment, Cobb-Douglas consumption over two periods, borrower vs saver). See
`book-archetypes.md`: shapes only, original wording and computed numbers.

**Overlap with `growth-decay` (already built).** That skill does compounding forward
($A = P(1+r)^t$), depreciation, continuous compounding, doubling time by logs, and solving for the
interest rate. Batch K does not repeat them: `present-value` goes backwards (discounting) and
sums streams; `growth-rates-logs` works with growth *rates* (logs, ratios, the rule of 70, index
numbers), not balances.

**Rules for every skill:** follow `CLAUDE.md` → "Adding a skill", and the shared requirements
at the top of `batch-h.md`. Lessons from batches I and J, enforced by the harness:
- Every LaTeX command in a JS string needs a doubled backslash (`'\\frac'`, `'\\cdot'`, `'\\sum'`),
  in nested template literals and `.join(...)` too.
- At least 2 steps per problem. Same `params` keys at every level (unused = 0).
- Interpretation questions are **required** for the three econ skills (and wanted at
  `geometric-series` L5), computed from the params, drawn last, and re-derived in
  `tests/skills/<id>.test.ts`.
- A dollar sign in RichText is `\\$` in the JS string.

**Exact answers.** Every answer in this batch is rational; never set `irrationalAnswers`.
- Interest and growth rates come from a small set whose powers are short decimals:
  r ∈ {5%, 10%, 20%, 25%, 50%} (and 4%, 8% where only r itself appears, as in perpetuities).
  Store them as `Q` (`q(1, 10)`), never as JS floats.
- Choose the *answer* first and build the givens from it: pick the discounted value, then set
  the future amount to `PV·(1+r)^n`. Givens may have cents (\$1,102.50 is fine), but a given
  that needs more than 2 decimal places rejects the draw (\$1,000 at 5% for 3 years is
  \$1,157.625).
- Logs: never ask the learner to take a log of an arbitrary number. Where logs appear, the prompt
  *gives* the log values (to 3 decimals, as a statistics table would), and the answer is
  computed from those printed values, so it is exact.
- Percent answers are typed as the percent number ("type 3 for 3%"), as in `growth-decay` L5.
  Say so in the prompt.

**Verify specs.** Write the verify as the problem statement, not the closed form:
- A sum of discounted payments is written out term by term
  (`evaluate`: `1210/(1+1/10)^1 + 1210/(1+1/10)^2`), so the annuity formula is checked against
  the definition.
- An unknown payment or present value is a `solve` of that sum (`solve`: `2100 = A/(11/10) + A/(11/10)^2`,
  unknowns `['A']`).
- An infinite sum (L4 of series, perpetuities) is a `limit` of the n-term sum as `n → 'oo'`
  (`a*(1-r^n)/(1-r)` with numbers in). The harness and SymPy both support `point: 'oo'`.
- Steady states and tangencies are `solve`s of the defining condition (`s*A*k^(1/2) = (n+d)*k`,
  `positive: true`).

---

## 1. `geometric-series`: Sequences & geometric series
`maxDenominator: 64`. Arithmetic sequences appear only in L1–L3 as the contrast case; the skill
is about geometric ones.

**Levels:**
1. The n-th term. `form` 0 arithmetic $a_n = a + (n-1)d$; `form` 1 geometric
   $a_n = a r^{n-1}$ with r ∈ {2, 3, −2, 1/2, 1/3} and n ≤ 7. Number. The prompt lists the first
   three terms. Example: 3, 6, 12, … → $a_6 = 3 \cdot 2^5 = 96$.
2. Find the ratio or a missing term. `form` 0: "terms 2 and 5 are 12 and 96; find r" ($r^3 = 8$,
   r = 2); `form` 1: "is the sequence arithmetic, geometric, or neither?" (choice; needs the
   skill test); `form` 2: the term between two given terms of a positive geometric sequence
   (the geometric mean, $\sqrt{a_{k-1} a_{k+1}}$, chosen to be an integer). Number or choice.
3. Finite sums. `form` 0 geometric $S_n = a\frac{1 - r^n}{1 - r}$ (n from 3 to 6); `form` 1
   arithmetic $S_n = \frac{n}{2}(2a + (n-1)d)$. Number. Example: 5 + 10 + 20 + 40 + 80 = 155 =
   $5\cdot\frac{1 - 2^5}{1 - 2}$.
4. Infinite sums. `form` 0 the sum $\frac{a}{1-r}$, r ∈ {1/2, 1/3, 2/3, 1/4, 3/4, 1/5, −1/2};
   `form` 1 "does it converge?" (choice: converges to [value] / diverges; |r| ≥ 1 includes r = 1
   and r = −1); `form` 2 a repeating decimal as a fraction (0.\overline{36} = 36/99 = 4/11, one or
   two repeating digits). Number or choice.
5. Rosser 7.7 / Keynesian shapes. `form` 0 the spending multiplier: the government spends G and
   each round a fraction b (the MPC, b ∈ {1/2, 3/5, 2/3, 3/4, 4/5, 9/10}) is spent again; total
   = $\frac{G}{1 - b}$. `form` 1 the same, but only the first n rounds (finite sum). `form` 2
   declining sales: a product sells $a$ units in month 1 and sales fall by p% (p ∈ {10, 20, 25,
   50}) each month; total over n months or "ever". Choose a so the answer is an integer. Number.

**Steps:**
- `identify` (L1–L5): "Find the first term and the ratio" (or difference). Ask: r (number);
  verify `evaluate` of the ratio of two given terms.
- `term` (L1): "Apply the n-th term formula". Final.
- `ratio-power` (L2 form 0): "Divide the terms: the ratio is raised to the gap". Ask: $r^{k}$;
  verify `evaluate`. Then `root` (final).
- `classify` (L2 form 1): "Compare differences and ratios". Choice; final.
- `count-terms` (L3, L5 form 1–2): "Count the terms". Ask: n; verify `evaluate`.
- `sum-formula` (L3–L5): "Apply the sum formula". Final (or penultimate in L4 form 2).
- `converge` (L4 form 0–1, L5): "Check |r| < 1". Choice; final in L4 form 1.
- `as-series` (L4 form 2): "Write the decimal as a geometric series". Ask: the ratio (1/100 or
  1/10); verify `evaluate`.

**Misconceptions:**
- `exponent-n` (L1, L3): "Used $r^n$ instead of $r^{n-1}$". The term one step too far.
- `arithmetic-for-geometric` (L1 form 1, L3 form 0): "Added the ratio instead of multiplying".
  $a + (n-1)r$, or the arithmetic sum with d = r.
- `ratio-not-root` (L2 form 0): "Divided the gap into the ratio instead of taking the root".
  $r = (a_5/a_2)/3$.
- `sum-sign-flip` (L3): "Used $\frac{1 - r^n}{r - 1}$". Negative of the answer (r ≠ 1).
- `last-term-as-sum` (L3, L5 form 1): "Gave the last term, not the sum".
- `infinite-a-over-r` (L4, L5): "Divided by r instead of 1 − r". $a/r$ (form 0) or $G/b$.
- `diverges-negative` (L4 form 1): "Called a sum with a negative ratio divergent". Reachable
  when −1 < r < 0.
- `repeating-over-ten` (L4 form 2): "Put the repeating digits over 10 (or 100) instead of 9 (or
  99)". 36/100.
- `multiplier-b-only` (L5 form 0–1): "Summed only the re-spending, not the first round".
  $\frac{bG}{1-b}$.

**Interpretation** (L5, 50%):
- form 0–1: "Why is the total finite even though spending goes round forever?" Correct: each
  round is only a fraction b of the last, so the rounds shrink fast enough that their sum
  settles at G/(1 − b). Distractors: "the government stops spending"; "the rounds are all
  equal"; "only the first round counts".
- form 0–1, second question: "If the MPC rose from b to b′, the multiplier would…" rise (compute
  both values in the explanation).
- form 2: "Total sales 'ever' are about how many times month-1 sales?" 1/(p/100) — the same
  number as the multiplier with b = 1 − p/100.

**whyItMatters:** A government spends \$100. People spend 3/4 of each dollar they receive, so the
rounds are 100, 75, 56.25, … and the total is $100/(1 - 3/4) = \$400$: a multiplier of 4. The
same geometric sum prices a stream of payments (an annuity) and, with infinitely many terms, a
perpetuity, so it sits under every present-value formula.

---

## 2. `present-value`: Present value & discounting
`maxDenominator: 100`. All money in dollars; answers whole dollars unless a level says cents.
r from the rate set above, n ≤ 4 (≤ 3 when r ≥ 20%).

**Levels:**
1. PV of one future sum: $PV = \frac{FV}{(1+r)^n}$. Choose PV (a multiple of 100), set
   $FV = PV(1+r)^n$, reject if FV needs more than 2 decimals. Number. Example: \$1,210 in 2
   years at 10% → \$1,000. `form` 1 (Rosser 7.4 Q3 shape): "Is investing \$X now enough to have
   \$FV in n years?" asks for the amount needed; the choice comes in interpretation.
2. Net present value of a project: outlay $C_0$ now, returns $R_1, R_2$ (and $R_3$ at r = 10%,
   20%) at the end of each year. Pick each discounted return $d_t$ (a multiple of 10), set
   $R_t = d_t(1+r)^t$. NPV $= \sum d_t - C_0$, which may be negative. Number. Example: outlay
   900, returns 550 and 605, r = 10%: 500 + 500 − 900 = 100.
3. Annuity: equal payments A at the end of each of n years (n 2–4).
   $PV = A\frac{1 - (1+r)^{-n}}{r}$. Choose A as a multiple of the factor's denominator so PV is
   whole. Number. Example: \$1,210 a year for 2 years at 10%: 1100 + 1000 = \$2,100.
4. Perpetuities. `form` 0 level: $PV = A/r$ (r ∈ {4%, 5%, 8%, 10%, 20%, 25%}); `form` 1 growing:
   $\frac{A}{r - g}$ (g < r, both from {1, 2, 3, 4, 5, 8, 10}%, r − g dividing A·100 cleanly);
   `form` 2 deferred: the first payment comes at the end of year k + 1 (k ∈ {1, 2}), so
   $PV = \frac{A/r}{(1+r)^k}$; choose A so it's whole (r = 10%, A = 121, k = 2 → 1000). Number.
   Examples: \$50 a year at 5% → \$1,000; \$60 growing at 2% with r = 8% → \$1,000.
5. Solve for the payment (Rosser 7.11, 7.13). `form` 0 loan repayment: borrow L, repay in n
   equal end-of-year payments: $A = \frac{L\,r}{1 - (1+r)^{-n}}$; `form` 1 sinking fund: save A
   at the end of each year to reach a target T: $A = \frac{T\,r}{(1+r)^n - 1}$. Choose A first
   (multiple of 10), build L or T, reject givens with more than 2 decimals. Number. Examples:
   borrow \$2,100 at 10% over 2 years → \$1,210 a year; reach \$3,310 in 3 years at 10% → \$1,000
   a year ($1000 \cdot (1.21 + 1.1 + 1) = 3310$).

**Verify:** L1 `solve` of `PV*(1+r)^n = FV`; L2 `evaluate` of `-C0 + R1/(1+r) + R2/(1+r)^2 …`;
L3 `evaluate` of the term-by-term sum; L4 form 0–1 `limit` (n → oo) of the n-term sum
(`A*(1-(1/(1+r))^n)/r`, and for form 1 `A/(1+r)*(1-((1+g)/(1+r))^n)/(1-(1+g)/(1+r))`), form 2
`limit` of the deferred sum; L5 `solve` of the term-by-term equation for A.

**Steps:**
- `factor` (L1–L4): "Find the discount factor". Ask: $(1+r)^n$ as a number (1.21); verify
  `evaluate`.
- `discount` (L1, L2): "Divide each amount by its factor". Ask (L2): the discounted value of the
  last return; verify `evaluate`. Final in L1.
- `net` (L2): "Add the discounted returns and subtract the outlay". Final.
- `annuity-terms` (L3, L5): "Discount each payment" (or "Grow each deposit" in L5 form 1). Ask:
  the sum of the factors (210/121 = 1.735…; type as a fraction is fine); verify `evaluate`.
- `annuity-sum` (L3): "Multiply the payment by the sum of factors". Final.
- `perpetuity` (L4): "Divide the payment by r (or r − g)". Ask: the value one period before the
  first payment (form 2) or final; verify `evaluate`.
- `defer` (L4 form 2): "Discount back to today". Final.
- `solve-payment` (L5): "Divide the loan (or target) by the factor sum". Final.

**Misconceptions:**
- `compounded-not-discounted` (L1, L2): "Multiplied by $(1+r)^n$ instead of dividing".
- `simple-discount` (L1, L3): "Discounted with simple interest". $FV/(1 + nr)$. Reachable when
  n ≥ 2.
- `undiscounted-sum` (L2, L3): "Added the payments without discounting". $\sum R_t - C_0$ (L2),
  $nA$ (L3).
- `forgot-outlay` (L2): "Left out the outlay". $\sum d_t$.
- `off-by-one-period` (L3, L4 form 2): "Discounted one period too many (or too few)". Annuity
  due instead of ordinary: $PV \cdot (1+r)$; deferred by k + 1 (or k − 1).
- `perpetuity-times-r` (L4): "Multiplied by r instead of dividing". $A \cdot r$.
- `growing-plus-g` (L4 form 1): "Used r + g in the denominator".
- `payment-no-interest` (L5): "Spread the amount evenly, ignoring interest". $L/n$ or $T/n$.

**Interpretation** (all levels, 50%): units and direction.
- L1: "\$1,000 is the present value of \$1,210 in 2 years at 10%. What does that mean?" Correct:
  \$1,000 today, invested at 10%, grows to exactly \$1,210 in 2 years, so the two are worth the
  same today. Distractors: "\$1,000 is the interest earned"; "inflation will cut \$1,210 to
  \$1,000"; "the bank charges \$210".
- L1, L3: "If the interest rate were higher, the present value would be…" lower (compute the
  value at the higher rate in the explanation).
- L2: "NPV = 100 > 0. Should the firm invest?" Yes: the returns are worth \$100 more today than
  the outlay; with NPV < 0, no. Computed from the sign.
- L4 form 0: "An annuity paying A for 50 years at r is worth a bit less than A/r. Why?" Correct:
  the perpetuity adds payments after year 50, which are worth almost nothing today. (Compute
  the 50-year value to the cent with `Q`, or say "about" with a rounded float in the
  explanation only.)
- L5 form 0: "Why do the payments add to more than the loan?" The extra is interest on the
  balance still owed.

**whyItMatters:** \$1,210 promised in 2 years is worth \$1,000 today at 10%, because \$1,000
invested now grows to $1000 \cdot 1.1^2 = 1210$. A firm uses this to compare an outlay now with
returns later (outlay \$900, returns \$550 and \$605: NPV = 500 + 500 − 900 = \$100 > 0), and a
bond paying \$50 a year forever is worth $50/0.05 = \$1,000$ at 5%. Higher rates lower every
present value.

---

## 3. `growth-rates-logs`: Growth rates & logs
`maxDenominator: 100`. Growth rates in percent. The point of the skill: growth rates *add* where
levels multiply, a log difference is a growth rate, and these are approximations that break for
large changes.

**Levels:**
1. Growth from levels and from logs. `form` 0 exact percent change between two levels
   (X₀ a multiple of 10, the change a whole percent); `form` 1 log approximation: the prompt
   gives $\ln X_0$ and $\ln X_1$ to 3 decimals (e.g. 10.000 and 10.030), and the answer is
   $100(\ln X_1 - \ln X_0)$ = 3.0. Number. Make the given logs real: compute them from actual
   levels and round, so a learner checking with a calculator agrees.
2. The rule of 70. `form` 0 doubling time ≈ 70/g (g ∈ {1, 2, 3.5, 5, 7, 10, 14}); `form` 1
   growth needed to double in T years (T ∈ {7, 10, 14, 20, 35}); `form` 2 "grows at g% for
   70/g·k years: about how many times larger?" $2^k$ (k ∈ {1, 2, 3}). Number.
3. Growth of products, ratios and powers (approximate). `form` 0 per capita:
   $g_{Y/N} \approx g_Y - g_N$; `form` 1 real growth: $g_{real} \approx g_{nominal} - \pi$;
   `form` 2 revenue: $g_{PQ} \approx g_P + g_Q$; `form` 3 a power: $g_{X^a} \approx a\,g_X$
   (a ∈ {2, 1/2, 1/3, −1}). Rates may be decimals with one place. Number.
4. Average growth and time in logs (Rosser 7.14 shapes). `form` 0 average annual growth over n
   years: $\frac{100(\ln X_n - \ln X_0)}{n}$ from given logs; `form` 1 years until X reaches a
   target at a continuous rate g: $t = \frac{\ln X_T - \ln X_0}{g}$, from given logs, chosen to
   be a whole number of years. Number.
5. Index numbers. `form` 0 rebase: an index with base year 2010 = 100 reads $I_s$ in year s and
   $I_t$ in year t; the value in year t with base year s is $100 I_t / I_s$ (chosen whole or one
   decimal); `form` 1 deflate: nominal value V and price index P (base 100) → real value
   $100V/P$; `form` 2 real growth from two nominal values and two price-index values, exact:
   $100\left(\frac{V_1/P_1}{V_0/P_0} - 1\right)$, chosen to be a whole percent. Number.

**Verify:** L1 form 0 `evaluate` of `100*(X1-X0)/X0`; form 1 `evaluate` of
`100*(10.030-10.000)` with the printed logs; L2 `evaluate` (`70/g`, `2^k`); L3 `evaluate` of the
approximation, written from the given rates; L4 form 1 `solve` of `lnX0 + g*t = lnXT` (unknown
`t`, with g as a decimal); L5 `evaluate`.

**Steps:**
- `difference` (L1, L4): "Subtract the starting value (or log)". Ask: the change; verify
  `evaluate`.
- `to-percent` (L1): "Divide by the start (or multiply the log change by 100)". Final.
- `rule-70` (L2): "Divide 70 by the growth rate (or by the years)". Ask: the doubling time;
  verify `evaluate`. Final in forms 0–1.
- `doublings` (L2 form 2): "Count the doublings". Ask: k; final is $2^k$.
- `combine` (L3): "Add or subtract the growth rates" ("Multiply by the power" in form 3). Ask:
  which operation (choice: add / subtract / multiply by the power), then final.
- `per-year` (L4 form 0): "Divide by the number of years". Final.
- `solve-t` (L4 form 1): "Divide the log gap by the rate". Final.
- `rebase` / `deflate` (L5): "Divide by the base-year index, times 100". Ask (form 2): the real
  value in year 0; verify `evaluate`. Final.

**Misconceptions:**
- `divided-by-new` (L1 form 0, L5 form 2): "Divided the change by the new value instead of the
  old".
- `log-no-100` (L1 form 1, L4): "Left the log change as a decimal". 0.03 instead of 3.
- `rule-70-multiplied` (L2): "Multiplied 70 by the rate". Or $70 \cdot g$ / $T \cdot 70$.
- `doublings-linear` (L2 form 2): "Multiplied by 2k instead of $2^k$". Reachable at k = 3 only
  (at k = 1, 2 the two agree — `distinctMisconceptions` drops it).
- `ratio-added` (L3 forms 0–1): "Added the rates for a ratio". $g_Y + g_N$.
- `product-subtracted` (L3 form 2): "Subtracted the rates for a product".
- `power-ignored` (L3 form 3): "Ignored the power". $g_X$.
- `total-not-average` (L4 form 0): "Gave the total log growth, not per year".
- `rebase-subtract` (L5 form 0): "Shifted the index instead of dividing". $I_t - I_s + 100$.
- `nominal-growth` (L5 form 2): "Used nominal growth, not real". The growth in V alone.

**Interpretation** (all levels, 50%):
- L1 form 1: "The log approximation says 3.0%. The exact change is 3.05%. When would the gap be
  large?" Correct: for large changes (from 100 to 150, logs give about 40.5% against an exact
  50%). Computed: show the exact change for these numbers in the explanation.
- L2: "A country growing at 2% instead of 1% doubles its income in…" half the time (35 vs 70
  years). Correct option computed from the given g.
- L3 form 0: "GDP grows 3% and population 1%. What happens to income per person?" It rises
  about 2%; distractors include "it rises 3% because GDP does". From the params.
- L5 form 1: "Nominal spending rose but real spending fell. How?" Prices rose faster than
  spending. Only when the numbers show it; otherwise "Real spending rose less than nominal
  because prices rose."

**whyItMatters:** GDP growing 3% a year with population growing 1% means income per person grows
about 3 − 1 = 2%, and at 2% it doubles in about 70/2 = 35 years. When ln GDP rises from 10.000 to
10.030, GDP grew about 3% (exactly 3.05%). Growth accounting, inflation adjustments and log
regressions all read changes this way.

---

## 4. `intertemporal-solow`: Two-period consumption & Solow
`maxDenominator: 100`. L1–L3 are the two-period consumer (Workouts 10.1–10.3); L4–L5 the Solow
model with Cobb-Douglas output per worker. Rates r ∈ {5%, 10%, 20%, 25%, 50%}.

**Levels:**
1. The intertemporal budget. Income $m_1$ now and $m_2$ next period, interest rate r. `form` 0
   present value of the endowment $m_1 + \frac{m_2}{1+r}$; `form` 1 future value
   $m_1(1+r) + m_2$ (the most you can consume next period); `form` 2 the slope of the budget line
   in $(c_1, c_2)$ space, $-(1+r)$. Choose $m_2$ a multiple of (1+r)'s numerator. Number.
   Example: $m_1 = 2000$, $m_2 = 1100$, r = 10%: PV 3000, FV 3300.
2. Optimal consumption with $U = c_1 c_2$: $c_1^* = \frac{PV}{2}$, $c_2^* = (1+r)c_1^*$. Tuple
   `['c1', 'c2']`; verify `solve` of the tangency `c2 = (1+r)*c1` and the budget
   `c1 + c2/(1+r) = m1 + m2/(1+r)`. Example: the numbers above → (1500, 1650).
3. Saving and borrowing with $U = c_1^{a}c_2^{1-a}$, a ∈ {1/5, 1/4, 1/3, 1/2, 2/3, 3/4}:
   $c_1^* = a \cdot PV$. `form` 0 $c_1^*$; `form` 1 saving $m_1 - c_1^*$ (negative = borrowing,
   prompt says so); `form` 2 $c_2^*$. Number. Example: a = 1/5, $m_1 = 1000$, $m_2 = 2200$,
   r = 10%: PV = 3000, $c_1^* = 600$, saves 400, $c_2^* = 400 \cdot 1.1 + 2200 = 2640$.
4. Solow steady state. Output per worker $y = A k^{\alpha}$, α ∈ {1/2, 1/3}; saving rate s,
   population growth n, depreciation δ (s, n, δ as percents). Steady state:
   $s A k^{\alpha} = (n + \delta) k$, so $k^* = \left(\frac{sA}{n+\delta}\right)^{1/(1-\alpha)}$.
   Choose $\frac{sA}{n+\delta}$ a whole number (a perfect square when α = 1/3). `form` 0 $k^*$;
   `form` 1 $y^*$. Number. Example: s = 30%, A = 2, n = 2%, δ = 8%, α = 1/2: ratio 6,
   $k^* = 36$, $y^* = 12$; check $0.3 \cdot 12 = 3.6 = 0.1 \cdot 36$.
5. Steady-state consumption and the golden rule. `form` 0 $c^* = (1 - s)y^*$; `form` 1 the
   golden-rule capital stock, from $f'(k) = n + \delta$: for α = 1/2,
   $k_{gold} = \left(\frac{A}{2(n+\delta)}\right)^2$ (choose A/(2(n+δ)) whole); `form` 2 the
   golden-rule saving rate, α (as a percent). Number. Example: s = 30%, A = 2, n + δ = 10%:
   $c^* = 0.7 \cdot 12 = 8.4$; $k_{gold} = (2/0.2)^2 = 100$ and $s_{gold} = 50\%$.

**Verify:** L1 `evaluate` from the budget definition; L2 `solve` as above; L3 form 0–1 `solve`
of the tangency `c2*a = (1-a)*(1+r)*c1` and the budget, with the saving as a second step;
L4 `solve` of `s*A*k^(alpha) = (n+d)*k`, unknown `k`, `positive: true` (form 1 then `evaluate`
of `A*k^alpha` at the solved k); L5 form 1 `solve` of the derivative condition
`alpha*A*k^(alpha-1) = n+d`, `positive: true`.

**Steps:**
- `pv-endowment` (L1–L3): "Put next period's income in today's dollars". Ask:
  $\frac{m_2}{1+r}$; verify `evaluate`.
- `budget` (L1): "Add (or grow) the two incomes". Final.
- `mrs` (L2): "Set the MRS equal to 1 + r". Ask: $c_2/c_1$ at the optimum; verify `evaluate`.
- `split` (L2, L3): "Spend the share a of lifetime wealth now". Ask: $c_1^*$ (final in L3
  form 0); verify `solve`.
- `save` (L3 form 1–2): "Subtract consumption from income" / "Grow the saving and add $m_2$".
  Final.
- `steady-condition` (L4, L5): "Set saving equal to break-even investment". Ask: the ratio
  $\frac{sA}{n+\delta}$; verify `evaluate`.
- `solve-k` (L4, L5): "Raise to the power 1/(1 − α)". Ask: $k^*$; verify `solve` as above.
  Final in L4 form 0.
- `output` (L4 form 1, L5 form 0): "Evaluate output per worker". Ask $y^*$ (final in L4).
- `consume` (L5 form 0): "Consume what isn't saved". Final.
- `golden` (L5 form 1–2): "Set the marginal product equal to n + δ". Final.

**Misconceptions:**
- `compounded-m2` (L1–L3): "Multiplied future income by (1 + r) instead of dividing". Form 0;
  in form 1, divided $m_1$ instead of growing it.
- `slope-inverted` (L1 form 2): "Gave the slope as $-1/(1+r)$".
- `ignored-interest` (L1–L3): "Added the incomes without interest". $m_1 + m_2$ (and the demands
  built from it).
- `equal-consumption` (L2): "Set $c_1 = c_2$". Both equal to $\frac{PV(1+r)}{2+r}$.
- `share-of-m1` (L3): "Applied the share to this period's income only". $a\,m_1$.
- `saving-sign` (L3 form 1): "Reported borrowing as saving". The answer negated (only when
  saving ≠ 0).
- `forgot-depreciation` (L4, L5): "Left δ out of break-even investment". Use n alone.
- `no-power` (L4): "Stopped at the ratio". $\frac{sA}{n+\delta}$ itself.
- `consumed-saving` (L5 form 0): "Gave saving, not consumption". $s\,y^*$.
- `golden-is-s` (L5 form 2): "Gave the current saving rate". Reachable when s ≠ α.

**Interpretation** (all levels, 50%):
- L1: "What does the present value of the endowment, \$3,000, mean?" Correct: the most the
  consumer could spend today by borrowing against next period's income. Distractors: total income
  ignoring interest; next period's income; what they will save.
- L2–L3: "Is this consumer a borrower or a saver in period 1?" Computed from the sign of
  $m_1 - c_1^*$ (and "neither" when zero).
- L2–L3, second question: "The interest rate rises. For this consumer, $c_1^*$ will…" With
  these preferences $c_1^* = a\,(m_1 + \frac{m_2}{1+r})$: it falls when $m_2 > 0$ (lower PV of
  future income) and stays put when $m_2 = 0$. Correct option computed from $m_2$.
- L4: "In the steady state, what stays constant?" Capital per worker (and output per worker);
  total capital grows at n. Distractors: total output; total capital; the saving rate times
  output in dollars.
- L5: "A higher saving rate raises long-run growth of output per worker." False: it raises the
  steady-state *level*; growth per worker returns to zero (here, without technology growth).
  L5 form 0 second question: "If s moved to the golden-rule rate, c* would…" rise (the golden
  rule maximizes steady-state consumption, so moving to it from either side raises c*), or stay
  the same when s = α (compute both $c^*$ values in the explanation).

**whyItMatters:** Earning \$2,000 now and \$1,100 next year at 10% interest is worth
$2000 + 1100/1.1 = \$3,000$ today. With $U = c_1 c_2$ you spend half of that now (\$1,500), save
\$500, and consume $500 \cdot 1.1 + 1100 = \$1,650$ next year. In the Solow model with s = 30%,
$y = 2\sqrt{k}$ and n + δ = 10%, capital per worker settles at 36, where saving
$0.3 \cdot 12 = 3.6$ exactly covers $0.1 \cdot 36$.

---

## Delegation and checks

1. Subagents (Sonnet), all four in parallel: there are no code dependencies (prerequisites
   only affect the tree). Each gets `CLAUDE.md`, PLAN §2.3 and §8, this spec's section, the
   rules block at the top of this file, `book-archetypes.md`, and reference skills:
   - `geometric-series`: `src/skills/math/exponent-rules.ts`, `src/skills/math/limits.ts`
     (`limit` verify to `oo`).
   - `present-value`: `src/skills/math/growth-decay.ts` (money formatting, rate handling,
     interpretation on a math skill) and `src/skills/econ/supply-demand-equilibrium.ts`.
   - `growth-rates-logs`: `src/skills/math/growth-decay.ts`, `src/skills/math/logarithm-rules.ts`.
   - `intertemporal-solow`: `src/skills/econ/utility-maximization.ts` (tuple demand, tangency
     verify) and `src/skills/econ/cobb-douglas-production.ts` (fractional exponents).
   Hard rules in every prompt: doubled backslashes, ≥ 2 steps, same params keys at every level,
   exact `Q` arithmetic with rates as `Q`, interpretation drawn last, a skill test re-deriving
   every choice answer and interpretation.
2. Lead: check every generator's math by hand on several seeds, run the backslash scan, then
   `npm test` and `npm run verify:sympy:skills -- geometric-series,present-value,growth-rates-logs,intertemporal-solow`.
3. Placement: econ skills are placeable; raise `MAX_ITEMS` in `learning/placement.ts` if acing
   no longer reaches every skill (the learner doesn't use placement; just bump it).
4. e2e and review PNGs (the garden gains plots for the three econ skills).
