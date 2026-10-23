"""Independent cross-check: re-solve every exported problem statement with SymPy and compare
against the app's computed answer. Exits 1 on any disagreement.

Usage: python -I verify/sympy_check.py verify/out/samples.json
"""
import json
import re
import sys

import sympy as sp
from sympy.parsing.sympy_parser import convert_xor, parse_expr, standard_transformations

TRANSFORMS = standard_transformations + (convert_xor,)
FUNCS = {"sqrt": sp.sqrt, "log": sp.log, "exp": sp.exp, "lcm": sp.lcm, "gcd": sp.gcd, "abs": sp.Abs, "mod": sp.Mod, "floor": sp.floor}


def parse(text, names, plain=()):
    # Positive symbols: the app samples variables at positive points (roots, logs are real).
    # Unknowns being solved for are `plain` (no sign assumption) so negative solutions exist.
    local = {n: sp.Symbol(n) if n in plain else sp.Symbol(n, positive=True) for n in names}
    local.update(FUNCS)
    # Decimals like 0.25 become exact rationals.
    text = re.sub(r"(?<![\w.])(\d+\.\d+)", lambda m: f"Rational('{m.group(1)}')", text)
    local["Rational"] = sp.Rational
    return parse_expr(text, local_dict=local, transformations=TRANSFORMS, evaluate=True)


def names_in(*texts):
    found = set()
    for t in texts:
        found.update(re.findall(r"\b([A-Za-z]\w*)\b", t))
    return found - set(FUNCS) - {"Rational"}


def same(a, b):
    d = sp.expand(a - b)
    if d == 0 or sp.simplify(d) == 0:
        return True
    # Constants like log(24) - 3*log(2) - log(3) don't always simplify symbolically;
    # compare them numerically to 50 significant digits instead.
    if not d.free_symbols:
        return abs(sp.N(d, 50)) < sp.Float("1e-40")
    return False


def numeric_near(expr, var, point, direction, value):
    if point in (sp.oo, -sp.oo):
        x = sp.Integer(10) ** 30 * (1 if point is sp.oo else -1)
    else:
        x = point + (sp.Rational(1, 10**20) if direction == "+" else -sp.Rational(1, 10**20))
    near = sp.N(expr.subs(var, x), 50)
    return abs(near - sp.N(value, 50)) < sp.Float("1e-8")


def check(item):
    spec, values = item["verify"], item["values"]
    kind = spec["type"]
    if kind == "solve":
        names = names_in(*spec["equations"], *spec["unknowns"])
        positive = bool(spec.get("positive"))
        plain = set() if positive else set(spec["unknowns"])
        eqs = []
        for e in spec["equations"]:
            lhs, rhs = e.split("=")
            eqs.append(sp.Eq(parse(lhs, names, plain), parse(rhs, names, plain)))
        unknowns = [sp.Symbol(u, positive=True) if positive else sp.Symbol(u) for u in spec["unknowns"]]
        sols = sp.solve(eqs, unknowns, dict=True)
        if len(sols) != 1:
            return f"SymPy found {len(sols)} solutions: {sols}"
        for u, v in zip(unknowns, values):
            if not same(sols[0][u], parse(v, names, plain)):
                return f"{u}: SymPy {sols[0][u]}, app {v}"
        return None
    if kind == "diff":
        names = names_in(spec["expr"], values[0], spec["variable"])
        var = sp.Symbol(spec["variable"], positive=True)
        expected = sp.diff(parse(spec["expr"], names), var)
        got = parse(values[0], names)
        return None if same(expected, got) else f"SymPy {expected}, app {got}"
    if kind == "partial":
        at = spec.get("at") or {}
        names = names_in(spec["expr"], values[0], *spec["wrt"], *spec["variables"])
        f = parse(spec["expr"], names)
        expected = sp.diff(f, *[sp.Symbol(w, positive=True) for w in spec["wrt"]])
        if at:
            expected = expected.subs({sp.Symbol(k, positive=True): parse(v, set()) for k, v in at.items()})
        got = parse(values[0], names)
        return None if same(expected, got) else f"SymPy {expected}, app {got}"
    if kind == "det":
        m = sp.Matrix([[parse(e, set()) for e in row] for row in spec["matrix"]])
        expected, got = m.det(), parse(values[0], set())
        return None if same(expected, got) else f"SymPy det {expected}, app {got}"
    if kind == "equivalent":
        names = names_in(spec["expr"], values[0])
        a, b = parse(spec["expr"], names), parse(values[0], names)
        return None if same(a, b) else f"SymPy says {a} != {b}"
    if kind == "limit":
        names = names_in(spec["expr"], values[0], spec["variable"])
        var = sp.Symbol(spec["variable"])
        local_names = names - {spec["variable"]}
        expr = parse(spec["expr"], local_names | {spec["variable"]}, plain={spec["variable"]})
        point = sp.oo if spec["point"] == "oo" else -sp.oo if spec["point"] == "-oo" else parse(spec["point"], set())
        dirs = [spec["side"]] if spec.get("side") else (["+"] if point is sp.oo else ["-"] if point is -sp.oo else ["+", "-"])
        got = parse(values[0], set())
        for d in dirs:
            take = (lambda e: sp.limit(e, var, point, dir=d)) if point not in (sp.oo, -sp.oo) else (lambda e: sp.limit(e, var, point))
            expected = take(expr)
            if same(expected, got):
                continue
            # sympy.limit has known bugs with logs of constants (e.g. returns -oo for a finite
            # log-difference quotient). Retry on the simplified expression, and accept only if that
            # agrees AND a 50-digit numeric evaluation right next to the point agrees too.
            retry = take(sp.simplify(expr))
            if same(retry, got) and numeric_near(expr, var, point, d, got):
                continue
            return f"SymPy limit ({d}) {expected} (simplified: {retry}), app {got}"
        return None
    if kind == "evaluate":
        a, b = parse(spec["expr"], set()), parse(values[0], set())
        return None if same(a, b) else f"SymPy {a}, app {b}"
    return f"unknown verify type {kind}"


def main(path):
    with open(path, encoding="utf-8") as f:
        items = json.load(f)
    failures = []
    for item in items:
        try:
            err = check(item)
        except Exception as exc:  # parsing/solving failure counts as a disagreement
            err = f"error: {exc!r}"
        if err:
            failures.append((item["where"], err))
    for where, err in failures[:50]:
        print(f"DISAGREE {where}: {err}")
    print(f"SymPy cross-check: {len(items) - len(failures)}/{len(items)} agree, {len(failures)} disagreements")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
