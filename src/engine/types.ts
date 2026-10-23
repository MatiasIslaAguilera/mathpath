// Core contracts every skill implements. See CLAUDE.md "Adding a skill".

export type Level = 1 | 2 | 3 | 4 | 5;
export const LEVELS: readonly Level[] = [1, 2, 3, 4, 5];

/** 'gre' is the GRE Quant track: its own tree, a daily slot in every session, not in placement. */
export type Track = 'math' | 'econ' | 'gre';

/**
 * Text that may contain inline math `$...$` and display math `$$...$$` (KaTeX).
 * Everything outside the delimiters is plain text.
 */
export type RichText = string;

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

export interface ChoiceOption {
  id: string;
  label: RichText;
}

/**
 * What a correct answer looks like. `value` strings are exact and parseable by both
 * mathjs and SymPy: integers, fractions "7/3", and expressions using + - * / ^ ( ),
 * sqrt(), log() (natural), exp(), with explicit `*`.
 */
export type AnswerSpec =
  | { kind: 'number'; value: string; display: string }
  | { kind: 'expression'; value: string; variables: string[]; display: string }
  | { kind: 'tuple'; labels: string[]; values: string[]; display: string }
  | { kind: 'choice'; options: ChoiceOption[]; correct: string }
  /** Select all that apply: correct only if exactly the `correct` set is chosen (GRE style). */
  | { kind: 'multi'; options: ChoiceOption[]; correct: string[] };

/** The learner's raw input, shaped to match an AnswerSpec. */
export type AnswerInput = string | string[];

// ---------------------------------------------------------------------------
// Verification: a machine-readable PROBLEM STATEMENT (never the answer). Used by the
// generator test harness (tests/verify-check.ts) and the SymPy cross-check
// (verify/sympy_check.py) to independently confirm an answer.
// ---------------------------------------------------------------------------

export type VerifySpec =
  /**
   * The answer's values, in `unknowns` order, satisfy every `lhs = rhs` equation. With
   * `positive`, the unknowns are positive (e.g. a quantity), which picks one root of a quadratic.
   */
  | { type: 'solve'; equations: string[]; unknowns: string[]; positive?: boolean }
  /** The answer (an expression) is d/d`variable` of `expr`. */
  | { type: 'diff'; expr: string; variable: string }
  /** The answer (an expression) is algebraically equivalent to `expr`. */
  | { type: 'equivalent'; expr: string; variables: string[] }
  /** The answer (a number) equals the value of `expr`. */
  | { type: 'evaluate'; expr: string }
  /**
   * The answer (a number) is the limit of `expr` as `variable` → `point`.
   * `point` is a number string, or 'oo' / '-oo' for ±infinity. Two-sided unless `side` is given.
   */
  | { type: 'limit'; expr: string; variable: string; point: string; side?: '+' | '-' }
  /**
   * Multiple-choice final answer (e.g. a domain). Can't be checked numerically: the skill MUST
   * have tests/skills/<skill-id>.test.ts that re-derives the correct option from the params.
   */
  | { type: 'choice'; note: string }
  /**
   * GRE quantitative comparison. The answer is a choice among QC_OPTIONS (engine/answers.ts).
   * The harness re-derives it independently by sampling the variables over their domain
   * (subject to `constraints`): always A > B → 'a', always B > A → 'b', always equal → 'c',
   * and any two samples that disagree prove 'd' (cannot be determined).
   * Expressions use mathjs syntax; constraints are mathjs boolean expressions like 'x > 0'.
   */
  | {
      type: 'qc';
      quantityA: string;
      quantityB: string;
      variables: { name: string; min: number; max: number; integer?: boolean }[];
      constraints: string[];
    }

// ---------------------------------------------------------------------------
// Problems and solution steps
// ---------------------------------------------------------------------------

export interface StepAsk {
  /** What guided mode asks the learner for at this step. */
  prompt: RichText;
  answer: AnswerSpec;
  /** Required for every non-choice ask: lets the harness check this step independently. */
  verify?: VerifySpec;
}

export interface Step {
  /** Stable id for this kind of step within the skill ("expand", "collect"), for mistake stats. */
  key: string;
  /** What to do, in plain words: "Set supply equal to demand". */
  instruction: RichText;
  /** The math for this step, display LaTeX (no $ delimiters). */
  math: string;
  /** One line: the rule or concept being used. */
  why: RichText;
  ask?: StepAsk;
}

/** A specific wrong answer this problem's numbers would produce under a known misconception. */
export interface MisconceptionInstance {
  id: string;
  wrong: AnswerSpec;
}

