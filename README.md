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
| `check_file` | A proposed file (path + content) against every import rule (FF-S01, FF-S03, FF-S04, FF-P01) and the class naming rules (FF-CV02..04 when active): verdict, one-line summary, violations with rule id, line, reason and a concrete fix. Instant, no graph | spec |
| `check_diff` | The `check_file` rules over a unified diff: new files whole, modified files on their added lines (new-file line numbers) | spec |
| `suggest_placement` | Where a new class or module goes, from its purpose ("repository for orders"): layer, a path the spec maps to that layer, a class name that passes the naming rules, what it may import | spec |

Without Neo4j every tool but `evaluate_project` works. `evaluate_project` returns an error result
(`NEO4J_UNREACHABLE` or `CONFIG_MISSING_ENV`) that says what to fix.

### Try it in three commands

```bash
npm ci
export NEO4J_PASSWORD=choose-a-password && docker compose up -d     # optional: only evaluate_project needs Neo4j
npm run mcp -- --spec specs/clean-arch.yaml --project fixtures/variant-a-structural   # speaks MCP on stdio
```

To poke at it by hand, use the MCP inspector: `npx @modelcontextprotocol/inspector npm run mcp -- --spec specs/clean-arch.yaml`.

### Agent loop tools: example outputs

Outputs below are real, on `specs/clean-arch.yaml` (in that spec FF-S03 is not applicable and FF-CV01/FF-CV04 are
disabled, so `checkedRules` lists the five rules that can fire). Every result leads with `verdict` and `summary`,
so an agent can stop reading there when the file is clean.

`check_file` with `path: "src/domain/entities/Order.ts"` and content importing `typeorm` and an infrastructure class:

```json
{
  "path": "src/domain/entities/Order.ts",
  "layer": "domain",
  "verdict": "violations",
  "summary": "src/domain/entities/Order.ts (domain): 3 violation(s) of FF-P01, FF-S01, FF-S04; apply each fix.",
  "violations": [
    {
      "rule": "FF-P01", "ruleName": "domain-purity", "severity": "critical", "line": 1,
      "subject": "import \"typeorm\"",
      "reason": "domain layer domain may not import typeorm: it matches forbidden_imports entry \"typeorm\"",
      "fix": "Remove the \"typeorm\" import from domain. Keep framework code (decorators, ORM models, HTTP types) in infrastructure and map it to plain domain classes there."
    },
    {
      "rule": "FF-S01", "ruleName": "dependency-direction", "severity": "critical", "line": 2,
      "subject": "import \"../../infrastructure/repositories/SqlOrderRepository\"",
      "reason": "domain (position 0) may not import infrastructure (position 2): layers are ordered inner to outer and may only depend on themselves or inner layers",
      "fix": "Do not import infrastructure from domain (it may import: no other layer). Declare an interface for what you need in domain, implement it in infrastructure, and inject the implementation from the composition root."
    },
    { "rule": "FF-S04", "ruleName": "no-domain-outward-dep", "severity": "major", "line": 2, "...": "..." }
  ],
  "advisories": [],
  "unresolved": [],
  "checkedRules": ["FF-S01", "FF-S04", "FF-P01", "FF-CV02", "FF-CV03"],
  "notes": []
}
```

`advisories` holds the same hits for `require()` and `import()` calls, which the frozen firewall counts but does not
score; `unresolved` lists alias imports (`@/x`) the spec alone cannot place (verdict `unknown` if nothing else fires).

`check_diff` with a diff that adds `src/application/services/OrderServiceImpl.ts`:

```json
{
  "verdict": "violations",
  "summary": "1 violation(s) in src/application/services/OrderServiceImpl.ts; apply each fix.",
  "files": [
    {
      "path": "src/application/services/OrderServiceImpl.ts", "layer": "application", "change": "added",
      "verdict": "violations",
      "violations": [
        {
          "rule": "FF-CV02", "ruleName": "naming-services", "severity": "minor", "line": 3,
          "subject": "class OrderServiceImpl",
          "reason": "class OrderServiceImpl does not match the naming pattern \"*Service|*UseCase\"",
          "fix": "Rename OrderServiceImpl to OrderService."
        }
      ],
      "...": "..."
    }
  ],
  "skipped": []
}
```

`suggest_placement` with `purpose: "repository for orders"`:

