# SEM-2 run (exploratory): hxpb1 / hxpb2, deferred R-MIRROR-SEM, instrument v1.5.10, 10 replicates

Run on 2026-11-04 in a cloud container, following `experiments/sem-gate-2/AGENT-RUN-PLAN.md` §2 and §7 (unchanged)
and `experiments/v15-study/RUNBOOK.md` §0–§2 with `--study-set experiments/sem-gate-2/study-set.json`, after the
confirmation pilot (`../sem2-pilot2/`: G1, G2, G3 and G5 hold). **Exploratory, not confirmatory**: no registered study
is touched, no counted rule list changes, R-MIRROR-SEM stays uncounted, no hypothesis test is claimed. Neither pilot is
pooled into these numbers.

## Setup

| Item | Value |
|---|---|
| Code commit | `c48fdc570` (`origin/sem2/run-v1510`: main `64b43fc31` plus the §7 addendum) |
| Instrument | `v1.5.10` (`INSTRUMENT_ID`; scores.json `instrumentId` v1.5.10) |
| CLI | `2.1.318`, unchanged from the confirmation pilot and across all 120 turns (the first pilot ran on `2.1.316`) |
| Generator | `claude-sonnet-5-5` (every turn's `modelUsageIds`) |
| Judge | `claude-opus-5-5` through the existing CLI judge route, hub `DAEDALUS_MIRROR_SEM=deferred` (`combined` arm only); scorer `DAEDALUS_MIRROR_SEM=replay` (0 calls) |
| Plan | make-input: 2 tasks × 2 arms × 10 replicates = 40 sessions, 120 turns; caps sessions 128 / total 131 |
| Sandbox / dry | isolation listing denied, sweep empty, scripted S4 clean; dry `"passed": true`, committed and pushed in `ccb0f1d3f` before any call |
| Smoke / probes | both passed (2 calls + 1 call) |
| Sessions | 40 / 40 done, 120 / 120 turns completed (1 attempt each), 0 redraws, 0 resumes, no stop (`run/state.json`) |
| Generator calls | 123 in total (smoke 2, probes 1, sessions 120) |
| Wall time | sessions 19:15:31Z to 20:25:47Z (about 70 min); summed turn wall time 4,068 s |

## Trap at the final step (task oracle, rule-blind)

| Task | Arm | Sessions with the trap | Exact 95 % interval (Clopper–Pearson) |
|---|---|---|---|
| t01 (hxpb1-pottery-kiln) | none | 7 / 10 | 0.35–0.93 |
| t01 | combined | 0 / 10 | 0.00–0.31 |
| t02 (hxpb2-translation-portal) | none | 10 / 10 | 0.69–1.00 |
| t02 | combined | 0 / 10 | 0.00–0.31 |
| both | none | 17 / 20 | 0.62–0.97 |
| both | combined | 0 / 20 | 0.00–0.17 |

Every session is functional on the final step (all task tests pass). D = 0 and Y = 0 in every session; 0 evasion
candidates; D_frozen 0. Exploratory rows new against the seed (R-MIRROR, R-MIRROR2) appear on the final tree of 5
`none` sessions (c002, c010, c021, c028, c037) and of no `combined` session.

## R-MIRROR-SEM (hub ledgers, `combined` arm)

- Fired in 13 of 20 `combined` sessions (t01 5 / 10, t02 8 / 10); one finding per firing session, 0 in the other 7.
- First exposure: by push in 12 sessions, on the session's 3rd to 7th push (median 4th), always in step 1; by pull
  in 1 session (c040, `check_consistency`, hub sequence 4).
- Removal: in all 13 the finding was resolved within step 1 (hub sequence 8 to 13; 12 resolved as seen by push, 1 by
  pull), none came back, and none is on the final tree. The scorer finds no R-MIRROR-SEM finding on any step
  snapshot.
- Citation check (SEM-GATE criterion-3 text checks) on the 13 `yes` answers behind the firings: 0 file:line or
  "line N" citations; quoted tokens in 2 answers, all vendor or field names. The trees at the firing moments are not
  snapshotted (the copy appeared and went within step 1), so the evidence-site check could not be run on them.

## Judge and hub

| Item | Value |
|---|---|
| Judge calls (ledger lines in `run/hub/*.mirror-sem.jsonl`) | 81, 0 failed, 0 retries |
| Calls per `combined` session | mean 4.05, range 2–7 |
| Answers (disk cache, both phases of this container) | 13 `yes` in the run (the 13 firings); answer text not committed |
| Hub push-check latency | pooled over 370 checks: p95 767 ms, max 922 ms; per-session p95 552–923 ms |

## Integrity

- 1 integrity flag: c035 (t01, rep 8, `combined`): edits with a hook event 9 / 11 (0.82 < 0.95). Two step-3 files
  (an outbound adapter and a domain model file) had no hook event. Fail-open 0, hub alive. The driver recorded it as
  flagged, not infrastructure, so the session was not redrawn (the redraw rule covers infrastructure only). It is kept
  in the counts above (trap 0); without it, t01 `combined` is 0 / 9.
- Delivery audit (`--require-delivery-audit`): present in all 20 `combined` sessions, 0 mismatches, 0
  counted-not-delivered.
- Every other `combined` session: hook-event coverage ≥ 0.95, fail-open 0, hub alive.

## Unexpected

- The CLI version is `2.1.318` against `2.1.316` in the first pilot (constant across the confirmation pilot and the run).
- The c035 coverage flag (above). The confirmation pilot had none.
- c040: the ledger records R-MIRROR-SEM first exposed on the pull channel at hub sequence 4 and resolved by pull at
  sequence 10, but neither sequence number has a line in `c040.push.jsonl` or `c040.calls.jsonl`. For the other 12
  firings, the ledger's first and resolving sequences match the push log lines (the finding is in that line's
  `pushed` and `resolved` lists). Not investigated further here.

## Files

`isolation/`, `dry/`, `smoke/`, `probes/`, `run/` (calls, turns, schedule, state, `sessions/*.json`, `hub/` push,
calls, ledgers and judge ledgers), `scores/` (scores.json, cells.json), `sessions/` (every session's step trees, from
`--keep-trees`), `private-id-map.json`.
