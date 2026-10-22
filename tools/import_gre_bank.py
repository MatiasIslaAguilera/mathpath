"""Import the public GRE Quant question bank from

  https://github.com/lbcty56/GRE-Quiz-App-Python-

The source file is a Python module containing `gre_quant_bank` (200 dicts:
qid, difficulty, topic, type, question, answer, explanation). This script
normalizes it to the small static-deck JSON consumed by src/content/greBank.ts.

Run from the repo root:

  python tools/import_gre_bank.py

It only writes src/content/gre-bank.json; it does not touch progress data.
"""

from __future__ import annotations

import ast
import json
import re
import urllib.request
from pathlib import Path

SOURCE_URL = "https://raw.githubusercontent.com/lbcty56/GRE-Quiz-App-Python-/main/question_bank.py"
SOURCE_REPO = "https://github.com/lbcty56/GRE-Quiz-App-Python-"
OUT = Path(__file__).resolve().parent.parent / "src" / "content" / "gre-bank.json"

QC_OPTIONS = [
    {"id": "a", "label": "Quantity A is greater."},
    {"id": "b", "label": "Quantity B is greater."},
    {"id": "c", "label": "The two quantities are equal."},
    {"id": "d", "label": "The relationship cannot be determined from the information given."},
]

DIFFICULTY = {"Simple": 1, "Middle": 2, "Hard": 3, "Challenging": 4}

OPTION_RE = re.compile(r"^\(([A-E])\)\s*(.+)$")


def load_bank() -> list[dict]:
    raw = urllib.request.urlopen(SOURCE_URL, timeout=30).read().decode("utf-8", "replace")
    tree = ast.parse(raw)
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(getattr(t, "id", "") == "gre_quant_bank" for t in node.targets):
            bank = ast.literal_eval(node.value)
            if isinstance(bank, list) and len(bank) == 200:
                return bank
    raise SystemExit("gre_quant_bank list not found")


def split_options(question: str) -> tuple[str, list[dict]]:
    """Split option lines `(A) ...` from the prompt. Returns (prompt, options)."""
    prompt_lines: list[str] = []
    options: list[dict] = []
    for line in question.splitlines():
        match = OPTION_RE.match(line.strip())
        if match:
            options.append({"id": match.group(1).lower(), "label": match.group(2).strip()})
        elif not options:
            prompt_lines.append(line)
    return "\n".join(prompt_lines).strip(), options


def normalize_expr(value: str) -> str:
    s = value.strip()
    s = s.replace("π", "pi").replace("×", "*").replace("÷", "/")
    # "4√3" / "√3" first, so the result is sqrt(3) rather than sqrt3.
    s = re.sub(r"√\s*\(([^)]*)\)", r"sqrt(\1)", s)
    s = re.sub(r"√\s*(\d+(?:\.\d+)?)", r"sqrt(\1)", s)
    s = s.replace("√", "sqrt")
    s = re.sub(r"(?<=\d)\s*(?=(?:sqrt|pi)\b)", "*", s)
    s = re.sub(r"\s+", "", s)
    return s


def variables_in(expr: str) -> list[str]:
    names = re.findall(r"(?<![A-Za-z])([A-Za-z])(?![A-Za-z])", expr)
    return sorted({n for n in names if n not in {"e"}})


def latex_math(expr: str) -> str:
    s = expr
    # Plain signed numbers stay compact: -3, not "- 3".
    if re.fullmatch(r"-?\d+(?:\.\d+)?", s):
        return s
    # a*sqrt(b) / a*pi
    s = re.sub(r"\*sqrt\((\d+)\)", r"\\sqrt{\1}", s)
    s = re.sub(r"\*pi\b", r"\\pi", s)
    # simple fraction a/b (including a leading -)
    m = re.fullmatch(r"(-?)(\d+)/(\d+)", s)
    if m:
        sign, n, d = m.groups()
        return f"{'-' if sign else ''}\\frac{{{n}}}{{{d}}}"
    # S/7 + 3 style expressions
    s = re.sub(r"([A-Za-z])/(\d+)", r"\\frac{\1}{\2}", s)
    s = re.sub(r"^\((\\frac\{[^}]*\}\{[^}]*\})\)", r"\1", s)
    s = re.sub(r"^\((.*)\)$", r"\1", s)
    s = s.replace("+", " + ").replace("-", " - ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def answer_spec(item: dict) -> dict:
    kind = item["type"]
    answer = item["answer"].strip()

    if kind == "Numeric Entry":
        expr = normalize_expr(answer)
        display = latex_math(expr)
        variables = variables_in(expr)
        if variables:
            return {
                "kind": "expression",
                "value": expr,
                "variables": variables,
                "display": display,
            }
        return {"kind": "number", "value": expr, "display": display}

    if kind == "Quantitative Comparison":
        letter = re.search(r"\(([A-E])\)", answer)
        if not letter:
            raise ValueError(f"{item['qid']}: no QC answer letter")
        return {"kind": "choice", "options": QC_OPTIONS, "correct": letter.group(1).lower()}

    prompt, options = split_options(item["question"])
    if kind == "Multiple Choice - Single Answer":
        letter = re.search(r"\(([A-E])\)", answer)
        if not letter:
            raise ValueError(f"{item['qid']}: no single-answer letter")
        return {"kind": "choice", "options": options, "correct": letter.group(1).lower()}

    if kind == "Multiple Choice - Multiple Answers":
        letters = [x.lower() for x in re.findall(r"\(([A-E])\)", answer)]
        if not letters:
            raise ValueError(f"{item['qid']}: no multi-answer letters")
        return {"kind": "multi", "options": options, "correct": letters}

    raise ValueError(f"{item['qid']}: unknown type {kind}")


def convert(item: dict) -> dict:
    kind = item["type"]
    if kind == "Quantitative Comparison":
        prompt = item["question"].strip()
    else:
        prompt, _ = split_options(item["question"])
    return {
        "id": f"gre-bank:{item['qid']}",
        "topic": item["topic"],
        "difficulty": DIFFICULTY[item["difficulty"]],
        "type": kind,
        "prompt": prompt,
        "answer": answer_spec(item),
        "explanation": item["explanation"].strip(),
        "source": {
            "bank": "lbcty56/GRE-Quiz-App-Python-",
            "url": SOURCE_REPO,
            "qid": item["qid"],
            "originalType": kind,
            "originalDifficulty": item["difficulty"],
        },
    }


def main() -> None:
    bank = load_bank()
    items = [convert(item) for item in bank]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "bank": "lbcty56/GRE-Quiz-App-Python-",
        "url": SOURCE_REPO,
        "count": len(items),
        "items": items,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(items)} items to {OUT}")


if __name__ == "__main__":
    main()
