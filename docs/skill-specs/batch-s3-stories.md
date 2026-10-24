# Batch S3: story variants for econ and narrative GRE skills

Read first: `CLAUDE.md` (Adding a skill, item 7 on stories), `docs/skill-specs/batch-s-stories.md`
(what a story variant is), `docs/skill-specs/batch-s2-stories.md` (patterns, not settings), and the
reference implementation `src/skills/math/linear-equations.ts` (`story`, `tell`, `pickStory`,
`NEW_PATTERNS`, `setupStep`, `setupAs`).

**Why.** The econ skills hand the learner the formula ($Q_d = 52 - 4P$, $TC = 366 + 2q + 3q^2$).
In the program, and in Hoy et al. and Bergstrom's *Workouts*, the work is building that formula
from words, from two observations, or from a change to a known one. The GRE skills here are
already word problems, but nothing asks the learner to *write the situation in algebra* before
solving. GRE fractions & percents is the learner's slowest skill (median 523 s per correct item);
the setup step is the scaffold it lacks.

None of these skills has stories yet, so there is no `story.original`; ids end `:s`.

## Rules (all patterns)

- `story: { levels, generate }`. `generate` picks the pattern with `rng.int(0, k − 1)` **first**,
  then draws that pattern's params. Every pattern at a level is a different *translation*, not a
  different setting; give each 2–3 settings with `rng.pick`.
- **Plain problems must stay byte-identical for every seed.** Refactor the level's body into a
  shared builder taking params (as `solveBuilt` / `buildQuadratic` do) and call it from both.
- Use the level's own param names and stay **inside its `ranges`**; the harness, the skill tests and
  SymPy then apply unchanged. Keep the plain verify spec and answer kind.
- **Setup step first**: key `setup-<pattern>` (add every key to `stepLabels`), `ask.answer.kind:
  'expression'` with `verify: { type: 'equivalent', expr, variables }`. The expression **must
  contain the variable** (write the situation in terms of the unknown, not a number). A second
  setup step, when useful, is `setup-right` or another `setup-*` key.
