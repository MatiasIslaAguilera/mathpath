# Question-bank content

The app has two content paths:

1. **Adaptive skills** (`src/skills/`): procedural generators, independently verified by
   `tests/generators.test.ts` and SymPy. This is still the main curriculum.
2. **Static challenge deck** (`src/content/` + `Challenge.tsx`): bank questions imported as-is.
   These are extra practice, not part of the Elo/FSRS mastery rating.

## Integrated bank

| Bank | Items | Source | Imported file |
|---|---|---|---|
| GRE Quant bank | 200 | [lbcty56/GRE-Quiz-App-Python-](https://github.com/lbcty56/GRE-Quiz-App-Python-) | `src/content/gre-bank.json` |

The bank has 89 single-answer, 58 numeric-entry, 46 quantitative-comparison, and 7
multiple-answer questions, split evenly across Simple/Middle/Hard/Challenging.

### Refresh it

```bash
npm run import:gre-bank   # python tools/import_gre_bank.py
```

The importer:

- reads `gre_quant_bank` from the upstream Python module;
- strips `(A) … (E)` option lines from the prompt and turns them into `AnswerSpec` options;
- maps the four GRE formats to `choice`, `multi`, and `number`/`expression`;
- normalizes `π`, `√`, fractions, and “in terms of S” answers;
- writes `src/content/gre-bank.json` (committed, so the app stays offline).

Run `npm test` afterwards; `tests/challenge.test.ts` checks ids, source metadata, option/key
consistency, and that the app's checker accepts every stored answer.

## Why the deck is separate

The `Problem` contract requires `params`, `verify`, `steps`, `misconceptions`, and a
`SkillDefinition` requires levels/ranges and a Learn card. A bank item has none of those, and
its answer key is not independently re-derived. Treating it as a skill would:

- pollute the Elo rating with repeated static items;
- break `problemFromId` / the generator harness;
- claim a level of verification the bank does not have.

The Challenge screen therefore keeps its own `mathpath.challenge.v1` history in localStorage.

## Quality caveats

The bank is third-party content and is imported **as-is**. The importer validates structure, not
mathematical truth. A wrong key in the source will be shown as the correct answer. Before using a
new bank for high-stakes study, spot-check a sample of each topic and difficulty, and prefer banks
whose explanations actually compute the answer rather than only restating it.

This repository is private for now, but keep the source fields intact. If it is ever published,
the source repository has no LICENSE file, so the deck should be removed or replaced with a
permissively licensed bank.

## Adding another bank

1. Put an importer in `tools/` that writes `src/content/<bank>.json` in the same shape:
   `{ bank, url, count, items: ChallengeItem[] }`.
2. Add a loader beside `greBank.ts` and export it from `src/content/index.ts`.
3. Add it to `CHALLENGE_DECKS` if the screen should list multiple decks.
4. Extend `tests/challenge.test.ts` to cover the new deck.
5. For PDFs/past papers, OCR/convert first; do not ship raw PDFs. Store only text/LaTeX and,
   where needed, a `Figure` built by `src/engine/figures.ts`.

## Template mining

The same bank is a source of **question archetypes**. `docs/skill-specs/bank-archetypes.md`
maps the bank's recurring patterns to existing generators and to candidate new skills. The rule
is: use the bank to design parameterized generators; do not paste static items into the skill
tree.
