# v1.4 evasion check: recorded dry runs (U5, decision M6)

**Stub data, not a measurement.** Both runs exercise the Study 2 evasion check (`scripts/v1.3/study2-evasion.ts`,
`Docs/v1.4/evasion-check.md`) end to end on synthetic inputs. No model, network or Neo4j call was made. Every out-root
and scratch directory sat in the OS temp directory; only the reports below were copied into the repository, and they
name the out-root as `<out-root>`. The identity is `pilot-metrics` (per rule): a dry-run artefact only (design R8).

## 1. `demo-stub/`: the loop harness's own dry run

```text
# a scratch copy of experiments/loop-demo/plan.dry-run.json: arms none and daedalus-mcp, runs 2, no frames
npx tsx scripts/loop-harness-cli.ts --plan <scratch>/plan.json --dry-run --binary /usr/bin/false \
  --harness-root <scratch>/h --out-root <scratch>/out
npx tsx scripts/v1.3/study2-evasion.ts --out-root <scratch>/out --out results/v1.4-evasion-dry-run/demo-stub \
  --h2 none@-,daedalus-mcp@- --spec specs/clean-arch.yaml
```

Stub generator, stub firewall, stub type-check; the Clean stub layout (the loop harness has no Layered style, design
R14). The demo plan has no frames, so the cells are `none@-` and `daedalus-mcp@-`, and its step records name no spec,
so `--spec specs/clean-arch.yaml` is the fallback.

What it showed:
- A1: no step has an acceptance record (the demo plan does not enable acceptance), so every cell has coverage 0,
  `acceptanceIncomplete` is true and the sample pool is empty (EV-05 draws only diffs that passed acceptance).
- A2: 2 eligible diffs per cell, both `avoided` and class `none`. The stub plants one domain → infrastructure import at
  step 2 and never removes it outside the gate arm, so step 3 inherits it and adds a clean domain file: the avoided path
  runs, the removal path does not (as the design expected).
- A3: no unmapped file and no out-of-scope edge (the stub writes only layer folders).
- Mechanism: no call log (`--call-log` off), so `noMechanism` is true.

## 2. `fixtures/`: an out-root assembled from the planted cases

```text
# tests/unit/scripts/v1.3/evasion/helpers.ts buildGitOutRoot: one run per case and arm (none@L2, daedalus-mcp@L2),
# 2 steps each (t0, t1 of tests/fixtures/v1.4-evasion/<case>), a real snapshots.git per run, passing acceptance records
npx tsx scripts/v1.3/study2-evasion.ts --out-root <scratch>/fixture-out --out results/v1.4-evasion-dry-run/fixtures
```

28 runs (14 cases × 2 cells; the A3-only `outside-context` case is not a run). Both cells get the same cases, so every
paired difference is 0 by construction.

What it showed:
- A1: every synthetic step record carries a passing acceptance record, so the pass rate and coverage are 1 and the
  H2 gap is 0 over 14 paired blocks.
- A3: the unmapped helpers of the relocation cases give 8 new out-of-scope edges per cell (H2 excess 0).
- A2: 12 eligible diffs per cell (11 removals, 1 avoided); classes: relocated-unmapped 4 (relocated-unmapped,
  stub-specifier-target, cycle, tool-tell), dynamic-escape 2 (dynamic-escape, avoided), deleted 2 (deleted,
  edgeless), wrapped 1, inlined 1, relocated-unguarded 1, none 1 (true-fix-dip). The `rename-only` runs give no diff:
  git's own rename detection on the run's store maps the finding (EV-06b).
- `observed-pair` sets `guardedPairsIncomplete` and lists `business → persistence`, without changing a count (EV-06a).
- The blind packet holds 20 items (10 per cell, 5 heuristic-flagged first); the `tool-tell` comment is redacted and
  the packet holds no run id, arm, cell, adapter or model (EV-06).

Files: `evasion.json` (deterministic), `evasion.md` (with a timestamp), `packet/` and `packet-key/key.json` (the sealed
key; only `packet/` would ever be handed to a reader).
