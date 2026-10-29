# v1.5 final study, lane B (Hexagonal): run record

Phase `lane-b`, tasks t13–t25 (13 confirmatory Hexagonal tasks), arms `none` and `combined`, r = 6, 3 steps per
session: 156 sessions, 468 step turns. Run at `main` `a228c3f94` (registration `Docs/v1.5/final-study-preregistration.md`,
Status REGISTERED 2026-10-29); RUNBOOK §0–§2.6 followed as written. Script sha256 (first 16 hex) checked against
registration §9 before the run: run-study.ts, make-input.ts, score-study.ts, final-study-analyse.ts and its lib all match.

No contrast, p value, effect size or D summary by arm is computed or reported here; the analysis runs once, later, by
`scripts/v1.5/final-study-analyse.ts`.

## Calls per cap

| Phase | Cap | Used |
|---|---|---|
| Smoke | 2 | 2 (both passed) |
| READ probe | 1 | 1 (passed, 0 leaked strings) |
| Sessions | 497 | 469 (468 completed turns + 1 lost in a restart) |
| **Total** | **500** | **472** |

make-input printed 13 tasks × 2 arms × 6 replicates = 156 sessions, 468 turns, caps sessions 497 / total 500,
matching the RUNBOOK table. setup-sandbox: listing denied, sweep empty (positive control present), S4 all six items
true, CLI install not writable by the generator. `--dry`: passed true (committed before any call, commit `323b5f05f`).

## Redraws and resumes

- **1 resume, 1 redraw** (`run/resumes.jsonl`, `run/redraws.jsonl`). The first `--sessions` launch was started under
  the coordinator's tool, whose background limit (2 h) would have killed the driver mid-run. The coordinator
  stopped it at 00:37Z while the first call of the first session (c001, t21 rep 0 combined, step-01) was in flight,
  and restarted it detached with `--sessions --resume`. The driver recorded that call as `lost-in-restart` and
  redrew session c001 whole as c157 (reason "unfinished at restart"). This is an infrastructure state of the
  coordinator, not agent behaviour; c001's partial hub log (`run/hub/c001.push.jsonl`) is kept, it has no
  `session.json` and is not scored.
- No other redraw, no skipped session, no stop (`state.json`: `stopped` null, `skipped` []).

## CLI version and model

`cliVersion` is 2.1.312 on all 468 turns (registration §9 pin). Every turn's `modelUsageIds` is `claude-sonnet-5-5`.
All 468 turns `completed`, 1 attempt each; skeleton intact on every turn; type-check errors 0 on every turn.

## Integrity per combined session (78)

Coverage = edits with a hook event / edits; fail-open rate; hub p95 and max (ms). Thresholds: coverage ≥ 95 %,
fail-open ≤ 5 %, hub p95 < 5 s (stop).

- Fail-open: 0 in every combined session. Hub p95 max 573 ms (median of session p95s 400 ms); no latency stop.
- **Flagged: 1 session, c008 (t13, rep 0)**: 16 of 17 edits had a hook event (coverage 0.941 < 0.95). Not an
  infrastructure state for the driver (hub alive, no fail-open), so it is kept (ITT) and flagged; `cells.json` marks
  it `flagged` for the registered sensitivity.
- Every other combined session: coverage 1.000.

