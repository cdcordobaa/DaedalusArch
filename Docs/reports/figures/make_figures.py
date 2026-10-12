#!/usr/bin/env python3
"""Build the figures of Docs/reports/director-report-2026-10.md from committed CSVs only.

Run from the repository root:  python3 Docs/reports/figures/make_figures.py
Standard library only; writes plain SVG files next to this script.
"""
import csv
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT = os.path.dirname(os.path.abspath(__file__))

SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK2 = "#52514e"
GRID = "#e4e3df"
S1, S2, S3 = "#2a78d6", "#eb6834", "#1baf7a"  # categorical slots 1-3, fixed order
FONT = "font-family='Helvetica, Arial, sans-serif'"


def rows(path):
    with open(os.path.join(ROOT, path), newline="") as f:
        return list(csv.DictReader(f))


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


class Plot:
    """Horizontal dot-and-interval chart: one row per label, x is a value scale."""

    def __init__(self, title, subtitle, labels, xmin, xmax, ticks, left=250, width=760, row_h=26):
        self.labels, self.xmin, self.xmax, self.ticks = labels, xmin, xmax, ticks
        self.left, self.width, self.row_h = left, width, row_h
        self.top = 64
        self.right = 24
        self.height = self.top + row_h * len(labels) + 76
        self.parts = [
            f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{self.height}' "
            f"viewBox='0 0 {width} {self.height}' {FONT}>",
            f"<rect width='100%' height='100%' fill='{SURFACE}'/>",
            f"<text x='16' y='24' font-size='15' font-weight='bold' fill='{INK}'>{esc(title)}</text>",
            f"<text x='16' y='44' font-size='11' fill='{INK2}'>{esc(subtitle)}</text>",
        ]
        y0, y1 = self.top - 6, self.top + row_h * len(labels)
        for t in ticks:
            x = self.x(t)
            self.parts.append(f"<line x1='{x:.1f}' y1='{y0}' x2='{x:.1f}' y2='{y1}' stroke='{GRID}' stroke-width='1'/>")
            self.parts.append(f"<text x='{x:.1f}' y='{y1 + 16}' font-size='11' fill='{INK2}' text-anchor='middle'>{t:g}</text>")
        for i, lab in enumerate(labels):
            self.parts.append(
                f"<text x='{left - 10}' y='{self.y(i) + 4:.1f}' font-size='12' fill='{INK}' text-anchor='end'>{esc(lab)}</text>"
            )

    def x(self, v):
        return self.left + (v - self.xmin) / (self.xmax - self.xmin) * (self.width - self.left - self.right)

    def y(self, i, offset=0.0):
        return self.top + self.row_h * (i + 0.5) + offset

    def vline(self, v, label):
        x = self.x(v)
        y1 = self.top + self.row_h * len(self.labels)
        self.parts.append(f"<line x1='{x:.1f}' y1='{self.top - 6}' x2='{x:.1f}' y2='{y1}' stroke='{INK2}' stroke-width='1.5' stroke-dasharray='4 3'/>")
        self.parts.append(f"<text x='{x + 4:.1f}' y='{y1 + 31}' font-size='10' fill='{INK2}'>{esc(label)}</text>")

    def dot(self, i, v, color, lo=None, hi=None, offset=0.0, shape="circle"):
        y = self.y(i, offset)
        if lo is not None and hi is not None:
            self.parts.append(
                f"<line x1='{self.x(lo):.1f}' y1='{y:.1f}' x2='{self.x(hi):.1f}' y2='{y:.1f}' stroke='{color}' stroke-width='2' stroke-linecap='round'/>"
            )
        if shape == "square":
            self.parts.append(f"<rect x='{self.x(v) - 4.5:.1f}' y='{y - 4.5:.1f}' width='9' height='9' rx='1.5' fill='{color}' stroke='{SURFACE}' stroke-width='2'/>")
        elif shape == "diamond":
            cx = self.x(v)
            self.parts.append(f"<path d='M{cx:.1f},{y - 6:.1f} L{cx + 6:.1f},{y:.1f} L{cx:.1f},{y + 6:.1f} L{cx - 6:.1f},{y:.1f} Z' fill='{color}' stroke='{SURFACE}' stroke-width='2'/>")
        else:
            self.parts.append(f"<circle cx='{self.x(v):.1f}' cy='{y:.1f}' r='5' fill='{color}' stroke='{SURFACE}' stroke-width='2'/>")

    def legend(self, items):
        y = self.height - 22
        x = self.left
        for label, color, shape in items:
            if shape == "square":
                self.parts.append(f"<rect x='{x}' y='{y - 9}' width='10' height='10' rx='1.5' fill='{color}'/>")
            elif shape == "diamond":
                self.parts.append(f"<path d='M{x + 5},{y - 10} L{x + 11},{y - 4} L{x + 5},{y + 2} L{x - 1},{y - 4} Z' fill='{color}'/>")
            else:
                self.parts.append(f"<circle cx='{x + 5}' cy='{y - 4}' r='5' fill='{color}'/>")
            self.parts.append(f"<text x='{x + 16}' y='{y}' font-size='11' fill='{INK}'>{esc(label)}</text>")
            x += 22 + 7 * len(label)

    def save(self, name):
        self.parts.append("</svg>")
        with open(os.path.join(OUT, name), "w") as f:
            f.write("\n".join(self.parts) + "\n")


