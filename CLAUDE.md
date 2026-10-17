# MathPath

A personal "Duolingo for math and economics" for one learner preparing for Mizzou's online
MA in Economics. React + TypeScript + Vite, fully local (no backend, no login). Plan, research,
and design rationale: [docs/PLAN.md](docs/PLAN.md).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests: generator harness (1,000 seeds × 5 levels per skill), checker property tests, learning logic. `SEEDS=100 npm test` for a quick run |
| `npm run verify:sympy` | Independent cross-check: exports ~200 problems/level/skill and re-solves them with SymPy |
| `npm run test:e2e` | Playwright at a phone viewport (390×844): session, hints, guided mode, misconceptions, export/import |
| `npm run typecheck` / `npm run build` | `tsc -b` / production build |

**Never mark work as correct on judgment alone.** After any change to a generator, run
`npm test` and `npm run verify:sympy`. After UI changes, run `npm run test:e2e`.

## Architecture

```
src/engine/      problem contracts and pure machinery (no React)
  types.ts         SkillDefinition, Problem, Step, AnswerSpec, VerifySpec  ← start here
  rational.ts      exact fractions (Q) for generator arithmetic
  rng.ts           seeded RNG: (skillId, level, seed) → same problem every time
  checker.ts       answer equivalence via mathjs (fractions/decimals, expressions by sampling)
  misconceptions.ts  match a wrong answer to a predicted misconception
  answers.ts format.ts richtext.ts registry.ts
src/skills/      ONE FILE PER SKILL, registered in skills/index.ts
  tree.ts          the full planned skill tree (ids, tracks, order, prerequisites), incl. unbuilt skills
src/learning/    mastery (Elo rating), fading, scoring, session builder, streak, record
src/storage/     versioned Progress in localStorage (try/catch), export/import
src/reminders/   ics.ts (daily recurring calendar event), notify.ts (best-effort in-app notification)
src/ui/          components/ (MathText, AnswerInput, StepCard), screens/, styles/app.css
public/          PWA icons; vite.config.ts configures vite-plugin-pwa (precache, manifest)
docs/skill-specs/  per-batch specs handed to skill-writing subagents
tests/           generators.test.ts (shared harness), verify-check.ts (independent verifier),
                 checker.property.test.ts, learning.test.ts, skills/<skill>.test.ts
verify/          export-samples.ts + sympy_check.py
e2e/             Playwright specs
```

Core rules:
- Problems are **procedurally generated**. Answers are **computed in code** with exact `Q`
  arithmetic, never hardcoded and never LLM-generated at runtime.
- Steps, misconceptions, and interpretation questions are built from the **same params** as the
  problem, so they always match it.
- `Problem.verify` is a machine-readable **problem statement**, not the answer. The test
  harness and SymPy use it to check the answer independently. Each non-choice
  `step.ask` also has a `verify`.

## Adding a skill

Reference implementations (copy their structure):
- `src/skills/math/linear-equations.ts`: number answer, multi-form levels, numeric misconceptions
- `src/skills/math/derivatives-power-rule.ts`: expression answer, per-term steps, expression misconceptions
- `src/skills/econ/supply-demand-equilibrium.ts`: tuple answer, choice steps, interpretation questions

Checklist:
1. Create `src/skills/<track>/<skill-id>.ts` exporting a `SkillDefinition`:
   - **metadata:** `id`, `title`, `track`, `unit`, `description`, `prerequisites`, `maxDenominator`.
     The `id`, `track`, and `prerequisites` **must match the skill's entry in
     `src/skills/tree.ts`** (a test enforces this). Prerequisites that aren't built yet resolve
     through the tree to the nearest built ones. If the tree needs to change, change it there
     first, keeping it in topological order.
   - **`levels`:** 1–5, each with a `description` and inclusive `ranges` for **every** key in
     `params`. The harness fails if a param is missing from the ranges or outside them.
   - **`stepLabels`:** a readable name for every `Step.key` the skill uses
     (`collect: 'Collect x-terms and numbers'`). The stats page and progress analysis use these,
     and the harness fails if one is missing.
   - **`misconceptions`:** `{ id: { name, explanation } }`. Name the specific mistake;
     the explanation says why it's wrong and what to do instead.
   - **`learn`:** `whyItMatters` ("What it's for": 60–110 words with one concrete, arithmetically
     checked economics example; shown automatically the first time the learner meets the skill),
     `summary`, `formulas`, `example: { seed, level }` (rendered with the generator itself), and
     optional `tips`.
   - **`generate(rng, level)`:**
     - Pick params with `rng` only. Choose them backwards from a clean answer, and loop with
       `continue` to reject bad draws.
     - Return `params`, `prompt`, `answer`, `steps`, `misconceptions`, optional
       `interpretation`, and `verify`.
   - **Optional `check()`:** only for skills that require a specific *form*.
