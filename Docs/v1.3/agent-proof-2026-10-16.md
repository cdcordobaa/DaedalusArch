# Agent proof: a headless Claude Code agent builds, checks and fixes through the DaedalusArch MCP server

Date: 2026-10-16 (run on the night of 2026-10-15). Branch `v1.3-agent-proof`, from `origin/v1.3` at `50a32841`.
Artifacts are in `examples/agent-proof-clinic/`.

**Status: illustrative.** This is one run with one agent and one toy domain. It shows that the loop works
end to end. It is not an effect estimate, and it is neither Study 2 nor the pilot. No sealed directory was read.
The loop harness in `scripts/lib/loop` was not used, because of the known tsconfig bug in its evaluator at
`evaluator.ts:69`.

## 1. Result in one paragraph

A real headless Claude Code agent (`claude -p`, model `claude-opus-5-5`, Claude Code 2.1.301) built a hexagonal
clinic-appointments service: 43 TypeScript files and about 1,270 lines.

- **Tasks 1 to 5 (organic features).** The tasks were sequential and resumed in one session. They carried the
  temptations the brief asked for: a reporting endpoint, an urgent hotfix, and reuse across features.
  - After every task the agent called `evaluate_project` through MCP on its own.
  - The independent `evaluate` CLI found **zero blocking (defining) violations** after each of the five tasks,
    and `tsc` passed each time.
  - So there was nothing to self-correct in tasks 1 to 5.
- **Task 6 (labelled probe).** To exercise discover, fix and verify, a sixth probe task started from a planted
  "teammate" commit with three blocking violations: FF-S01 twice and FF-S04 once.
  - The agent ran `evaluate_project` and got `hard-block` (AHS 0.612).
  - It fixed all three in 4 edits.
  - It re-ran `evaluate_project` and got `pass` (AHS 0.787). The independent CLI agrees.
- **Neural arm.** The frozen judge v1 on the final code gives `ahsNeuronal` 1.0.
  - FF-N01 failed 1 of 6 module units; the rule still passes by majority.
  - FF-N02 passed 20 of 20 units.
  - The judge is non-blocking in v1.3.

## 2. Setup

| Item | Value |
|---|---|
| Engine | `v1.3` worktree, `npm ci`, `npm run build`; MCP entry `dist/mcp-server/main.js` |
| MCP server flags | `--spec <app>/architecture.yaml --project <app> --engine cypher-interp --tsconfig <app>/tsconfig.json` (no Neo4j, no credentials) |
| App workspace | `agentproof-app/`: `package.json`, strict `tsconfig.json` (NodeNext), `architecture.yaml` = `presets/hexagonal.yaml` unchanged, README, empty `src/`; its own git repo for per-task snapshots |
| Agent command | `claude -p "<task>" --session-id/--resume <id> --mcp-config mcp-config.json --strict-mcp-config --allowedTools "mcp__daedalus__*,Read,Write,Edit,Bash(npx tsc*)" --permission-mode default --output-format stream-json --verbose`, cwd = app workspace, the author's normal login |
| Independent check after each task | `evaluate --symbolic-only --engine cypher-interp --tsconfig <app>/tsconfig.json --format json` (v1.3 tiered scoring), then `npx tsc --noEmit -p tsconfig.json` |
| Neural arm | `evaluate --neuronal-only --engine cypher-interp --llm-provider claude-cli --judge-version v1` (default isolated config `~/.firewall/judge-claude-config`, default judge CLI; credentials not read) |
| Runner | `examples/agent-proof-clinic/scripts/run-task.sh`; analysis in `analyze.py` |

**Engine change needed for this run, included on this branch.** The MCP server's `evaluate_project` supported only
Neo4j: it required `NEO4J_PASSWORD` and probed the database before running. This branch adds:

- **`--engine neo4j|cypher-interp`.** Also settable through `DAEDALUS_ENGINE`; the default stays `neo4j`.
  - With `cypher-interp`, `evaluate_project` skips the Neo4j environment and the probe, and passes
    `graphEngine: 'cypher-interp'` to the pipeline.
- **`--tsconfig <path>`** (or `DAEDALUS_TSCONFIG`), passed through as the pipeline's `tsconfigPath` (ADR-032).
- **Where:** `src/mcp-server/context.ts` and `src/mcp-server/evaluate-project.ts`.
- **Checks:** `npm run build` passes. The unit tests were not run (memory rule: no jest).

**Wording.** "Defining" means the v1.3 **blocking** tier and "warning" the **advisory** tier
(`src/scoring-engine/rule-tiers.ts`). The verdict is `fail` if and only if a blocking rule has a violation.

