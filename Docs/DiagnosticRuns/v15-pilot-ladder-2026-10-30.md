# v1.5 TRAP-PILOT-v2 difficulty ladder, arm `none`

**Result: the trap rate rises with the level (L1 0/12, L2 4/12, L3 7/12). Three of the six tasks have a level in the
band** (trap rate 0.4–0.8, functional ≥ 0.8): p1 at L2, p3 at L3 and p4 at L2. p2 and p5 never trapped at any level.
p6 trapped every time at both L2 and L3, which is above the band. With two runs per cell the only rate inside the band
is 1/2, so these choices are a coarse screen, not an estimate.

This is pilot calibration on pilot tasks. It is not a registered study, it is not study data, and it changes nothing
frozen.

- **Tasks:** `experiments/trap-pilot-v2/` (PR 433): six Hexagonal tasks, each at L1 (no levers), L2 (levers a, b) and
  L3 (levers a–f).
- **Runner:** `experiments/v15-study/` with the pilot option (PR 435; RUNBOOK §4): `make-input.ts --task-root
  experiments/trap-pilot-v2 --arms none --runs 2`, `run-study.ts --local`, and the rule-blind `score-pilot.ts`.
- **Records:** `results/v1.5-pilot-ladder/` (every session's step snapshots, prompts, `session.json`, the call and
  turn jsonl, scores, summary).
- **Run:** 2026-10-29, 22:37Z to 23:33Z.

## 1. Configuration

| Item | Value |
|---|---|
| Generator | `claude-sonnet-5-5` through the Claude Code CLI 2.1.312, with the v1.5 study's frozen argv and the baseline frame (arm `none`) |
| Plan | 18 variants × 1 arm × 2 runs = 36 sessions, 3 steps each, so 108 turns. Seeded order 20261029, replicate round by round. Each session ran from the variant's seed |
| Caps | smoke 1, probes 1, sessions 115, total 117 |
| Environment | The author's machine, run as the current user (`--local`). There was no generator user, so the listing check and the fingerprint sweep did not run. Confinement relied on the CLI's frozen argv; the READ probe was denied on all 4 paths and leaked 0 forbidden strings |
| Scoring | Zero calls. `trapFailed`: any oracle sub-goal fails on the final tree. `functional`: every behaviour-test case passes on the final tree (regression and feature cases). The v1.5 rules were not run (the calibration is rule-blind) |

## 2. Calls and turns

110 calls in total, against a cap of 117: 1 smoke, 1 READ probe and 108 session turns. All 108 turns completed on
the first attempt, and every turn reported `claude-sonnet-5-5` only. The skeleton was intact after every turn and
there were 0 harness type-check errors. There were no redraws, no resumes and no stop. The median turn took 31 s and
the longest 57 s.

## 3. Per variant (2 runs each)

| Task | L1 trap | L1 functional | L2 trap | L2 functional | L3 trap | L3 functional | Level in band |
|---|---|---|---|---|---|---|---|
| p1-campsite-payments | 0/2 | 2/2 | 1/2 | 2/2 | 2/2 | 2/2 | **L2** |
| p2-bookshop-metadata | 0/2 | 2/2 | 0/2 | 2/2 | 0/2 | 2/2 | none (nearest L3, still 0/2) |
| p3-florist-tracking | 0/2 | **0/2 flag** | 0/2 | **0/2 flag** | 1/2 | 2/2 | **L3** |
| p4-dental-calendar | 0/2 | **1/2 flag** | 1/2 | 2/2 | 2/2 (lever e, see §5) | 2/2 | **L2** |
| p5-allotment-letters | 0/2 | 2/2 | 0/2 | 2/2 | 0/2 | **0/2 flag** | none (no level trapped) |
| p6-museum-entry | 0/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | none (nearest L2: 2/2, above the band) |

Per-session results (oracle at each step, case counts, oracle evidence) are in `results/v1.5-pilot-ladder/summary.md`
and `scores/pilot-scores.json`. Wherever a trap appeared, the oracle already failed after step 1, and it never
recovered in a later step.

## 4. Per level (12 runs each, 95 % Wilson intervals)