2. **Steps:**
   - Each step has a `key` (stable, e.g. `'expand'`), an `instruction` (plain words), `math`
     (display LaTeX), and a `why` (one line: the rule).
   - Give every step an `ask` so guided mode can quiz it.
   - Number and expression asks need a `verify`. Choice asks (conceptual: "which condition
     defines equilibrium?") don't.
   - The **last step's ask must equal the final answer**.
3. **Misconceptions per problem:** compute the wrong answer each mistake would produce
   with these numbers. Pass the candidates through `distinctMisconceptions(answer, [...])`,
   which drops undefined ones, ones equal to the right answer, and duplicates. Use `null` for
   "doesn't apply here". Every defined misconception must be reachable at some level (the
   harness checks this).
4. **Interpretation questions** (sign, units, meaning; PLAN §2.3):
   - Required for econ skills.
   - Also worth adding to math skills that econ relies on. The power rule asks what
     $f'(x_0)$ means as marginal profit.
   - Compute the correct option from params. Add `tests/skills/<id>.test.ts` that re-derives
     the correct option independently.
   - Draw interpretation randomness *after* everything else in `generate()`, so existing
     seeds (and Learn-card examples) don't change.
5. **Answer forms:**
   - Prefer number answers (a missing exponent, a value, a log's argument) over "simplify
     this". The checker accepts any equivalent expression, so it can't enforce a form.
   - Multiple-choice final answers (domains, ranges) use `verify: { type: 'choice', note }`
     and **require** `tests/skills/<id>.test.ts` that re-derives the correct option. The
     harness checks that the file exists.
   - Irrational answers (ln 5 / 2, e^{rt}): set `irrationalAnswers: true` and keep the value
     exact (`log(5)/2`). The learner types a decimal rounded to ≥ 2 places.
6. **Text conventions:**
   - RichText uses `$inline$` and `$$display$$` math, `*emphasis*`, and `\$` for a dollar sign.
   - `value` strings must parse in mathjs **and** SymPy: explicit `*`, `^` for powers,
     `sqrt()`, `log()` (natural), fractions as `(7/3)`. Use `Q.toExpr()` and `Q.toString()`.
7. Register the skill in `src/skills/index.ts`, then run `npm test` and `npm run verify:sympy`.

## PWA and reminders

- **Offline:** `npm run build` produces a service worker that precaches the app (woff2 fonts
  only, not .woff/.ttf). The service worker is disabled in dev, so e2e runs against dev. The
  production manifest and precache are checked by `e2e/pwa.spec.ts`, which builds and inspects
  `dist/`.
- **Install on a phone:** service workers need HTTPS (or localhost), so the built `dist/` must
  be served from an HTTPS static host to install on a phone.
- **Daily reminder:** Settings → "Add to my calendar" downloads a daily recurring `.ics`
  event. It fires even when the app is closed. The in-app notification only fires while the
  app is running; no backend means no push.

## Learning logic (where it lives)

| Logic | File | What it does |
|---|---|---|
| Rating | `learning/mastery.ts` | Elo-style per skill. P(correct) = σ(θ − b_level). Difficulty = hardest level with P ≥ 0.75. Hinted solves never raise θ. |
| Fading | `learning/fading.ts` | Backward fading: low mastery → more steps worked in guided mode. The learner always does ≥ 1 step. |
| Scoring | `learning/scoring.ts` | Unassisted: 10·level XP. Hints: half. Guided/reveal: 0 XP but counts for the day. |
| States | `learning/states.ts` | new → learning → practiced → check-pending → mastered, and rusty. "Fragile" is an overlay flag: first-of-day accuracy ≪ later accuracy. |
| Retention check | `learning/record.ts` + `session.ts` | The first unassisted solve at level ≥ 4 schedules a cold check 3 days later. It must be the first attempt of the day on that skill, at level ≥ 4, with no help. Pass → mastered. Fail → retry in 3 days, no penalty. |
| Reviews | `learning/scheduler.ts` | FSRS (ts-fsrs), one card per skill. Only the first attempt of the day is graded: Good, Hard (hints), or Again. A failed first-of-day review of a mastered skill → rusty. A later solo success → recovered. |
| Session | `learning/session.ts` | Warm-up → retention checks → ~70% current skill / ~30% due reviews (most-forgotten first, plus rusty and fragile) → finisher. Once ≥ 3 skills are solid, review items show "Mixed review" instead of the skill name. A same-skill follow-up comes after any miss or help. `todaysAgenda()` feeds Home. |
| Locks | `learning/unlock.ts` | A skill unlocks when every built prerequisite (resolved through `tree.ts`) is solid. A started or placed skill never re-locks. |
| Placement | `learning/placement.ts` | Binary search over the tree. 2 level-3 items per probed skill. Pass → credit it and its ancestors (rating 1.2, FSRS card graded Good so a review checks it in a few days). 1/2 → partial (level 2). Fail or "I don't know" → it and its dependents are left for learning. At most 24 items. Only raises ratings. Results are saved in `progress.placement`. |
| Streaks | `learning/streak.ts` | Computed from `days` alone (no stored state). A day with ≥ 3 problems counts. Every 7th streak day earns a freeze (max 2), used automatically on a missed day only while a streak is running. `comebackStatus()` drives the welcome-back card; more than 7 days away → a gentle, review-only session one level easier. |
| Stats & map | `learning/stats.ts` | Per-skill accuracy (overall, first-of-day, help rate, interpretation), weakest skills, top missed steps and misconceptions, the 8-week streak calendar, `treeView()` for the skill-tree map, and `overallProgress()` against the full tree. |
| Recording | `learning/record.ts` | Writes rating, FSRS, state transitions, history (with `firstOfDay`), XP, days, mistake log, misconception counts, and step misses. Returns `SkillEvent`s for the UI. |

## Workflow: analyzing a progress.json

When the user drops a `progress.json` (exported from Settings) into the repo and asks for an analysis:

1. **Read the file. These fields matter:**
   - `skills[id]`: `rating`, `attempts`, `correctUnassisted`, `interpretation`, and `history`
     (per attempt: `level`, `correct`, `help`, `hintsUsed`, `firstOfDay`).
   - `mistakes[]`: `{skillId, problemId, level, kind: wrong|hint|guided|reveal|interpretation, input, misconception, missedSteps}`.
     `problemId` is `skill:level:seed`; regenerate the exact problem with
     `problemFromId()` in `src/engine/registry.ts`.
   - `misconceptionCounts`: `"skill/misconception"` → count.
   - `stepMisses`: `"skill/stepKey"` → count.
2. **Find the weak spots:**
   - Skills with low unassisted accuracy or high help rates.
   - **First-of-day accuracy much lower than later-in-session accuracy.** That is the
     illusion-of-mastery signal.
   - The most frequent misconceptions and missed step keys.
   - Wrong `input`s that matched **no** misconception. These are undiagnosed mistakes:
     regenerate the problem and work out what error produces that input.
3. **Act on what you find:**
   - **Undiagnosed recurring wrong answers:** add a new misconception (definition +
     per-problem computation).
   - **Frequently missed step:**
     - Improve that step's `why` and `ask.prompt`.
     - Split it into smaller steps, or add a Learn-card tip or formula.
   - **A skill with persistent failure:** consider a gentler new level or a prerequisite
     skill. Check whether a prerequisite (e.g. exponent rules before the power rule)
     is the real gap.
   - **Interpretation errors:** add explanations or more targeted questions.
4. **Verify and report:**
   - Run `npm test` and `npm run verify:sympy` (plus `npm run test:e2e` if the UI changed).
   - Report what you found, with numbers, and what you changed.
   - Don't commit the user's progress.json. It is in `.gitignore`.

## Subagent delegation

- Use Sonnet subagents for repetitive work: new skill files, tests, UI components and styling,
  Learn-card content, and simple bug fixes.
- Give each one:
  - this file
  - the relevant PLAN section
  - one reference skill file
  - the exact skill spec: levels, misconceptions, interpretation questions
- Review the math yourself before merging.
- Run all tests after each batch.
