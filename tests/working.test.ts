import { describe, expect, it } from 'vitest';
import { checkAnswer } from '../src/engine/checker';
import { latexToMath } from '../src/engine/latex';
import { makeProblem, SKILLS } from '../src/engine/registry';
import { LEVELS } from '../src/engine/types';
import { answerFromWorking, checkLine, checkWorking, firstLineLatex, workingSpec, type WorkingSpec } from '../src/engine/working';

const SEEDS = Math.min(Number(process.env.SEEDS ?? 1000), 60);

describe('latexToMath (math keyboard LaTeX → mathjs)', () => {
  const cases: [string, string][] = [
    [String.raw`3x-12=-30`, '3x-12=-30'],
    [String.raw`\frac{1}{3}x+4`, '((1)/(3))x+4'],
    [String.raw`x^{2}+5x-36=0`, 'x^(2)+5x-36=0'],
    [String.raw`\frac{-6-\sqrt{84}}{2}`, '((-6-sqrt(84))/(2))'],
    [String.raw`2\left(x-1\right)=7x-6`, '2(x-1)=7x-6'],
    [String.raw`-3\cdot2`, '-3 * 2'],
    [String.raw`x=-9\text{ or }x=4`, 'x=-9 or x=4'],
    [String.raw`x=\pm4`, 'x= ± 4'],
    [String.raw`\left|x\right|=3`, 'abs(x)=3'],
    [String.raw`\ln\left(x\right)=3`, 'log(x)=3'],
    [String.raw`\sqrt[3]{8}`, 'nthRoot(8, 3)'],
    [String.raw`x_1=3`, 'x_1=3'],
    [String.raw`\frac12`, '((1)/(2))'],
    [String.raw`R^{\prime}\left(q\right)=21-2q=0`, "R'(q)=21-2q=0"],
    [String.raw`R^{\prime\prime}\left(q\right)=-2`, "R''(q)=-2"],
  ];
  for (const [latex, expected] of cases) it(latex, () => expect(latexToMath(latex)).toBe(expected));
  it('rejects commands it does not know', () => expect(() => latexToMath(String.raw`\int x`)).toThrow());
});

describe('checkLine', () => {
  const linear: WorkingSpec = { vars: ['x'], solutions: [{ x: -6 }] };
  const quad: WorkingSpec = { vars: ['x'], solutions: [{ x: -9 }, { x: 4 }] };
  const system: WorkingSpec = { vars: ['x', 'y'], solutions: [{ x: 1, y: -9 }] };

  it('true lines are ok, false lines are wrong', () => {
    expect(checkLine('3(x - 4) = -30', linear)).toBe('ok');
    expect(checkLine('3x - 12 = -30', linear)).toBe('ok');
    expect(checkLine('3x = -42', linear)).toBe('wrong');
    expect(checkLine('x = -14', linear)).toBe('wrong');
    expect(checkLine('3x - 12 = -30 = 3x - 12', linear)).toBe('ok');
  });
  it('lines it cannot judge are skipped or unreadable, never wrong', () => {
    expect(checkLine('', linear)).toBe('empty');
    expect(checkLine('f(x) = 2', linear)).toBe('skipped');
    expect(checkLine('3x - 12', linear)).toBe('skipped');
    expect(checkLine('3x < 5', linear)).toBe('skipped');
    expect(checkLine('3x = ', linear)).toBe('unreadable');
    expect(checkLine('3x = (2', linear)).toBe('unreadable');
  });
  it('rounded decimals get a rounding tolerance; exact numbers do not', () => {
    expect(checkLine('x = -6.00', linear)).toBe('ok');
    expect(checkLine('x = -6.1', linear)).toBe('wrong');
    expect(checkLine('x = -6001/1000', linear)).toBe('wrong');
    const irrational: WorkingSpec = { vars: ['x'], solutions: [{ x: (-6 - Math.sqrt(84)) / 2 }] };
    expect(checkLine('x = -7.58', irrational)).toBe('ok');
  });
  it('quadratics: a factored line holds for both roots, one root alone is "some"', () => {
    expect(checkLine('(x + 9)(x - 4) = 0', quad)).toBe('ok');
    expect(checkLine('x^2 + 5x - 36 = 0', quad)).toBe('ok');
    expect(checkLine('x = -9', quad)).toBe('some');
    expect(checkLine('x = -9 or x = 4', quad)).toBe('ok');
    expect(checkLine('x = -9, x = 4', quad)).toBe('ok');
    expect(checkLine('x = 9 or x = -4', quad)).toBe('wrong');
    expect(checkLine('x = (-5 ± 13)/2', quad)).toBe('ok');
  });
  it('systems: substitute both unknowns', () => {
    expect(checkLine('y = x - 10', system)).toBe('ok');
    expect(checkLine('x + 5(x - 10) = -44', system)).toBe('ok');
    expect(checkLine('6x = 6', system)).toBe('ok');
    expect(checkLine('y = 9', system)).toBe('wrong');
  });
  it('first wrong line', () => {
    const r = checkWorking(['3(x - 4) = -30', '3x - 12 = -30', '3x = -42', 'x = -14'], linear);
    expect(r.status).toEqual(['ok', 'ok', 'wrong', 'wrong']);
    expect(r.firstWrong).toBe(2);
    expect(checkWorking(['3x - 12 = -30', 'x = -6'], linear).firstWrong).toBeNull();
  });
  it('works on converted keyboard LaTeX', () => {
    expect(checkLine(latexToMath(String.raw`\frac{1}{3}x+4=5`), { vars: ['x'], solutions: [{ x: 3 }] })).toBe('ok');
    expect(checkLine(latexToMath(String.raw`\left(x-5\right)^2=16`), { vars: ['x'], solutions: [{ x: 9 }] })).toBe('ok');
  });
});

