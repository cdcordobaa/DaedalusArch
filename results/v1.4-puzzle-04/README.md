# PUZZLE-04 records: the tool arms `gate` and `pull` (exploratory, v1.5-exp, DEV split, not Study 2b)

Plan: `experiments/puzzle-04/plan.md` (committed before any call, `b1e0a2ad`). Report:
`Docs/DiagnosticRuns/puzzle-04-2026-10-23.md`.

| Path | What |
|---|---|
| `gate/`, `pull/` | one arm each: `run/` (call ledger `calls.jsonl`, `turns.jsonl`, `schedule.json`, input, dry, smoke and probe results), `sessions/<id>/` (step snapshots `snap/step-00..03`, `session.json`, step prompts), `diffs/`, `scores.json`, `oracle-verdicts-to-read.raw.md`, `private-task-map.json` |
| `gate/gate/` | the hub log, one line per hook event (`<id>.gate.jsonl`) |
| `pull/mcp/` | the MCP tap (`<id>.tap.jsonl`; `content` and `diff` arguments replaced by sha256 and length) and the frozen call log (`<id>.calls.jsonl`) |
| `pull/derived-p6-controller-trap-checks.json` | zero-call booleans from the raw tap: which P6 sessions checked a controller holding the trap import |
| `oracle-verdicts-to-read.md` | every oracle FAIL and functional failure, with proposed categories, for the author's hand read |
| `isolation/` | the zero-call isolation evidence, the wrapper and the two relays |

No envelope and no agent message is kept. Session ids are per arm (`c01`… in `gate` and in `pull` are different
sessions).