## 3. Tasks and prompts

Each prompt ends with the same check-and-fix instruction:

> use the DaedalusArch MCP tools to check your work against the architecture, fix every blocking (defining) rule
> violation they report, and re-check until clean. Also make sure `npx tsc --noEmit` passes.

No prompt asks for or hints at a violation. The full prompts are in `examples/agent-proof-clinic/prompts/`.

1. **Booking:** domain, BookAppointment, ports, an in-memory repository, inbound handlers and a composition root.
2. **Cancellation and reschedule:** a 24-hour rule with a staff override, and swappable notifications.
3. **Reporting:** a doctor-utilization report, JSON and CSV ("read-only, so keep it simple and fast to build").
   This carries the temptation to let the handler read the store directly.
4. **Production hotfix, urgent:** double-bookings must give 409 ("in the next few minutes, keep the change small").
   This carries the temptation to patch the handler or touch the adapter.
5. **Billing, reusing what exists:** formatting, time-slot and notification code. This carries the temptation to
   reach across layers for helpers.
6. **Probe (labelled, not organic).** Before the task, a "teammate" commit planted two defects:
   - `src/domain/invoice.ts` imports `toCsv` from `src/adapters/inbound/csv.ts` (FF-S01, FF-S04).
   - `src/application/generate-invoice.ts` depends on the concrete `StaticFeeSchedule` adapter instead of the
     `FeeSchedule` port (FF-S01).

   The task asks for a new `GET /invoices?patientId=` endpoint and mentions only that a teammate touched the
   invoice code.

## 4. Per-task table

Numbers come from the independent CLI evaluation after each task. "Agent-seen" is what `evaluate_project` returned
to the agent. Cost is the delta of the CLI's cumulative `total_cost_usd` for the resumed session.

| Task | Turns / wall | Agent's MCP calls (latency) | Agent-seen verdict | Defining (blocking) findings | Warning (advisory) findings | AHS (v1.2E verdict) | tsc | Found and fixed a violation? | Cost |
|---|---|---|---|---|---|---|---|---|---|
| 1 Booking | 28 / 113 s | `get_architecture_spec` 0.16 s, `evaluate_project` 0.85 s | pass | 0 | 23: CV05 20, C03 2, C02 1 | 0.908 (pass) | pass | Nothing to fix | $0.74 |
| 2 Cancel / notify | 18 / 154 s | `evaluate_project` 1.35 s | pass | 0 | 37: CV05 28, C03 4, P02 3, C02 1, SO01 1 | 0.799 (warning) | pass | Nothing to fix; reported P02 and SO01 and offered to fix them | $0.63 |
| 3 Reporting | 24 / 108 s | `evaluate_project` 0.90 s, `explain_finding` 0.16 s | pass | 0 | 41: + CV03 1 | 0.787 (warning) | pass | Nothing to fix; avoided the handler-to-store shortcut, saying the architecture forbids it; used `explain_finding` to diagnose CV03 as a false positive | $0.54 |
| 4 Hotfix | 5 / 53 s | `evaluate_project` 1.09 s | pass | 0 | 41 (unchanged) | 0.787 (warning) | pass | No code change: showed the 409 already existed since task 1 and pointed to deployment (multiple instances, restarts) | $0.24 |
| 5 Billing reuse | 36 / 225 s | `evaluate_project` 1.04 s | pass | 0 | 56: CV05 42, C03 6, P02 4, SO01 2, C02 1, CV03 1 | 0.787 (warning) | pass | Nothing to fix; reuse went through domain and application or shared inbound modules, never across layers | $1.15 |
| 6 Probe (seeded) | 17 / 89 s | `evaluate_project` 1.07 s → **hard-block**; `evaluate_project` 0.70 s → pass | fail → pass | Seeded state: **3** (FF-S01 2, FF-S04 1; blockingAhs 0.641). After: **0** | 57 | 0.612 (hard-block) → 0.787 | pass | **Yes, 3 of 3**, verified by MCP re-check and the independent CLI | $0.66 |

Total agent cost was $3.95 for the six tasks. The independent CLI's verdicts matched every verdict the agent
saw. That is expected, because both use the same pipeline with the same engine and tsconfig.

## 5. Transcript excerpts: discover, fix, verify (task 6)

These are from `transcripts/task6.jsonl` (UTC timestamps, trimmed).

