# PUZZLE-02 tool arm `mcp-detect` results (exploratory, v1.5-exp, DEV split, not Study 2b)

Plan: `experiments/puzzle-02-tool-arm/plan.md`. Note: `ops/notes/puzzle-02-tool-arm-note.md`. Report:
`Docs/DiagnosticRuns/puzzle-02-tool-arm-2026-10-22.md`.

| Path | What it is |
|---|---|
| `scores.json` | Per session and step: status, harness tsc, tests (run from outside), oracle per sub-goal, `check_consistency` per snapshot, changed lines, tool calls; per-puzzle outcomes side by side with the baseline (`score-tool-arm.ts`, zero calls) |
| `oracle-verdicts-to-read.md` | Every oracle FAIL on a final tree, with the diff excerpt (counts provisional until read) |
| `diffs/<session>/step-0N.diff` | The change of each step (step-01 against the seed) |
| `sessions/<session>/` | `snap/step-00..03`, `turns/step-0N/prompt.txt`, `session.json` (c06: infrastructure, redrawn as c11) |
| `run/calls.jsonl`, `run/turns.jsonl` | The call ledger (34 lines; the c06 step-02 line is the in-flight call lost to the container restart) and per-turn records |
| `run/mcp/<cell>.calls.jsonl`, `run/mcp/<cell>.tap.jsonl` | The frozen MCP call log and the hub's JSON-RPC tap (tool, arguments, status, finding count), for the record only |
| `run/schedule.json`, `run/redraws.jsonl`, `run/resumes.jsonl`, `run/input.json` | Seeded schedule, the one redraw, the resume, the driver input |
| `run/smoke-result.json`, `run/probe-result.json`, `run/probe-prompt.txt`, `run/dry-result.json` | Smoke and confinement probe verdicts; the zero-call dry run (argv and relay checks) |
| `isolation/` | Listing checks, fingerprint sweeps (before the calls, and after the restart), the zero-call READ probe, the wrapper, the relay |
| `private-task-map.json` | `t1` → P1, `t2` → P2 (sha256 fixed in `experiments/puzzle-02-tool-arm/order.json` before any call) |

No agent message text is kept: envelopes are not committed. Spend fields are dropped.
