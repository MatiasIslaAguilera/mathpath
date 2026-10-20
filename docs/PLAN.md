# MathPath — plan

A personal "Duolingo for math and economics." Goal: go from pre-Algebra-2 to the math
used in Mizzou's online MA in Economics, through a daily habit that survives a full-time job.

Status (Oct 18, 2026): **35 skills built and verified, with sync and the GRE track.** Waiting on deployment (docs/SETUP.md). See §7 for what's next and §6 for how the plan changed from the original brief.

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
| **Mastery learning** (Bloom; Kulik et al. 1990) | A skill unlocks once its prerequisites are solid at level 2 (P ≥ 0.75 at level 2, with ≥ 3 unassisted level-2+ solves); the prerequisite keeps climbing through reviews and stretch items. "Mastered" also requires a delayed retention check (§2.4). |
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
- Difficulty for the next item is the highest level with P ≥ 0.75. Every 5th current-skill item (from the 3rd) is a **stretch**, one level up, once the skill has ≥ 5 attempts.
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

## 3. Skill tree

Arrows are prerequisites. ✅ = built (35 skills). The authoritative tree, including the
skills not built yet, is `src/skills/tree.ts`. Prerequisites resolve *through* unbuilt
skills: the power rule needs limits, which needs functions, which needs linear equations.

**MATH**
1. ✅ Linear equations → linear inequalities → systems of 2 equations
2. Quadratics: factoring → quadratic formula → vertex form
3. Functions: ✅ evaluation & domain/range → ✅ composition → inverses → transformations
4. ✅ Exponent rules → ✅ logarithm rules → ✅ exp/log equations → ✅ growth & decay
5. Sequences & geometric series
6. ✅ Limits & continuity
7. Derivatives: ✅ power rule → ✅ product/quotient → ✅ chain rule → ✅ exp & log
   derivatives → implicit differentiation
8. Applications: differentials & linear approximation → ✅ concavity & second-derivative test
   → ✅ optimization
9. Partial derivatives → total differential → multivariable optimization (FOC/SOC, Hessian)
10. Matrices: operations → determinants → inverse → Cramer's rule
11. Integrals: antiderivatives → definite integrals → area between curves
12. Probability & statistics: basics → expected value & variance → normal / z-scores →
    SE, CIs, t-tests
13. Kuhn–Tucker (light)
14. *(optional)* Trig basics

**ECONOMICS** (each uses the math above)
1. ✅ Supply & demand equilibrium (incl. taxes, interpretation questions)
2. ✅ Elasticity: point, arc, constant-elasticity, the revenue reading
3. Surplus, taxes/subsidies, deadweight loss
4. ✅ Costs & profit maximization: MC, AC/AVC, P = MC, efficient scale, shutdown price
5. Monopoly vs. competition
6. Cobb-Douglas production
7. Utility maximization with a budget → demand functions
8. Lagrangian optimization + interpreting λ; cost minimization
9. Comparative statics
10. Cournot duopoly
11. Present value, discounting, annuities
12. Growth rates & logs, index numbers
13. Two-period consumption & Solow steady state
14. Regression interpretation
15. Expected value & risk

**GRE QUANT** (added at your request; its own track, one question in every session)
- **Arithmetic:** ✅ integer properties, ✅ fractions & percents, ✅ ratios/rates/work,
  ✅ exponents & roots
- **Algebra:** ✅ equations & word problems, ✅ inequalities & absolute value, ✅ quadratics &
  functions, ✅ coordinate geometry
- **Geometry:** ✅ lines/angles/triangles, ✅ circles & polygons, ✅ solids
- **Data analysis:** ✅ mean/median/SD, ✅ counting & probability, ✅ data interpretation
  (charts, tables), ✅ normal distribution & percentiles

These are generated from templates and verified like everything else, not copied from ETS or
any question bank (copyright). They cover all four GRE formats:
- numeric entry
- multiple choice
- select all that apply
- quantitative comparison

GRE is excluded from the placement test and from "master's progress". Note that the Mizzou
online MA does not require the GRE; this track is quant-reasoning practice.

---

## 4. Architecture (as built)

### Data flow

```
skill generator (pure, seeded) ──► Problem ──► Exercise UI ──► AttemptResult
                                                                    │
                                     LearningEvent (immutable, uuid)◄┘
                                                │
              localStorage event log + outbox ◄─┴─► Supabase `events` table (append-only, RLS)
                                                │
                       Progress = replay(events) + profile  (deterministic on every device)
```

### Key decisions

- **Seeded RNG.** Every problem is reproducible from `(skill, level, seed)`.
- **Exact arithmetic** (`Q` rationals, polynomial helpers) inside generators.
- **The answer checker accepts equivalent forms:**
  - numbers: fractions, decimals rounded to ≥ 2 places
  - expressions: numeric equivalence at sample points
  - tuples, multiple choice, select-all
  - Unreadable input is reported, never graded as wrong.
- **Progress is an event log.**
  - Every attempt, interpretation answer and placement is an immutable event.
  - Progress is rebuilt by replaying events in time order, so the phone and the PC merge by
    union and nothing is ever lost.
  - Your pre-sync progress became a baseline event, stamped with when that progress began, so
    it can never erase answers from another device.
  - Settings live in a small last-writer-wins profile.
- **Local-first sync.**
  - The app works fully offline; events wait in an outbox.
  - A sync pass uploads them, reconciles the profile, and pulls new events by a server-time
    watermark.
  - Supabase row-level security means only your account can read your rows.
