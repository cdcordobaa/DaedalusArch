# v1.5 final study, lane A (DDD): run record

Pre-registration: `Docs/v1.5/final-study-preregistration.md` (REGISTERED 2026-10-29), run at `main`
`a228c3f9408f0f1b3cbbbe16e5d2e4858d75ddb1`. Runbook: `experiments/v15-study/RUNBOOK.md` §2 with `PH=lane-a`, `R=3`,
`TASKS=t01,…,t12`. Arms `none` and `combined`, 12 DDD tasks × 2 arms × 3 replicates = 72 sessions, 216 step turns.
This file records how the run went. It reports **no outcome, contrast, p value or effect size**: those come once,
later, from `scripts/v1.5/final-study-analyse.ts`.

## Pre-run checks (zero calls)

- The registration header read "Status: REGISTERED 2026-10-29" on the first fetch.
- Script sha256 (first 16 hex) matched registration §9 for all five scripts: `run-study.ts` c770618bb1fd5185,
  `make-input.ts` 2d5931676940c942, `score-study.ts` cbe12bb9d6d621e3, `scripts/v1.5/final-study-analyse.ts`
  1d4bcdf7a83fac5f, its lib a57b8598f3b93a35.
- CLI `2.1.312 (Claude Code)`, equal to the §9 pin. The install is not writable by the generator (`isolation/cli-version.txt`).
- `make-input` printed: 12 tasks × 2 arms × 3 replicates = 72 sessions, 216 turns planned, caps
  `{"smoke":2,"probes":1,"sessions":229,"total":232}`. These equal the RUNBOOK table. Dry tasks: t01, t02.
- `setup-sandbox.sh`: listing all denied, sweep empty with the positive control found (91 patterns), and scripted S4
  passed on all six items (hookRelay, mcpConfinement, switchOff, combinedMechanics, noLeak, argv).
- `--dry` printed `"passed": true` on all seven items. The isolation and dry evidence were committed and pushed to this
  branch before any call.

## Calls per cap

| Cap | Used | Cap |
|---|---|---|
| Smoke | 2 (both passed) | 2 |
| READ probe | 1 (passed, 0 leaked strings) | 1 |
| Sessions | 217 | 229 |
| **Total** | **220** | **232** |

The sessions phase used 216 completed turns plus 1 call that was lost: the first turn of the interrupted session
c007, which never completed (see below).

## Turns, redraws and resumes

- 216 of 216 planned turns completed, 108 per arm (36 sessions per arm). Every turn has status `completed`, model
  `claude-sonnet-5-5`.
- **CLI version per turn: `2.1.312` on all 216 turns (all equal).** No version stop and no hub-latency stop. The
  final `state.json` has `stopped: null`.