def f(v):
    return float(v) if v not in ("", None) else None


def fig_so4():
    readings = [
        ("strict v1, rule 1.1.0, N 75", "results/so4-heldout/agg-strict/prf_overall.csv"),
        ("corrected v1, rule 1.2.0, N 73", "results/so4-heldout/agg-corrected/prf_overall.csv"),
        ("instrument v2, rule 1.2.0, N 73", "results/so4-heldout/v2/agg/prf_overall.csv"),
        ("labelled v1, rule-1.1.0 FPs, N 73", "results/so4-heldout/agg/prf_overall.csv"),
    ]
    labels, data = [], []
    for name, path in readings:
        r = next(x for x in rows(path) if x["base_kind"] == "all" and x["coverage"] == "all")
        data.append(r)
        labels += [f"{name}: recall", f"{name}: precision", f"{name}: F1"]
    p = Plot(
        "SO4 held-out, symbolic-only: four readings",
        "Point and primary cell-bootstrap 95% interval. Precision is seeded differential precision (labelled for the last reading).",
        labels, 0.6, 1.0, [0.6, 0.7, 0.8, 0.9, 1.0], left=330,
    )
    for k, r in enumerate(data):
        p.dot(3 * k, f(r["recall"]), S1, f(r["ci_low"]), f(r["ci_high"]))
        prec = f(r["precision_labelled"]) if r["precision_labelled"] else f(r["precision_strict"])
        p.dot(3 * k + 1, prec, S1, f(r["precision_ci_low"]), f(r["precision_ci_high"]))
        f1 = 2 * prec * f(r["recall"]) / (prec + f(r["recall"]))
        p.dot(3 * k + 2, f1, S1, f(r["f1_ci_low"]), f(r["f1_ci_high"]))
    p.save("fig1-so4-readings.svg")


def fig_tool():
    r = rows("results/tool-comparison/recall.csv")
    want = ["MO-S01", "MO-S03", "MO-P01", "MO-C04", "MO-X01", "in-coverage seeds", "all seeds"]
    by = {x["group"]: x for x in r}
    labels = [f"{g} (n {by[g]['n']})" for g in want]
    p = Plot(
        "Seed recall: DaedalusArch vs dependency-cruiser (translation 1.0.0)",
        "Point and instance Wilson 95% interval (the 'if independent' bound). Registered primary reading.",
        labels, 0.0, 1.0, [0, 0.2, 0.4, 0.6, 0.8, 1.0], left=200,
    )
    for i, g in enumerate(want):
        x = by[g]
        lo, hi = map(float, x["da_ci95"].split("-"))
        p.dot(i, float(x["da_rate"]), S1, lo, hi, offset=-5)
        lo, hi = map(float, x["depcruise_ci95"].split("-"))
        p.dot(i, float(x["depcruise_rate"]), S2, lo, hi, offset=5, shape="square")
    p.legend([("DaedalusArch (instrument v2)", S1, "circle"), ("dependency-cruiser 18.4.0", S2, "square")])
    p.save("fig2-tool-comparison.svg")


