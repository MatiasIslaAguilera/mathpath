# Batch S2: story patterns (more kinds of translation, not more settings)

**Why.** Batch S gave five math skills a story variant, but each story level had one way of mapping
words to math, told in 2–4 settings (mostly "a fee plus a price per unit"). The learner's story
misses (exports of Oct 23–24, 44 story attempts) were almost all the same reading error:

| Skill, level | Story solo | Plain solo | Misses |
|---|---|---|---|
| linear-inequalities L1 | 52% (n 21) | 97% | 13 × reversed set (`read-backwards`) |
| linear-inequalities L2 | 63% (n 8) | 67% | 3 × reversed set |
| linear-equations L3 | 83% (n 6) | 88% | 44/4 = 11 for a 4-night stay with a \$4 nightly fee (undiagnosed) |
| systems-of-equations L2 | 0/2 | n/a | (4, 6) for y = 2 + 3x, 2x + 2y = 20: the slope read as 1 (undiagnosed) |

A different *setting* doesn't train a different *reading*. This batch adds patterns that change the
mapping itself (a different unknown, a comparison, a rate in the wrong unit, a negated limit, both
quantities changing, a question asked about the other plan), each built around the misreading it
provokes, with that misreading computed as a named misconception from the problem's own numbers.

Batch 2 (next): story variants for econ (supply–demand, elasticity, cost–profit, present value,
growth rates, utility/Cobb-Douglas) and the narrative GRE skills (fractions–percents,
ratios–rates, equations–word-problems), from Hoy et al., Bergstrom's *Workouts* and McCune.

## How patterns are added without breaking history

