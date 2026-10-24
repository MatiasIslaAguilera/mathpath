# MathPath — plan

A personal "Duolingo for math and economics." Goal: go from pre-Algebra-2 to the math
used in Mizzou's online MA in Economics, through a daily habit that survives a full-time job.

Status (Oct 22, 2026): **38 skills built and verified (20 math, 3 econ, 15 GRE), with sync and the GRE track.** Deployed to GitHub Pages; every push to main runs the tests and redeploys. See §7 for what's next and §6 for how the plan changed from the original brief.

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
- **Level-3 start, for high-accuracy learners:** the rating moves slowly when a miss cancels
  several solves, so a level-4 item can take ~100 problems to appear (measured on the Oct 2026
  attempt log: 105 linear-equation attempts, 0 at level 4, 0 retention checks). If the skill is
  *practiced* and the last 25 unassisted attempts are ≥ 90% correct, the first solo level-3
  solve also starts the clock. The check is then served at the level that earned it (3), or at
  the working level if that is higher, so mastery stays tied to demonstrated ability.
- **Stretch cadence:** every 5th current item is one level up; every 3rd once recent solo
  accuracy is above the 75–85% desirable-difficulty band, because the working level is then
  too easy (70% of the Oct 2026 log was level 1, solved at 89%).
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

Arrows are prerequisites. ✅ = built (38 skills). The authoritative tree, including the
skills not built yet, is `src/skills/tree.ts`. Prerequisites resolve *through* unbuilt
skills: the power rule needs limits, which needs functions, which needs linear equations.

**MATH**
1. ✅ Linear equations → ✅ linear inequalities → ✅ systems of 2 equations
2. Quadratics: ✅ factoring → ✅ quadratic formula → vertex form
3. Functions: ✅ evaluation & domain/range → ✅ composition → ✅ inverses → ✅ transformations
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
| Sonnet writes the skills | Batches F and H written (or finished) by Opus | Sonnet hit a usage limit. Same specs and checks. |
| Build the remaining algebra last | Batch H (inequalities, systems, quadratics, inverses, transformations) before multivariable calculus | Prerequisites resolve through unbuilt skills, so the app jumped from linear equations to functions and exponents and never practiced quadratics or inverses. The learner is at the start of the tree, where these are the next unlocks. |
| Placement: at most 24 items | At most 30 | With batch H there are 23 placeable skills, 8 of them leaves; each leaf needs its own 2-item probe, and acing the test needed 30 items to reach every skill. Raise it again when a batch adds leaves. |
| A math keypad for the answer box | Typed lines of working, each line checked | VanLehn (2011): step-level tutoring is about twice as effective as answer-only checking (d ≈ 0.76 vs 0.31). Substituting the solution into each line pinpoints the first wrong one exactly. On Android phones a sketch pad can't be checked, and paper isn't at hand. |
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
6. ✅ **Deploy:** GitHub Pages (`.github/workflows/deploy.yml`)
7. ✅ **H** algebra foundation (6): linear inequalities, systems, quadratic factoring, quadratic
   formula, inverse functions, transformations (`docs/skill-specs/batch-h.md`)
8. **Next skills (I and beyond), in this order** (matches the first-semester courses):
   1. ✅ partial derivatives → total differential → multivariable optimization (batch I)
   2. ✅ Cobb-Douglas → utility maximization → Lagrangian (batch J)
   3. ✅ present value, growth rates (batch K)
   4. ✅ matrices → Cramer's rule → comparative statics (batches I and J)
   5. statistics → regression interpretation
   6. integrals → surplus/DWL
   7. vertex form, sequences & geometric series
   Also built (Oct 22): Android back gesture (back = one layer back; sessions and placement ask
   first) and the **working pad**: lines of working typed with a math keyboard (MathLive),
   each line checked by substituting the solution, and the first wrong line pinpointed after
   Check. On Oct 23 it was widened to the econ skills (see item 11). Next: §8 item 7.
9. ✅ **Progress reviews** (4 so far, logged in `docs/review-ledger.json`): `npm run analyze`
   reports only what is new since the last review; `npm run measure` checks the model itself.
   The improvement backlog that came out of them is §8.