def fig_judge():
    r = sorted(rows("results/e7-corpus/agg-proportional/ahs_by_aggregation.csv"), key=lambda x: x["project_id"])
    labels = [x["project_id"] for x in r]
    # Registered weights: any-fail delta_judge = any-fail AHS - judge-blind AHS (same weights).
    p = Plot(
        "E7 judge effect on ahsCombined, registered weights (W_n = 0.08) - POST HOC",
        "delta_judge = AHS under the aggregation minus the judge-blind AHS; bound [-0.08, 0].",
        labels, -0.10, 0.01, [-0.10, -0.08, -0.06, -0.04, -0.02, 0.0], left=300,
    )
    p.vline(-0.08, "bound -W_n")
    for i, x in enumerate(r):
        blind = f(x["ahs_combined_judge_blind"])
        p.dot(i, f(x["delta_judge_registered"]), S1, offset=-6)
        p.dot(i, f(x["delta_judge_proportional"]), S2, offset=0, shape="square")
        p.dot(i, round(f(x["ahs_combined_any_fail"]) - blind, 3), S3, offset=6, shape="diamond")
    p.legend([("registered", S1, "circle"), ("proportional", S2, "square"), ("any-fail", S3, "diamond")])
    p.save("fig3-judge-effect-registered-weights.svg")

    p = Plot(
        "E7 judge effect, judge-weighted-v1 (judge 2/7) - POST HOC sensitivity",
        "delta_judge_jw = AHS under the aggregation minus the judge-blind AHS, same weights; bound [-2/7, 0].",
        labels, -0.30, 0.01, [-0.30, -0.25, -0.20, -0.15, -0.10, -0.05, 0.0], left=300,
    )
    p.vline(-2 / 7, "bound -2/7")
    for i, x in enumerate(r):
        p.dot(i, f(x["delta_judge_jw_registered"]), S1, offset=-6)
        p.dot(i, f(x["delta_judge_jw_proportional"]), S2, offset=0, shape="square")
        p.dot(i, f(x["delta_judge_jw_any_fail"]), S3, offset=6, shape="diamond")
    p.legend([("registered", S1, "circle"), ("proportional", S2, "square"), ("any-fail", S3, "diamond")])
    p.save("fig4-judge-effect-judge-weighted.svg")


def fig_e1():
    grid = [x for x in rows("results/e1-grid/agg/so5_grid.csv") if x["ahs_combined"]]
    models = ["claude-haiku-4-5", "claude-sonnet-5-5", "claude-opus-5-5", "gpt-5.6-terra"]
    levels = [("none", S1, "circle", -7), ("minimal-prose", S2, "square", 0), ("full-aac", S3, "diamond", 7)]
    cells = {}
    for x in grid:
        cells.setdefault((x["requested_model_id"], x["spec_level"]), []).append(f(x["ahs_combined"]))
    labels = []
    for m in models:
        ns = "/".join(str(len(cells.get((m, lv), []))) for lv, _, _, _ in levels)
        arm = " (Codex, exploratory)" if m.startswith("gpt") else ""
        labels.append(f"{m}{arm}, n {ns}")
    p = Plot(
        "E1: mean ahsCombined by model and spec level (registered aggregation)",
        "Dot = mean over valid cells; line = min to max of the cells (descriptive). Every cell passes (threshold 0.80).",
        labels, 0.84, 1.0, [0.84, 0.88, 0.92, 0.96, 1.0], left=330, row_h=34,
    )
    for i, m in enumerate(models):
        for lv, color, shape, off in levels:
            v = cells.get((m, lv), [])
            if v:
                p.dot(i, sum(v) / len(v), color, min(v), max(v), offset=off, shape=shape)
    p.legend([(lv, color, shape) for lv, color, shape, _ in levels])
    p.save("fig5-e1-ahs-model-spec.svg")


if __name__ == "__main__":
    fig_so4()
    fig_tool()
    fig_judge()
    fig_e1()
    print("figures written to", OUT)
