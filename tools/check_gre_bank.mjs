// Structural + parse check for the imported challenge bank. This intentionally does not run the
// full app test suite (vitest needs esbuild's child process, which some sandboxes block); it uses
// mathjs directly to make sure every stored answer is machine-readable.

import { readFileSync } from 'node:fs';
import { create, all } from 'mathjs';

const math = create(all, {});
const data = JSON.parse(readFileSync(new URL('../src/content/gre-bank.json', import.meta.url), 'utf8'));
const points = [0.37, 0.71, 1.13, 1.58, 2.21, 2.9];
const errors = [];
const ids = new Set();

for (const item of data.items) {
  if (ids.has(item.id)) errors.push(`${item.id}: duplicate id`);
  ids.add(item.id);
  if (!item.prompt?.trim()) errors.push(`${item.id}: empty prompt`);
  if (!item.explanation?.trim()) errors.push(`${item.id}: empty explanation`);
  const a = item.answer;
  try {
    if (a.kind === 'choice') {
      if (!a.options.some((o) => o.id === a.correct)) errors.push(`${item.id}: correct option missing`);
      for (const o of a.options) if (!o.label?.trim()) errors.push(`${item.id}: empty option`);
    } else if (a.kind === 'multi') {
      if (!a.correct.length) errors.push(`${item.id}: no correct options`);
      for (const id of a.correct) if (!a.options.some((o) => o.id === id)) errors.push(`${item.id}: missing ${id}`);
    } else if (a.kind === 'number') {
      const v = math.evaluate(a.value);
      if (!Number.isFinite(v)) errors.push(`${item.id}: number ${a.value} is not finite`);
    } else if (a.kind === 'expression') {
      const node = math.parse(a.value);
      for (let i = 0; i < points.length; i++) {
        const scope = {};
        a.variables.forEach((v, k) => (scope[v] = points[(i + k) % points.length]));
        const value = node.evaluate(scope);
        if (!Number.isFinite(value)) errors.push(`${item.id}: expression ${a.value} is not finite at sample ${i}`);
      }
    } else {
      errors.push(`${item.id}: unsupported kind ${a.kind}`);
    }
  } catch (e) {
    errors.push(`${item.id}: cannot parse ${JSON.stringify(a)} (${e.message})`);
  }
}

if (errors.length) {
  console.error(errors.slice(0, 30).join('\n'));
  console.error(`\n${errors.length} issue(s)`);
  process.exit(1);
}
console.log(`OK: ${data.items.length} items, all answers parse and all option keys resolve`);