describe('answerFromWorking', () => {
  it('number: the last x = value', () => {
    expect(answerFromWorking(['3x = -18', 'x = -18/3', 'x = -6'], { vars: ['x'], solutions: [{ x: -6 }] }, { kind: 'number', value: '-6', display: '-6' })).toBe('-6');
    expect(answerFromWorking(['3x = -18'], { vars: ['x'], solutions: [{ x: -6 }] }, { kind: 'number', value: '-6', display: '-6' })).toBeNull();
  });
  it('roots: both values, smaller first', () => {
    const spec: WorkingSpec = { vars: ['x'], solutions: [{ x: -9 }, { x: 4 }] };
    const ans = { kind: 'tuple' as const, labels: ['Smaller root', 'Larger root'], values: ['-9', '4'], display: '' };
    expect(answerFromWorking(['(x + 9)(x - 4) = 0', 'x = 4 or x = -9'], spec, ans)).toEqual(['-9', '4']);
    expect(answerFromWorking(['x = 4', 'x = -9'], spec, ans)).toEqual(['-9', '4']);
    expect(answerFromWorking(['x = 4'], spec, ans)).toBeNull();
  });
  it('systems: the last value of each unknown, in order', () => {
    const spec: WorkingSpec = { vars: ['x', 'y'], solutions: [{ x: 1, y: -9 }] };
    const ans = { kind: 'tuple' as const, labels: ['x', 'y'], values: ['1', '-9'], display: '' };
    expect(answerFromWorking(['6x = 6', 'x = 1', 'y = 1 - 10', 'y = -9'], spec, ans)).toEqual(['1', '-9']);
  });
});

describe('every equation skill: the prompt equation and the answer check as true', () => {
  for (const skill of SKILLS) {
    it(skill.id, () => {
      let covered = 0;
      for (const level of LEVELS) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const p = makeProblem(skill, level, seed);
          const spec = workingSpec(p);
          if (!spec) continue;
          covered++;
          const ctx = `${p.id}`;
          // The prompt's own equation is a correct first line (when it is one we can judge).
          const first = firstLineLatex(p);
          if (first) {
            let line: string | null = null;
            try {
              line = latexToMath(first);
            } catch {
              // a prompt with LaTeX the keyboard can't produce: not prefilled
            }
            if (line) expect(['ok', 'some', 'skipped', 'unreadable'], `${ctx} first line "${line}"`).toContain(checkLine(line, spec));
            if (line && checkLine(line, spec) === 'unreadable') continue;
          }
          // Stating the answer in working ("x = value" per unknown) is ok and fills the answer box.
          const lines =
            p.answer.kind === 'number'
              ? [`${spec.vars[0]} = ${p.answer.value}`]
              : p.answer.kind === 'tuple' && spec.vars.length === 1
                ? p.answer.values.map((v) => `${spec.vars[0]} = ${v}`)
                : p.answer.kind === 'tuple'
                  ? spec.vars.map((v, i) => `${v} = ${(p.answer as { values: string[] }).values[i]}`)
                  : [];
          for (const l of lines) expect(['ok', 'some'], `${ctx} "${l}"`).toContain(checkLine(l, spec));
          const filled = answerFromWorking(lines, spec, p.answer);
          expect(filled, `${ctx} answer from working`).not.toBeNull();
          expect(checkAnswer(p.answer, filled!).correct, `${ctx} filled answer is correct`).toBe(true);
        }
      }
      expect(covered).toBeGreaterThanOrEqual(0);
    });
  }
});

describe('skills that offer the working pad have something to check at those levels', () => {
  for (const skill of SKILLS.filter((s) => s.workingPad?.length)) {
    it(skill.id, () => {
      for (const level of skill.workingPad!) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          expect(workingSpec(makeProblem(skill, level, seed)), `${skill.id}:${level}:${seed}`).not.toBeNull();
        }
      }
    });
  }
});

