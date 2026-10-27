# TRAPRATE-01 results (arm `none`, exploratory task screening, not v1.5 study data): STOPPED at the READ probe

Plan: `experiments/traprate-01/plan.md` (committed before any call, at 36e38b3e5). The run stopped under plan §3
("the READ probe fails: STOP") after 2 of 161 calls. No baseline turn was run.

| Path | What it is |
|---|---|
| `run/environment.txt` | CLI, Node, npm, kernel, OS, runner version; the one environment fix (npm `cafile`) |
| `run/calls.jsonl` | The call ledger: 1 smoke, 1 read probe |
| `run/smoke-result.json` | Smoke result (passed); agent text replaced by a placeholder, cost field removed |
| `run/probes-result-read.json` | READ probe result (failed by the rule, see below); agent text replaced by a placeholder |
| `run/input.json` | The driver input, absolute sandbox paths kept as is |
| `isolation/listing.txt` | Listing check as the generator user: every closed path denied |
| `isolation/sweep.txt` | The scripted fingerprint sweep: empty, but **vacuous** (the search never ran, see `sweep-note.md`) |
| `isolation/sweep-diagnostic.txt`, `isolation/sweep-note.md` | A corrected sweep with a positive control: 0 readable files |

Not committed: envelopes, any agent text, `private-id-map.json` (the plan commits it after generation; none
happened, so it stays in the sandbox vault).

## Run summary

| Phase | Calls | Cap |
|---|---|---|
| Dry | 0 | 0 |
| Smoke | 1 (passed, `claude-sonnet-5-5`) | 1 |
| Read probe | 1 (failed by the rule) | 1 |
| Baseline | 0 of 150 planned | 159 |
| **Total** | **2** | **161** |

Redraws: 0. Wall time: about 8 minutes from setup to stop. CLI 2.1.311 (the plan's reference is 2.1.308: a recorded
difference).

## Why the READ probe failed

The probe's `forbidden` list (built by `make-input.ts`) holds every task id, and the first probe path is that task's
README path, which contains the task id `f1-ddd-two-aggregates`. The probe prompt carries that path, and the agent's
reply names the paths it tried, so the check counts 1 leaked forbidden string. The README's first line and both
canary tokens are absent, and all 3 reads were denied (3 permission denials; the CLI refused each path as outside the
work tree). In substance nothing was read. By the plan's own rule, though, the probe failed, and the coordinator does
not reinterpret a stop rule. The fix is in the probe design (leave out of `forbidden` the ids that occur in the probe
paths, or pick probe paths without task ids) and is the author's call.

## Other findings

1. `setup-sandbox.sh` check 2 is vacuous: `grep -f /dev/stdin` as the generator user cannot reopen the root-only
   pattern file, and stderr plus `|| true` hide this (`isolation/sweep-note.md`). The corrected sweep found nothing.
2. The skeleton warm-up `npm ci` failed TLS through the container proxy (npm gets only an allow-listed environment).
   Setting npm `cafile` in root's `~/.npmrc` to the container CA bundle fixed it, as in the v1.3 loop pilot.