| Session | Task | Rep | Edits | With hook | Coverage | Hook events | Fail-open | Fail-open rate | Hub p95 | Hub max | Pull calls | Flagged |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| c003 | t14 | 0 | 16 | 16 | 1.000 | 20 | 0 | 0.000 | 281 | 334 | 9 | false |
| c005 | t16 | 0 | 12 | 12 | 1.000 | 18 | 0 | 0.000 | 347 | 388 | 10 | false |
| c008 | t13 | 0 | 17 | 16 | 0.941 | 21 | 0 | 0.000 | 357 | 360 | 9 | true |
| c011 | t25 | 0 | 15 | 15 | 1.000 | 31 | 0 | 0.000 | 376 | 460 | 10 | false |
| c012 | t20 | 0 | 15 | 15 | 1.000 | 23 | 0 | 0.000 | 478 | 479 | 10 | false |
| c014 | t23 | 0 | 25 | 25 | 1.000 | 57 | 0 | 0.000 | 446 | 583 | 12 | false |
| c015 | t24 | 0 | 18 | 18 | 1.000 | 39 | 0 | 0.000 | 500 | 517 | 9 | false |
| c018 | t15 | 0 | 14 | 14 | 1.000 | 27 | 0 | 0.000 | 307 | 326 | 9 | false |
| c020 | t22 | 0 | 16 | 16 | 1.000 | 26 | 0 | 0.000 | 508 | 511 | 7 | false |
| c022 | t17 | 0 | 12 | 12 | 1.000 | 23 | 0 | 0.000 | 315 | 321 | 7 | false |
| c023 | t19 | 0 | 21 | 21 | 1.000 | 41 | 0 | 0.000 | 476 | 497 | 15 | false |
| c025 | t18 | 0 | 23 | 23 | 1.000 | 64 | 0 | 0.000 | 541 | 605 | 12 | false |
| c027 | t14 | 1 | 14 | 14 | 1.000 | 16 | 0 | 0.000 | 272 | 339 | 11 | false |
| c028 | t23 | 1 | 22 | 22 | 1.000 | 48 | 0 | 0.000 | 400 | 431 | 11 | false |
| c030 | t25 | 1 | 15 | 15 | 1.000 | 31 | 0 | 0.000 | 381 | 406 | 9 | false |
| c033 | t22 | 1 | 17 | 17 | 1.000 | 30 | 0 | 0.000 | 456 | 486 | 8 | false |
| c034 | t18 | 1 | 17 | 17 | 1.000 | 39 | 0 | 0.000 | 449 | 497 | 7 | false |
| c035 | t20 | 1 | 17 | 17 | 1.000 | 22 | 0 | 0.000 | 455 | 494 | 10 | false |
| c041 | t19 | 1 | 21 | 21 | 1.000 | 50 | 0 | 0.000 | 506 | 538 | 14 | false |
| c042 | t24 | 1 | 12 | 12 | 1.000 | 31 | 0 | 0.000 | 450 | 518 | 8 | false |
| c043 | t13 | 1 | 14 | 14 | 1.000 | 23 | 0 | 0.000 | 259 | 289 | 11 | false |
| c044 | t17 | 1 | 12 | 12 | 1.000 | 24 | 0 | 0.000 | 315 | 344 | 9 | false |
| c045 | t16 | 1 | 14 | 14 | 1.000 | 19 | 0 | 0.000 | 263 | 293 | 7 | false |
| c046 | t15 | 1 | 15 | 15 | 1.000 | 26 | 0 | 0.000 | 330 | 336 | 10 | false |
| c049 | t21 | 1 | 14 | 14 | 1.000 | 20 | 0 | 0.000 | 314 | 405 | 9 | false |
| c054 | t25 | 2 | 15 | 15 | 1.000 | 31 | 0 | 0.000 | 375 | 424 | 13 | false |
| c057 | t20 | 2 | 15 | 15 | 1.000 | 26 | 0 | 0.000 | 493 | 529 | 12 | false |
| c059 | t17 | 2 | 12 | 12 | 1.000 | 22 | 0 | 0.000 | 334 | 367 | 9 | false |
| c061 | t13 | 2 | 14 | 14 | 1.000 | 21 | 0 | 0.000 | 276 | 293 | 11 | false |
| c063 | t14 | 2 | 16 | 16 | 1.000 | 21 | 0 | 0.000 | 285 | 309 | 10 | false |
| c065 | t24 | 2 | 12 | 12 | 1.000 | 30 | 0 | 0.000 | 431 | 458 | 7 | false |
| c067 | t16 | 2 | 15 | 15 | 1.000 | 20 | 0 | 0.000 | 256 | 257 | 8 | false |
| c068 | t22 | 2 | 16 | 16 | 1.000 | 29 | 0 | 0.000 | 511 | 547 | 8 | false |
| c069 | t23 | 2 | 22 | 22 | 1.000 | 49 | 0 | 0.000 | 420 | 460 | 7 | false |
| c071 | t21 | 2 | 14 | 14 | 1.000 | 20 | 0 | 0.000 | 306 | 398 | 8 | false |
| c072 | t15 | 2 | 12 | 12 | 1.000 | 22 | 0 | 0.000 | 292 | 294 | 9 | false |
| c073 | t19 | 2 | 26 | 26 | 1.000 | 45 | 0 | 0.000 | 526 | 608 | 16 | false |
| c077 | t18 | 2 | 22 | 22 | 1.000 | 41 | 0 | 0.000 | 496 | 558 | 12 | false |
| c079 | t21 | 3 | 14 | 14 | 1.000 | 21 | 0 | 0.000 | 296 | 303 | 9 | false |
| c081 | t17 | 3 | 12 | 12 | 1.000 | 22 | 0 | 0.000 | 325 | 342 | 8 | false |
| c082 | t16 | 3 | 12 | 12 | 1.000 | 19 | 0 | 0.000 | 270 | 433 | 7 | false |
| c083 | t13 | 3 | 13 | 13 | 1.000 | 20 | 0 | 0.000 | 339 | 383 | 12 | false |
| c085 | t22 | 3 | 17 | 17 | 1.000 | 30 | 0 | 0.000 | 528 | 563 | 9 | false |
| c086 | t19 | 3 | 23 | 23 | 1.000 | 66 | 0 | 0.000 | 516 | 579 | 10 | false |
| c088 | t24 | 3 | 21 | 21 | 1.000 | 46 | 0 | 0.000 | 514 | 660 | 10 | false |
| c095 | t18 | 3 | 20 | 20 | 1.000 | 36 | 0 | 0.000 | 498 | 513 | 10 | false |
| c097 | t25 | 3 | 15 | 15 | 1.000 | 31 | 0 | 0.000 | 385 | 421 | 8 | false |
| c100 | t23 | 3 | 21 | 21 | 1.000 | 50 | 0 | 0.000 | 413 | 445 | 9 | false |
| c101 | t14 | 3 | 16 | 16 | 1.000 | 21 | 0 | 0.000 | 274 | 274 | 11 | false |
| c102 | t20 | 3 | 14 | 14 | 1.000 | 30 | 0 | 0.000 | 513 | 587 | 13 | false |
| c103 | t15 | 3 | 15 | 15 | 1.000 | 30 | 0 | 0.000 | 361 | 392 | 8 | false |
| c105 | t13 | 4 | 13 | 13 | 1.000 | 20 | 0 | 0.000 | 303 | 305 | 9 | false |
| c108 | t20 | 4 | 14 | 14 | 1.000 | 20 | 0 | 0.000 | 453 | 458 | 11 | false |
| c109 | t19 | 4 | 27 | 27 | 1.000 | 40 | 0 | 0.000 | 532 | 548 | 13 | false |
| c110 | t24 | 4 | 18 | 18 | 1.000 | 35 | 0 | 0.000 | 462 | 487 | 9 | false |
| c111 | t25 | 4 | 15 | 15 | 1.000 | 31 | 0 | 0.000 | 413 | 436 | 11 | false |
| c117 | t23 | 4 | 24 | 24 | 1.000 | 49 | 0 | 0.000 | 455 | 526 | 12 | false |
| c120 | t17 | 4 | 12 | 12 | 1.000 | 23 | 0 | 0.000 | 339 | 344 | 8 | false |
| c121 | t18 | 4 | 24 | 24 | 1.000 | 41 | 0 | 0.000 | 505 | 617 | 9 | false |
| c122 | t16 | 4 | 14 | 14 | 1.000 | 20 | 0 | 0.000 | 267 | 302 | 7 | false |
| c123 | t15 | 4 | 16 | 16 | 1.000 | 32 | 0 | 0.000 | 331 | 401 | 10 | false |
| c124 | t21 | 4 | 14 | 14 | 1.000 | 22 | 0 | 0.000 | 315 | 316 | 10 | false |
| c127 | t14 | 4 | 16 | 16 | 1.000 | 20 | 0 | 0.000 | 330 | 365 | 10 | false |
| c128 | t22 | 4 | 16 | 16 | 1.000 | 26 | 0 | 0.000 | 573 | 591 | 6 | false |
| c131 | t17 | 5 | 12 | 12 | 1.000 | 21 | 0 | 0.000 | 314 | 316 | 9 | false |
| c132 | t25 | 5 | 15 | 15 | 1.000 | 31 | 0 | 0.000 | 411 | 475 | 13 | false |
| c133 | t18 | 5 | 19 | 19 | 1.000 | 42 | 0 | 0.000 | 528 | 561 | 8 | false |
| c134 | t22 | 5 | 17 | 17 | 1.000 | 28 | 0 | 0.000 | 557 | 604 | 7 | false |
| c136 | t24 | 5 | 15 | 15 | 1.000 | 33 | 0 | 0.000 | 492 | 587 | 9 | false |
| c140 | t19 | 5 | 25 | 25 | 1.000 | 54 | 0 | 0.000 | 556 | 657 | 11 | false |
| c142 | t14 | 5 | 16 | 16 | 1.000 | 20 | 0 | 0.000 | 305 | 312 | 12 | false |
| c143 | t23 | 5 | 21 | 21 | 1.000 | 51 | 0 | 0.000 | 434 | 494 | 12 | false |
| c147 | t13 | 5 | 13 | 13 | 1.000 | 20 | 0 | 0.000 | 287 | 301 | 13 | false |
| c149 | t16 | 5 | 13 | 13 | 1.000 | 17 | 0 | 0.000 | 257 | 271 | 7 | false |
| c151 | t15 | 5 | 14 | 14 | 1.000 | 26 | 0 | 0.000 | 353 | 355 | 6 | false |
| c154 | t20 | 5 | 14 | 14 | 1.000 | 21 | 0 | 0.000 | 457 | 473 | 14 | false |
| c155 | t21 | 5 | 14 | 14 | 1.000 | 21 | 0 | 0.000 | 386 | 419 | 9 | false |
| c157 | t21 | 0 | 14 | 14 | 1.000 | 22 | 0 | 0.000 | 407 | 414 | 6 | false |

