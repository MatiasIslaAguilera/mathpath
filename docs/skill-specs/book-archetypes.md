# Problem shapes from the learner's own books

The learner's reference books live in `.books/` (git-ignored, never committed). Use them to find
**problem shapes** for story variants and new skills, the same way `bank-archetypes.md` uses the
GRE bank: describe the shape in your own words, then write a generator with original wording
and computed numbers. Never copy problem text, names or numbers into the repo.

To read them: `pdftotext -layout <file>.pdf out.txt` (PDF); an `.epub` is a zip of XHTML
(`unzip`, then strip tags). Extract into the session scratchpad, not the repo.

| Book | Covers | Best for |
|---|---|---|
| Rosser & Lis, *Basic Mathematics for Economists* | Algebra through optimization, every topic with economic examples | Story variants for the built math skills (levels 1–3) |
| Hoy et al., *Mathematics for Economics*, 4th ed., **Student Solutions Manual** | Worked solutions following the Econ 7370 syllabus, ch. 1–25 | Unbuilt 7370 skills: matrices, partials, constrained optimization, comparative statics, Kuhn–Tucker |
| Bergstrom & Varian, *Workouts in Intermediate Microeconomics* | Multi-part micro word problems, numbered by chapter (2.x budget lines, 4.x utility, …) | Econ skills: budget sets, utility maximization, demand, cost, monopoly, intertemporal choice |
| McCune, *500 GRE Math Questions* | GRE-style items (OCR text is rough) | GRE track word problems: chained discounts, ages, mixtures and ratios |
| Nugmanov, *Business Mental Math* (EPUB) | Case-interview mental arithmetic | Estimation and percent fluency (a possible "mental math" warm-up) |

## Shapes already used (batch S)

From Rosser §3.7 (simple equations), §3.9 (inequalities), §4.1 and §4.6 (functions, budget
constraints), §5.1–5.2 (simultaneous equations), §7.1 (growth):

- **Fee plus per-unit price** gives a total, so solve for the count (`a·x + b = c`).
- **The unknown is a rate, not a count:** an exchange rate after a fixed fee
  (`(A − fee)·x = B`), or a share price after a commission. *Not built yet:* a good level-2/3
  story for linear equations.
- **A demand curve solved for the price** (`q = a − b·p`, given q). *Not built yet:* fits
  inverse-functions L1 and functions-basics.
- **A weighted grade threshold**, and **budget feasibility** ("can the firm afford 6 K and
  4 L at these prices?").
- **Two plans meet**, and **break-even** (revenue = cost).
- **Supply meets demand** (`p = k + m·q` against a downward demand).
- **Growth factors multiply**: compounding over consecutive periods.

## Next shapes to mine

- **Hoy ch. 8–9 (matrices, determinants, Cramer's rule) and ch. 14 (comparative statics):** the
  market model solved in reduced form, then "what happens to the equilibrium price when a tax
  rises?" These go with the unbuilt matrices → Cramer → comparative statics skills (PLAN §8,
  item 2).
- **Hoy ch. 11–13 (partials, multivariable and constrained optimization):** Cobb-Douglas,
  Lagrangian cost minimization, interpreting λ.
- **Workouts 2.x–6.x:** budget lines with taxes and rations; utility maximization giving demand
  functions. Each problem is multi-part (compute, then write the equation, then interpret), which
  is the story-variant pattern exactly.
- **Rosser §5.9–5.11:** comparative statics in reduced form, price discrimination, a multi-plant
  monopoly.
