# HEXDDD-01 exploratory pilot: run report (2026-10-20)

**Exploratory. Not part of the confirmatory Study 2b.** Design: `ops/notes/hexddd-01-violation-elicitation-design.md`
§5 (branch `ops/hexddd-01-elicitation`, PR #331). Inputs: `experiments/pilot-hexddd-01/` (commit d3cccc5a, pushed
before any generator call). Results: `results/v1.4-pilot-hexddd-01/`.

This report gives **counts and the pass-bar verdict only**. It names no finding, so the author's hand read of
`results/v1.4-pilot-hexddd-01/diffs/` stays blind (procedure: `results/v1.4-pilot-hexddd-01/README.md`).

## Verdict against §5.2

**FAIL.**

- (a) D_seed ≥ 1 in at least 1 of the 2 runs: **no** (D_seed = 0 and 0).
- (b) in both runs, ≥ 1 new advisory identity in FF-S03, FF-P02, FF-DT05 or FF-DT06 confirmed by the hand read:
  **no**. There are 0 candidates in either run, so no hand read can make (b) hold.

Design §5.2 allows exactly one revision after a FAIL: a real-repo seed (S1 at its pin). That revision is the author's
call and was not run. The hand-read log (construct gap, design §5.3) is still to be filled. It can show violations
the instrument does not see, but it cannot change this verdict.

## Calls

| Phase | Calls | Cap |
|---|---|---|
| Smoke check (one trivial turn through the harness's Claude step agent) | 1 | 1 |
| No-MCP confinement probes 1–5 | 5 | 5 |
| Pilot (2 runs × 5 steps, arm `none`, 0 repair turns) | 10 | 12 |
| **Total** | **16** | 18 |

Ledger: `results/v1.4-pilot-hexddd-01/run/calls.jsonl`. Every turn finished in one attempt, so no redraw was used. Scoring
(re-score, check-correct, D_seed) and exposure made zero calls. C1d and C4 were not run.

## Gates

- **Smoke check:** passed. The nested `claude -p`, spawned with the harness's allow-listed environment, authenticated
  and completed one turn with status `completed` on `claude-sonnet-5-5`.
- **Confinement probes:** 5 of 5 passed (escape-write, node-modules-overwrite, tsc-flag-injection, command-chaining,
  allowed-command). The Bash argument set was kept (`allowBash: true`).
- **CLI version:** Claude Code `2.1.304`. **OS:** Linux cloud sandbox, Ubuntu 24.04.5 LTS, x86_64, kernel 6.18; Node 22.22.0.
  Both differ from the pinned macOS setup and are declared exploratory differences (`experiments/pilot-hexddd-01/README.md`).

## Counts

Blocking counts are at the instrument of main (`cypher-interp`, scoring v1.3, signed construct switches). Step 0 is
the seed, which carries one planted identity per case.

| Case | Step | Turn | tsc errors | Source files | LOC | Blocking | of which check-correct `correct` | Advisory |
|---|---|---|---|---|---|---|---|---|
| S1 Hexagonal | 0 (seed) | — | 0 | 32 | — | 1 | 1 | 36 |
| | 1 | completed | 0 | 32 | 608 | 1 | 1 | 37 |
| | 2 | completed | 0 | 32 | 634 | 1 | 1 | 37 |
| | 3 | completed | 0 | 37 | 813 | 1 | 1 | 42 |
| | 4 | completed | 0 | 40 | 920 | 1 | 1 | 47 |
| | 5 | completed | 0 | 44 | 1249 | 0 | 0 | 52 |
| S2 DDD | 0 (seed) | — | 0 | 31 | — | 1 | 1 | 0 |
| | 1 | completed | 0 | 42 | 538 | 1 | 1 | 0 |
| | 2 | completed | 0 | 42 | 546 | 1 | 1 | 0 |
| | 3 | completed | 0 | 46 | 711 | 1 | 1 | 0 |
| | 4 | completed | 0 | 49 | 785 | 1 | 1 | 0 |
| | 5 | completed | 0 | 54 | 932 | 1 | 1 | 0 |

| Case | D_seed (pass-bar reading) | D_seed, file-level findings included | D_seed, unlabelled | New advisory identities in the (b) rules |
|---|---|---|---|---|
| S1 | 0 | 0 | 0 | 0 |
| S2 | 0 | 0 | 0 | 0 |

The skeleton was intact after every turn. Source-file counts and LOC come from the step records (`src/**/*.ts`, the
harness's file set). The seed row's file count is the seed tree's.

**Exposure:** not available. `scripts/v1.4/exposure-count.ts` defines opportunity queries for Layered specs only and
refused all 10 snapshots ("spec style … expected layered"), as design §8 item 3 anticipates
(`results/v1.4-pilot-hexddd-01/scores/exposure/exposure.json`).

## Deviations from the design, declared before the calls

- Seed start and brownfield frame come from the pilot driver (`run-pilot.ts`) rather than the harness, because the
  harness is frozen (design §8 items 1 and 2). The step records' `promptSha256` hashes the harness frame that was
  replaced. The sent text and its hash are in `results/v1.4-pilot-hexddd-01/run/<task>/prompt-*.txt` and `frame-*.json`.
- No generator isolation (no dedicated config directory in the sandbox). The E1 allow-listed environment was used.
- The npm cache for the skeleton was filled from the session shell, because the harness's cache warm lacks the
  sandbox proxy certificate. The install itself is the harness's own.

One clarification was made at scoring time. The (b) candidates use the edge identity for edge findings and the fine
key for file-level findings (`edgeOnly: false`), because FF-P02 and FF-DT06 are file-level. Under `edgeOnly: true`
they could never be candidates. The count is 0 under either reading.
