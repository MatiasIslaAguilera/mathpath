# MathPath — plan

A personal "Duolingo for math and economics." Goal: go from pre-Algebra-2 to the math
used in Mizzou's online MA in Economics, through a daily habit that survives a full-time job.

Status: **MVP + batches A–C built** (mastery states, FSRS, retention checks, interleaving, "What it's for", placement test, prerequisite locks, streak freezes, welcome-back, skill-tree map, stats). Batch D built (installable offline PWA, calendar reminder). Batches E (exponents, logs, functions), F (calculus core + first econ applications) and G (GRE Quant, 15 skills) built: 35 skills. Sync: event log + Supabase. Next: deploy (docs/SETUP.md), then the remaining tree (multivariable, matrices, integrals, statistics, the rest of econ).

---

## 1. What the Mizzou program actually uses (research findings)

Sources: MU catalog MA Economics page, Mizzou Online admissions page, department syllabi
for Econ 7370, 7371, 8451, 8453 (2018–2023; no 2024–26 syllabi were public).

| Finding | Source |
|---|---|
| Admission: **at least one semester of calculus** is required for the online MA. GRE not required. | Mizzou Online admissions |
| Catalog: program "assumes a mathematical background through calculus"; weaker applicants may be admitted with supporting coursework. | MU catalog |
| Core (18 cr): **Econ 7370 Quantitative Economics** (or 8370 Math for Economics), **7371 Intro Econometrics** (or 8472), **8451 Micro Theory**, **8453 Macro Theory**, **8473 Applied Econometrics**, 8413 Research Workshop. | MU catalog |
| **7370 topics** (Hoy et al., *Mathematics for Economics*): sets & functions; sequences, limits, **present value**; continuity; differentiation & **differentials**; convex/concave functions; **Taylor's formula**; one-variable optimization; **systems of linear equations, matrices, determinants, inverse, Cramer's rule, eigenvalues, quadratic forms**; partial derivatives; multivariable optimization with **1st/2nd-order conditions**; **Lagrange multipliers**; **comparative statics**; **Kuhn–Tucker**; dynamics. | 7370 Fall 2021 syllabus |
| **7371** (Stock & Watson): prereq is intermediate micro + **an intro statistics course**. Starts with a probability/statistics review, then OLS, hypothesis tests, confidence intervals, **nonlinear (log) specifications**, panel data, binary dependent variables, IV, time series. | 7371 Summer 2022 syllabus |
| **8451** (Nicholson & Snyder): micro "as a set of analytical tools built on calculus": consumer & producer theory, partial/general equilibrium, imperfect competition (oligopoly), asymmetric information. | 8451 2022/2023 syllabi |
| **8453**: general equilibrium, **intertemporal optimization**, **Solow growth model**, overlapping generations. | 8453 2018/2022 syllabi |

### Changes I made to your skill tree because of this

