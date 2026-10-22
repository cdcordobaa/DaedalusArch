# v1.5 U4: S3 facts and S2 confirmation (exploratory)

Thinking note: [`ops/notes/v15-u4-facts-confirmation-note.md`](../../ops/notes/v15-u4-facts-confirmation-note.md) (v1, r1 before any call, r2 after the S2 failure). Report: [`Docs/DiagnosticRuns/v15-u4-2026-10-23.md`](../../Docs/DiagnosticRuns/v15-u4-2026-10-23.md). Development material only. Nothing under `src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/` or the v1.4 tag is changed; `experiments/detect-02/` is imported read-only (its `semantic.ts` now exports its system prompt, text unchanged).

| File | What |
|---|---|
| `repos.ts` | The 13 human DDD repositories at their pinned SHAs; spec variants (aggregates hidden or replaced) |
| `conditions.ts` | S3-b: the DETECT-02 rules under declared, inferred or model (`s3`) roots, zero calls |
| `hand-read.json` | Every hit on the human repositories, read by hand |
| `proposer.ts` | The relaxed D5 proposer `u4-d5-relaxed-r1`, frozen before any call |
| `candidates.ts` | S2 candidate sets (dev set and precision fixtures), zero calls; `results/proposer-counts.json` |
| `scope.json` | The S2 scope, cut for the cap before any call |
| `llm.ts` | The one provider path (`claude -p`, `claude-sonnet-5-5`, no tools), ledger, hard cap 75, cassettes, replay |
| `s3.ts` | S3 root and ownership facts, grounded; `results/s3-run{0,1}.json`, `results/s3-facts.json` |
| `s2.ts` | S2 confirmation (`detect02-sem-v1`); `results/s2-answers.json` |
| `s2-r2.ts` | The one post-hoc fix (r2); `results/s2-r2-answers.json` |
| `analyse.ts` | The measures of note §3; `results/metrics.json` |
| `ledger.jsonl` | One line per provider call (73 of 75) |

Replay commands are in the report, §9. Every replay costs zero calls.
