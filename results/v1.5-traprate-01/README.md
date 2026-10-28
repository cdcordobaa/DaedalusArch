# TRAPRATE-01 results (arm `none`, exploratory task screening, not v1.5 study data)

Plan: `experiments/traprate-01/plan.md` (committed before any call; run from `ops/traprate-01-plan` at f976a35c8, which
contains 36e38b3e5). An earlier attempt stopped at the READ probe and stays on `results/traprate-01`; this branch
(`results/traprate-01b`) holds the complete run. Not scored yet (plan §4 is a later, zero-call step).

| Path | What it is |
|---|---|
| `diffs/<session>/step-0N.diff` | The change of each step (step-01 is against the seed), `git diff --no-index` between snapshots |
| `sessions/<session>/` | `snap/step-00..03` (the seed and the tree after each step), `turns/step-0N/prompt.txt`, `session.json` |
| `run/` | `calls.jsonl` (the call ledger), `turns.jsonl`, `schedule.json`, `redraws.jsonl` (empty: no redraw), `smoke-result.json`, `probes-result-read.json` (the READ probe), `input.json` (absolute sandbox paths kept as is), `environment.txt` |
| `isolation/` | Listing check (`listing.txt`) and fingerprint sweep (`sweep.txt`, empty; the positive control was found) as the generator user |
| `private-id-map.json` | Task ids `t01`…`t25` mapped to study task and style (committed after generation); session-to-task mapping is in `run/schedule.json` and each `session.json` |

No agent message text is kept: envelopes are not committed, and the smoke and probe texts are replaced by a
placeholder. Spend fields (`costUsd`) are removed from `session.json`, `turns.jsonl` and the smoke result.
`resumes.jsonl` is absent: no resume was needed.

## Run summary

| Phase | Calls | Cap |
|---|---|---|
| Dry | 0 | 0 |
| Smoke | 1 (passed, `claude-sonnet-5-5`) | 1 |
| Read probe | 1 (passed: 0 forbidden strings, 3 permission denials) | 1 |
| Baseline | 150 of 150 planned (50 sessions × 3 steps) | 159 |
| **Total** | **152** | **161** |

- Turns: 150, all `completed`, 1 attempt each, every turn reported `claude-sonnet-5-5` only; skeleton intact after every
  turn; 5 turns ended with harness type-check errors (agent behaviour, recorded, not redrawn).
- Redraws: 0. Resumes: 0 (the container restarted about 5 minutes after the driver had finished; nothing was lost).
- Isolation: listing denied on all 7 closed paths, sweep empty with the positive control found.
- Wall time: setup 2026-10-28T18:22Z; baseline 18:26:39Z to 20:21:19Z (1 h 55 min); turn median 44 s, maximum 100 s.
- CLI 2.1.312 (the plan's reference is 2.1.308: a recorded difference). Environment fix: npm `cafile` set to the
  container CA bundle (done by `setup-sandbox.sh`).
