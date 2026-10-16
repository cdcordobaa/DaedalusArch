# Precedent-propagation probe (night backlog #6, F2): data

Exploratory feasibility probe, development set. Report: `Docs/DiagnosticRuns/v1.3-precedent-probe-2026-10-16.md`.
Plan, committed first: `Docs/DiagnosticRuns/v1.3-precedent-probe-plan.md`. Seeds: `examples/precedent-probe/`.

| Path | What |
|---|---|
| `seeds/<domain>.<planted|control>.json` | seed acceptance check (evaluate record of each seed tree) |
| `cells/<NN>.<domain>.<condition>.<step>/` | one cell: `prompt.txt` (rendered frame), `step.diff` (the agent's change on the seed), `snapshot/src`, `report.json` (full evaluate output), `record.json` (blocking findings, new identities, shape classification) |
| `correctness/` | `check-correct.ts --tiers blocking` over every cell (`jobs.json` uses paths relative to itself) |
| `summary.json`, `summary.md` | per-cell table, 2×2 per style, pre-stated reading |
| `scripts/` | `cells.py` (cells, order, frame), `evalsnap.py`, `score_cells.py`, `aggregate.py`, `mktsconfig.sh` (from #161) |
