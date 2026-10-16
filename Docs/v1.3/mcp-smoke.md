# MCP v2 live smoke test (local machine)

Written 2026-10-15 on branch `v1.3-mcp2`. Script: `scripts/v1.3/mcp-smoke.ts` (logic in `scripts/v1.3/lib/mcp-smoke.ts`). Tests: `tests/unit/scripts/v1.3/mcp-smoke.test.ts`.

## What it answers

Does a real coding agent, given only the DaedalusArch MCP server, use it while it writes code? The smoke runs Claude Code once, headless, on a tiny demo task, and reads the transcript for two facts:

1. **Called the checker**: the agent called `check_diff` or `check_file` at least once.
2. **Acted on a blocking answer**: when a check answered `blockingVerdict: "block"`, the agent edited the files that answer named afterwards, and at the end none of them has a blocking finding.

It is a smoke test, one run, one task. It does not measure whether the tools improve architecture; that is the firewall-in-the-loop experiment (`Docs/mcp-firewall-in-the-loop.md`), which needs a pre-registration first.

## The run

- **Directories.** A fresh `<tmp>/mcp-smoke-XXXX/` holds `harness/` (the harness root: the spec copy and the MCP config) and `out/mcp-smoke/demo/run-0/` (the agent's working directory). Both lie outside the repository. Everything is removed afterwards unless `--keep` is given.
- **Demo project.** Six files of a small clean-architecture slice (`DEMO_FILES`): an `Order` entity, an `OrderRepository` port, a use case, an in-memory repository, and a `SystemClock` in infrastructure. The spec is `specs/clean-arch.yaml`, copied into the harness. The demo project has no blocking finding before the run (a test pins this).
- **Task** (`DEMO_TASK`). Add `Order.cancel()` recording `cancelledAt`, and a `CancelOrderUseCase`. The task mentions the existing `SystemClock`, so the shortest route (the entity calls the infrastructure clock) breaks FF-S01 and FF-S04, both blocking. The task also asks the agent to check its files with the architecture tools before finishing. The task does not name a rule or the fix.
- **Argv.** The pinned generator route: `buildArmCall(config, req, DEMO_TASK, { arm: 'daedalus-mcp', daedalus })` from `scripts/lib/generators/arms.ts`. That is the E1 confinement argv (BR-U5a-41) with `--strict-mcp-config`, one `--mcp-config` naming only the DaedalusArch server, the nine spec-only MCP v2 tools allowed by exact name, and `evaluate_project` denied. Two deviations, both recorded in the report:
  - `--output-format stream-json --verbose` instead of `json`. The json envelope does not carry the tool calls, and the smoke needs them.
  - `allowBash: false` (the no-Bash variant). The smoke installs no skeleton, so the harness type-check command the Bash rule allows does not exist.
- **Server.** `node <repo>/dist/mcp-server/main.js --spec <harness>/spec.yaml --project <cwd>`. Build it first with `npm run build`.
- **Environment.** `buildGeneratorChildEnv(process.env)`: the generator allow-list with keys and tokens dropped, as for E1. The CLI uses its own login.

## How to run it (local machine)

```bash
npm ci && npm run build
npx tsx scripts/v1.3/mcp-smoke.ts \
  --claude "$(command -v claude)" \
  --model <the pinned model id of the generator plan> \
  --cli-version <the pinned claude CLI version, optional> \
  [--timeout-ms 900000] [--keep] [--out results/v1.3-reference/mcp-v2]
```

- `--cli-version x.y.z`: when given, `claude --version` must start with it, or the run stops before anything is spawned (`SMOKE_CLI_VERSION`).
- Exit codes: `0` the agent called `check_diff` or `check_file`; `1` it never did; `2` a setup error (CLI missing, server not built, path not absolute).
- The report is written to `<out>/mcp-smoke-<timestamp>.json`: the argv (prompt masked), the deviations, the MCP config, the CLI version, exit code and duration, every tool call with its blocking verdict, the files edited after the first blocking answer, the verdict, and the final tree's blocking findings (`check_file` over every source file, in-process, with the project root).

The run cannot be done in the cloud environment where this was written: there is no `claude` login there and no network for the model.

## Dry run (tested here)

```bash
npx tsx scripts/v1.3/mcp-smoke.ts --dry-run [--behaviour fixes|ignores-block|never-checks]
```

The dry run replaces the `claude` process with `StubClaudeRunner`. It answers `--version`, and for the run it writes files into the cwd and emits the stream-json events a real run would. The tool results come from the **real** `check_file` handler, so the whole path except the model is exercised: the directories, the argv and MCP config, the environment filter, the transcript parser, and the final-tree check.

| Behaviour | What the stub does | Expected verdict |
|---|---|---|
| `fixes` | checks the tempting `Order.ts` (blocking answer), writes it, rewrites it with the time passed in, checks again (pass), adds the use case and checks it | called yes, acted **yes**, final tree clean |
| `ignores-block` | gets the blocking answer and writes the violating file anyway | called yes, acted **no**, final tree has FF-S01, FF-S04 |
| `never-checks` | writes the files and makes no tool call | called **no** (exit 1) |

All three are unit tests (`tests/unit/scripts/v1.3/mcp-smoke.test.ts`), with the argv deviations, the single strict MCP config, the dropped API key, and the clean-up.

## Reading the verdict

- `actedOnBlocking: yes`: every file a blocking answer named was edited after the answer and has no blocking finding at the end.
- `no`: every such file still has a blocking finding at the end.
- `partly`: anything in between (for example, edited but still blocking on one file).
- `n/a`: no check returned a blocking answer (the agent may have written compliant code first time, or never checked).

The final-tree check uses the same fast path as the tools, so it is subject to the same limits (`Docs/v1.3/mcp-v2.md` §6). For the full answer, run `evaluate_project` on the kept directory (`--keep`) with Neo4j.