- Then the level's own steps, unchanged, ending with the final answer.
- **Misreadings**: compute each with the problem's numbers and pass them, *before* the body's own
  candidates, through `distinctMisconceptions(answer, [...readings, ...body.misconceptions])`.
  Reuse an existing misconception id when the error is the same one; add new ids (with `name` and
  `explanation`, the explanation saying why it's wrong and what to do) only for new errors. Every
  new id must be reachable (the harness checks).
- **One irrelevant number** in one pattern per skill at its top story level; say in the setup
  `why` that it doesn't enter.
- Numbers must make sense in the story: positive prices, quantities, times; units named.
- Dollar signs: `\\$${v}` in template literals and `'\\$'` in plain strings (never `\$`); LaTeX
  backslashes doubled.
- **Original wording only.** Shapes come from the learner's books (`.books/`, git-ignored); never
  copy their text, names or numbers.
- Choice-answer levels: the skill's `tests/skills/<id>.test.ts` must re-derive the correct option
  for story problems too (extend the existing test loop to `makeProblem(skill, level, seed, 'story')`).

## Econ

### supply-demand-equilibrium: story levels 1, 4
Plain L1: $Q_d = a - bP$, $Q_s = c + dP$, answer $(P^*, Q^*)$. L4: sellers pay a per-unit tax $t$,
$Q_s = c + d(P - t)$, answer $(P_b, Q^*)$.

| Level | Pattern (setup key) | Translation | Misreading |
|---|---|---|---|
| 1, 4 | words (`setup-words`) | "At a price of zero buyers would take $a$ units; each \$1 on the price cuts that by $b$." Supply likewise ("sellers bring $c$ units even at a price of zero, and $d$ more for every \$1"). Setup: $Q_d$ in terms of $P$; `setup-right`: $Q_s$. | new **slope-dropped**: demand written $a - P$ (the per-dollar change left out) → solve with $b = 1$ |
| 1, 4 | two observations (`setup-points`) | Demand from two points: "at \$$P_1$ buyers took $Q_1$; at \$$P_2$ they took $Q_2$" ($P_1 \ne P_2$, both on $a - bP$, both quantities positive). Supply in words. Setup: $Q_d$ in $P$. | new **slope-inverted**: slope taken as $\Delta P/\Delta Q = 1/b$, line through $(P_1, Q_1)$: $Q_d = Q_1 + (P_1 - P)/b$ → solve |
| 1, 4 | shift (`setup-shift`) | "Normally demand is $Q_d = a_0 - bP$ (given). This month [a festival / a heat wave] adds $k$ units of demand at every price." So $a = a_0 + k$, $k \in [5, 30]$, $a_0 > 0$. Setup: the new $Q_d$. Irrelevant number at L4 (how long the event lasts). | new **shift-ignored**: equilibrium with $a_0$ |
| 4 | all three also state the tax in words ("for every unit sold, the seller sends \$$t$ to the government") | | existing `tax-wrong-direction`, `tax-ignored`, `seller-price` stay |

Each pattern at L4 adds the tax sentence to the same translation. Interpretation questions: keep
the plain level's if the builder attaches them (drawn last).

### elasticity: story levels 1, 2
Plain: $Q = a - bP$ at $P_0$; L1 asks $\varepsilon$, L2 classifies elastic / inelastic / unit.

| Pattern | Translation | Misreading |
|---|---|---|
| words (`setup-words`) | demand in words as above | existing ones |
| two observations (`setup-points`) | demand from two (price, quantity) observations | new **slope-inverted**: $\varepsilon' = -\frac{1}{b}\cdot\frac{P_0}{Q_0}$ (L1 number; at L2 tag the option it would pick if it differs) |
| from today (`setup-anchor`) | "At today's price of \$$P_0$ the cinema sells $Q_0$ tickets a night; every \$1 rise loses $b$ customers, every \$1 cut gains $b$." Setup: $Q = Q_0 - b(P - P_0)$ (equivalent to $a - bP$). | existing `slope-not-elasticity` (answer $-b$) |

### cost-profit-maximization: story levels 1, 3
Plain: $TC(q) = F + vq + wq^2$. L1: $MC(q_0)$. L3: competitive price $p$, answer $(q^*, \pi)$.

| Level | Pattern | Translation | Misreading |
|---|---|---|---|
| 1, 3 | words (`setup-words`) | "Rent is \$$F$ a month whatever is made; materials cost \$$v$ a unit; crowding the workshop adds \$$w$ times the square of the units made." Setup: $TC(q)$. | existing |
| 1 | one more unit (`setup-next`) | costs in words; question: "about how much does it cost to make one more unit when output is $q_0$?" | existing `tc-as-mc` (they gave $TC(q_0)$) |
| 1, 3 | average given (`setup-average`) | "Fixed cost \$$F$; average variable cost is $v + wq$ dollars per unit." Setup: $TC(q) = F + q(v + wq)$. | new **avc-as-tvc**: treated $v + wq$ as total variable cost, $TC' = F + v + wq$ → L1: $MC' = w$; L3: $p = w$ has no clean solution, so omit at L3 |
| 3 | sunk cost (`setup-sunk`) | costs in words, plus "last year it spent \$$S$ on a market study" ($S$ = irrelevant, sunk). Setup: profit $\pi(q) = pq - TC(q)$. | new **sunk-cost-counted**: profit $- S$ |

### utility-maximization: story level 1
Plain L1: income $m$, prices $p_x, p_y$; forms: intercept, slope, affordable. Answer as plain.

| Pattern | Translation | Misreading |
|---|---|---|
| goods (`setup-budget`) | "You have \$$m$ a month for coffee ($x$, \$$p_x$ a cup) and books ($y$, \$$p_y$ each)." Setup: spending $p_x x + p_y y$ (variables x, y). | existing `slope-inverted`, `swapped-prices` |
| income from work (`setup-income`) | two-stage: "you earn \$$w$ an hour for $h$ hours" with $m = wh$ (choose $w, h$ whole, $m$ in range). Setup: spending as above. | new **hourly-as-income**: used $w$ as the income |
| time budget (`setup-time`) | the budget is hours, not dollars: "$m$ free hours a week; a film takes $p_x$ hours, a hike $p_y$". Same math, units hours. | existing |

### present-value: story level 1
Plain L1: $PV = FV/(1 + r)^n$ (form 0: amount needed later; form 1: PV of a future sum).

| Pattern | Translation | Misreading |
|---|---|---|
| grows to (`setup-grows`) | "Let $x$ be what you put in now. Write what it grows to in $n$ years": $x(1 + r)^n$; then solve $x(1+r)^n = FV$. | existing `compounded-not-discounted`, `simple-discount` |
| prize (`setup-prize`) | "A prize of \$$FV$ is paid in $n$ years. What is the most you'd pay for the ticket today?" Same setup. One irrelevant number (the number of tickets sold). | existing |
| two offers (`setup-offers`) | "An employer offers a bonus of \$$FV$ in $n$ years. What payment today is worth the same?" | existing |

Growth rates and Cobb-Douglas stay plain in this batch: their prompts are already situations or
pure formulas, and the learner has not started them.

## GRE

### gre-fractions-percents: story levels 1, 4
L1 plain: percent change from `old` to `nw`. L4 forms: percent of a percent, reverse percent
(choice answer), and the third form as built.

| Level | Pattern | Translation | Misreading |
|---|---|---|---|
| 1 | multiplier (`setup-multiplier`) | "Let $x$ be the percent change. Write the new value in terms of $x$": $\text{old}(1 + x/100)$; then the plain steps. Settings: a share price, a town's population, a salary. | existing `percent-change-base` |
| 1 | fell by / rose by (`setup-by`) | the story gives the **change**, not the new value ("the price fell by \$36"); the learner must not treat it as the new value. Setup as above. | new **by-as-to**: percent $= (\text{change} - \text{old})/\text{old}\cdot 100$ |
| 1 | newest first (`setup-order`) | the text gives the new value first ("Today a share costs \$$nw$; a year ago it cost \$$old$"). | existing `percent-change-base` (divided by the new value) |
| 4 | after a discount (`setup-discount`) | reverse percent: "after a $d$% discount a jacket costs \$$price$". Setup: $(1 - d/100)x$. | existing `reverse-percent-multiplied` |
| 4 | after tax (`setup-tax`) | "including $d$% sales tax the bill was \$$price$; the price before tax?" Setup $(1 + d/100)x$. Only where the level's form and ranges allow; otherwise skip. | existing `reverse-percent-multiplied` (here: $price \cdot (1 - d/100)$) |
| 4 | percent more than (`setup-more`) | "A earns $d$% more than B; A earns \$$price$; what does B earn?" Setup $(1 + d/100)x$. | same |

L4's reverse-percent form is a choice answer: re-derive the correct option in the skill test.

### gre-ratios-rates: story levels 2, 4
L2 plain: combined work (form 0: together; form 1: one alone from the together time).
L4 plain: rate × time with a unit conversion.

| Level | Pattern | Translation | Misreading |
|---|---|---|---|
| 2 | work done (`setup-work`) | "Let $t$ be the hours working together. Write the fraction of the job done in $t$ hours": $t/a + t/b$ (form 1: write what B alone does). Settings: printers, painters, pumps. | existing `work-rates-added-times` |
| 2 | relative speed (`setup-faster`) | two-stage: "B works $k$ times as fast as A" (so B's time is $a/k$), only where the level's params allow it exactly. | new **faster-means-longer**: B's time taken as $a \cdot k$ |
| 2 | fractions done (`setup-part`) | "In one hour A does $\frac{1}{a}$ of the job…" phrased as parts per hour. | existing |
| 4 | per minute, asked in hours (`setup-convert`) | "Let $x$ be the time in minutes. Write the amount in terms of $x$" ($\text{rate}\cdot x$), then plug in the converted time. Settings: typing words, a printer's pages, a pump. | existing `unit-conversion-missed` |
| 4 | per hour, asked in minutes (`setup-convert-back`) | the other direction | existing |

### gre-equations-word-problems: story levels 1, 3
L1 plain: translate a sentence (forms: $m(x + k) = r$, $mx + k = r$, …). L3: systems from words,
tickets (tuple answer).

| Level | Pattern | Translation | Misreading |
|---|---|---|---|
| 1 | in a situation (`setup-situation`) | the same sentence told as a situation ("a plumber charges $k$ dollars more than $m$ times…"). Setup: the left side in $x$. | existing `translation-order` |
| 1 | "less than" order (`setup-order`) | "5 less than 3 times a number" ($3x - 5$), where the plain form allows it. | existing `translation-order` ($5 - 3x$) |
| 1 | grouping (`setup-group`) | "$m$ times the sum of a number and $k$" vs "the sum of $m$ times a number and $k$". | existing `translation-order` |
| 3 | coins (`setup-coins`) | two coin types, total count and total value. Setup: total value in terms of $a$ and $c$ (variables a, c). | existing `solved-for-wrong-variable` (prices attached to the wrong counts give exactly the other count, so it is the same number; no new id) |
| 3 | nuts (`setup-mixture`) | two kinds of nuts at \$$p$ and \$$q$ per pound, total pounds and cost. | same |
| 3 | seats (`setup-seats`) | "a theater sold $x$ orchestra and $y$ balcony seats"; one irrelevant number (the show's length). | existing `solved-for-wrong-variable` |

## As built (Oct 24)

Three Sonnet subagents built it from this spec; reviewed and re-checked by hand. Deviations:
- supply-demand L4: the supply setup is written in the price sellers keep, $c + ds$; the existing
  `tax-supply` step then substitutes $s = P - t$. Story markets redraw until $c \ge 0$ (supply is
  told as "sellers bring $c$ even at a price of zero").
- elasticity: the irrelevant number is in the L2 words pattern (the spec named none).
- utility L1 income: wage and hours are drawn from divisors of $m$; two setup steps (pay in hours
  $t$, then spending in $x, y$). Time budgets redraw when $m > 72$ hours.
- present value: the prize pattern asks what the *winning* ticket is worth (the number of tickets
  sold is the irrelevant number); story `form` follows the question, so the interpretation fits.
- GRE fractions L4 tax: $d \in \{10, 20, 25\}$ (plausible sales taxes).
- GRE ratios L2 faster: B is 2–4 times as fast, setup $m x / a$ (B's rate times the hours together).
- GRE equations L3: `values-swapped` dropped in review (identical numbers to
  `solved-for-wrong-variable`).

New misconceptions: `slope-dropped`, `slope-inverted`, `shift-ignored` (supply–demand),
`slope-inverted` (elasticity), `avc-as-tvc`, `sunk-cost-counted` (cost–profit), `hourly-as-income`
(utility), `by-as-to` (GRE percents), `faster-means-longer` (GRE rates).

Checks: plain problems byte-identical (20,000 compared: 8 skills × 5 levels × 500 seeds); every
story level serves its 3 patterns about evenly over 1,000 seeds (ratios L4: 2).

## Verify (each skill)

```
npx vitest run --mode quick tests/generators tests/skills -t "<skill-id>"
npm run verify:sympy:skills -- <skill-id>
npx eslint src/skills/<track>/<skill-id>.ts
npx tsc -b
```

Also confirm plain problems are unchanged: generate seeds 1–300 at every level before and after
the change and compare (`JSON.stringify(makeProblem(skill, level, seed))`). Print 2 story prompts
per pattern with the answer and read them: each must make sense as a situation, with the answer
right for the story.
