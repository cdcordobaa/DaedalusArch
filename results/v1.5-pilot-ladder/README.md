# TRAP-PILOT-v2 difficulty ladder, arm `none` (pilot calibration, not study data)

The 18 TRAP-PILOT-v2 variants (`experiments/trap-pilot-v2/`, six Hexagonal tasks × levels L1–L3) were each run twice
by the agent alone (arm `none`, no firewall tool), three steps per session: 36 sessions, 108 turns. Generator
`claude-sonnet-5-5` through the Claude Code CLI 2.1.312, the frozen argv and frame of the v1.5 study. Runner:
`experiments/v15-study/` with the pilot option (PR 435; RUNBOOK §4). Scored by the variants' own oracles and behaviour
tests only (`score-pilot.ts`); the v1.5 rules were not run on these trees.

Report: `Docs/DiagnosticRuns/v15-pilot-ladder-2026-10-30.md`.

## Run

| Phase | Calls | Cap |
|---|---|---|
| Local dry (pilot scorer end to end) | 0 | 0 |
| Smoke (arm `none` only) | 1, passed | 1 |
| READ probe | 1, passed: 4 of 4 reads denied, 0 forbidden strings | 1 |
| Sessions | 108 of 108 planned | 115 |
| **Total** | **110** | **117** |

- All 108 turns `completed`, 1 attempt each, model `claude-sonnet-5-5` only; skeleton intact after every turn; 0 harness
  type-check errors. Redraws 0, resumes 0, stop none. Wall time 2026-10-29T22:37:42Z to 23:33Z; turn median 31 s,
  maximum 57 s. Order: the plan's seeded shuffle (seed 20261029), replicate round by round.
- **Local run, no generator user.** The run used the author's machine as the current user (`--local`): no uid switch,
  no listing or fingerprint sweep. Confinement rests on the CLI's frozen argv (`--setting-sources ""`,
  `--strict-mcp-config`, acceptEdits, prompts none, one Bash rule); the READ probe (the first variant's README in the
  clone, both canaries, a spec copy) was denied on every path.

## Layout

| Path | What it is |
|---|---|
| `sessions/cNNN/` | `snap/step-00..03` (seed and the tree after each step), `turns/step-0N/prompt.txt`, `session.json` |
| `run/` | `calls.jsonl` (call ledger), `turns.jsonl` (per turn), `schedule.json`, `state.json`, `input.json` (canaries and probe strings removed, paths neutral), `sessions.log.txt` |
| `smoke/`, `probes/`, `dry/` | smoke, READ probe (agent text omitted) and local dry results |
| `scores/pilot-scores.json` | per session: oracle per step, `trapFailed` (final tree), `functional` (every test case passes), case counts, failing cases, oracle evidence |
| `summary.md`, `summary.json` | per variant and per level tables (95 % Wilson intervals); `make-summary.ts` rebuilds them |
| `private-id-map.json` | neutral ids `t01`…`t18` mapped to variants (session → id in `run/schedule.json`) |

No envelope or agent message text is kept; spend fields are not recorded. Paths are written as `<clone>`, `<run>` and
`<home>`.
