# PUZZLE-01 baseline results (arm `none`, exploratory, DEV split, not Study 2b)

Plan: `experiments/puzzle-01-baseline/plan.md`. Report: `Docs/DiagnosticRuns/puzzle-01-baseline-2026-10-21.md`.

| Path | What it is |
|---|---|
| `scores.json` | Per session and step: status, harness tsc count, tests (run from outside), oracle per sub-goal, size vs seed; frozen instrument on final trees; per-puzzle outcomes (`score-baseline.ts`, zero calls) |
| `visibility.json` | R6: frozen and prototype visibility per sub-goal and tree, and the agreement tables |
| `detect-01-prototype.json` | DETECT-01 rules (`origin/explore/detect-01` at `655a7121`) on the 25 trees |
| `oracle-verdicts-to-read.md` | Every oracle FAIL on an agent tree, with code excerpt, category and proposed label |
| `diffs/<session>/step-0N.diff` | The change of each step (step-01 against the seed) |
| `sessions/<session>/` | `snap/step-00..03` (seed and the tree after each step), `turns/step-0N/prompt.txt`, `session.json` |
| `run/` | `calls.jsonl` (the call ledger, one line per spawn; the c12 step-03 line is the in-flight call lost to the container restart), `turns.jsonl` (per turn: status, attempts, model ids from `modelUsage`, tsc), `schedule.json`, `redraws.jsonl`, `resumes.jsonl`, `smoke-result.json`, `probes-result-confinement.json`, `input.json` |
| `isolation/` | Listing checks and the fingerprint sweep as the generator user, the READ probe result, the CLI wrapper |
| `private-id-map.json` | Session and task ids → puzzle and run index (committed after generation) |

No agent message text is kept: envelopes are not committed, and the probe and smoke texts are replaced by a
placeholder. Spend fields are dropped.