## Wall time

- Setup, dry, smoke and probe: 00:32Z–00:36Z.
- Sessions: 00:36:22Z (first launch) – 05:56:44Z: 5 h 20 min.
- Scoring (`score-study.ts`): 05:57Z–06:36Z.
- Per-turn wall time (`turns.jsonl` → `wallMs`, 234 turns per arm):

| Arm | Mean (s) | Median (s) | p90 (s) | Max (s) |
|---|---|---|---|---|
| `none` | 34.9 | 33.2 | 45.4 | 202.8 |
| `combined` | 45.2 | 40.5 | 68.1 | 137.1 |

## Scores

`scores/scores.json` and `scores/cells.json` exist; `cells.json` holds 156 cells (13 tasks × 2 arms × 6 replicates),
none with `D` null; 1 cell flagged (c008).

## Checks before commit

No file under this directory contains a spend field, a canary (the RUNBOOK §3 canary grep prints nothing), a personal absolute
path or agent message text (the probe's answer is stored as `<agent text omitted>`; the only `message` field is the
dry run's stub version-mismatch check). The private id map is committed after generation, as the RUNBOOK says.

## Anything unexpected

- The coordinator's restart described above (one call lost, one session redrawn).
- Nothing else: no harness error, no hub socket loss, no version change.
