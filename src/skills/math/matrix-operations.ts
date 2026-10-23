// Matrix operations (math). L1 entrywise A+B, A-B, kA (2x2 tuple), L2 one entry of a product,
// L3 the full 2x2 product, L4 the size of a product (choice), L5 a cost story (matrix times a
// 3-vector, 3-entry tuple, with an interpretation question). Matrices are shown as bmatrix.

import { numberAnswer, tupleAnswer } from "../../engine/answers";
import { distinctMisconceptions } from "../../engine/misconceptions";
import type { Rng } from "../../engine/rng";
import type {
  AnswerSpec,
  ChoiceOption,
  InterpretationQuestion,
  MisconceptionInstance,
  SkillDefinition,
  Step,
  VerifySpec,
} from "../../engine/types";

const ID = "matrix-operations";
type Body = ReturnType<SkillDefinition["generate"]>;
type M = number[][];

/** A number inside a mathjs / SymPy expression: negatives in parentheses. */
const e = (v: number) => (v < 0 ? `(${v})` : `${v}`);
/** Same for LaTeX products (negatives in parentheses). */
const pl = e;
const bm = (rows: M) =>
  `\\begin{bmatrix} ${rows.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{bmatrix}`;
const col = (v: number[]) => bm(v.map((x) => [x]));

const LABELS4 = [
  "Row 1, col 1",
  "Row 1, col 2",
  "Row 2, col 1",
  "Row 2, col 2",
];
const DISPLAY4 = ["r_{1,1}", "r_{1,2}", "r_{2,1}", "r_{2,2}"];
const UNK4 = ["p11", "p12", "p21", "p22"];
const flat = (m: M) => [m[0][0], m[0][1], m[1][0], m[1][1]];
const tuple4 = (v: number[]) => tupleAnswer(LABELS4, v, DISPLAY4);

const mul = (A: M, B: M): M =>
  A.map((row) =>
    B[0].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)),
  );
const dotExpr = (xs: number[], ys: number[]) =>
  xs.map((x, k) => `${e(x)}*${e(ys[k])}`).join(" + ");
const dotLatex = (xs: number[], ys: number[]) =>
  xs.map((x, k) => `${pl(x)}\\cdot ${pl(ys[k])}`).join(" + ");
const colOf = (B: M, j: number) => B.map((r) => r[j]);

/** One verify for a 2x2 result: one equation per entry, written from the definition. */
function verify4(exprs: string[]): VerifySpec {
  return {
    type: "solve",
    equations: exprs.map((x, i) => `${UNK4[i]} = ${x}`),
    unknowns: UNK4,
  };
}

// ---------------------------------------------------------------------------
// Level 1: A + B, A - B, kA
// ---------------------------------------------------------------------------