`SkillDefinition.story.original` is the story generator exactly as it was before the new patterns.
Ids ending `:s` (already in the learner's event log) regenerate from it, so `npm run analyze` keeps
re-diagnosing old misses against the problem the learner actually saw. `story.generate` is the new
mix: `rng.int(0, 3)` picks the pattern (0 = the original stories), and new ids end `:s2`.
Never edit `original` beyond adding misconceptions; a third mix would need `:s3` and a second
frozen generator.

Every pattern keeps the level's param names and ranges and the skill's own solving steps, so the
harness, the inequality option test and SymPy apply unchanged. Each pattern has its own first-step
key (`setup-rate`, `setup-age`, …), so `stepMisses` and the coverage count separate the patterns.

## Patterns

Misconceptions in **bold** are new.

### linear-equations
| Level | Pattern (setup key) | Translation it trains | Misreading |
|---|---|---|---|
| 1 | original (`setup`) | fee plus price per unit | **total-over-count** (c ÷ a, fee left in) |
| 1 | rate unknown (`setup-rate`) | count given, price per unit unknown | **total-over-count** |
| 1 | comparison (`setup-compare`) | "5 more than 3 times the number of …" | **compare-reversed** (x = a·c + b) |
| 1 | unit rate (`setup-units`) | \$r per 20 min, x in hours | **unit-mismatch** (answer in blocks) |
| 2 | original (`setup`) | two plans meet, break-even | — |
| 2 | ages (`setup-age`) | in x years both ages grow | **aged-one-only** |
| 2 | gap (`setup-gap`) | "\$15 more than him", not equal | **ignored-gap** |
| 2 | chase (`setup-chase`) | head start plus speed × time | sign-x-term (speeds added) |
| 3 | original (`setup`) | unknown base price plus per-item extra | **total-over-count** (the seen 44/4) |
| 3 | extra unknown (`setup-extra`) | base given, per-item extra unknown | **total-over-count** |
| 3 | discount (`setup-discount`) | a(x − e) = d | **discount-sign**, total-over-count |
| 3 | two orders (`setup-orders`) | a(x + b) = cx + d, one irrelevant number | distribute-first-only |

### linear-inequalities
| Level | Pattern | Translation | Misreading (the option it adds or renames) |
|---|---|---|---|
| 1 | original | fee + per unit vs a limit or target | read-backwards |
| 1 | price unknown (`setup-rate`) | budget for a fixed count | **total-over-count** option |
| 1 | negated limit (`setup-negated`) | "must not exceed", "can't be … or less" | reversed set named **negated-limit** |
| 1 | margin (`setup-margin`) | profit per item = price − cost, then a fixed permit | **price-not-margin** option |
| 2 | original | a stock that falls | read-backwards |
| 2 | negated falling (`setup-negated`) | "no more than", "has not dropped below" | **negated-limit** |
| 2 | candle (`setup-units`) | cm per 15/20/30 min, x in hours | **unit-mismatch** option |
| 2 | temperature (`setup-falling`) | crosses zero; boundary negative; wind speed irrelevant | read-backwards |
| 3 | original | plan A vs plan B prices | read-backwards |
| 3 | profit (`setup-profit`) | revenue vs cost: profit, loss, break even | read-backwards |
| 3 | asked about B (`setup-compare`) | "when is *B* cheaper than A" | reversed set named **compare-reversed** |
| 3 | pay (`setup-pay`) | "pays more": better is larger | read-backwards |

### systems-of-equations (level 2)
| Pattern | Translation | Misreading |
|---|---|---|
| original (`setup`) | supply in words, demand as an equation | **per-unit-dropped** (the seen (4, 6)) |
| market (`setup-market`, `setup-demand`) | supply *and* demand in words | **per-unit-dropped** |
| count and value (`setup-compare`) | "child tickets were 3 more than twice the adult" + money total | **compare-reversed** |
| rectangle (`setup-perimeter`) | length from width, then 2x + 2y | **perimeter-as-sum** |

### functions-basics
| Level | Pattern | Translation | Misreading |
|---|---|---|---|
| 1 | original (`setup`) | profit from given formulas | **fixed-cost-dropped** |
| 1 | profit in words (`setup-words`) | price, a cost growing with the square, rent | **fixed-cost-dropped** |
| 1 | falling price (`setup-revenue`) | revenue = x(b − ax) | **price-not-revenue** |
| 1 | pen (`setup-area`) | three sides fenced against a wall | **wall-side-fenced** |
| 2 | original (`setup`) | water bill, two rules | wrong-piece |
| 2 | courier (`setup-boundary`) | rules in words; "k kg or more" at the cut-off half the time | wrong-piece |
| 2 | parking (`setup-duration`) | the input is leave − arrive | **clock-not-duration** |
| 2 | before launch (`setup-time`) | model in words; "5 quarters before" is x = −5 | **time-direction**, negative-squared |

### exponent-rules (level 1)
| Pattern | Translation | Misreading |
|---|---|---|
| original (`setup-product` / `setup-quotient`) | growth factors given as powers | multiply-for-product, add-for-quotient |
| periods (`setup-periods`) | "multiplied by x every year, for 6 years then 4 more" / "how many times as large as after the first 4" | same |
| sizes (`setup-size`) | an area; how many containers fill a tank | same |
| scale (`setup-scale`) | groups × amount per group; "how many times as far" | same |

## Verify

```
npm test
npm run verify:sympy:skills -- linear-equations,linear-inequalities,systems-of-equations,functions-basics,exponent-rules
```

Seed stability (one-off, Oct 24): every plain seed and every `:s` story seed regenerates exactly
as before the batch (0 diffs over 7,500 plain and 3,000 story problems, and all 44 story ids in
the learner's exports); 6 of those 44 now carry a misconception they lacked.

Coverage over 1,000 seeds: every story level serves 4 patterns at about 25% each.

**Outcome check** (PLAN §8 item 0): `npm run measure` §6, story vs plain per skill and level, over
the next 2–3 weeks. Inequalities L1 first (44 points on Oct 24). Plain accuracy must hold. Per
pattern: `stepMisses` on the `setup-*` keys show which translations are hard.