```json
{
  "purpose": "repository for orders",
  "summary": "IOrderRepository -> src/domain/repositories/IOrderRepository.ts (domain); SqlOrderRepository -> src/infrastructure/repositories/SqlOrderRepository.ts (infrastructure)",
  "placements": [
    {
      "role": "repository-interface", "layer": "domain",
      "path": "src/domain/repositories/IOrderRepository.ts", "className": "IOrderRepository",
      "why": "layer domain lists role repository-interface; the interface (port) the use cases depend on",
      "mayImport": [],
      "forbiddenPackages": ["@nestjs/*", "typeorm", "express", "prisma", "@prisma/*", "sequelize"]
    },
    {
      "role": "repository-impl", "layer": "infrastructure",
      "path": "src/infrastructure/repositories/SqlOrderRepository.ts", "className": "SqlOrderRepository",
      "why": "layer infrastructure lists role repository-impl; implements IOrderRepository (prefix names the storage: Sql, InMemory, TypeOrm)",
      "mayImport": ["domain", "application"],
      "forbiddenPackages": []
    }
  ],
  "notes": []
}
```

Try `check_file` without an MCP client (same handler, same JSON; exit 0 clean, 1 violations, 2 usage):

```bash
printf 'import { Entity } from "typeorm";\nexport class OrderRepoImpl {}\n' \
  | npm run -s mcp:check-file -- --spec specs/clean-arch.yaml src/domain/Order.ts
npm run -s mcp:check-file -- --spec specs/clean-arch.yaml src/domain/Order.ts path/to/draft.ts   # content from a file
```

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
- `check_file` and `check_diff` scan imports and classes lexically (comments ignored, no compiler), so an import
  built at run time is not seen and a decorator with nested parentheses may be missed. `check_diff` sees only added
  lines of a modified file; a file moved across layers needs `check_file` on its whole content.
- `suggest_placement` maps the purpose to a role by a keyword table; the subfolder (`repositories/`, `use-cases/`)
  is a convention, not a rule, and the path is verified only against the spec's layer globs.
- Tool calls are not logged; the experiment needs a call log (see the design doc).

Tests: `npx jest tests/unit/mcp-server`. Source: `src/mcp-server/`.

### Experiment harness (draft, no live runs)

`scripts/lib/generators/arms.ts` adds tool arms to the E1 Claude Code headless call without changing it: `none`
(the E1 argv), `daedalus-mcp` (`--mcp-config` naming only this server, `--strict-mcp-config` kept, the seven
spec-only tools allowed by exact name, `evaluate_project` denied) and `context-graph` (a placeholder for a context
tool such as Serena or graphify; the steps to plug one in are in `ContextGraphProvider`). Print every arm's argv and
MCP config without calling anything:

```bash
npx tsx scripts/generator/arms-dry-run.ts            # first cell per arm; --all for every cell, --json for JSON
```

The pre-registration draft is `Docs/prereg-drafts/firewall-in-the-loop.md` (DRAFT, not registered).

## Ontology v0: grounded semantic layer (v1.3, running it live locally)

`src/apg-enrich/ontology/` builds a separate `Sem*` layer over the APG: capabilities, business rules,
responsibilities and business concepts, each with provenance (model, prompt hash, run id, temperature), a confidence
and evidence that a grounding validator checked against the APG and the source. The cheap proxies propose, the model
interprets, deterministic checks verify. Design and threats: `Docs/v1.3/ontology-v0-design.md`.

The model is reached only through the judge's isolated Claude CLI route: the pinned CLI version, the dedicated
config dir (default `~/.firewall/judge-claude-config`), the allow-listed child environment, the neutral cwd and the
init probe. Credentials are never read. A cloud session cannot run that route, so everything in the repository is
tested with a mock provider and recorded-fixture cassettes. The live run is local only:

```bash
npx tsx scripts/v1.3/ontology-run.ts --fixtures --estimate               # calls and prompt tokens per case; calls nothing
npx tsx scripts/v1.3/ontology-run.ts --fixtures --budget 120             # live record into tests/fixtures/v1.3-ontology/cassettes-claude-cli/
npx tsx scripts/v1.3/ontology-run.ts --fixtures --replay                 # replay the live cassettes (no call) and re-score
npx tsx scripts/v1.3/ontology-run.ts --project <dir> --spec <spec.yaml> --estimate
npx tsx scripts/v1.3/ontology-run.ts --project <dir> --spec <spec.yaml> --budget 200 --cassettes <dir>
```

- `--budget` caps provider calls per project. Cache hits are free.
- A usage-limit or auth stop ends the run with exit code 4. Every answer recorded so far stays in the cassettes, so
  the same command resumes from there.
- `--judge-outcomes <json>` (`{"<case>": {"source": "...", "failedFiles": [...]}}`) adds the judge's outcome on the
  same items to the score table.
- Results go to `results/v1.3-ontology/<provider>[-replay]/`: one `result.json` per project and `scores.json`.
- The mock fixture run is `--provider mock`. Its answers are hand-written, so its scores check the plumbing only.

Tests: `npx jest tests/unit/apg-enrich/ontology tests/unit/scripts/ontology-run.test.ts`.