- **1 resume, 1 redraw.**
  - *Why:* the coordinator launched `--sessions` as a background tool command, and that tool stops a command after
    2 h at most. The first 15 turns ran at about 43 s per turn, which projected the run to about 2.6 h, past that
    limit. To keep an uncontrolled kill from cutting a session at an arbitrary point, the coordinator stopped the
    driver with SIGTERM at 00:49:59Z. The stop came right after session c006 finished (18 turns, 6 sessions done)
    and before c007's first turn returned. The coordinator then relaunched `--sessions --resume` detached from the
    tool. The original command was not changed.
  - The driver handled the interruption under its rule "a session started before a restart and never finished is an
    infrastructure loss". It redrew c007 (t04, rep 0, `none`) whole as c073 (`redraws.jsonl`, reason `unfinished at
    restart`; `resumes.jsonl`, at done = 6). The redraw is an infrastructure state, not agent behaviour.
  - Cost: 1 lost call, plus the 3 redraw turns inside the cap. No other redraws. No integrity-triggered redraw. No
    session skipped.
  - This interruption is a coordinator action that the registration does not name explicitly (it names "container
    restart"). It is recorded here as a procedural note, for review as a possible §6 deviation.

## Integrity per combined session

`run/sessions/<id>.json` → `integrity`. Registered thresholds: hook coverage ≥ 95 %, fail-open ≤ 5 %, hub p95
stop at 5 s.

| Session | Task | Rep | Edits | With hook event | Coverage | Fail-open | Hub p95 (ms) | Hub max (ms) | Pull calls | Flagged |
|---|---|---|---|---|---|---|---|---|---|---|
| c002 | t11 | 0 | 9 | 8 | 0.8889 | 0 (0) | 641 | 759 | 10 | **yes**: edits with a hook event 8/9 < 95 % |
| c003 | t01 | 0 | 14 | 14 | 1 | 0 (0) | 535 | 746 | 11 | no |
| c005 | t12 | 0 | 8 | 8 | 1 | 0 (0) | 576 | 774 | 9 | no |
| c008 | t08 | 0 | 14 | 14 | 1 | 0 (0) | 674 | 831 | 9 | no |
| c009 | t07 | 0 | 6 | 6 | 1 | 0 (0) | 939 | 939 | 8 | no |
| c011 | t06 | 0 | 31 | 31 | 1 | 0 (0) | 970 | 1305 | 6 | no |
| c012 | t04 | 0 | 43 | 43 | 1 | 0 (0) | 1025 | 1137 | 7 | no |
| c014 | t05 | 0 | 12 | 12 | 1 | 0 (0) | 801 | 855 | 10 | no |
| c016 | t03 | 0 | 22 | 22 | 1 | 0 (0) | 755 | 845 | 6 | no |
| c017 | t10 | 0 | 16 | 16 | 1 | 0 (0) | 547 | 768 | 9 | no |
| c018 | t09 | 0 | 31 | 31 | 1 | 0 (0) | 752 | 921 | 8 | no |
| c022 | t02 | 0 | 10 | 10 | 1 | 0 (0) | 529 | 590 | 11 | no |
| c025 | t02 | 1 | 10 | 10 | 1 | 0 (0) | 608 | 772 | 8 | no |
| c028 | t07 | 1 | 7 | 7 | 1 | 0 (0) | 705 | 887 | 9 | no |
| c029 | t11 | 1 | 12 | 12 | 1 | 0 (0) | 679 | 775 | 9 | no |
| c030 | t10 | 1 | 17 | 17 | 1 | 0 (0) | 679 | 794 | 9 | no |
| c035 | t12 | 1 | 10 | 10 | 1 | 0 (0) | 582 | 769 | 5 | no |
| c037 | t01 | 1 | 13 | 13 | 1 | 0 (0) | 574 | 708 | 8 | no |
| c039 | t03 | 1 | 26 | 26 | 1 | 0 (0) | 860 | 946 | 12 | no |
| c042 | t08 | 1 | 14 | 14 | 1 | 0 (0) | 649 | 775 | 10 | no |
| c044 | t09 | 1 | 29 | 29 | 1 | 0 (0) | 877 | 880 | 8 | no |
| c045 | t04 | 1 | 39 | 39 | 1 | 0 (0) | 1096 | 1234 | 5 | no |
| c046 | t06 | 1 | 34 | 34 | 1 | 0 (0) | 1118 | 1406 | 11 | no |
| c048 | t05 | 1 | 12 | 12 | 1 | 0 (0) | 879 | 900 | 11 | no |
| c049 | t10 | 2 | 13 | 13 | 1 | 0 (0) | 611 | 617 | 9 | no |
| c050 | t03 | 2 | 24 | 24 | 1 | 0 (0) | 909 | 1048 | 6 | no |
| c052 | t04 | 2 | 43 | 43 | 1 | 0 (0) | 1141 | 1267 | 5 | no |
| c053 | t01 | 2 | 11 | 11 | 1 | 0 (0) | 469 | 589 | 9 | no |
| c058 | t11 | 2 | 12 | 12 | 1 | 0 (0) | 567 | 585 | 8 | no |
| c059 | t08 | 2 | 14 | 14 | 1 | 0 (0) | 594 | 646 | 9 | no |
| c060 | t12 | 2 | 9 | 9 | 1 | 0 (0) | 574 | 617 | 9 | no |
| c061 | t06 | 2 | 29 | 29 | 1 | 0 (0) | 1031 | 1071 | 8 | no |
| c062 | t02 | 2 | 11 | 11 | 1 | 0 (0) | 594 | 614 | 10 | no |
| c063 | t05 | 2 | 12 | 12 | 1 | 0 (0) | 793 | 795 | 10 | no |
| c069 | t09 | 2 | 33 | 33 | 1 | 0 (0) | 848 | 987 | 4 | no |
| c070 | t07 | 2 | 6 | 6 | 1 | 0 (0) | 586 | 649 | 8 | no |

- **1 session flagged: c002 (t11, rep 0).** It had 8 of 9 edits with a hook event. The uncovered edit was at
  step-02. Fail-open was 0, the hub was alive (`hubDeadAfter` empty) and it was not an infrastructure state, so the
  session is kept (ITT) and flagged. The registered sensitivity drops its block.
- The other 35 combined sessions had coverage 1.0 and fail-open 0.
- The highest hub p95 was 1141 ms and the highest hub max was 1406 ms, well under the 5 s stop.
- No overlay was seen. Scorer: 0 evasion candidates in any cell, 0 double reports.

## Wall time

- Total, from the first fetch (00:31:52Z) to the end of scoring (03:54:19Z): about 3 h 22 min.
- Sessions phase: 00:38:07Z to 03:21:55Z, about 2 h 44 min, including the resume.
- Scoring: 03:31:28Z to 03:54:19Z, about 23 min, with 0 model calls and 0 evaluation failures.
- Per-turn wall time from `turns.jsonl` → `wallMs`, p95 by nearest rank:

| Arm | Turns | Median (s) | p95 (s) | Max (s) |
|---|---|---|---|---|
| none | 108 | 36.3 | 61.7 | 150.0 |
| combined | 108 | 47.0 | 84.6 | 185.3 |

## Scores

`scores/scores.json` and `scores/cells.json` exist. `cells.json` holds **72 cells** (36 `none`, 36 `combined`), and
every cell has a non-null D. In `scores.json`, all 72 runs are counted and `evaluationFailures` is empty. No analysis
was run.

## Records

- `isolation/`, `dry/`, `smoke/` and `probes/`: the probe answer is stored as `<agent text omitted>`.
- `run/`: `calls.jsonl`, `turns.jsonl`, `schedule.json`, `state.json`, `redraws.jsonl`, `resumes.jsonl`, 72
  `sessions/*.json` and the hub logs for 36 combined sessions (108 files).
- `scores/` and `private-id-map.json`.
- The interrupted c007 has no `session.json`, so its partial files stay out of the records, as the RUNBOOK copy
  rule implies.
- Pre-commit checks: `grep -rl canary-` printed nothing. No file holds `costUsd`, a personal absolute path or agent
  message text.

## Anything unexpected

- The resume above was caused by the coordinator tool's 2 h background limit, not by the container or the driver.
- The scorer's console output, kept in a root-only log that is not committed, prints per-cell lines while it runs.
  The coordinator saw some of them while checking progress. No contrast or summary by arm was computed.
