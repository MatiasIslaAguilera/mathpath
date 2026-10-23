// Dump generated problems as {problem statement (verify spec), app's answer} for the
// independent SymPy cross-check. Usage: tsx verify/export-samples.ts [seedsPerLevel=200] [--skills id1,id2]
// --skills limits the export to skills whose generators changed (npm run verify:sympy:skills -- id1,id2).
// Run the full check when shared engine code changes.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeProblem, SKILLS } from '../src/engine/registry';
import { LEVELS, type AnswerSpec, type VerifySpec } from '../src/engine/types';

const args = process.argv.slice(2);
const skillsIdx = args.indexOf('--skills');
const only = skillsIdx >= 0 ? args[skillsIdx + 1]?.split(',').filter(Boolean) : undefined;
const perLevel = Number(args.find((a, i) => /^\d+$/.test(a) && i !== skillsIdx + 1) ?? 200);
const unknown = only?.filter((id) => !SKILLS.some((s) => s.id === id)) ?? [];
if (unknown.length) {
  console.error(`Unknown skill id(s): ${unknown.join(', ')}`);
  process.exit(1);
}
const selected = only ? SKILLS.filter((s) => only.includes(s.id)) : SKILLS;
const here = dirname(fileURLToPath(import.meta.url));

interface Check {
  where: string;
  verify: VerifySpec;
  values: string[];
}

const values = (a: AnswerSpec): string[] =>
  a.kind === 'tuple' ? a.values : a.kind === 'choice' || a.kind === 'multi' ? [] : [a.value];

const checks: Check[] = [];
for (const skill of selected) {
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
console.log(`Exported ${checks.length} checks from ${selected.length} skills to ${out}`);