function level1(rng: Rng): Body {
  const form = rng.int(0, 2);
  const A: M = [
    [rng.nonzero(-9, 9), rng.nonzero(-9, 9)],
    [rng.nonzero(-9, 9), rng.nonzero(-9, 9)],
  ];
  const B: M = [
    [rng.nonzero(-9, 9), rng.nonzero(-9, 9)],
    [rng.nonzero(-9, 9), rng.nonzero(-9, 9)],
  ];
  let k = 0;
  if (form === 2) {
    do k = rng.nonzero(-5, 5);
    while (k === 1);
    for (const r of B) r.fill(0);
  }
  const a = flat(A);
  const b = flat(B);
  const ent = (i: number) =>
    form === 0 ? a[i] + b[i] : form === 1 ? a[i] - b[i] : k * a[i];
  const result = [0, 1, 2, 3].map(ent);
  const exprs = [0, 1, 2, 3].map((i) =>
    form === 0
      ? `${e(a[i])} + ${e(b[i])}`
      : form === 1
        ? `${e(a[i])} - ${e(b[i])}`
        : `${e(k)}*${e(a[i])}`,
  );
  const answer = tuple4(result);
  const verify = verify4(exprs);
  const prompt =
    form === 2
      ? `Let $$A = ${bm(A)}.$$ Compute $${k}A$. Give the four entries of the result, row by row.`
      : `Let $$A = ${bm(A)}, \\qquad B = ${bm(B)}.$$ Compute $A ${form === 0 ? "+" : "-"} B$. Give the four entries of the result, row by row.`;
  const op = form === 0 ? "+" : "-";
  const steps: Step[] = [
    {
      key: "entrywise",
      instruction:
        form === 2
          ? `Multiply every entry of $A$ by $${k}$. Start with row 1, column 1.`
          : "Combine the entries in matching positions. Start with row 1, column 1.",
      math:
        form === 2
          ? `${k}\\cdot ${pl(a[0])} = ${result[0]}`
          : `${pl(a[0])} ${op} ${pl(b[0])} = ${result[0]}`,
      why:
        form === 2
          ? "A number times a matrix multiplies every entry, in both rows."
          : "Matrices of the same size are added or subtracted entry by entry: row 1, column 1 with row 1, column 1, and so on.",
      ask: {
        prompt: "What is the entry in row 1, column 1 of the result?",
        answer: numberAnswer(result[0]),
        verify: {
          type: "solve",
          equations: [`p11 = ${exprs[0]}`],
          unknowns: ["p11"],
        },
      },
    },
    {
      key: "assemble",
      instruction:
        "Do the same for the other three positions and fill in every entry.",
      math: bm([
        [result[0], result[1]],
        [result[2], result[3]],
      ]),
      why: "Each position is computed on its own from the entries in that position.",
      ask: { prompt: "Give all four entries of the result.", answer, verify },
    },
  ];
  const cand: (MisconceptionInstance | null)[] = [
    form === 1
      ? {
          id: "reversed-subtraction",
          wrong: tuple4([0, 1, 2, 3].map((i) => b[i] - a[i])),
        }
      : null,
    form === 2
      ? {
          id: "scalar-first-row",
          wrong: tuple4([k * a[0], k * a[1], a[2], a[3]]),
        }
      : null,
  ];
  return {
    params: {
      form,
      k,
      a11: a[0],
      a12: a[1],
      a21: a[2],
      a22: a[3],
      b11: b[0],
      b12: b[1],
      b21: b[2],
      b22: b[3],
    },
    prompt,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, cand),
    verify,
  };
}

// ---------------------------------------------------------------------------
// Level 2: one entry of AB
// ---------------------------------------------------------------------------

function level2(rng: Rng): Body {
  const form = rng.int(0, 1); // 0: A is 2x3, B is 3x2; 1: both 2x2
  const inner = form === 0 ? 3 : 2;
  const A: M = [0, 1].map(() => [
    rng.nonzero(-9, 9),
    rng.nonzero(-9, 9),
    form === 0 ? rng.nonzero(-9, 9) : 0,
  ]);
  const B: M = [0, 1, 2].map((r) => [
    r < inner ? rng.nonzero(-9, 9) : 0,
    r < inner ? rng.nonzero(-9, 9) : 0,
  ]);
  const i = rng.int(1, 2);
  const j = rng.int(1, 2);
  const row = A[i - 1].slice(0, inner);
  const cl = colOf(B, j - 1).slice(0, inner);
  const value = row.reduce((s, x, k) => s + x * cl[k], 0);
  const answer = numberAnswer(value);
  const expr = dotExpr(row, cl);
  const verify: VerifySpec = {
    type: "solve",
    equations: [`p = ${expr}`],
    unknowns: ["p"],
  };
  const Ashow = A.map((r) => r.slice(0, inner));
  const Bshow = B.slice(0, inner);
  const prompt = `Let $$A = ${bm(Ashow)}, \\qquad B = ${bm(Bshow)}.$$ What is the entry in row ${i}, column ${j} of $AB$?`;
  const prods = row.map((x, k) => x * cl[k]);
  const steps: Step[] = [
    {
      key: "row-col",
      instruction: `Take row ${i} of $A$ and column ${j} of $B$. Multiply them in pairs.`,
      math: `${row.map((x, k) => `${pl(x)}\\cdot ${pl(cl[k])} = ${prods[k]}`).join(",\\; ")}`,
      why: "Entry (i, j) of a product is row i of the left matrix times column j of the right matrix: pair the first entries, the second entries, and so on.",
      ask: {
        prompt: `What is the first product, $${pl(row[0])}\\cdot ${pl(cl[0])}$?`,
        answer: numberAnswer(prods[0]),
        verify: {
          type: "solve",
          equations: [`p = ${e(row[0])}*${e(cl[0])}`],
          unknowns: ["p"],
        },
      },
    },
    {
      key: "add-products",
      instruction: "Add the products.",
      math: `(AB)_{${i}${j}} = ${prods.map(pl).join(" + ")} = ${value}`,
      why: "The entry is the sum of all the pairwise products, not a single one of them.",
      ask: {
        prompt: `What is the entry in row ${i}, column ${j} of $AB$?`,
        answer,
        verify,
      },
    },
  ];
  // (BA)_ij: row i of B times column j of A (the two shared entries)
  const rowB = B[i - 1].slice(0, 2);
  const colA = [A[0][j - 1], A[1][j - 1]];
  const cand: (MisconceptionInstance | null)[] = [
    form === 1
      ? {
          id: "entrywise-product",
          wrong: numberAnswer(A[i - 1][j - 1] * B[i - 1][j - 1]),
        }
      : null,
    {
      id: "wrong-order",
      wrong: numberAnswer(rowB.reduce((s, x, k) => s + x * colA[k], 0)),
    },
  ];
  return {
    params: {
      form,
      i,
      j,
      a11: A[0][0],
      a12: A[0][1],
      a13: A[0][2],
      a21: A[1][0],
      a22: A[1][1],
      a23: A[1][2],
      b11: B[0][0],
      b12: B[0][1],
      b21: B[1][0],
      b22: B[1][1],
      b31: B[2][0],
      b32: B[2][1],
    },
    prompt,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, cand),
    verify,
  };
}