10. ✅ **Home redesign (Oct 23)**: the garden (one plot per master's skill, growth = skill state,
    a water drop = review due today, plants never shrink), Pareto the cat (mood = today's
    progress, bubble = the next concrete thing, never a reproach), streak and days practiced as
    equal figures, and two charts (problems per day; weekly solo accuracy from the full event
    log, against the 75–85% band). Fraunces + Atkinson Hyperlegible Next, with digits from a
    4 KB IBM Plex subset (`src/ui/fonts/`, renamed per its OFL) because Atkinson's slashed zero
    read as ∅. Reviewed by four adversarial critics (visual, motion/mobile, learning science,
    dataviz/a11y); their must-fixes are in, the rest are §8 item 8. Logic in
    `learning/garden.ts` (`tests/garden.test.ts`), UI in `ui/components/{Garden,Cat,Charts}.tsx`,
    checks in `e2e/home.spec.ts`. Review PNGs: `SCREENS=<dir> npx playwright test screens`.
11. ✅ **Working pad widened (Oct 23)** to supply & demand 1–5, optimization 1–5, cost & profit
    2–5, elasticity 5, transformations 1–4, limits 4, concavity 3, GRE exponents 2, GRE word
    problems 1 and 3. `Problem.working.names` declares the other quantities a learner writes
    (`AC`, `MC`, `Pb`, `pi` for profit, `e` for elasticity): checked, never filled into the answer.
    The pad now reads derivative sides (`R'(q) = 21 - 2q = 0` checks the rest of the chain;
    the keyboard's `^{\prime}` is converted), function notation at the unknown (`R(q) = …` is R at
    the solution), and starred optima (`P^*`). Guard: `tests/working.test.ts` asserts the app's own
    worked solution is never marked wrong, for every opted-in skill.

12. ✅ **Batches I and J (Oct 23): 11 skills, 34 of 54 core skills built.** I (`batch-i.md`):
    partial derivatives, total differential, matrix operations, determinants, matrix inverse,
    Cramer's rule, multivariable optimization. J (`batch-j.md`): Cobb-Douglas, utility
    maximization, Lagrangian, comparative statics. Engine: two new verify specs, `partial`
    (∂ⁿf/∂w₁…, optionally at a point) and `det`, each checked independently by mathjs and SymPy.
    The harness now fails on a LaTeX command whose backslash JS dropped (`'\cdot'` in a plain
    string renders as the letters "cdot", `'\times'` as a tab + "imes"): KaTeX accepts both
    silently, so this was invisible before; it found one live in GRE quadratics L4.
    Built by Sonnet subagents from the specs (two waves for I, four in parallel for J), every
    example reviewed by hand. Review found: lost backslashes (I), Cramer L1–2 drawing
    zero-coefficient systems, and a Lagrangian choice that marked the valid `f + λ(g − c)` as wrong.
13. ✅ **Batch K (Oct 23): Time & growth, 4 skills, 38 of 55 non-GRE tree skills built.**
    `batch-k.md`: geometric series (math; multiplier, repeating decimals, convergence), present
    value (discounting, NPV, annuities, perpetuities, loan and sinking-fund payments), growth
    rates & logs (log approximation from printed logs, rule of 70, ratio/product growth, index
    numbers), two-period consumption & Solow (endowment PV/FV, optimal c₁/c₂, saving, steady
    state, golden rule). Kept clear of `growth-decay` (compounding forward, doubling time, solving
    for r). Every answer exact; infinite sums verify as a `limit` of the n-term sum to `oo`.
    Four Sonnet subagents in parallel; SymPy 13,230/13,230. Review found: the spec's golden-rule
    question was wrong (moving s to the golden rule never lowers c*; the subagent caught it), and
    a lost `\alpha` that the harness can't see because `\a` isn't a JS escape (found by a
    scan for any undoubled backslash + letter; run it on every new batch).

**Also shipped:** a static **Past papers** deck with 200 GRE Quant questions imported from
`lbcty56/GRE-Quiz-App-Python-` (`docs/CONTENT-SOURCES.md`). It is separate from the mastery
rating; `docs/skill-specs/bank-archetypes.md` lists the bank's question archetypes for the next
batch of generators.