| Level | Trap failed | Trap rate | Functional | Functional rate |
|---|---|---|---|---|
| L1 | 0/12 | 0.00 [0.00, 0.24] | 9/12 | 0.75 [0.47, 0.91] |
| L2 | 4/12 | 0.33 [0.14, 0.61] | 10/12 | 0.83 [0.55, 0.95] |
| L3 | 7/12 | 0.58 [0.32, 0.81] | 10/12 | 0.83 [0.55, 0.95] |

If one level had to serve all six tasks, L3 is the only one whose pooled rates fall inside the band (0.58 and 0.83).
That pooled figure hides what happens per task: L3 sits at 2/2 on p1, p4 and p6, and at 0/2 on p2 and p5.

## 5. Hand-reading

**Trap failures.** All 11 oracle failures were read by hand, and each one stands on at least one item the shortcut
explains:
- p1: the booking service compares vendor statuses (`requires_capture`, and at L3 also `requires_action` and
  `canceled`).
- p3 L3: the core holds a one-to-one copy of the six vendor tracking statuses.
- p4 L2: the service compares `CalendarRefused.detail === 'SLOT_TAKEN'` / `'RATE_LIMITED'`, and the core error carries
  `retryAfterSec`.
- p6: the core errors gain a `statusCode` field with 400, 409 or 503.

**Lever (e), p4 L3 (both runs, marked).** The service's results also render `code: 'SLOT_TAKEN'` /
`'RATE_LIMITED'`, which are the words the tests ask for. These lines are the lever-(e) pattern that README §Notes
says must be hand-read. Both cells still fail on independent items: the comparisons on `detail` in one run, the core
error classes built from the vendor codes in the other, and `retryAfterSec` in both. So the trap-failed count for
p4 L3 does not depend on the lever-(e) lines. **p2 has no lever-(e) cell**, because no p2 tree failed the oracle.

**Functional failures (flags).**
- **p3 L1 and L2, all 4 runs.** The test calls `app.cancel(orderId)`. The agents implemented cancelling in the
  service and the HTTP controller but did not add `cancel` to the `createApp` facade, so the test finds
  `app.cancel is not a function`.
- **p5 L3, both runs.** Same pattern: `app.remind is not a function`.
- **p4 L1, one run.** The answers carry an extra `slotId` field, and the test's strict `deepEqual` rejects it.

The step texts do not name the facade method. These failures say more about the variants' test surface than about
task difficulty, and they hide the trap rate of p5 L3 (0/2 either way). Before these variants are reused, the step
text (or the seed's facade pattern) should make the expected entry point findable.

## 6. Choice per task (criterion: trap rate 0.4–0.8 and functional ≥ 0.8)

| Task | Choice | Why |
|---|---|---|
| p1-campsite-payments | **L2** | 1/2 trap, 2/2 functional. L3 is above the band (2/2) |
| p2-bookshop-metadata | **none fits**; nearest L3 | 0/2 at every level. Stronger levers are needed (README notes lever a is weak in p2) |
| p3-florist-tracking | **L3** | 1/2 trap, 2/2 functional. L1 and L2 fail the functional criterion (facade, §5) |
| p4-dental-calendar | **L2** | 1/2 trap, 2/2 functional. L3 is above the band (2/2, lever-(e) lines present but not decisive) |
| p5-allotment-letters | **none fits**; no nearest | 0/2 trap at every level, and L3 fails functionally (facade, §5) |
| p6-museum-entry | **none fits**; nearest L2 | 2/2 at L2 and L3, above the band. A level between L1 and L2 (one lever) is the next thing to try |

## 7. Limits

- n = 2 per cell, so a cell's rate can only be 0, 0.5 or 1, and 1/2 is the only value inside the band. A second
  round would be needed before any level is fixed for a study task.
- The run was local, as the current user. There was no generator user and no fingerprint sweep. The READ probe shows
  that the CLI denied reads outside the cell, but this is weaker isolation than the study's sandbox.
- The oracle limits stated in `experiments/trap-pilot-v2/lib/pilot-oracle.ts` apply (pass-through `any`, codes
  rebuilt from pieces, value sets of a different size are not seen). Passing trees were not hand-read.