- **Learning logic:**
  - Elo-style rating per skill, picking a level at about 75% predicted success
  - FSRS reviews graded only on the first attempt of the day
  - cold retention checks for "mastered"
  - backward fading in guided mode
  - interleaving with hidden skill names
  - an adaptive placement test (binary search over the tree)
  - details in `CLAUDE.md` → "Learning logic"
- **No runtime LLM.** Problems, answers, steps, misconceptions and figures are all generated
  by code.

### Verification (outside checks, run after every batch)

1. **Generator harness:** every skill × 5 levels × 1,000 seeds. It checks:
   - the answer against an independent check of the problem statement
   - every guided step's answer
   - parameter ranges, clean answers, distinct misconceptions, KaTeX rendering, figure safety
2. **SymPy cross-check:** about 92,000 problems and steps re-solved by a computer algebra
   system. For limits with logs, a guarded fallback covers a known `sympy.limit` bug.
3. **Skill tests:** each skill re-derives answers a *different* way, such as:
   - finite differences
   - brute-force grid search
   - enumeration
   - exact big-integer arithmetic
   - law of cosines
   - a normal-distribution formula
4. **GRE quantitative comparisons:** generators compute the relationship exactly. The harness
   re-derives it by sampling with trap values. Any two disagreeing samples prove "cannot be
   determined".
5. **fast-check property tests** for the checker. Event-log properties too: live progress
   equals a rebuild, and merging is order-independent. Plus a two-device sync test against a
   fake Supabase.
6. **Playwright end-to-end tests** at phone size (22 tests).

---

## 5. File structure

```
app/
├─ CLAUDE.md                 architecture, adding a skill, progress analysis workflow
├─ docs/PLAN.md              this file
├─ docs/SETUP.md             Supabase + GitHub Pages + phone install (your steps)
├─ docs/skill-specs/         the specs given to skill-writing subagents (batches E, F, G)
├─ supabase/migrations/      database schema (events, profiles, attempt_log view, RLS)
├─ .github/workflows/        test + build + deploy to GitHub Pages on every push
├─ public/                   PWA icons
├─ src/
│  ├─ engine/                types, rationals, RNG, checker, misconceptions, figures, registry
│  ├─ skills/                math/, econ/, gre/ (one file per skill), tree.ts (full planned tree)
│  ├─ learning/              mastery, scheduler (FSRS), states, session, placement, unlock,
│  │                         streak, stats, fading, scoring, record (events → progress)
│  ├─ storage/               events, replay, store (local log + outbox), useLearningStore
│  ├─ sync/                  Supabase client + sync pass
│  ├─ reminders/             .ics calendar reminder, best-effort notification
│  └─ ui/                    components (MathText, AnswerInput, AnswerDisplay/Figure, StepCard)
│                            and screens (Home, Exercise, GuidedMode, LearnCard, Placement,
│                            SkillTree, Stats, Settings, Summary)
├─ tests/                    harness, verifiers, learning/sync tests, tests/skills/<id>.test.ts
├─ e2e/                      Playwright specs
└─ verify/                   SymPy cross-check
```

---

## 6. Decisions that changed the original brief

| Original brief | Now | Why |
|---|---|---|
| "No backend, no login", localStorage + export | Supabase sync with an account, local-first | You asked for phone use and continuous learning with a database. Export/import still exists as a backup. |
| Runs locally | GitHub Pages (public repo, app code only) + installable PWA | Phone install needs HTTPS. |
| Daily notification at a chosen time | Recurring calendar event (.ics) + best-effort in-app notification | A web app can't schedule notifications while closed without a push server. |
| Math + econ tracks | + GRE Quant track, one question per session | Your request. |
| Trig on the main path | Optional | None of the core Mizzou courses really uses it. |
| Matrices and statistics "later" | Core path | 7370 (linear algebra) and 7371/8473 (econometrics) require them. |
| Sonnet writes the skills | Batch F written by Opus | Sonnet hit a usage limit. Same specs and checks. |
| Unlock when prerequisites are "practiced" (level 3) | Unlock when solid at level 2; stretch items one level up | First real progress file (Oct 2026): 75 linear-equations problems, 89% at level 1, never shown level 3, nothing unlocked. One level-1 miss erased ~7 solves, so the rating sat on the level 1/2 line; a simulation gave 9% odds of unlocking in the next 100 problems. |

---

## 7. Build order and status

1. ✅ Plan + research
2. ✅ MVP: engine, checker, guided mode, misconceptions, 3 reference skills, all verification
3. ✅ **A** mastery states, FSRS, retention checks, interleaving, "What it's for" ·
   ✅ **B** placement test + prerequisite locks · ✅ **C** streak freezes, welcome-back,
   skill-tree map, stats · ✅ **D** offline PWA + calendar reminder
4. ✅ Event log + Supabase sync + account UI; GitHub Pages workflow
5. ✅ **E** exponents, logs, functions (6) · ✅ **F** calculus core + first econ (8) ·
   ✅ **G** GRE Quant (15)
6. ⏳ **Deploy:** waiting on your Supabase project + GitHub repo (`docs/SETUP.md`)
7. **Next skills (H and beyond), in this order** (matches the first-semester courses):
   1. partial derivatives → total differential → multivariable optimization
   2. Cobb-Douglas → utility maximization → Lagrangian
   3. present value, growth rates
   4. matrices → Cramer's rule → comparative statics
   5. statistics → regression interpretation
   6. integrals → surplus/DWL
   7. remaining algebra (quadratics, inverses, transformations, systems)
8. **After a few days of real use:** analyze your answer history (`attempt_log` in Supabase
   or progress.json) and adjust generators, hints and Learn cards to your weak spots.