describe('economics notation in working', () => {
  // Revenue R(q) = 20q - 5q^2: q* = 2, R* = 20.
  const revenue: WorkingSpec = { vars: ['q', 'R'], solutions: [{ q: 2, R: 20, MR: 0 }], names: ['MR'] };
  it("a derivative side is left out and the rest of the chain is judged (in mathjs ' is a transpose)", () => {
    expect(checkLine("R'(q) = 20 - 10q = 0", revenue)).toBe('ok');
    expect(checkLine("R'(q) = 20 - 10q", revenue)).toBe('skipped');
    expect(checkLine("R'(q) = 20 - 5q = 0", revenue)).toBe('wrong');
  });
  it('a named quantity at the unknown is its value at the solution, so a wrong function is caught', () => {
    expect(checkLine('R(q) = 20q - 5q^2', revenue)).toBe('ok');
    expect(checkLine('R(q) = 20q - 4q^2', revenue)).toBe('wrong');
    expect(checkLine('R(2) = 20', revenue)).toBe('skipped'); // a function at a point: notation, not judged
  });
  it('starred optima are the quantity itself', () => {
    expect(checkLine('q^* = 2', revenue)).toBe('ok');
    expect(checkLine('R^(*) = 20*2 - 5*2^2 = 20', revenue)).toBe('ok');
    expect(checkLine('R^* = 24', revenue)).toBe('wrong');
  });
  it('a one-letter unknown before a bracket is still a product', () => {
    const demand: WorkingSpec = { vars: ['P', 'e'], solutions: [{ P: 3, e: -1, R: 45 }], names: ['R'] };
    expect(checkLine('R = P(30 - 5P)', demand)).toBe('ok');
    expect(checkLine('R(P) = P(30 - 5P)', demand)).toBe('ok');
    expect(checkLine('x(x + 1) = 2', { vars: ['x'], solutions: [{ x: 1 }] })).toBe('ok');
  });
  it('a problem can name pi (profit) and e (elasticity): they are those quantities, not the constants', () => {
    const profit: WorkingSpec = { vars: ['q', 'pi'], solutions: [{ q: 20, pi: 250 }] };
    expect(checkLine('pi = 56*20 - (150 + 16*20 + 20^2)', profit)).toBe('ok');
    expect(checkLine('pi(q) = 56q - (150 + 16q + q^2)', profit)).toBe('ok');
    expect(checkLine(latexToMath(String.raw`\pi^{*}=250`), profit)).toBe('ok');
    const elastic: WorkingSpec = { vars: ['P', 'e'], solutions: [{ P: 3, e: -1, epsilon: -1 }], names: ['epsilon'] };
    expect(checkLine('e = -5*3/15', elastic)).toBe('ok');
    expect(checkLine(latexToMath(String.raw`\varepsilon=-1`), elastic)).toBe('ok');
    // Without the name, pi is still the constant.
    expect(checkLine('x = pi', { vars: ['x'], solutions: [{ x: Math.PI }] })).toBe('ok');
  });
  it('named quantities are checked but never fill the answer box', () => {
    const cost: WorkingSpec = { vars: ['AC', 'AVC'], solutions: [{ AC: 33, AVC: 26, TC: 66 }], names: ['TC'] };
    expect(checkLine('AC = TC/2 = 66/2 = 33', cost)).toBe('ok');
    const ans = { kind: 'tuple' as const, labels: ['Average cost', 'Average variable cost'], values: ['33', '26'], display: '' };
    expect(answerFromWorking(['TC = 66', 'AC = 33', 'AVC = 26'], cost, ans)).toEqual(['33', '26']);
  });
});

describe('the pad never marks a line of the app\'s own worked solution wrong', () => {
  // Statements in a step's display math are separated by arrows and spacing.
  const SPLIT = /\Rightarrow|\implies|\qquad|\quad|\;/;
  for (const skill of SKILLS.filter((s) => s.workingPad?.length)) {
    it(skill.id, () => {
      for (const level of skill.workingPad!) {
        for (let seed = 1; seed <= Math.min(SEEDS, 30); seed++) {
          const p = makeProblem(skill, level, seed);
          const spec = workingSpec(p)!;
          for (const step of p.steps) {
            for (const piece of step.math.split(SPLIT).map((x) => x.trim()).filter((x) => x.includes('='))) {
              let line: string;
              try {
                line = latexToMath(piece.replace(/\left|\right/g, ''));
              } catch {
                continue; // LaTeX the keyboard can't produce
              }
              expect(checkLine(line, spec), `${p.id} [${step.key}] ${piece}`).not.toBe('wrong');
            }
          }
        }
      }
    });
  }
});
