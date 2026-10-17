// Dump generated problems as {problem statement (verify spec), app's answer} for the
// independent SymPy cross-check. Usage: tsx verify/export-samples.ts [seedsPerLevel=200]

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeProblem, SKILLS } from '../src/engine/registry';
import { LEVELS, type AnswerSpec, type VerifySpec } from '../src/engine/types';

const perLevel = Number(process.argv[2] ?? 200);
const here = dirname(fileURLToPath(import.meta.url));

interface Check {
  where: string;
  verify: VerifySpec;
  values: string[];
}

const values = (a: AnswerSpec): string[] =>
  a.kind === 'tuple' ? a.values : a.kind === 'choice' || a.kind === 'multi' ? [] : [a.value];

const checks: Check[] = [];
for (const skill of SKILLS) {
  for (const level of LEVELS) {
    for (let i = 0; i < perLevel; i++) {
      const seed = 100_000 + i * 7919; // different seeds from the unit tests
      const p = makeProblem(skill, level, seed);
      if (p.verify.type !== 'choice' && p.verify.type !== 'qc') checks.push({ where: p.id, verify: p.verify, values: values(p.answer) });
      p.steps.forEach((s, k) => {
        if (s.ask?.verify) checks.push({ where: `${p.id} step ${k}`, verify: s.ask.verify, values: values(s.ask.answer) });
      });
    }
  }
}

const out = join(here, 'out', 'samples.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(checks));
console.log(`Exported ${checks.length} checks from ${SKILLS.length} skills to ${out}`);
