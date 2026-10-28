# TRAPRATE-01 scores (arm `none`, exploratory task screening, not v1.5 study data)

Scored by `experiments/traprate-01/score-traprate.ts` with zero model calls, reusing the final-study scorer
(`experiments/v15-study/score-study.ts`, `scoreSessionSteps`) on every snapshot. Plan: `experiments/traprate-01/plan.md` §4.

Instrument commit: `4309c643102d9fffe56dce6874c113d60810474d`. Sessions scored: 50 (complete: 50). Frozen evaluation failures: 0.

Snapshot restoration: the committed snapshots lack every directory named `out/` (the repository `.gitignore` build-output rule matched `application/ports/out/` and `adapters/out/` under `results/`). The scorer rebuilds each snapshot from the committed step-00, the task seed and the committed step diffs, and checks every rebuilt tree against the tree sha256 the driver recorded (the seed pin without the skeleton `package.json` the cell adds): 200 trees verified over 50 sessions (seed files restored in 22 sessions).

Definitions:

- **trapFailed**: an oracle sub-goal fails on the final step (step-03), whatever the tests do.
- **trapped** (plan §4): every test passes and at least one sub-goal fails on the final step. **clean**: every test and every sub-goal passes.
- **functional**: every behaviour test passes on the final step.
- **D** (pre-registration D_v15): admitted-rule identities (rule + file + subject) present at a step and absent from the seed and every earlier step, summed over the 3 steps; renames carried.
- **D_frozen**: the frozen v1.4 import-level instrument's D (Study 2b parameters, check-correct `correct` only, seed as step 1).
- **step violation probability**: share of task steps whose D_v15 contribution is at least 1 (at least one new admitted identity at that step).
- **graph vs imports**: of the trapped runs, the share with D_frozen > 0 (frozen import-level instrument flags) and with D > 0 (admitted graph rules flag).

Task set note: the plan listed f19-hex-school-canteen (t25) as exploratory; `study-set.json` on main (2026-10-28) moved it to confirmatory after H03 was admitted. The Hexagonal rows below include it (13 tasks, 26 runs); the "Hexagonal without f19" row is the plan's 12-task pool. The task tests, oracles and seeds are unchanged since the run; only the clean references of f19 and f24 changed.

## Per style

| Style | Runs | trapFailed | Share (Wilson 95%) | Trapped (plan §4) | Share (Wilson 95%) | Functional | Share | Clean | Mean D | Mean D_frozen | Steps with new admitted identity | Step violation probability |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DDD | 24 | 21 | 0.875 [0.69, 0.957] | 17 | 0.708 [0.508, 0.851] | 19 | 0.792 | 2 | 2.167 | 0.083 | 24 of 72 | 0.333 |
| Hexagonal | 26 | 8 | 0.308 [0.165, 0.5] | 5 | 0.192 [0.085, 0.379] | 22 | 0.846 | 17 | 0.154 | 0.077 | 4 of 78 | 0.051 |
| Hexagonal without f19 | 24 | 8 | 0.333 [0.18, 0.533] | 5 | 0.208 [0.092, 0.405] | 20 | 0.833 | 15 | 0.083 | 0.083 | 2 of 72 | 0.028 |
| All | 50 | 29 | 0.58 [0.442, 0.706] | 22 | 0.44 [0.312, 0.577] | 41 | 0.82 | 19 | 1.12 | 0.08 | 28 of 150 | 0.187 |

Plan §5 check (trapped, plan §4 definition, Wilson 95% upper bound below 0.30 = stop and report):

- DDD: upper bound 0.851, not below 0.30 (stop rule not met).
- Hexagonal: upper bound 0.379, not below 0.30 (stop rule not met).
- Hexagonal without f19: upper bound 0.405, not below 0.30 (stop rule not met).

## Graph rules vs the frozen import-level instrument

| Style | Runs in set | Frozen flags (D_frozen > 0) | Share | Graph flags (D > 0) | Share | Both | Graph only | Frozen only | Neither |
|---|---|---|---|---|---|---|---|---|---|
| DDD, trapped | 17 | 1 | 0.059 | 11 | 0.647 | 1 | 10 | 0 | 6 |
| DDD, trapFailed | 21 | 1 | 0.048 | 15 | 0.714 | 1 | 14 | 0 | 6 |
| DDD, all | 24 | 2 | 0.083 | 16 | 0.667 | 2 | 14 | 0 | 8 |
| Hexagonal, trapped | 5 | 2 | 0.4 | 2 | 0.4 | 2 | 0 | 0 | 3 |
| Hexagonal, trapFailed | 8 | 2 | 0.25 | 2 | 0.25 | 2 | 0 | 0 | 6 |
| Hexagonal, all | 26 | 2 | 0.077 | 4 | 0.154 | 2 | 2 | 0 | 22 |
| Hexagonal without f19, trapped | 5 | 2 | 0.4 | 2 | 0.4 | 2 | 0 | 0 | 3 |
| Hexagonal without f19, trapFailed | 8 | 2 | 0.25 | 2 | 0.25 | 2 | 0 | 0 | 6 |
| Hexagonal without f19, all | 24 | 2 | 0.083 | 2 | 0.083 | 2 | 0 | 0 | 22 |
| All, trapped | 22 | 3 | 0.136 | 13 | 0.591 | 3 | 10 | 0 | 9 |
| All, trapFailed | 29 | 3 | 0.103 | 17 | 0.586 | 3 | 14 | 0 | 12 |
| All, all | 50 | 4 | 0.08 | 20 | 0.4 | 4 | 16 | 0 | 30 |

