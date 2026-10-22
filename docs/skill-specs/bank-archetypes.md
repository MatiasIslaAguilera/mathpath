# Bank archetypes → generator candidates

This is the template-mining companion to the static challenge deck. The deck is the 200-question
GRE Quant bank imported by `tools/import_gre_bank.py`. Use it to find recurring **question
shapes**, then implement the shape as a parameterized generator (with `params`, `steps`,
`verify`, and misconceptions), not as a copied item.

## What the bank contains

| Topic | Items | Formats |
|---|---:|---|
| Algebra | 46 | single, numeric, multi, QC |
| Geometry | 45 | single, numeric, QC |
| Data Analysis | 44 | single, numeric, QC |
| Arithmetic | 42 | single, numeric, QC |
| Quantitative Comparison | 23 | QC |

Across all topics: 89 single-answer, 58 numeric-entry, 46 quantitative-comparison, 7
multiple-answer; 50 each at Simple/Middle/Hard/Challenging.

## Recurring archetypes

| Archetype | Bank examples | Existing generator / next step |
|---|---|---|
| One-variable linear equation | S01 (`4x - 7 = 13`), many Algebra items | `math/linear-equations` |
| Percent of / percent change / discount | S02, S06 | `gre/gre-fractions-percents`; add a percent-change level if missing |
| Rectangle/triangle/circle mensuration | S03, M07, M14, H32 | `gre/gre-circles-polygons`, `gre/gre-lines-angles-triangles` |
| Mean/median/range/SD | S04, H23, H29 | `gre/gre-descriptive-stats` |
| Linear QC with a fixed value | S05, S10 | `gre` QC generator; these are the easiest template: fix `x`, compare two linear forms |
| QC with a **variable domain** | H06, H09, H20, H41, H45 | High-value new QC level: compare expressions under constraints; use the harness's sampling to prove “cannot be determined” |
| Inscribed figures | M07 (circle in square), H07 (equilateral triangle in circle), H24 (cube diagonal) | Add a `gre` “inscribed figures” level or extend `gre-circles-polygons` / `gre-solids` |
| “In terms of S” algebra | C18 (7 consecutive integers summing to S) | Candidate new skill or level: parameterize the number of consecutive integers and ask for the largest/smallest in terms of S |
| Select-all number properties | M32 (`x^2=4`, `y^2=9`, possible `x-y`) | `gre/gre-integers` multi-select level; enumerate the small domain exactly |
| Probability with dice/cards/balls | H37, S39 | `gre/gre-counting-probability`; exact enumeration |
| Data interpretation from a table | Data Analysis items | `gre/gre-data-interpretation`; generate a table, compute the answer in code |
| Unit/rate/work | Arithmetic items | `gre/gre-ratios-rates` |
| Exponents/roots | Algebra items | `gre/gre-exponents-roots` |

## How to mine one item into a generator

Example: C18, “The sum of 7 consecutive integers is S. What is the greatest?”

1. **Generalize the parameter**: number of consecutive integers `n` (e.g. 3–9), not just 7.
2. **Choose a clean answer**: let the integers be `a, a+1, …, a+n-1`. Then
   `S = n a + n(n-1)/2`, so `a = S/n - (n-1)/2` and the greatest is
   `a + n - 1 = S/n + (n-1)/2`.
3. **Pick params backwards**: choose `a` and `n`; compute `S`; ask for the greatest (or the
   smallest, or the mean).
4. **Write the generator** with `params: { n, a }`, exact `Q` arithmetic, at least two steps,
   and `verify: { type: 'evaluate', expr: 'S/n + (n-1)/2' }` with `S` substituted — or better,
   an equivalent equation the harness can test.
5. **Use the bank item as a fixture** in `tests/skills/<id>.test.ts` (the `n=7` case must match
   the closed form).
6. **Add misconceptions**: off-by-one (using `S/n` as the greatest), wrong mean, sign error.

Example: H20, `|x| > 5`, compare `x^2` vs 25.

- Generalize to `|x| > k`, compare `x^2` vs `k^2`; answer is always A. This is a weak template.
- Better mine H06/H29/H45: constraints that allow “cannot be determined”. Those teach the QC
  skill; encode the domain with `verify.type = 'qc'` and let the harness sample trap values.

## Rules

- **Do not paste bank text** into a skill. Rewrite the stem and parameterize it.
- **Do not add a static bank as a `SkillDefinition`.** It breaks the generator harness and the
  mastery model; keep it in the Challenge deck.
- **Every generator still needs `verify`, steps, and misconceptions.** A bank item is a design
  reference, not a shortcut around the contract.
- **A new skill needs a `tree.ts` entry and `tests/skills/<id>.test.ts`.** Follow
  `docs/skill-specs/batch-*.md` and the reference skills in `CLAUDE.md`.

## Priority candidates for the curriculum

1. **QC with variable domains** (H06/H09/H20/H29/H41/H45): directly fills a gap between the
   current generated QC and real GRE “cannot be determined” logic.
2. **Inscribed figures** (M07/H07/H24): geometry that the current GRE generators do not cover.
3. **Consecutive-integer expressions** (C18): a clean algebra skill with a symbolic answer.
4. **Data interpretation table** (Data Analysis items): generate the table, compute the answer,
   and render with `tableFigure`; no static asset needed.
5. **Select-all number properties** (M32): enumerate a small domain exactly; good `multi` practice.
