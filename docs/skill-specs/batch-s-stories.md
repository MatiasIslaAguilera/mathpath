# Batch S: story variants (word problems with a setup step)

**Why.** Measured on 2026-10-22: only 16% of math prompts and 24% of GRE prompts tell a situation;
the four skills the learner practices most are 0% narrative. The learner's weakest skill is a
narrative one (GRE percents, 40% solo, median 8½ minutes per correct item vs 25 s for a bare
linear equation). Executing steps is not the bottleneck; turning a situation into math is.
See PLAN §8.

**What a story variant is.** `SkillDefinition.story = { levels, generate(rng, level) }`
(`src/engine/types.ts`). It returns the same body shape as `generate`:

- **Same math, same checks.** Use the level's own param names and stay inside its `ranges`, so
  the harness, the misconception checks and SymPy apply unchanged. Reuse the skill's own solving
  code (refactor `generate` into a shared `solve…(params)` function if needed; plain problems
  must stay byte-identical for the same seed — `makeProblem(skill, level, seed)` is unchanged).
- **A setup step first.** `steps[0].key` starts with `setup` (`setup`, `setup-right`, …), asks the
  learner to *write the situation as an expression* (`answer.kind: 'expression'`), and has
  `verify: { type: 'equivalent', expr, variables }`. The checker accepts any equivalent form.
  Add every setup key to `stepLabels`. The harness enforces all of this.
- **Then the skill's own steps**, unchanged, ending with the final answer as usual.
- **Numbers make sense in the story**: positive prices, counts and totals; units named.
- **At the top level of each story set, one irrelevant number** (a delivery time, a date) that
  must be ignored. Mention it in the setup step's `why`.
- **Dollar signs**: write `` `\\$${v}` `` in template literals (see `usd()` in
  `linear-equations.ts`), never `\$`, which lint rejects.
- **Original wording only.** Problem *shapes* below come from books the learner owns
  (`.books/`, git-ignored). Never copy their text, names or numbers.

Ids: `skill:level:seed:s`. The session serves a story for about half of practice items at story
levels (even seeds); warm-ups, finishers and retention checks stay plain.

**Reference implementation:** `src/skills/math/linear-equations.ts` (`story`, `pickStory`,
`setupStep`, `solveBuilt`). Levels 1–3: fee plus per-unit price, discounts, two plans meeting,
break-even, items at an unknown base price plus a per-item extra (with an irrelevant number).

## Per skill

### linear-inequalities: story levels 1, 2, 3
Shapes (Rosser §3.9, §4.6): a budget limit ("a fee plus $a per unit, at most $c: how many
units?"); a weighted grade ("coursework counts 30%, you scored 60; what exam score keeps the
overall at least 50?"); a battery or stock that falls by a fixed amount per hour (level 2,
negative coefficient: the sign flips); two plans, "when is A cheaper than B?" (level 3).
Setup: write the quantity that is limited, in terms of x. The final answer stays the skill's
solution-set choice; keep the existing interpretation questions where they apply.

### systems-of-equations: story level 2
Shape (Rosser §5.1–5.2): supply and demand meet. Supply as `p = k + m·q` (the level's
`y = mx + k`), demand as a linear relation `a·q + b·p = c` with signs that make economic sense
(demand slopes down, supply up), positive equilibrium price and quantity. Setup: write the
supply price as an expression in q (or x). Keep the answer as the level's tuple.

### functions-basics: story levels 1, 2
Level 1 (Rosser §4.1, §3.2): profit = revenue − cost. Revenue `b·x`, cost `|a|·x² + |c|`, so
profit is `a x² + b x + c` with a < 0, c < 0; "find the profit at x0 units" (x0 > 0). Setup:
write profit as an expression in x. Level 2 piecewise: a shipping or tax schedule ("$p per kg
up to k kg, then …") evaluated at a point; setup: write the piece that applies. Domain/range
levels (3–5) stay plain.

### exponent-rules: story level 1
Growth factors (Rosser §7.1): "a population multiplies by x each year; it grows by x^a, then by
x^b: total factor x^?" (product), and "over a years it grew by x^a, of which x^b came in the
first b years: what was the factor over the remaining years?" (quotient: the reason the
exponents subtract). Setup: write the growth factor as an expression in x (e.g. `x^a * x^b`,
or `x^a / x^b`). This targets `add-for-quotient`, the learner's one persisting misconception.

## Verify

```
npm run test:quick
npm run verify:sympy:skills -- <skill-id>
npx eslint src/skills/<track>/<skill-id>.ts
```

Print 9 story prompts (seeds 2, 4, 6 at each story level) and read them: they must make sense
as situations, with the right answer for the story.
