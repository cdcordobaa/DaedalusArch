# COMPREHEND-01: architecture-comprehension benchmark (v1.5-exp)

**Exploratory, development material.** Design: `ops/notes/comprehend-01-design.md` (DRAFT, for the author). Build
report: `Docs/DiagnosticRuns/comprehend-01-build-2026-10-23.md`. No model call has been made here; the pilot runs only
after the author approves the design note.

Question: does the property graph (the DETECT-02 facts served by four tools) make an agent understand an architecture
more accurately, more cheaply, or both? Two arms on the same questions: **F** (Read, Grep, Glob) and **FG** (the same
plus `context_map`, `who_writes`, `trace`, `impact`).

## Files

| Path | What |
|---|---|
| `questions/bank.json` | 30 items: text, answer format, key, scoring, class, provenance (files and lines read; graph agreement) |
| `questions/conventions.json` | the conventions block of the prompt, verbatim |
| `trees.json` | the 10 trees: 3 puzzle seeds, 4 precision fixtures (in-repo), 3 human DDD repositories (pinned SHAs) |
| `lib/bank.ts`, `lib/score.ts`, `lib/arms.ts`, `lib/runners.ts` | loading, scoring, prompt and argv, the fake and live runners |
| `graph-check.ts` | what the tools answer for each item (the "graph oracle") and tool latency through the MCP layer |
| `run.ts` | the runner: plan, cap, confinement, re-runs, ledger, summary; dry run by default |
| `run.test.ts` | unit tests of the runner, scorer and arms |
| `results/graph-check.json`, `results/latency.json` | zero-call outputs |
| `results/dry-run/` | the dry run: `plan.json`, `ledger.jsonl`, `summary.json` (fake answers, fake tokens) |

The tools live in `experiments/detect-02/mcp/` (`comprehend/`, `comprehend-server.ts`, `comprehend-main.ts`).

## Commands (zero model calls)

```sh
# the three human repositories, cloned at their pins (outside the repository)
for r in lucashang-ddd-payday meetinger ddd-forum; do …; done   # url and sha in trees.json; <clones>/<id>
npx tsx --test experiments/detect-02/mcp/comprehend/tools.test.ts
npx tsx --test experiments/comprehend-01/run.test.ts
npx tsx experiments/comprehend-01/graph-check.ts --clones <clones>
npx tsx experiments/comprehend-01/run.ts --clones <clones>          # dry run, scripted fake model
```

## The bank

| Type | Items | | Class | Items |
|---|---|---|---|---|
| W writes (aggregates of a command; commands of an aggregate) | 8 | | G (a tool answers) | 16 |
| C call chain | 6 | | Gw (the nearest tool output is wrong or incomplete) | 3 |
| R rule a planned change would risk | 5 | | S (the spec in the prompt answers) | 4 |
| I impact (importers) | 4 | | X (no tool answers: plans, placement) | 7 |
| P placement | 4 | | | |
| O owner context | 3 | | | |

Trees: P1 4, P2 6, P4 3, fixtures 4, lucashang-ddd-payday 4, meetinger 4, ddd-forum 5. Seven items carry a
`behaviour` link to a puzzle trap or clean step (design §8).

## Live run (the pilot, not now)

Refused unless `COMPREHEND01_LIVE=1`, `--live`, `--confirm-sessions 62`, `--bank-sha256 <the frozen bank's sha>`,
`--claude <bin>` and an absolute `--config-dir` (a dedicated CLI config directory outside the repository, as EFF-01).
Hard cap 66 sessions (62 planned, 4 re-runs).