## 8. Improvement backlog (from reviews 4–5, 2026-10-22/23)

### Next session: start here (written Oct 23, after batch K shipped)

1. **Review the learner's data first** (steps below). No new export arrived between batches J
   and K, so these are still open:
   - The inequality-story fix from review 5: `npm run measure` §6, linear-inequalities L1 story
     vs plain was 0.22 vs 0.96 (n 9 vs 23). It worked if the gap shrinks and the
     `read-backwards` misconception count falls.
   - First attempts on the batch I/J/K skills. When there are some, look for undiagnosed wrong
     answers; these generators have never met a real learner.
2. **Then build batch L, statistics:** probability basics → expected value & variance →
   normal & z-scores → sampling & inference → regression interpretation, plus expected value &
   risk. Write `docs/skill-specs/batch-l.md` the way `batch-k.md` is written (book shapes, PLAN
   §2.3 rows, examples checked by hand, then subagents). Check overlap with the GRE statistics
   skills (`gre-descriptive-stats`, `gre-normal-distribution`, `gre-counting-probability`).
3. **After L:** batch M, integrals → surplus/DWL, plus monopoly vs competition and Cournot; then
   the leftovers (vertex form, implicit differentiation, differentials, Kuhn–Tucker). 17 non-GRE
   tree skills remain unbuilt (`tree.ts` against `hasSkill`).
4. **Backlog item 1** (calibrate levels) is now less urgent: once settled, the rating model
   already beats the constant (0.1193 vs 0.1244, review 5). Re-check before starting it.

Notes for building with subagents (learned in I and J):
- Put the hard rules in every prompt: doubled backslashes in LaTeX strings, ≥ 2 steps per problem,
  the same params keys at every level, exact rational answers, interpretation drawn last, a
  skill test that re-derives every choice answer and interpretation. The harness enforces most of these.
