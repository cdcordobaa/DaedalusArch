# DETECT-02 `check_consistency`: pull mode (MCP tool) and push mode (gate)

**Exploratory (v1.5-exp).** Not the Study 2b instrument and never applied to it. Nothing under `src/` is changed; the
frozen MCP server is imported read-only. Scope: the two trap families the PUZZLE-01 puzzles elicit.

| Rule | Plain words (what the agent reads) |
|---|---|
| R-D4 | One command changes and saves one aggregate instance. Any other aggregate (another instance of the same type, or another type) is updated afterwards by a handler of a domain event that the first aggregate records. |
| R-XCTX | A bounded context changes only its own aggregates. Another context's aggregate changes when that context reacts to an event it subscribes to, not inside this command. |

Both read the aggregates and contexts from the spec's `architecture.ddd` block. The facts and rules live in
`../lib/` and `../rules/r-d4-*.cypher`, `../rules/r-xctx-*.cypher`. The check is symbolic: no model call, and the
same tree gives the same answer every time. A finding gives:
- the command's file:line;
- the rule;
- why the code breaks it: the command, the aggregates and instances, and the calls that reach each write;
- the write sites;
- a fix hint.

When one command breaks both rules, the two are reported as one finding.

## Pull mode: the MCP server (the agent calls the tool)

```
npx tsx experiments/detect-02/mcp/main.ts --spec <spec.yaml> --project <work tree> --engine cypher-interp --confine [--call-log <abs path outside the tree>]
```

- **Tools.** It serves every frozen tool unchanged (`get_architecture_spec`, `which_layer`, `check_import`,
  `evaluate_project`, `explain_violation`, `check_file`, `check_diff`, `suggest_placement`, `infer_spec`,
  `explain_finding`, `propose_spec`), plus `check_consistency`.
- **Input.** `{ files?: string[], project?, spec? }`. `files` keeps only the findings whose command, write site or
  store declaration is in one of the changed files.
- **Output.** `status` (`clean` | `violations` | `not-applicable`), `findings[]`, `summary` and `ms`, plus the same
  findings as text.
- **`--confine`.** The frozen `confineArgs` applies: a `spec` or `project` argument outside the configured ones is
  refused.
- **`--call-log`.** The frozen call log applies. `check_consistency` lines use `seq` from 1,000,001.

The tool description tells the agent what the tool is for and when to use it: after changing persistence code, a
command that saves aggregates or code that calls another context, and before finishing a step.

## Push mode: the gate (the harness runs the check after each turn)

```
npx tsx experiments/detect-02/mcp/push-gate.ts --project <work tree> --spec <spec.yaml> [--files a.ts,b.ts] [--json] [--always]
```

- **What it prints.** The same findings text on stdout, empty when the tree is clean. The loop harness appends it to
  the next prompt, like a CI gate.
- **Exit codes.** 0 for clean or not applicable, 1 for violations, 2 for an error.
- **Cost.** No call and no turn of its own. In push mode the agent sees the findings only if the run has a next turn
  (a later step, or a repair turn if the protocol allows one).

## Choosing a mode for a puzzle run

- **Pull.** The agent decides when to call the tool. This measures tool plus instruction; see
  `ops/notes/puzzle-02-tool-arm-note.md`.
- **Push.** Every turn gets the findings and nothing depends on the agent calling a tool. With 0 repair turns, the
  last step's findings are never acted on.

## Zero-call check (`zero-call-check.ts`)

```
npx tsx experiments/detect-02/mcp/zero-call-check.ts    # → ../results/zero-call-check.json
```

The check goes through the MCP layer: the experimental server with `--confine`, called by an in-process client.
- **Trees:** every P1 and P2 baseline agent tree (steps 1–3); the P1 and P2 trap and trap-alt solutions, clean
  solutions and seeds; and every P4 tree as a quiet check.
- **Probe:** it also checks that a `project` argument outside the configured project is refused.

`hint-audit/` holds the drafted agent frame for the tool arm and its hint audit (`Docs/v1.3/study2-task-design/
hint-audit.mjs`, rung L3, the puzzles' specs and the 51 puzzle terms of the baseline audit): 0 FAIL on P1 and P2.