export interface InterpretationQuestion {
  prompt: RichText;
  options: ChoiceOption[];
  correct: string;
  /** Shown after answering, right or wrong. */
  explanation: RichText;
}

/**
 * A picture or table that goes with the prompt. SVG is generated by code (engine/figures.ts),
 * never from user input. Every figure needs an `alt` text description.
 */
export type Figure =
  | { kind: 'svg'; svg: string; alt: string }
  | { kind: 'table'; caption: string; headers: string[]; rows: string[][] };

export interface Problem {
  /** `${skillId}:${level}:${seed}`, plus `:s` for a story variant — enough to regenerate it. */
  id: string;
  /** 'story' when built by `SkillDefinition.story` (a word problem with a setup step). */
  variant?: 'story';
  skillId: string;
  level: Level;
  seed: number;
  /** Every random parameter, so the harness can check level ranges. */
  params: Record<string, number>;
  prompt: RichText;
  /** Optional diagram or data table shown with the prompt. */
  figure?: Figure;
  answer: AnswerSpec;
  steps: Step[];
  misconceptions: MisconceptionInstance[];
  interpretation?: InterpretationQuestion[];
  verify: VerifySpec;
  /**
   * For the working pad (engine/working.ts): every correct solution, as values of the variables
   * the learner writes in their working (e.g. both roots `{ x: '-9' }`, `{ x: '4' }`). Only needed
   * when it can't be read off a `solve` verify (whose unknowns may be `r1`, `r2`).
   */
  working?: { solutions: Record<string, string>[] };
}

// ---------------------------------------------------------------------------
// Skill definitions
// ---------------------------------------------------------------------------

export interface MisconceptionDef {
  /** Short name of the mistake: "Forgot the inner derivative". */
  name: string;
  /** Why it is wrong and what to do instead. */
  explanation: RichText;
}

export interface LevelSpec {
  description: string;
  /** Inclusive [min, max] for each entry in Problem.params. The harness enforces these. */
  ranges: Record<string, [number, number]>;
}

export interface LearnCard {
  /** "What it's for": why this skill matters, with one concrete (ideally economics) example. */
  whyItMatters: RichText;
  summary: RichText;
  formulas: { latex: string; note?: RichText }[];
  /** The worked example is generate(createRng(seed), level). It always matches the generator. */
  example: { seed: number; level: Level };
  tips?: RichText[];
}

export interface SkillDefinition {
  id: string;
  title: string;
  track: Track;
  /** Grouping on the skill tree, e.g. "Derivatives". */
  unit: string;
  description: string;
  /** Skill ids. Ids that are not registered yet are ignored when unlocking. */
  prerequisites: string[];
  levels: Record<Level, LevelSpec>;
  /** Largest denominator allowed in final numeric answers (1 = integers only). */
  maxDenominator: number;
  /**
   * Answers may be irrational (e.g. ln 5 / 2, continuous compounding). Values are still exact
   * expressions ("log(5)/2"); learners can type a decimal rounded to ≥ 2 places.
   */
  irrationalAnswers?: boolean;
  /**
   * Levels that offer the working pad: lines of working checked by substituting the solution
   * (engine/working.ts). Only for equation solving in the variables the learner writes.
   */
  workingPad?: Level[];
  misconceptions: Record<string, MisconceptionDef>;
  /** Readable name for every Step.key this skill uses (stats page, progress analysis). */
  stepLabels: Record<string, string>;
  learn: LearnCard;
  /** Pure: every random choice comes from `rng`. */
  generate(rng: import('./rng').Rng, level: Level): Omit<Problem, 'id' | 'skillId' | 'level' | 'seed'>;
  /**
   * Story (word-problem) variants: the same math told as a situation, with a first step that asks
   * the learner to set it up (write the expression or equation). Built from the same param names
   * and level ranges, so every harness and SymPy check applies; served for about half of the
   * non-warm-up items at these levels (session.ts). Problem id: `skill:level:seed:s`.
   */
  story?: {
    levels: Level[];
    generate(rng: import('./rng').Rng, level: Level): Omit<Problem, 'id' | 'skillId' | 'level' | 'seed'>;
  };
  /**
   * Optional custom checker. Default: engine/checker.ts by AnswerSpec kind.
   * Use it only when the default is too strict or too loose for this skill (a required form,
   * or an answer computed from rounded constants given in the prompt). Start from
   * checkAnswer(problem.answer, input) and keep its `error` so unreadable input isn't graded.
   */
  check?(problem: Problem, input: AnswerInput): import('./checker').CheckResult;
}