- Review each reported example by hand (all were right in I/J, but the review still found
  rendering and pedagogy bugs the tests can't see). Scan for lost backslashes over the new files.
- Sessions can hit the API rate limit mid-batch. Partial work stays on disk; resume each agent
  with SendMessage rather than starting over.
- The learner doesn't use the placement test. When new skills push past `MAX_ITEMS` in
  `learning/placement.ts`, bump it (the e2e helper reads it) and move on.

### Starting a session on this

1. Export a fresh progress file (Settings → Export) and run, in order:
   - `npm run analyze -- <file>`: new mistakes since the last review, trends between reviews,
     misconceptions that persist after a fix.
   - `npm run measure -- <file>`: the model checks below (Brier, calibration, FSRS, time on
     task, learning curve, content runway). Every number in this section comes from it.
2. Pick the top open item below. Each one names the evidence, the change, the files, and the
   **check that decides whether it worked**. A change is done when its check passes on real data,
   not when the code is written.
3. Verify: `npm run test:quick` while iterating, then `npm test`,
   `npm run verify:sympy:skills -- <changed skill ids>`, and `npm run test:e2e` for UI or session
   changes.
4. Close the loop: `npm run analyze -- <file> --mark-reviewed "what changed"`, commit the ledger
   with the code, and update the status column here.

Baseline (second export of 2026-10-23, review 5, 286 solo attempts over 6 days): solo accuracy
84% (inside the 75–85% band); rating-model Brier 0.1419 vs 0.1373 for a constant over all
attempts, 0.1193 vs 0.1244 once 15+ attempts in (the model now wins there); FSRS first-of-day
recall predicted 0.98, actual 0.78 (n 18); 35 timed minutes per active day; 23 of 54 core skills
built at the time (34 now, after batches I and J), 4 started, 3.1 weeks of runway before I and J.

### Backlog, in priority order

| # | Item | Evidence | Change | Check | Status |
|---|---|---|---|---|---|
| 0 | **Story variants: translation, not just execution** | 16% of math and 24% of GRE prompts tell a situation; the most-practiced skills were 0%. Weakest skill is a narrative one (GRE percents, 40% solo, median 523 s per correct item vs 25 s for a bare linear equation). | Batch S (`docs/skill-specs/batch-s-stories.md`): `SkillDefinition.story`, ids `…:s`, about half of practice items at story levels; a first *setup* step asks for the expression (checked by equivalence). First batch: linear equations L1–3, inequalities L1–3, systems L2, functions L1–2, exponent rules L1 (growth factors, aimed at `add-for-quotient`). Shapes mined from the learner's books in `.books/` (git-ignored; never copied). Next: Hoy et al. and Workouts shapes for the econ skills. | `npm run measure` §6: the story-vs-plain gap per skill and level shrinks over weeks; plain accuracy holds. | in progress |
| 1 | **Calibrate level difficulty per skill** | The rating model predicts worse than a constant (Brier 0.1285 vs 0.1189; 0.0994 vs 0.0977 once settled). Actual beats predicted at every level (L3: 0.74 → 0.83); actual L2 and L3 accuracy are equal (0.83), but the model spaces levels one logit apart. Accuracy climbs 0.76 → 0.92 while the average level only moves 1.1 → 1.7. Tested and **rejected**: a slip parameter (best Brier 0.1262). | Estimate each skill's level offsets from the attempt log (shrunk toward the current spacing −2…2, so sparse skills keep the default), used by `pCorrect` / `nextLevel` in `learning/mastery.ts`. Offsets must be rebuilt by replay (no hidden state), like `held`. | `npm run measure`: model Brier below the constant baseline on attempts made *after* the change, and solo accuracy inside 75–85%. | open |
| 2 | **Content runway: build by syllabus weight** | 2.8 weeks of runway at 6.8 new core skills/week (keep ≥ 3). The topics Econ 7370 leans on hardest (matrices, partial derivatives, multivariable optimization, Lagrange, comparative statics) are all unbuilt. | Next batch, in this order: partial derivatives → total differential → multivariable optimization (FOC/SOC); matrices → determinants → inverse/Cramer; Lagrangian. Specs in `docs/skill-specs/` (the first seven: `batch-i.md`), generators per CLAUDE.md, subagents for the files. Supersedes the order in §7 item 8 where they differ. | `npm run measure` §5: runway ≥ 3 weeks; harness + SymPy green for each new skill. | I, J and K built (Oct 23, 15 skills; §7 items 12–13). Next: batch L, statistics ("Next session" above) |
| 3 | **Personal FSRS parameters** | First-of-day recall predicted 0.97, actual 0.77 (n 13). All 3 misses came at predicted recall ≈ 1.0: cold-start slips, not forgetting. | Once ≥ 50 first-of-day reviews exist, fit FSRS weights from the log (fsrs optimizer, offline in `tools/`), store them in `learning/scheduler.ts`. Until then, no change: n is too small. | `npm run measure` §2: predicted and actual recall within 5 points. | waiting for data |
| 4 | **Contrasting cases for rule confusion** | Exponent rules: median 7 s right, 9 s wrong; 5 of 7 misses under 12 s. `add-for-quotient` persists after its fix (2 before review 3, 1 after). | A level-1 item type showing $x^a\cdot x^b$ and $rac{x^a}{x^b}$ side by side (tuple answer: both exponents), so the learner must tell the rules apart. Same idea for power-of-a-power vs product at level 2. Also log `durationMs` on attempts so fast misses can be named in feedback. | `npm run analyze` trend: `add-for-quotient` rate per attempt falls; `measure` §3: fast misses drop. | open |
| 5 | **Time-box slow items** | GRE fractions & percents: a correct item takes a median 523 s; one GRE item can be a quarter of a 34-minute day. | After ~2 min on any item, offer the first hint (counts as hinted). An "I don't know" button that opens guided mode and logs `help: 'reveal'`, so guesses stop polluting the data (the two "50" answers). | `measure` §3: median time on the skill falls with accuracy stable. | open |
| 6 | **Outside benchmark of readiness** | The app only grades itself. | A monthly 20-item mock from the Past papers GRE deck (held out from practice), and a readiness set of textbook problems for 7370 topics (Hoy et al.), scored and stored as their own history. | The benchmark itself: score trend month to month. | open |
| 7 | **Working pad: identity working** | 6 skills had the pad before Oct 23, 15 now. Still off: exponent rules, log rules, all derivative skills, inverse L2–3, because their working is identities in free letters ($(xy)^3/(x^7y^5) = x^{-4}y^{-2}$, $f'(x) = 6x + 2$), which substitution can't judge. Also off, with reasons in the skill files: concavity L5 (its method lists the rejected critical point), inverse L4 and GRE word problems L2 (only some variants are equations). | In `engine/working.ts`: a line whose free letters aren't unknowns is checked as an identity by sampling, like `checker.ts` does for expression answers (both sides equal at random points). Derivative lines: `f'(x) = …` compared with the problem's derivative via the step's `diff` (or, for the batch I skills, `partial`) verify. Then opt in exponent rules, log rules, derivatives. Run the worked-solution guard on each. | `tests/working.test.ts` worked-solution guard green for the new skills; share of practice items offering the pad (from the event log) rises; no rise in `wrong` lines on correct final answers. | open |
| 8 | **Home: the rest of the design review** | The adversarial review (Oct 23) left these: Home has ~80 buttons, mostly the 38-row skill list that repeats the skill tree (PLAN: "Home shows one button"); the cat stands beside the garden, not in it (no watering pose); no radius scale (3–999 px, 9 values); XP is still a volume reward on Home. | Move the skill list to the skill tree screen (a dozen e2e specs click `skill-*` rows on Home: move them to the tree first); put the cat on a tile with a pose per mood; 3 radius tokens; XP to the Stats page. | Playwright: buttons on Home ≤ 6; `npm run test:e2e` green; review PNGs approved. | open |

### Done in review 6 (Oct 23 evening, for context)

The read-backwards fix works once deployed: inequality stories 10/12 solo after it, 1/4 on the
older build that afternoon. Warm-ups and finishers always took the single most likely skill one
level below its working level: 45 level-1 exponent-rules items in 6 days, all correct, and the
skill never climbed. They now rotate over likely wins (P ≥ 0.8, least recently seen first) and
serve the working level once a skill is above the band (`easiest` in `learning/session.ts`).
Check: warm-ups spread over skills; exponent rules gets level 2–3 items. `npm run analyze` no
longer counts a miss logged in-app under an older label as "persisting" (it came from a build
without the fix). Evidence moved: `add-for-quotient` 0 since its fix (item 4 less urgent), GRE
percents right in a median 83 s, down from 523 s (item 5 less urgent), runway 6.1 weeks.

### Done in review 5 (Oct 23, for context)

Inequality stories: level-1 story items were 22% solo (n 9) against 96% plain (n 23), and every
story miss at levels 1–2 was the reversed set: the right set at L1 flipped, the unflipped set at L2.
One error explains both: the limit written first ($41 > 4x + 17$), solved to $6 > x$, read as
$x > 6$. Stories now tag that option `read-backwards` (not `flip-positive`/`no-flip`) and add a
`check` step (is a value next to the boundary in the set?) before the answer; a Learn tip says to
finish with $x$ on the left. Check: `measure` §6, the inequality story-vs-plain gap at L1 shrinks.
Also seen, one-offs left alone: a hotel story answered with $x + 4$ (total ÷ nights, fee not removed),
two $f(-x)$ sign slips. The rating model now beats the constant once settled (0.1193 vs 0.1244);
runway 3.1 weeks.

### Done on Oct 23 (for context)

Home redesign and its adversarial review (§7 item 10); the working pad widened to 10 more skills
(§7 item 11). The GRE past-papers e2e (`e2e/challenge.spec.ts`) fails about 1 run in 8 on clean
`main` too (a wait for "Show answer"): a pre-existing flake, not yet looked into.

### Done in review 4 (for context)

Level hold (promote at P ≥ 0.75, hold while P ≥ 0.6); `coefficient-raised-to-inner`
misconception; GRE percent-change step split (simplify, then convert); interpretation answers
record the chosen option; review ledger and `npm run analyze`; generator harness in 4
parallel shards (12.5 → 5.4 min); `npm run test:quick`; `npm run verify:sympy:skills`.

