# DaedalusArch

An architectural firewall for TypeScript: a YAML spec (layers, fitness functions) is checked against an
architecture property graph, scored as an Architecture Health Score (AHS) and turned into a verdict. See
`Docs/` for the requirements, the registered instrument and the experiment plans.

## MCP server (v1.3 prototype)

> **Prototype.** Groundwork for a "firewall in the loop" experiment (design in
> [`Docs/mcp-firewall-in-the-loop.md`](Docs/mcp-firewall-in-the-loop.md)). It adds code only: the frozen
> instrument (rules, scoring, specs, presets, registered artefacts) is unchanged.

An MCP server over stdio that lets an AI coding agent ask for the architecture constraints and verdicts while it
writes code.

| Tool | Answers | Needs |
|---|---|---|
| `get_architecture_spec` | The spec as data: layers (inner to outer), globs, which layers each may and may not import, forbidden packages, every rule with status and description | spec |
| `which_layer` | The layer of a file path, plus the layers and packages a file there may and may not import | spec |
| `check_import` | Would an import from file A to module B break a rule? Rule id, severity and reason. Spec-based and instant, no graph (covers FF-S01, FF-S03, FF-S04, FF-P01; not cycles or class-level rules) | spec |
| `evaluate_project` | The existing symbolic-only pipeline on a project: AHS, verdict, violations by rule. Slow, and it **replaces the graph in the Neo4j database**, so use a scratch instance | spec, Neo4j |
| `explain_violation` | A rule's intent and fix guidance, from the rule template and the report catalogue (by rule id, rule name or violation type) | none (spec adds context) |

Without Neo4j the first, second, third and fifth tools work. `evaluate_project` returns an error result
(`NEO4J_UNREACHABLE` or `CONFIG_MISSING_ENV`) that says what to fix.

### Try it in three commands

```bash
npm ci
export NEO4J_PASSWORD=choose-a-password && docker compose up -d     # optional: only evaluate_project needs Neo4j
npm run mcp -- --spec specs/clean-arch.yaml --project fixtures/variant-a-structural   # speaks MCP on stdio
```

To poke at it by hand, use the MCP inspector: `npx @modelcontextprotocol/inspector npm run mcp -- --spec specs/clean-arch.yaml`.

### Configuration

Flags: `--spec <spec.yaml>` and `--project <dir>`; or `DAEDALUS_SPEC` and `DAEDALUS_PROJECT`. Every tool also
takes an optional `spec` argument (and `evaluate_project` an optional `project`). Neo4j, for `evaluate_project`
only, uses the CLI's variables: `NEO4J_URI` (default `bolt://localhost:7687`), `NEO4J_USER` (default `neo4j`),
`NEO4J_PASSWORD` (required, no default) and `APG_STORE_PATH`. File paths are project-relative; absolute paths
inside `--project` are made relative.

Build once (`npm run build`) to run the compiled entry `dist/mcp-server/main.js` (also installed as the
`daedalus-arch-mcp` bin). Use absolute paths in the configs below; replace `/path/to/DaedalusArch`.

#### Claude Code

```bash
claude mcp add daedalus-arch -- node /path/to/DaedalusArch/dist/mcp-server/main.js \
  --spec /path/to/DaedalusArch/specs/clean-arch.yaml --project "$PWD"
```

or a project-level `.mcp.json`:

```json
{
  "mcpServers": {
    "daedalus-arch": {
      "command": "node",
      "args": [
        "/path/to/DaedalusArch/dist/mcp-server/main.js",
        "--spec", "/path/to/DaedalusArch/specs/clean-arch.yaml",
        "--project", "."
      ],
      "env": {
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": "${NEO4J_PASSWORD}"
      }
    }
  }
}
```

#### Cursor

`.cursor/mcp.json` in the project (or `~/.cursor/mcp.json` for all projects):

```json
{
  "mcpServers": {
    "daedalus-arch": {
      "command": "node",
      "args": [
        "/path/to/DaedalusArch/dist/mcp-server/main.js",
        "--spec", "/path/to/DaedalusArch/specs/clean-arch.yaml",
        "--project", "/path/to/your/project"
      ],
      "env": {
        "NEO4J_PASSWORD": "${env:NEO4J_PASSWORD}"
      }
    }
  }
}
```

Drop the `env` block if you do not need `evaluate_project`. Without a build, use
`"command": "npx", "args": ["tsx", "/path/to/DaedalusArch/src/mcp-server/main.ts", ...]`.

### Limits of the prototype

- `check_import` resolves relative specifiers, project-relative bare paths and packages. Path aliases from
  `tsconfig` cannot be resolved without TypeScript's module resolution; the tool answers `unknown` and takes a
  `resolvedPath`. It does not see `default_exclude_paths` (extraction excludes) or role exemptions.
- `check_import` is a restatement of four Cypher rules as predicates; the tests pin its answers on the
  `fixtures/` projects, and `Docs/mcp-firewall-in-the-loop.md` asks for a full fidelity check before any experiment.
- Tool calls are not logged; the experiment needs a call log (see the design doc).

Tests: `npx jest tests/unit/mcp-server`. Source: `src/mcp-server/`.