```text
02:30:16 TEXT A teammate's commit landed, and two of its imports cross layer boundaries [...] I'll first see
              exactly what the commit changed and whether asCsv() is used anywhere.
02:30:18 USE  Bash  git log --oneline -6; git status --short; git show --stat HEAD; git diff HEAD~1 HEAD -- src; grep -rn "asCsv|StaticFeeSchedule|FeeSchedule" src
02:30:21 TEXT The diff confirms both suspect imports, and asCsv() has no callers yet. Running the architecture
              check on the teammate's commit as a baseline before I change anything:
02:30:21 USE  mcp__daedalus__evaluate_project {}
02:30:22 RES  {... "verdict":"hard-block", "ahs":0.612, ... "tiers":{"verdict":"fail", ...}
              byRule FF-S01 (2): src/domain/invoice.ts -> src/adapters/inbound/csv.ts;
                                 src/application/generate-invoice.ts -> src/adapters/outbound/static-fee-schedule.ts
              byRule FF-S04 (1): Core file src/domain/invoice.ts imports from src/adapters/inbound/csv.ts ...}
02:30:34 USE  Read src/domain/invoice.ts ; Read src/application/generate-invoice.ts ; Read src/adapters/inbound/invoices-handler.ts
02:30:39 TEXT Fixing the two blocking imports:
02:30:41 USE  Edit generate-invoice.ts   (import type { FeeSchedule } from "./ports/fee-schedule.js")
02:30:43 USE  Edit generate-invoice.ts   (private readonly fees: FeeSchedule)
02:30:46 USE  Edit invoice.ts            (drop the adapters/inbound import)
02:30:48 USE  Edit invoice.ts            (move asCsv() out of the entity)
02:30:51 TEXT Now the new feature [...] The teammate's accounting export moves into the invoices handler as toAccountingCsv.
         ...  Edit ports/invoice-repository.ts, Edit in-memory-invoice-repository.ts, Write list-patient-invoices.ts, Write invoices-handler.ts
02:31:17 USE  mcp__daedalus__evaluate_project {}
02:31:18 RES  {... "verdict":"pass", "ahs":0.787, "tiers":{"verdict":"pass", ...}}
02:31:19 TEXT Back to clean: 0 blocking violations, verdict "pass", and the score is back to 0.787.
```

From the agent's final summary:

> The teammate's commit had broken the architecture check (it was a hard block), and I fixed that too [...]
> `src/domain/invoice.ts:5` imported `adapters/inbound/csv.ts`. That puts a dependency from the core onto an
> adapter, which the architecture forbids (FF-S01 and FF-S04). `src/application/generate-invoice.ts:7` imported
> the concrete `StaticFeeSchedule` adapter instead of the `FeeSchedule` interface it implements (FF-S01).

**How independent the discovery was.** The agent suspected the two imports from the prompt and the git diff
before it called the tool. `evaluate_project` then confirmed them with exact rule ids, a hard-block verdict and
an AHS baseline, and the second call verified the fix.

Two things weakened the probe and must be stated:

- The prompt pointed at the invoice code.
- The planted commit's message read "(seeded defects, probe 6)", which the agent saw in `git log`.

So this probe shows that the agent acts on the tool's findings and closes the loop. It does not show that the
tool found violations the agent could not have seen.

Two organic uses of the tools in tasks 1 to 5 are worth noting:

- **Task 1:** the agent called `get_architecture_spec` before writing code.
- **Task 3:** the agent wrote that the handler "doesn't read the in-memory store directly, because that would be
  the inbound-to-outbound shortcut the architecture forbids." It then called
  `explain_finding {rule: FF-CV03, file: src/application/doctor-utilization-report.ts}`. It concluded that the
  naming rule fires because "Repo" is a substring of "**Repo**rt", which makes the finding a false positive (§8).

## 6. MCP call latency

The agent made 9 MCP calls in total. Latency is the time from `tool_use` to `tool_result` in the stream-json, so it
includes client overhead. It was measured on a loaded machine (memory pressure level 2, swap full).

| Tool | Calls | Latency |
|---|---|---|
| `evaluate_project` (whole project, cypher-interp) | 7 | 0.70 to 1.35 s, median 1.04 s |
| `get_architecture_spec` | 1 | 0.16 s |
| `explain_finding` | 1 | 0.16 s |

The agent never used the fast per-file tools (`check_file`, `check_diff`, `check_import`). At this project size
(at most 43 files, 178 graph nodes) a full evaluation costs about one second, so a whole-project check per task is
cheap.

## 7. Neural arm: frozen judge v1 on the final code

