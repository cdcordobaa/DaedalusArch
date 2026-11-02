# v1.5 Hexagonal study: main run (registered study)

Pre-registration `Docs/v1.5/hexagonal-study-preregistration.md` (REGISTERED 2026-10-30; DEV-HX-1, DEV-HX-2; §9.2
filled 2026-11-02). Runbook `experiments/v15-study/RUNBOOK.md` §2, PH=hx-study, R=10. Neither was changed.

## Setup

| Item | Value |
|---|---|
| `main` HEAD (branch base) | `0916986d6a66fcded86571c120c552a86069c450` (merge of PR 470, the §9.2 addendum) |
| Seal | `verify-seal.sh`: ok, root `db7347acf8106989`, 752 files |
| §9.1 script hashes | all 12 match (first 16 hex) |
| Rules root | `098d67bd4fdc97c5`, 45 of 45 OK (`experiments/hcal-07/RULES-FROZEN.sha256`) |
| CLI version | 2.1.316 (equal to the pilot run 2 pin; every turn record carries it) |
| make-input | 11 tasks × 2 arms × 10 replicates = 220 sessions, 660 turns; caps sessions 700, total 703 |
| setup-sandbox | `sh experiments/v15-study/setup-sandbox.sh 10 --study-set experiments/hx-study-set/study-set.json --phase hx-study --results-dir results/v1.5-hx-study/hx-study`; listing denied, sweep empty, S4 passed (`isolation/`) |
| `--dry` | passed; `isolation/` and `dry/` committed and pushed before any call (commit `9cd50f82a`) |
| `--smoke` / `--probes` | passed, 2 + 1 calls (READ probe: 0 leaked strings) |
| Sessions | `DAEDALUS_MIRROR_SEM=off nohup npx tsx experiments/v15-study/run-study.ts --sessions --input /srv/o/hx-study/input.json > /srv/o/hx-study/sessions.log 2>&1 &`, started 05:49:16Z, ended on its own 12:52:56Z (`stopped: null`) |
| Calls | smoke 2, probes 1, sessions 660 = **663 of 703** (sessions cap 700: 660 used) |
| Turns per arm | none 330, combined 330 (all 660 `completed`) |
| Redraws / resumes | 0 / 0 |
| Hub judge calls | 0 (`DAEDALUS_MIRROR_SEM=off`, DEV-HX-1) |
| Scoring | once: `score-study.ts --counted hx-i --require-delivery-audit` (judge off), 13:06:45Z–14:06:36Z, exit 0, 220 runs, 0 evaluation failures, 0 model calls |
| Analysis | once: `npx tsx scripts/v1.5/hx-study-analyse.ts --cells scores/cells.json --out analysis/`, exit 0 |

## Integrity (combined sessions)

- Integrity flags: **1 of 110**: c099 (t01, rep 4): edits with a hook event 7/9 < 95 % (two files at step-02 without a
  hook event). Kept (ITT, §6); the driver did not redraw it. Fail-open 0 in all 110; hub p95 at most 729 ms.
- Delivery-audit flags: 0 of 110 (audit present in all 110; no rule-list mismatch; no counted rule not delivered).
- Evasion candidates: 0 in all 220 runs.
- Blocks entering the contrast: **110 of 110** (every step of both cells scored).

## Primary result (H-HX), as printed by the analysis

| blocks | tasks | ΣD none | ΣD combined | RR [within] | d̄ [within] | exact p | task sign (−/+/p) | reading |
|---|---|---|---|---|---|---|---|---|
| 110 | 11 | 203 | 0 | 0.00 [0.00, 0.00] | -1.85 [-2.10, -1.59] | 2.12e-22 | 10/0/1.95e-3 | supported |

