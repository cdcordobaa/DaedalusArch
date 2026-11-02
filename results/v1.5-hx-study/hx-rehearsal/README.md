# v1.5 Hexagonal study: dress rehearsal (§5.2): PASS

Not study data. Run after the agent pilot passed all five gates (run 2, `results/v15-hx-pilot-r2`, commit `84cecc969`).
Pre-registration `Docs/v1.5/hexagonal-study-preregistration.md` §5.2; runbook `experiments/v15-study/RUNBOOK.md` §2.
Neither was changed.

**Tasks:** t01 (hxa1-chimney-sweeps) and t02 (hxa2-canal-boats), the first two of the sealed set, chosen by that rule
before any call. 2 tasks × 1 replicate × 2 arms × 3 steps.

## Setup

| Item | Value |
|---|---|
| `main` HEAD (branch base) | `2f1f3acb1b6c10c2f6480aa3fef0183d3bed91cc` (after PRs 463–465, docs and CI only; seal root `db7347acf8106989` and all 12 §9.1 script hashes re-checked: unchanged) |
| CLI version | 2.1.316 (same as pilot run 2; every turn record) |
| make-input | 2 tasks × 2 arms × 1 replicate = 4 sessions, **12 turns; caps sessions 13, total 16** |
| setup-sandbox | listing denied, sweep empty, S4 clean (`isolation/`) |
| `--dry` | passed; committed and pushed before any call (commit `e59cb5268`) |
| `--smoke` / `--probes` | passed, 2 + 1 calls |
| Sessions | `DAEDALUS_MIRROR_SEM=off nohup npx tsx experiments/v15-study/run-study.ts --sessions --input /srv/o/hx-rehearsal/input.json > /srv/o/hx-rehearsal/sessions.log 2>&1 &`, started 04:02:28Z, ended on its own 04:08:41Z (`stopped: null`) |
| Calls | smoke 2, probes 1, sessions 12 = **15 of 16** (session cap 13: 12 used) |
| Turns per arm | none 6, combined 6 (all `completed`) |
| Redraws / resumes | 0 / 0 |
| Hub judge calls | 0 (`DAEDALUS_MIRROR_SEM=off`, DEV-HX-1) |
| Integrity | c003 (t01): edits 10/10 with hook, fail-open 0, hub p95/max 679/680 ms, not flagged; c004 (t02): 13/13, 0, 595/727 ms, not flagged |
| Gate (b) check (record) | PASS: 2 sessions, 6 steps, 0 missing |

## Pass criteria (§5.2)

| Criterion | Evidence | Exit |
|---|---|---|
| Driver started detached by the RUNBOOK command and survives past 2 h of the launching tool, or the run ends sooner with the driver still detached | Started with the RUNBOOK §2.4 command (`nohup … &`). The launching shell (its own session id) exited within 3 s; the driver kept running under nohup and finished all 12 turns on its own at 04:08:41Z (about 6 min). It ended before 2 h with the driver still detached | **PASS** |
| Every session folder holds its step trees and they rebuild to the recorded tree hashes | From a clean `git archive` of the results commit `af47348cc`: 4 session folders, each with `snap/step-00..03` and `session.json`. Steps 01–03: 12 of 12 rebuild to the `treeSha256` in `session.json` (the driver's `treeSha`). Step-00: the seed plus the harness's `package.json`; without that file, all 4 equal the input's pinned seed hash (t01 `82981bd7…`, t02 `3123015a…`) | **PASS** |
| The jsonl files and `session.json` with `deliveryAudit` are in the results commit (`git ls-files`) | `git ls-files` lists `run/turns.jsonl`, `run/calls.jsonl`, `run/hub/c003.{push,calls}.jsonl`, `run/hub/c004.{push,calls}.jsonl`, `sessions/c00{1..4}/session.json`; c003 and c004 carry `deliveryAudit` (35 and 47 records) | **PASS** |
| The scorer runs on the committed records alone with `--require-delivery-audit` and flags nothing | `score-study.ts --counted hx-i --require-delivery-audit` on an out root assembled only from the archived commit (`sessions/`, `run/hub`, `run/state.json`, `schedule.json`, `turns.jsonl`; the root-only `input.json` supplied the task list): exit 0, 4 sessions scored, all complete, 0 flagged runs, 0 delivery-audit flags, 0 rule-list mismatches, 0 counted rules not delivered, 0 findings differences, 0 evasion candidates, 0 evaluation failures; output identical to the scoring of the live out root. Gate (b) on the committed records: PASS, 0 missing | **PASS** |

## Unexpected

- The coordinating tool's wait loop on the driver could not see the driver's exit (its `pgrep` pattern matched itself) and
  ran until its 1 h limit; the driver itself had ended at 04:08:41Z. No effect on the run.

## Records

`isolation/`, `dry/`, `smoke/`, `probes/`, `run/`, `sessions/` (trees from `--keep-trees`: 4 sessions, 16 steps),
`scores/`, `gate-b.json`, `private-id-map.json`. No cost field, no canary marker, no personal path, no chat or agent
message text; `git status --short --ignored` lists no ignored file under this folder.
