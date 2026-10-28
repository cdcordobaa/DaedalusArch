# v1.5 final study, Stage 1 pilot: results

Plan: `experiments/v15-study/stage1-plan.md` (committed before any call). Run on `main` at `86b5c01e4` (contains
`f89d9fa83`), cloud container, root, 2026-10-28. Tasks `t01` (DDD) and `t13` (Hexagonal) × arms `none` / `combined` ×
1 replicate. Isolation and dry evidence were committed and pushed (`d634af790`) before the first call.

**This is a plumbing and cost check, not study data.** With n = 1 per cell it shows no effect; no D, Y or trap count
below is read as a direction. Nothing here is pooled with the study.

## Exit criteria

| # | Criterion | Result | Number |
|---|---|---|---|
| 1 | Both `combined` runs: edits with a hook event ≥ 95 %, fail-open ≤ 5 %, hub p95 < 2 s | **pass** | c003: 13/13 edits (100 %), fail-open 0, p95 492 ms (max 755); c004: 16/16 (100 %), fail-open 0, p95 400 ms (max 410) |
| 2 | One CLI version on every turn; no settings or overlay write took effect | **pass** | 12/12 turns `2.1.312`; S4 `switchOff` true; overlay seen 0 in both runs; evasion count 0 in all 4 cells |
| 3 | Double reports 0; one finding number per key across both channels | **pass** | `doubleReports` 0 (c003, c004); c003 has 1 key (number 1, push first then pull), c004 has 0 keys |
| 4 | Attribution table produced by the scorer with no hand step | **pass** | produced for c003 (1 row) and c004 (0 rows) |
| 5 | Both channels seen at least once across the pilot | **pass** | push events 40 + 25 (hub push log lines); pull calls 10 + 8 |
| 6 | All 4 runs scored end to end with no manual repair; `cells.json` with 4 cells, D not null | **pass** | 4 runs scored, `evaluationFailures` 0, `cells.json` 4 cells, D non-null in all 4 |
| 7 | Per-turn wall time per arm reported | **pass** | `scores.json` → `summary.<arm>.turnWallTime`; see below |

All exit criteria hold.

## Calls against the caps

| Phase | Cap | Used |
|---|---|---|
| Smoke | 2 | 2 (both passed: `none`; `combined` hook fired, pull answered with the same number as already reported, Stop blocked once, 0 double reports) |
| READ probe | 1 | 1 (passed, 0 leaked forbidden strings) |
| Session turns | 13 | 12 |
| **Total** | **16** | **15** |

Redraws: 0. Lost sessions: 0. Skipped: 0. Resumes: 0. Driver stop: none. All 12 turns `completed` on the first
attempt; generator model id `claude-sonnet-5-5` on every turn.

## Wall time

- CLI: `2.1.312 (Claude Code)`, install not writable by the generator.
- Total wall time from `npm ci` to the end of scoring: about 14 min. Sessions phase: 496 s (4 sessions).
- Per-turn wall time (6 turns per arm; p95 by nearest rank, which for n = 6 is the maximum):

| Arm | Median | Mean | p95 (max) |
|---|---|---|---|
| `none` | 35.2 s | 35.5 s | 42.1 s |
| `combined` | 42.2 s | 44.1 s | 68.3 s |

## Scores (n = 1 per cell; not a direction)

| Cell | Task | Arm | D | Y | trapFailed | functional | D_frozen |
|---|---|---|---|---|---|---|---|
| c001 | t13 | none | 0 | 0 | true | true | 0 |
| c002 | t01 | none | 1 | 1 | true | true | 0 |
| c003 | t01 | combined | 0 | 0 | false | true | 0 |
| c004 | t13 | combined | 0 | 0 | true | true | 0 |

## Unexpected or worth noting

- The CLI pin at run time is `2.1.312`; the design note (§5.1) records the hook format as shown on `2.1.308` only and
  asks for the gate `--dry` to be rerun on a new pin. The `--dry` of this run (real CLI, scripted API) passed on
  `2.1.312`, and both smoke and session hooks fired with 100 % coverage, so the hook path works on this pin.
- Combined per-turn wall time is higher than `none` (median +7 s, one turn at 68 s); hub latency itself stayed under
  0.8 s, so the difference is the agent's extra tool calls (pull calls, Stop blocks), not the relay.
- The pull channel was used through four tools in c004 (`get_architecture_spec` 1, `check_consistency` 3,
  `check_file` 3, `check_diff` 1).
- Nothing else unexpected: no script failure, no repair, no infrastructure flag.

## Records

`isolation/`, `dry/`, `smoke/`, `probes/`, `run/` (calls, turns, schedule, state, 4 `session.json`, hub push/calls/ledger
for c003 and c004), `scores/` (`scores.json`, `cells.json`), `private-id-map.json`. No chat text or envelopes are
committed (the runbook's canary grep over this directory prints nothing; the probe answer is stored as omitted).