From `analysis/analysis.json`: D_hx sum none 203, combined 0; T = −203; paired exact sign-flip p 2.12 × 10⁻²²
(Monte Carlo p 1 × 10⁻⁵); task-level exact sign test 10 − / 0 +, n = 10 tasks with a nonzero sum, p 0.00195
(task sums t01–t11: −8, −50, −33, −12, −14, −14, −2, −32, −20, 0, −18); RR 0, within-task interval [0, 0],
task-cluster interval [0, 0]; d̄ −1.845, within-task [−2.10, −1.59], task-cluster [−2.75, −1.05] (10,000 resamples,
seed 20261030). Exact Wilcoxon signed-rank p 2.12 × 10⁻²²; exact sign test over blocks 73 − / 0 +, p 2.12 × 10⁻²².
Decision: reject, predicted sign, task check holds: **supported**.

Joint reading (§1): **supported** (trap paired sign: 79 − / 4 +, p 4.00e-19)

| per block | combined trap persisted | combined trap gone |
|---|---|---|
| D fell | 8 | 65 |
| D did not fall | 4 | 33 |

The 8 blocks in "D fell, trap persisted" are the §4 hand-read set; the hand-reading is not part of this run's record.

Robustness lines, as printed:

- dropTasksWithoutTrap: supported (p 2.12e-22, 110 blocks)
- firstStudyDropNoTrapBiased (labelled biased, §4): supported (p 4.24e-22, 87 blocks)
- dropFlagged: supported (p 4.24e-22, 109 blocks)
- firstHalf: supported (p 2.91e-11, 55 blocks)
- secondHalf: supported (p 1.46e-11, 55 blocks)

## Secondaries, as printed (`analysis/analysis.json`, `secondary`)

| Secondary | none | combined |
|---|---|---|
| 1. Trap rate (Wilson 95 %) | 87/110 = 0.791 [0.706, 0.856] | 12/110 = 0.109 [0.064, 0.181] |
| 1. Paired exact sign test on trap failure | 79 blocks − / 4 + , p 4.00 × 10⁻¹⁹ | |
| 2. Functional acceptance (Wilson 95 %) | 103/110 = 0.936 [0.874, 0.969] | 105/110 = 0.955 [0.898, 0.980] |
| P(D = 0) (Wilson 95 %) | 37/110 = 0.336 [0.255, 0.429] | 110/110 = 1.000 [0.966, 1.000] |
| 6. Cost: turns; turn wall time median / mean / max (scorer summary) | 330; 31.6 / 32.7 / 170.9 s | 330; 41.2 / 42.3 / 88.3 s |

Secondaries 3 (repair), 4 (attribution), 5 (not-counted and advisory rows), 7 (per-shape view of H11) and the per-cell
parts of 6 (tool calls, hook events) are not printed by the analysis script; they are recorded per run in
`scores/scores.json` (`attribution`, `exploratoryNew`, `integrity`) and `run/turns.jsonl`. No aggregate beyond the
analysis output was computed here.

## Wall time

Sessions 05:49:16Z–12:52:56Z (7 h 04 min); scoring 1 h 00 min; whole run from setup to analysis about 8 h 25 min.

## Unexpected

- The first `setup-sandbox.sh` attempt (05:44Z, zero calls) stopped with "ISOLATION NOT ACHIEVED": the sweep found one
  world-readable file, `/tmp/reg.md`, a copy of the registration written by the coordinating session's own
  precondition poll. It was deleted and setup re-run (05:45Z): listing denied, sweep empty, S4 passed. No call had been
  made. The committed `isolation/` is the second attempt's.
- c099's integrity flag (above) did not lead to a redraw by the driver; it is kept and flagged as §6 states.

## Records

`isolation/`, `dry/`, `smoke/`, `probes/`, `run/` (turns, calls, schedule, state, per-session `session.json` with
`deliveryAudit`, hub push/calls/ledger), `sessions/` (`--keep-trees`: 220 sessions, 880 steps), `scores/`,
`analysis/`, `private-id-map.json`. Privacy checks: no cost field, no canary marker (RUNBOOK §3 grep empty), no personal path, no chat or
agent message text; `git status --short --ignored` lists no ignored file under this folder.