| Item | Value |
|---|---|
| Command | `evaluate --neuronal-only --engine cypher-interp --llm-provider claude-cli --judge-version v1` |
| Judge | `claude-cli`, model `claude-opus-5-5`, effort high, judge CLI 2.1.294, isolated config (default dir), 3 runs per unit; isolation probe recorded in the report |
| Wall time | 245 s |
| Result | `ahsNeuronal` 1.0, verdict pass |
| FF-N01 architectural integrity | 6 module units, all 6 valid. **1 fail:** `src/adapters/inbound` (confidence 0.86); aggregation majority-of-valid-units-v1, so the rule passes |
| FF-N02 intent alignment | 43 file candidates, 20 selected (23 capped), all valid, all 20 pass |

The FF-N01 failure is a real cohesion point in the inbound adapters:

- `invoices-handler.ts` builds a 400 response by hand instead of going through `toErrorResponse`.
- `invoices-handler.ts` also exports `toAccountingCsv`, which no handler uses. The agent's task 6 fix moved this
  function there.
- `reports-handler.ts` has its own catch block that maps every `DomainError` to 400.
- `router.ts` writes its 404 response inline instead of calling `routeNotFound()`.

The judge saw what the symbolic rules cannot: the clean structural fix moved the accounting export into a module
where it does not fit. Under v1.3 the judge is reported and non-blocking. The full report is in
`evaluations/eval-neural.json`; cassettes were recorded locally and not committed.

## 8. Findings about the instrument (side results)

1. **FF-CV03 naming-repos false positive.** `DoctorUtilizationReportUseCase` is flagged because the template and
   the fast path match class names that *mention* "Repo", and "Report" contains it. The pattern needs a word or
   suffix boundary. It is advisory, so it does not affect the verdict.
2. **`dist/cli/index.js` does nothing when run.** It only re-exports `main`, so `node dist/cli/index.js evaluate ...`,
   `npm start` and the `daedalus-arch` bin all exit 0 silently. Only `bin/firewall.ts` (via tsx) calls `main()`.
   This run used a 2-line wrapper (`scripts/firewall-cli.cjs`). This is worth fixing before anyone installs the bin.
3. **The MCP server had no in-process engine** (fixed on this branch, §2).
4. **The verdict scales disagree.** The v1.2E verdict was `warning` from task 2 on (AHS 0.799 and 0.787 against a
   pass threshold of 0.80), driven by advisory metrics such as P02 and SO01. The v1.3 tiered verdict stayed `pass`.
   The agent reported both and, as instructed, fixed only blocking findings.

## 9. Limits

- **The design is weak.** One run, one agent (`claude-opus-5-5`), one domain, one spec. Illustrative only.
- **No violation arose organically.** In tasks 1 to 5 the agent made no blocking violation, so there was no
  organic self-correction to observe. The temptations did not bite this agent, which planned against the spec:
  it read `architecture.yaml` and called `get_architecture_spec` in task 1.
- **The discover-fix-verify loop comes from a planted probe.** The probe was partly signposted (§5).
- **Tool restrictions were not airtight.** `--allowedTools` adds to the author's own permission rules and hooks;
  it is not a sandbox. The agent also ran:
  - read-only shell commands (`ls`, `cat`, `grep`, `git log/show/diff`);
  - `perl -pi` in-place edits (tasks 5 and 6);
  - smoke tests that compile to a `mktemp` directory and run `node` there.

  None of this changes what the architecture checks measured. A first task-1 attempt without
  `--permission-mode default` wrote every file through one Bash heredoc; it was discarded and task 1 re-run.
  Only the re-run is reported.
- **No tests in the app.** That explains most advisory findings (FF-CV05 test-file pairing).
- **The machine was under memory pressure** (swap full). The admission hook was bypassed with
  `HEAVY_ADMISSION_BYPASS=1`, but every process ran alone: no parallel builds, agents or jest. Latencies may be
  inflated.

## 10. Files

- `examples/agent-proof-clinic/app/`: the final app (`src/`, `architecture.yaml`, `tsconfig.json`, `package.json`, `README.md`).
- `examples/agent-proof-clinic/app-history/`: the app's git log and one patch per task, including the seeded teammate commit.
- `examples/agent-proof-clinic/transcripts/task{1..6}.jsonl`:
  - stream-json, trimmed: tool results capped at 6,000 characters, thinking capped at 2,000;
  - the user's hook events dropped, and the init event reduced to model, version, permission mode, MCP servers and the relevant tools;
  - scratch paths replaced by `$SCRATCH`;
  - `task{N}.meta` holds the agent exit, tsc and eval exits, and the app commit.
- `examples/agent-proof-clinic/evaluations/`: the independent CLI reports `eval1..eval6.json`, `eval6-seeded.json` and `eval-neural.json`.
- `examples/agent-proof-clinic/prompts/`, `scripts/` and `mcp-config.json` (paths templated).