1. **Matrices moved from "later" to the core path.** 7370 spends a quarter of the course on
   linear algebra (determinants, inverses, Cramer's rule), and second-order conditions and
   comparative statics use determinants/Hessians.
2. **Statistics/probability moved from "later" to the core path,** and regression
   interpretation became a full econ unit. 7371 assumes intro stats, and the two econometrics
   courses are 2 of the 5 required courses. Interpreting coefficients in log-level, level-log
   and log-log models is where the logs skill pays off.
3. **Added:** sequences & geometric series (→ annuities/perpetuities), differentials &
   linear/Taylor approximation, second-order conditions (1-variable, then 2-variable with
   the Hessian), interpreting the Lagrange multiplier (shadow price), implicit
   differentiation / total differential for comparative statics, Cobb-Douglas production
   (marginal products, returns to scale), cost minimization, Cournot duopoly, two-period
   consumption (intertemporal budget), Solow steady state.
4. **Trig demoted to optional.** None of the five core courses uses it in a meaningful way.
   It stays in the tree, but nothing on the main path requires it. This also drops one of
   your three weak spots from the critical path.
5. **Kuhn–Tucker** is added as a late, light skill (inequality constraints, corner solutions).
6. **Integrals stay but shrink:** antiderivatives, definite integrals, area interpretation
   (consumer surplus with nonlinear demand), and later continuous probability.

Your weak spots (functions/transformations, exponentials & logs) are the foundation for
derivatives, growth rates, and log-regression interpretation, so the placement test probes
them first and the tree routes through them before calculus.

---

## 2. Specialist findings

### 2.1 Learning scientist: methods and how each one appears in the app

| Method (evidence) | How it shows up |
|---|---|
| **Retrieval practice** (testing effect; Roediger & Karpicke 2006) | Every interaction is an attempt to produce an answer. Learn cards are optional reference, never a "read first" gate. Reviews are cold attempts, not re-reading. |
| **Spacing** (Cepeda et al. 2006 meta-analysis) | Each skill has an FSRS memory state (`ts-fsrs` library). Due skills make up the ~30% review share of each session. |
| **Interleaving** (Rohrer & Taylor 2007; strongest for *choosing* a method) | Once ≥3 skills reach "practiced," review items are mixed and the prompt doesn't say which skill it is (it says "Solve," not "Use the chain rule"). Later, "which method applies?" items are added for skills that are easy to confuse (product rule vs. chain rule; point vs. arc elasticity). |
| **Worked examples → fading** (Sweller; Renkl & Atkinson backward fading) | First contact with a skill: the Learn card's worked example plus a *completion problem* where every step is filled in except the last. Guided mode fills in fewer steps as mastery grows, removing the *last* steps first (backward fading). |
| **Mastery learning** (Bloom; Kulik et al. 1990) | A skill unlocks once its prerequisites reach "practiced" (unassisted success at difficulty ≥3). "Mastered" also requires a delayed retention check (§2.4). |
| **Elaborative feedback** (Shute 2008) | When a wrong answer matches a known misconception, the app names it and explains it. Every step shows a one-line "why." |
| **Desirable difficulty** | Difficulty is chosen so the predicted success rate is about 75–85%. Too easy builds no memory; too hard kills motivation. |
| **Self-explanation** (Chi 1994) | Econ interpretation questions (sign, units, meaning). In guided mode, some steps ask "which rule applies?" instead of asking for a number. |
| **Pretesting** | The placement test doubles as a pretest: items you miss become your first learning targets. |

**Mastery model: an Elo-style rating per skill.**
- Each skill has a rating θ. Difficulty levels 1–5 have fixed ratings b₁…b₅.
  P(correct) = σ(θ − b_d).
- After an *unassisted* attempt: θ ← θ + K·(outcome − P), with K shrinking as attempts accumulate.
- Hint use: the attempt counts as incorrect-ish (outcome 0.3) and never raises θ above its prior value.
- Guided/reveal: outcome 0, small K (the attempt still carries information).
- Difficulty for the next item is the highest level with P ≥ 0.75.
- Why not BKT? BKT models a binary "known/unknown" state and doesn't map naturally onto
  five difficulty levels. Elo is transparent, works with few observations, and produces
  the "next difficulty" directly.

**Review scheduling: FSRS** (`ts-fsrs`). One card per skill. The first attempt of the day on a
skill is graded: unassisted correct → Good, correct on the second try → Hard, wrong / hint /
guided → Again. Later attempts that day update θ but not FSRS, which keeps the spacing signal clean.

### 2.2 Game designer: the core loop

- **Session:** ~10 problems, about 10–15 minutes. Daily goal is adjustable: 3 / 5 / 10 / 15 problems.
  **3 problems always counts for the day.**
- **Session shape:**
  1. A warm-up: one review item with a high predicted P(correct), so the first action is a success.
  2. The core: about 70% current skill, 30% due reviews, interleaved.
  3. The finish: the last item is chosen to have the highest predicted P(correct) among
     eligible items. If you just missed one, the follow-up "same method, new numbers" problem
     comes first.
- **Reward timing:**
  - Immediate: feedback, an XP tick, and a progress bar for each problem.
  - Medium: a level-up banner when a skill's difficulty rises.
  - Big: a mastery celebration when a retention check passes. This is the reward that matters,
    and it arrives days after the practice, which reinforces spacing instead of cramming.
- **What pulls you back tomorrow:**
  - The session summary ends with a concrete preview: "Tomorrow: 2 reviews + continue Derivatives (level 3)."
  - Home shows one button.
  - An optional reminder (see the limitation in §6).
- **Missed day handling:**
  - Streak freezes: you earn 1 per 7-day streak and can hold up to 2. They are applied automatically.
  - When the streak does break, there is no guilt screen. The app shows "Welcome back. You've
    practiced 23 days total," with a **3-problem restart** button.
  - **Total practice days** and a **weekly consistency** score ("4 of the last 7 days") are shown
    as prominently as the streak, so a break never erases visible progress.
  - Longest streak is kept.
  - After a long gap (>7 days), the first session is entirely review at a reduced difficulty.
    This is honest about forgetting and starts you with wins.
- **Never punishing:** no hearts or lives, no countdowns, XP is never lost, help never breaks the
  streak, and nothing is shown in red except an individual incorrect answer.

### 2.3 Economics professor: what understanding looks like, per econ skill

Each econ generator includes optional **interpretation items** (multiple choice, generated from
the same parameters). These are tracked as a separate "interpretation" accuracy.

| Skill | Beyond the number |
|---|---|
| Supply & demand equilibrium | Units (P in $/unit, Q in units). Excess supply/demand at a given price, and which way the price moves. Direction of P\* and Q\* when demand or supply shifts. |
| Elasticity (point/arc) | Unitless, and why. The sign is negative for demand and the magnitude is what gets classified. Elastic vs. inelastic → what happens to revenue when price rises. Why arc and point elasticity differ. |
| Surplus, taxes, DWL | Units are dollars, and surplus is an area. Who bears more of a tax (the more inelastic side). Why DWL > 0: trades that no longer happen. Tax revenue vs. DWL tradeoff. |
| Cost functions, MR = MC | MC is the cost of the *next* unit. AC is minimized where MC = AC. Why profit maximization is MR = MC and not P = MC (outside perfect competition). Shutdown when P < AVC. |
| Monopoly vs. competition | Direction of price/quantity differences, DWL of monopoly, markup and the Lerner index tied to elasticity. |
| Utility maximization (Cobb-Douglas) | MRS = price ratio as a tradeoff. Budget shares equal the exponents. Demand responds to income and own price but not cross price (a Cobb-Douglas property). |
| Lagrangian | λ = marginal utility of income (shadow price): its units, and what happens to utility when income rises by $1. |
| Comparative statics | The *sign* of the derivative and what it means ("a higher tax lowers Q\*"). Which assumption determines the sign. |
| Present value, discounting | PV is in today's dollars. Higher r → lower PV. Long horizons are very sensitive to r. A perpetuity is the limit case. |
| Growth rates, logs | Δln x ≈ % change and when the approximation breaks (large changes). The rule of 70. Index-number base year. |
| Regression interpretation | A coefficient's units and meaning in level-level, log-level (≈100·β %), level-log, and log-log (elasticity) models. Significance vs. size. Ceteris paribus. Correlation ≠ causation. |
| Expected value | Units. Risk-neutral vs. risk-averse comparison. |
| Cournot, Solow, two-period consumption | Best-response logic. The steady state as a fixed point. The interest rate as the price of current consumption. |

### 2.4 Skeptical tutor: detecting illusion of mastery

Signals the app watches:
1. **Session warm-up effect:** high accuracy *after* several same-skill items, low on the
   *first* attempt of the day. The app tracks first-attempt accuracy and in-session accuracy
   separately. A large gap marks the skill as **fragile**.
2. **Context dependence:** correct in blocked practice, wrong when interleaved. Interleaved
   accuracy is tracked separately.
3. **Help dependence:** a high share of hinted solves. These earn no mastery credit, so the
   rating won't rise on them.
4. **Delayed failure:** a passed skill fails its first spaced review.

Responses:
- **"Mastered" requires** reaching level 4 unassisted (θ high enough) **and then** passing a
  **retention check ≥3 days later**. The check is a cold, interleaved, unassisted item at
  level ≥4 and must be the first attempt of the day on that skill.
- **States:**
  - locked → available → learning → practiced → *retention check pending* → mastered
  - Off the main path: **rusty** (a failed review after mastery) and **fragile**
- A rusty or fragile skill goes back into the current-skill pool at one level lower, with
  shorter FSRS intervals (FSRS handles lapses natively). It is not reset to zero. The app
  says plainly: "You knew this right after practice but not 5 days later. That's normal.
  A few spaced reviews fix it."
- **Placement credit is provisional:** skills placed by the diagnostic count as "practiced,"
  not "mastered," and get a retention check within the first week.

---

## 3. Skill tree (revised)

Arrows are prerequisites. ★ = in the MVP.

**MATH**
1. ★ Linear equations → linear inequalities → systems of 2 equations
2. Quadratics: factoring → quadratic formula → vertex form
3. Functions: evaluation & domain/range → composition → inverses → transformations
4. Exponents (rules) → logarithms (rules) → solving exp/log equations → growth/decay models
5. Sequences & geometric series
6. Limits & continuity
7. Derivatives: ★ power rule → product/quotient → chain rule → exp & log derivatives → implicit differentiation
8. Applications: differentials & linear approximation → concavity & second-derivative test → optimization
9. Partial derivatives → total differential → multivariable optimization (FOC/SOC, Hessian)
10. Matrices: operations → determinants → inverse (2×2, 3×3) → Cramer's rule
11. Integrals: antiderivatives → definite integrals → area between curves
12. Probability & statistics: probability basics → expected value & variance → normal / z-scores → sampling, SE, CI, t-tests
13. Kuhn–Tucker (light)
14. *(optional)* Trig basics: unit circle, identities

**ECONOMICS** (each requires the listed math)
1. ★ Supply & demand equilibrium (linear eq., systems)
2. Elasticity: point (derivatives) & arc
3. Surplus, taxes/subsidies, DWL (equilibrium, area)
4. Cost functions & MR = MC (derivatives, optimization)
5. Monopoly vs. competition (MR = MC, elasticity)
6. Cobb-Douglas production: MP, returns to scale (partials)
7. Utility maximization with budget (Cobb-Douglas) → demand functions
8. Lagrangian optimization + λ interpretation; cost minimization
9. Comparative statics (implicit / total differential, Cramer's rule)
10. Cournot duopoly (systems, derivatives)
11. Present value, discounting, compound interest, annuities/perpetuities (exp, series)
12. Growth rates, logs as % changes, index numbers, rule of 70
13. Two-period consumption & Solow steady state (exponents, optimization)
14. Regression interpretation (logs, statistics)
15. Expected value & risk (probability)

---

## 4. Architecture

### Core types (`src/engine/types.ts`)

```ts
interface SkillDefinition<P> {
  meta: { id; title; track: 'math'|'econ'; unit; prerequisites: string[];
          levels: Record<1|2|3|4|5, ParamRanges> };      // declared ranges, used by generator AND tests
  generate(rng: Rng, level: Level): Problem<P>;           // picks params, returns everything below
  learnCard: LearnCard;                                    // formula, worked example (built by generate w/ fixed seed), common mistakes
}

interface Problem<P> {
  skillId; level; seed; params: P;
  prompt: RichText;                     // text + KaTeX
  answer: AnswerSpec;                   // number | fraction | expression | choice | tuple, with tolerance
  steps: Step[];                        // ordered; built from the same params
  misconceptions: { id; name; explanation; wrongAnswer: AnswerSpec }[];  // computed wrong answers
  interpretation?: ChoiceQuestion[];    // econ "beyond the number"
  verify: VerifySpec;                   // machine-readable *problem statement* for SymPy (not the answer)
}

interface Step {
  instruction: string;                  // "Set supply equal to demand"
  math: string;                         // KaTeX
  why: string;                          // the rule/concept
  ask?: { prompt: string; answer: AnswerSpec };   // what guided mode asks you for
  value?: unknown;                      // intermediate value, checked by tests
}
```

### Key decisions

- **Seeded RNG** (mulberry32). Every problem is reproducible from `(skillId, level, seed)`,
  which makes test failures, the mistake log, and SymPy disagreements replayable.
- **Exact arithmetic** with mathjs `Fraction` inside generators, so "clean" answers are exact
  and never off by float error.
- **Answer checker** (mathjs):
  - Numbers: parse fractions, decimals, and simple expressions (`1/2`, `0.5`, `3/6`), then
    compare with relative/absolute tolerance.
  - Expressions: numerical equivalence at ~20 random points per variable, avoiding
    singularities, plus a symbolic `simplify(a-b)==0` fallback.
  - Skills that require a *form* (e.g. "factor") add a form check.
  - Misconception matching reuses the same equivalence test against each computed wrong answer.
- **Guided mode** uses `step.ask`. Backward fading is decided in `learning/fading.ts`: the number
  of prefilled steps = f(θ), and the last step is never prefilled.
- **Storage:** a single versioned `ProgressV1` object in localStorage behind a try/catch wrapper
  with migrations. It holds per-skill θ, FSRS card, state, attempt history, the mistake log
  (skill, seed, level, missed step index, misconception id, help used), streak data, and settings.
  Export/import as `progress.json` with schema validation on import.
- **No runtime LLM, no backend.**

### Verification (outside checks)

1. **Generator harness** (Vitest, one shared test that runs every registered skill). For each
   skill × level × 1,000 seeds:
   - params fall within the declared `levels` ranges
   - the answer satisfies the problem via an independent check (substitute back, or a
     numeric derivative via finite differences)
   - every `step.value` is consistent: each step re-checked by substitution where possible
   - final step value == answer
   - every `step.ask.answer` is accepted by the checker
   - no misconception's wrong answer equals the correct answer (otherwise you'd get "wrong"
     feedback for a right answer)
   - answers are "clean" per skill policy
2. **SymPy cross-check:** `verify/export-samples.ts` dumps N problems per skill as
   `{verify spec, app answer}`. `verify/sympy_check.py` re-solves each spec with SymPy
   (`solve`, `diff`, `integrate`, …) and reports every disagreement with a replay seed.
   It runs as `npm run verify:sympy`. SymPy 1.12 is already installed on this machine.
3. **Property tests** (fast-check) for the checker:
   - equivalent rewrites (fraction ↔ decimal, expanded ↔ factored, reordered terms, scaled
     num/den) are accepted
   - random perturbations are rejected
   - malformed input never throws
4. **Playwright** at an iPhone-sized viewport (390×844): placement, full session, hints,
   guided mode with a wrong step then a retry, and export → clear → import round-trip.

---

## 5. File structure

```
app/
├─ CLAUDE.md                     architecture, how to add a skill, progress.json analysis workflow
├─ docs/PLAN.md                  this file
├─ package.json  vite.config.ts  tsconfig.json  index.html  playwright.config.ts
├─ public/                       PWA icons
├─ src/
│  ├─ main.tsx  App.tsx
│  ├─ engine/
│  │  ├─ types.ts                SkillDefinition, Problem, Step, AnswerSpec, VerifySpec
│  │  ├─ rng.ts                  seeded RNG + helpers (randInt, pick, nonzero, cleanFraction)
│  │  ├─ format.ts               exact-number → LaTeX / plain string helpers
│  │  ├─ checker.ts              answer equivalence (mathjs)
│  │  ├─ misconceptions.ts       match wrong answer → misconception
│  │  └─ registry.ts             skill list, prerequisite DAG helpers
│  ├─ skills/
│  │  ├─ index.ts                registers all skills
│  │  ├─ math/linear-equations.ts            ★ reference skill
│  │  ├─ math/derivatives-power-rule.ts      ★ reference skill
│  │  └─ econ/supply-demand-equilibrium.ts   ★ reference skill (with interpretation items)
│  ├─ learning/
│  │  ├─ mastery.ts              Elo rating, skill states, fragile/rusty detection
│  │  ├─ scheduler.ts            FSRS wrapper (ts-fsrs)
│  │  ├─ session.ts              session builder: warm-up, 70/30, interleave, end on success
│  │  ├─ fading.ts               guided-mode prefilled-step count
│  │  ├─ scoring.ts              XP / mastery credit rules
│  │  ├─ streak.ts               streaks, freezes, total days, weekly consistency
│  │  └─ placement.ts            adaptive diagnostic (batch 2)
│  ├─ storage/
│  │  ├─ progress.ts             schema, versioning, safe localStorage
│  │  └─ exportImport.ts
│  └─ ui/
│     ├─ components/             MathText, AnswerInput, StepCard, FeedbackPanel, ProgressRing…
│     ├─ screens/                Home, Session, Exercise, GuidedMode, LearnCard, SkillTree,
│     │                          Stats, Settings, Placement, WelcomeBack, SessionSummary
│     └─ styles/
├─ tests/
│  ├─ generators.test.ts         shared 1,000-seed harness over all skills
│  ├─ checker.property.test.ts   fast-check
│  └─ learning/*.test.ts         mastery, scheduler, session builder, streak
├─ e2e/*.spec.ts                 Playwright, phone viewport
└─ verify/
   ├─ export-samples.ts
   └─ sympy_check.py
```

---

## 6. Things you should know before approving

- **Daily reminder limitation.** A local-only PWA *cannot reliably fire a notification at a
  fixed time* when the app is closed. Web Push needs a server, and the Notification Triggers
  API was never shipped. My plan:
  1. Settings generates a **recurring calendar event (.ics)** at your chosen time. It works
     on any phone, offline, and actually fires.
  2. When the PWA is open or in the background, the app shows a best-effort notification.

  If you'd rather add a tiny free push server later, the design leaves room for it.
- **Placement test** (batch 2): adaptive search over each track's prerequisite chain.
  - It starts mid-track and gives 1–2 items at level 3 per probed skill.
  - A pass credits that skill and its prerequisites as provisionally "practiced."
  - A miss probes downward.
  - It takes about 20–25 items (15–20 min) and can be retaken anytime. Retaking never lowers
    a skill you've already mastered through practice.
- **Expression answers:** you'll type things like `6x^2 - 4/x^3` or `6x^2-4x^(-3)`. A small
  math keyboard row (^, /, √, x, parentheses) will sit above the input on mobile.

---

## 7. Build order

1. **This plan** ← you are here
2. **MVP (Opus, me):**
   - Vite+React+TS shell
   - engine (types, rng, checker, misconceptions)
   - storage + export/import
   - Exercise screen with Check / Hint / "I don't know" → guided mode with "Show me"
   - misconception feedback
   - immediate same-skill follow-up after help
   - simple Home with "Today's session"
   - the 3 ★ skills with Learn cards
   - generator harness, fast-check checker tests, SymPy cross-check, Playwright smoke tests
   - CLAUDE.md
3. **Batches** (each followed by a full test run + my review):
   - **A.** Mastery (Elo + states + retention check), FSRS, session builder, fading
     (me: learning-science logic)
   - **B.** Placement test (me) + its UI (Sonnet)
   - **C.** Gamification (XP, streak/freezes, welcome-back, skill-tree map, stats page)
     (logic: me; UI: Sonnet)
   - **D.** PWA (manifest, service worker, .ics reminder) (Sonnet)
   - **E–H.** Remaining skills in groups of 4–6 (Sonnet subagents). Each gets this spec plus
     `linear-equations.ts` / `supply-demand-equilibrium.ts` as references. I review every
     file's math and run the harness + SymPy check before merging. Calculus-heavy and
     Lagrangian skills: I review the math line by line.