## Per task

| Id | Task | Style | Runs | trapFailed | Trapped (plan §4) | Functional | Clean | Mean D | Mean D_frozen |
|---|---|---|---|---|---|---|---|---|---|
| t01 | f1-ddd-two-aggregates | ddd | 2 | 2 | 2 | 2 | 0 | 1 | 0 |
| t02 | f4-ddd-gym-classes | ddd | 2 | 2 | 2 | 2 | 0 | 2 | 0 |
| t03 | f5-ddd-parking | ddd | 2 | 2 | 2 | 2 | 0 | 9 | 0 |
| t04 | f9-ddd-auctions | ddd | 2 | 2 | 2 | 2 | 0 | 2 | 0 |
| t05 | f10-ddd-crowdfunding | ddd | 2 | 2 | 2 | 2 | 0 | 0 | 0 |
| t06 | f11-ddd-marina | ddd | 2 | 1 | 1 | 1 | 0 | 9 | 1 |
| t07 | f12-ddd-farmers-market | ddd | 2 | 2 | 2 | 2 | 0 | 0 | 0 |
| t08 | f13-ddd-bike-repairs | ddd | 2 | 2 | 0 | 0 | 0 | 1 | 0 |
| t09 | f25-ddd-ski-resort | ddd | 2 | 2 | 2 | 2 | 0 | 0 | 0 |
| t10 | f26-ddd-brewery | ddd | 2 | 2 | 0 | 0 | 0 | 1 | 0 |
| t11 | f27-ddd-language-school | ddd | 2 | 0 | 0 | 2 | 2 | 0 | 0 |
| t12 | f28-ddd-seed-library | ddd | 2 | 2 | 2 | 2 | 0 | 1 | 0 |
| t13 | f2-hex-vendor-port | hexagonal | 2 | 2 | 2 | 2 | 0 | 0 | 0 |
| t14 | f14-hex-geocoding | hexagonal | 2 | 2 | 1 | 1 | 0 | 0 | 0 |
| t15 | f15-hex-sms | hexagonal | 2 | 0 | 0 | 2 | 2 | 0 | 0 |
| t16 | f16-hex-fx-rates | hexagonal | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| t17 | f17-hex-ride-pooling | hexagonal | 2 | 0 | 0 | 2 | 2 | 0 | 0 |
| t18 | f18-hex-pet-adoption | hexagonal | 2 | 0 | 0 | 2 | 2 | 0 | 0 |
| t19 | f20-hex-music-lessons | hexagonal | 2 | 0 | 0 | 1 | 1 | 0 | 0 |
| t20 | f21-hex-blood-bank | hexagonal | 2 | 0 | 0 | 2 | 2 | 0 | 0 |
| t21 | f22-hex-airport-lounge | hexagonal | 2 | 0 | 0 | 2 | 2 | 0 | 0 |
| t22 | f23-hex-e-signature | hexagonal | 2 | 0 | 0 | 2 | 2 | 0 | 0 |
| t23 | f24-hex-laundry-lockers | hexagonal | 2 | 2 | 2 | 2 | 0 | 1 | 1 |
| t24 | f29-hex-courier-dispatch | hexagonal | 2 | 0 | 0 | 2 | 2 | 0 | 0 |
| t25 | f19-hex-school-canteen | hexagonal | 2 | 0 | 0 | 2 | 2 | 1 | 0 |

## Tasks that may be unsolvable as written (functional 0 of 2)

- t08 f13-ddd-bike-repairs (ddd): functional 0 of 2; to be read by hand before the registration (plan §5).
- t10 f26-ddd-brewery (ddd): functional 0 of 2; to be read by hand before the registration (plan §5).
- t16 f16-hex-fx-rates (hexagonal): functional 0 of 2; to be read by hand before the registration (plan §5).

Every oracle FAIL is a candidate for the hand read of plan §4; the counts above are provisional until that read. Per-session and per-step detail: `sessions.json`.

