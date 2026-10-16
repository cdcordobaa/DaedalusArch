# v1.3 floor probe (2026-10-16)

Feasibility probe for Study 2's floor risk. Report: `Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md`.
The agent in every trajectory is one Claude session; this is not the loop pilot and not Study 2.

- `tasks.json`: the 6 rehearsal tasks (2 pilot tasks verbatim, 4 new) and the prompt frames per style.
- `<task>/none/step-NN.json`: `none`-arm record per step (blocking and advisory counts per rule, blocking findings,
  files touched, LOC, type-check errors); `snapshots/step-NN/src` is the tree after the step.
- `<task>/tool/step-NN.pre.json` / `.post.json`: tool arm before and after the fix, each with the MCP `check_diff`
  result of the step diff (`.pre.diff`) or the fix diff (`.post.diff`); `snapshots/step-NN/src` is the post-fix tree.
- `summary.json`, `summary.md`: aggregates (`scripts/aggregate.py`).
- `correctness/`: `scripts/v1.3/check-correct.ts --tiers blocking` on every `none`-arm blocking finding.
- `instrument-probe/`: five synthetic hexagonal shortcut files used only to probe the tools (§3.6 of the report).
- `scripts/`: the probe's helpers. They hold absolute scratch paths of the session that ran them (the pinned
  generator skeleton was installed from `scripts/generator/skeleton/` with `npm ci --ignore-scripts`); adjust before reuse.

Scoring: `daedalus-arch evaluate --symbolic-only --engine cypher-interp --scoring v1.3`, specs `presets/hexagonal.yaml`
and `presets/layered.yaml`, unchanged.