// ---------------------------------------------------------------------------
// Level 3: the full 2x2 product
// ---------------------------------------------------------------------------

function level3(rng: Rng): Body {
  const A: M = [
    [rng.nonzero(-9, 9), rng.nonzero(-9, 9)],
    [rng.nonzero(-9, 9), rng.nonzero(-9, 9)],
  ];
  const B: M = [
    [rng.nonzero(-9, 9), rng.nonzero(-9, 9)],
    [rng.nonzero(-9, 9), rng.nonzero(-9, 9)],
  ];
  const P = mul(A, B);
  const result = flat(P);
  const answer = tuple4(result);
  const exprs = [0, 1, 2, 3].map((n) =>
    dotExpr(A[Math.floor(n / 2)], colOf(B, n % 2)),
  );
  const verify = verify4(exprs);
  const a = flat(A);
  const b = flat(B);
  const steps: Step[] = [
    {
      key: "row-col",
      instruction:
        "Row 1 of $A$ times column 1 of $B$ gives the row 1, column 1 entry. Compute it first.",
      math: `${dotLatex(A[0], colOf(B, 0))} = ${result[0]}`,
      why: "Every entry of $AB$ is a row of $A$ times a column of $B$. The row picks the row of the result, the column picks the column.",
      ask: {
        prompt: "What is the entry in row 1, column 1 of $AB$?",
        answer: numberAnswer(result[0]),
        verify: {
          type: "solve",
          equations: [`p = ${exprs[0]}`],
          unknowns: ["p"],
        },
      },
    },
    {
      key: "assemble",
      instruction:
        "Repeat for the other three positions and fill in every entry.",
      math: `AB = ${bm(P)}`,
      why: "Four entries, four row-by-column sums. Check one against the definition before you answer.",
      ask: {
        prompt: "Give all four entries of $AB$, row by row.",
        answer,
        verify,
      },
    },
  ];
  const BA = mul(B, A);
  const cand: (MisconceptionInstance | null)[] = [
    {
      id: "entrywise-product",
      wrong: tuple4([a[0] * b[0], a[1] * b[1], a[2] * b[2], a[3] * b[3]]),
    },
    { id: "wrong-order", wrong: tuple4(flat(BA)) },
  ];
  return {
    params: {
      a11: a[0],
      a12: a[1],
      a21: a[2],
      a22: a[3],
      b11: b[0],
      b12: b[1],
      b21: b[2],
      b22: b[3],
    },
    prompt: `Let $$A = ${bm(A)}, \\qquad B = ${bm(B)}.$$ Compute $AB$. Give the four entries of the result, row by row.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, cand),
    verify,
  };
}

// ---------------------------------------------------------------------------
// Level 4: size of a product (choice)
// ---------------------------------------------------------------------------

const size = (r: number, c: number) => `$${r} \\times ${c}$`;
const UNDEF = "Not defined";

function level4(rng: Rng): Body {
  for (;;) {
    const defined = rng.chance(2 / 3);
    const m = rng.int(1, 5);
    const n = rng.int(1, 5);
    const q = rng.int(1, 5);
    let p = n;
    if (!defined) {
      do p = rng.int(1, 5);
      while (p === n);
    }
    const ok = n === p;
    const correct = ok ? size(m, q) : UNDEF;
    const named: { id: string; label: string | null }[] = [
      { id: "inner-as-size", label: size(n, p) },
      { id: "defined-anyway", label: ok ? null : size(m, q) },
    ];
    const fillers = [size(q, m), UNDEF, size(m, p), size(n, q), size(m, n)];
    const chosen: { label: string; id?: string }[] = [{ label: correct }];
    const has = (l: string) => chosen.some((c) => c.label === l);
    for (const nm of named)
      if (nm.label && !has(nm.label) && chosen.length < 4)
        chosen.push({ label: nm.label, id: nm.id });
    for (const f of fillers)
      if (chosen.length < 4 && !has(f)) chosen.push({ label: f });
    if (chosen.length < 4) continue;
    const order = rng.shuffle(chosen);
    const options: ChoiceOption[] = order.map((c, idx) => ({
      id: `o${idx}`,
      label: c.label,
    }));
    const idOf = (label: string) =>
      options[order.findIndex((c) => c.label === label)].id;
    const answer: AnswerSpec = {
      kind: "choice",
      options,
      correct: idOf(correct),
    };
    const mis: MisconceptionInstance[] = chosen
      .filter((c) => c.id)
      .map((c) => ({
        id: c.id!,
        wrong: { kind: "choice", options, correct: idOf(c.label) },
      }));
    const steps: Step[] = [
      {
        key: "inner-dims",
        instruction: `Compare the inner dimensions: the columns of $A$ ($${n}$) and the rows of $B$ ($${p}$).`,
        math: `A: ${m} \\times \\mathbf{${n}} \\quad B: \\mathbf{${p}} \\times ${q}`,
        why: "Row times column needs the same number of entries on both sides, so the number of columns of $A$ must equal the number of rows of $B$.",
        ask: {
          prompt: `Do the inner numbers, $${n}$ and $${p}$, match?`,
          answer: {
            kind: "choice",
            options: [
              { id: "yes", label: "Yes, they match" },
              { id: "no", label: "No, they differ" },
            ],
            correct: ok ? "yes" : "no",
          },
        },
      },
      {
        key: "outer-dims",
        instruction: ok
          ? `They match, so $AB$ exists. Its size is the outer numbers: $${m} \\times ${q}$.`
          : "They differ, so $AB$ is not defined.",
        math: ok
          ? `(${m} \\times ${n})(${p} \\times ${q}) \\to ${m} \\times ${q}`
          : `${n} \\ne ${p} \\Rightarrow AB \\text{ is not defined}`,
        why: "When the inner numbers match, the product has as many rows as $A$ and as many columns as $B$.",
        ask: { prompt: "What is the size of $AB$?", answer },
      },
    ];
    return {
      params: { m, n, p, q },
      prompt: `$A$ is a $${m} \\times ${n}$ matrix and $B$ is a $${p} \\times ${q}$ matrix. What is the size of $AB$ (rows $\\times$ columns)?`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, mis),
      verify: {
        type: "choice",
        note: "AB exists only when the columns of A equal the rows of B; then it is (rows of A) x (columns of B).",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Level 5: cost story, matrix times a 3-vector
// ---------------------------------------------------------------------------

interface Ctx {
  products: string[];
  inputs: string[];
  units: string[];
  firm: string;
}
const CTX: Ctx[] = [
  {
    products: ["Chairs", "Tables", "Desks"],
    inputs: ["Wood", "Labor", "Paint"],
    units: ["board feet", "hours", "litres"],
    firm: "A furniture shop",
  },
  {
    products: ["Bread", "Cakes", "Pies"],
    inputs: ["Flour", "Sugar", "Butter"],
    units: ["kg", "kg", "kg"],
    firm: "A bakery",
  },
  {
    products: ["Phones", "Tablets", "Laptops"],
    inputs: ["Chips", "Glass", "Assembly"],
    units: ["chips", "panels", "hours"],
    firm: "An electronics plant",
  },
];

function level5(rng: Rng): Body {
  for (;;) {
    const ctx = rng.int(0, CTX.length - 1);
    const form = rng.int(0, 1);
    const C = CTX[ctx];
    const T: M = [0, 1, 2].map(() => [0, 1, 2].map(() => rng.int(0, 9)));
    const v = [0, 1, 2].map(() => rng.int(1, 9));
    if (T.some((r) => r.every((x) => x === 0))) continue;
    // form 0: rows = inputs, columns = products, v = quantities -> total of each input
    // form 1: rows = products, columns = inputs, v = input prices -> unit cost of each product
    const rowNames = form === 0 ? C.inputs : C.products;
    const colNames = form === 0 ? C.products : C.inputs;
    const result = T.map((r) => r.reduce((s, x, k) => s + x * v[k], 0));
    const display = rowNames.map((s) => `\\text{${s}}`);
    const answer = tupleAnswer(rowNames, result, display);
    const unk = ["r1", "r2", "r3"];
    const verify: VerifySpec = {
      type: "solve",
      equations: T.map((r, i) => `${unk[i]} = ${dotExpr(r, v)}`),
      unknowns: unk,
    };
    const prompt =
      form === 0
        ? `${C.firm} makes ${C.products.join(", ")} in the quantities $x = ${col(v)}$ (in that order). The table gives the inputs used per unit: its rows are ${C.inputs.join(", ")} and its columns are ${C.products.join(", ")}. $$T = ${bm(T)}$$ Compute $T\\,x$, the total amount of each input. Give ${C.inputs.join(", ")}, in that order.`
        : `${C.firm} makes ${C.products.join(", ")}. The table gives the inputs used per unit: its rows are ${C.products.join(", ")} and its columns are ${C.inputs.join(", ")}. $$T = ${bm(T)}$$ The input prices, in dollars, are $p = ${col(v)}$, in the order ${C.inputs.join(", ")}. Compute $T\\,p$, the cost of making one unit of each product. Give ${C.products.join(", ")}, in that order.`;
    const steps: Step[] = [
      {
        key: "row-col",
        instruction: `Row 1 of $T$ times the vector gives the first entry (${rowNames[0]}). Multiply in pairs and add.`,
        math: `${dotLatex(T[0], v)} = ${result[0]}`,
        why:
          form === 0
            ? "Each row of the table says how much of one input each product needs. Multiply by the quantities and add to get the total of that input."
            : "Each row of the table is one product's recipe. Multiply by the input prices and add to get that product's cost.",
        ask: {
          prompt: `What is the ${rowNames[0]} entry of the result?`,
          answer: numberAnswer(result[0]),
          verify: {
            type: "solve",
            equations: [`r = ${dotExpr(T[0], v)}`],
            unknowns: ["r"],
          },
        },
      },
      {
        key: "assemble",
        instruction: "Repeat for rows 2 and 3 and fill in every entry.",
        math: `T\\,${form === 0 ? "x" : "p"} = ${col(result)}`,
        why: "A 3 by 3 matrix times a 3-entry vector gives a 3-entry vector: one row-times-vector sum per row.",
        ask: {
          prompt: `Give the three entries: ${rowNames.join(", ")}.`,
          answer,
          verify,
        },
      },
    ];
    // Wrong: multiplied down the columns of the table instead of across the rows.
    const transposed = [0, 1, 2].map((c) =>
      T.reduce((s, r, k) => s + r[c] * v[k], 0),
    );
    const cand: (MisconceptionInstance | null)[] = [
      {
        id: "transposed-table",
        wrong: tupleAnswer(rowNames, transposed, display),
      },
    ];

    // Interpretation: drawn last.
    const ir = rng.int(0, 2);
    const ij = rng.int(0, 2);
    const cell = T[ir][ij];
    const unit = form === 0 ? C.units[ir] : "dollars";
    const cands = [
      cell,
      result[ir],
      T[ij][ir],
      cell + 1,
      cell + 2,
      cell + 3,
      v[ij],
    ];
    const vals: number[] = [];
    for (const x of cands)
      if (!vals.includes(x) && vals.length < 4) vals.push(x);
    const order = rng.shuffle(vals);
    const options: ChoiceOption[] = order.map((x, idx) => ({
      id: `o${idx}`,
      label: `$${x}$ ${unit}`,
    }));
    const interpretation: InterpretationQuestion[] = [
      {
        prompt:
          form === 0
            ? `If the firm makes one more unit of ${colNames[ij]} (and the same of everything else), by how much does the total of ${rowNames[ir]} change?`
            : `If the price of ${colNames[ij]} rises by one dollar (other prices unchanged), by how much does the cost of one unit of ${rowNames[ir]} change?`,
        options,
        correct: options[order.indexOf(cell)].id,
        explanation:
          form === 0
            ? `The result is linear in the quantities, and the coefficient of ${colNames[ij]} in the ${rowNames[ir]} row is the table entry $${cell}$. One more unit adds that many ${unit}.`
            : `One unit of ${rowNames[ir]} uses $${cell}$ units of ${colNames[ij]}, so a one-dollar price rise adds $${cell}$ dollars to its cost.`,
      },
    ];
    return {
      params: {
        ctx,
        form,
        t11: T[0][0],
        t12: T[0][1],
        t13: T[0][2],
        t21: T[1][0],
        t22: T[1][1],
        t23: T[1][2],
        t31: T[2][0],
        t32: T[2][1],
        t33: T[2][2],
        v1: v[0],
        v2: v[1],
        v3: v[2],
        ir,
        ij,
      },
      prompt,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, cand),
      interpretation,
      verify,
    };
  }
}

// ---------------------------------------------------------------------------

const R9: [number, number] = [-9, 9];

export const matrixOperations: SkillDefinition = {
  id: ID,
  title: "Matrix operations",
  track: "math",
  unit: "Matrices",
  description:
    "Add, scale and multiply matrices, and read the size of a product.",
  prerequisites: ["systems-of-equations"],
  maxDenominator: 1,
  levels: {
    1: {
      description: "Entrywise: A + B, A − B, kA (2×2)",
      ranges: {
        form: [0, 2],
        k: [-5, 5],
        a11: R9,
        a12: R9,
        a21: R9,
        a22: R9,
        b11: R9,
        b12: R9,
        b21: R9,
        b22: R9,
      },
    },
    2: {
      description: "One entry of a product: row times column",
      ranges: {
        form: [0, 1],
        i: [1, 2],
        j: [1, 2],
        a11: R9,
        a12: R9,
        a13: R9,
        a21: R9,
        a22: R9,
        a23: R9,
        b11: R9,
        b12: R9,
        b21: R9,
        b22: R9,
        b31: R9,
        b32: R9,
      },
    },
    3: {
      description: "The full 2×2 product AB",
      ranges: {
        a11: R9,
        a12: R9,
        a21: R9,
        a22: R9,
        b11: R9,
        b12: R9,
        b21: R9,
        b22: R9,
      },
    },
    4: {
      description: "Is AB defined, and what size is it?",
      ranges: { m: [1, 5], n: [1, 5], p: [1, 5], q: [1, 5] },
    },
    5: {
      description: "Cost story: a 3×3 table times a 3-vector",
      ranges: {
        ctx: [0, CTX.length - 1],
        form: [0, 1],
        t11: [0, 9],
        t12: [0, 9],
        t13: [0, 9],
        t21: [0, 9],
        t22: [0, 9],
        t23: [0, 9],
        t31: [0, 9],
        t32: [0, 9],
        t33: [0, 9],
        v1: [1, 9],
        v2: [1, 9],
        v3: [1, 9],
        ir: [0, 2],
        ij: [0, 2],
      },
    },
  },
  misconceptions: {
    "entrywise-product": {
      name: "Multiplied matching entries",
      explanation:
        "Matrix multiplication is not entry by entry. Entry (i, j) of $AB$ is row $i$ of $A$ times column $j$ of $B$: multiply in pairs along the row and down the column, then add. Multiplying $a_{ij}$ by $b_{ij}$ uses one pair instead of the whole sum.",
    },
    "wrong-order": {
      name: "Multiplied B times A",
      explanation:
        "Order matters: $AB$ takes rows from $A$ and columns from $B$. You computed $BA$, which uses rows of $B$ and columns of $A$. For most pairs $AB \\ne BA$.",
    },
    "reversed-subtraction": {
      name: "Subtracted A from B",
      explanation:
        "$A - B$ means each entry of $A$ minus the matching entry of $B$. You computed $B - A$, so every entry has the wrong sign.",
    },
    "scalar-first-row": {
      name: "Multiplied only the first row",
      explanation:
        "A number times a matrix multiplies every entry, in every row. $kA$ scales all four entries, not just the first row.",
    },
    "inner-as-size": {
      name: "Used the inner dimensions as the size",
      explanation:
        "The inner numbers must match for $AB$ to exist, and then they disappear. The size comes from the outer numbers: (rows of $A$) $\\times$ (columns of $B$).",
    },
    "defined-anyway": {
      name: "Multiplied matrices whose inner sizes don't match",
      explanation:
        "Row times column needs the same number of entries. If the columns of $A$ differ from the rows of $B$, the product does not exist, whatever the outer sizes are.",
    },
    "transposed-table": {
      name: "Multiplied down the columns instead of across the rows",
      explanation:
        "Each entry of the result is one row of the table times the vector. You used a column of the table, which mixes up the products and the inputs.",
    },
  },
  stepLabels: {
    entrywise: "Combine matching entries",
    "row-col": "Row times column",
    "add-products": "Add the products",
    "inner-dims": "Compare the inner dimensions",
    "outer-dims": "Read the size from the outer dimensions",
    assemble: "Fill in every entry",
  },
  learn: {
    whyItMatters:
      "Matrices bundle many linear calculations at once, which is how econometrics and multi-sector models are written. A shop makes chairs and tables from wood, labor and paint. The recipe table is $\\begin{bmatrix} 4 & 2 & 1 \\\\ 6 & 3 & 2 \\end{bmatrix}$ and input prices are \\$2, \\$15 and \\$5. Multiplying gives unit costs $4\\cdot 2 + 2\\cdot 15 + 1\\cdot 5 = 43$ and $6\\cdot 2 + 3\\cdot 15 + 2\\cdot 5 = 67$ dollars. Making 10 chairs and 5 tables then costs $10\\cdot 43 + 5\\cdot 67 = 765$ dollars.",
    summary:
      "Add or subtract matrices of the same size entry by entry, and multiply by a number entry by entry. To multiply $AB$, the columns of $A$ must equal the rows of $B$. Entry $(i, j)$ is row $i$ of $A$ times column $j$ of $B$: multiply in pairs and add. The product of an $m \\times n$ and an $n \\times q$ matrix is $m \\times q$. Order matters: $AB$ and $BA$ usually differ.",
    formulas: [
      {
        latex: "(A \\pm B)_{ij} = a_{ij} \\pm b_{ij}",
        note: "Same size only; entry by entry.",
      },
      {
        latex: "(AB)_{ij} = a_{i1}b_{1j} + a_{i2}b_{2j} + \\cdots",
        note: "Row $i$ of $A$ times column $j$ of $B$.",
      },
      {
        latex: "(m \\times n)(n \\times q) = m \\times q",
        note: "Inner numbers must match; the outer numbers are the size.",
      },
    ],
    example: { seed: 4, level: 3 },
    tips: [
      "To find entry $(i, j)$ of a product, put a finger on row $i$ of the left matrix and another on column $j$ of the right one.",
      "Before multiplying, write the sizes side by side: $(m \\times n)(p \\times q)$. If $n \\ne p$ you are done: it is not defined.",
      "Do not assume $AB = BA$. Swapping the order changes which rows and columns pair up.",
    ],
  },

  generate(rng, level) {
    switch (level) {
      case 1:
        return level1(rng);
      case 2:
        return level2(rng);
      case 3:
        return level3(rng);
      case 4:
        return level4(rng);
      case 5:
        return level5(rng);
    }
  },
};
