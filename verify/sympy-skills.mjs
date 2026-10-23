// npm run verify:sympy:skills -- id1,id2 : export and SymPy-check only these skills (200 seeds/level).
import { execSync } from 'node:child_process';

const ids = process.argv[2];
if (!ids) {
  console.error('Usage: npm run verify:sympy:skills -- skill-id[,skill-id...]');
  process.exit(1);
}
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
run(`npx tsx verify/export-samples.ts --skills ${ids}`);
run('python -I verify/sympy_check.py verify/out/samples.json');
