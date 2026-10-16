# 4. Using it inside a coding agent (MCP)

The MCP server lets a coding agent ask about the architecture while it writes code. The agent can ask which layer a
path belongs to and what that layer may import. It can check a file or a diff before writing it, and ask where a new
class should go. The server speaks MCP over stdio, so any MCP client can use it.

## Tools (branch `v1.3`)

| Tool | What it answers | Needs a database? |
|---|---|---|
| `get_architecture_spec` | The spec as data: layers, globs, what each layer may and may not import, rules with tier | no |
| `which_layer` | The layer of a file path, and what a file there may import | no |
| `check_import` | Would importing module B from file A break a rule? Rule id, tier, reason | no |
| `check_file` | A proposed file (path + content) checked against the import, purity and naming rules, with a fix per violation | no |
| `check_diff` | The `check_file` rules over a unified diff | no |
| `suggest_placement` | Layer, path and class name for something new ("repository for orders") | no |
| `explain_violation` | A rule's intent and fix guidance | no |
| `explain_finding` | Construct, source, tier and a minimal violating and compliant example for a rule id | no |
| `infer_spec` | Proposes a spec for a project with no spec (style, layer map, YAML) | no |
| `evaluate_project` | The full rule set on the whole project | **yes on `v1.3`**, no in PR #135 |

`check_file` and `check_diff` scan imports and class declarations lexically. They are fast (about 50 ms per file in
testing), but they cover only the rules that can be checked from one file: layer direction and skipping, domain
purity, and class naming. Cycles, injection and other graph rules need `evaluate_project`.

## Start the server

Build once, then run the compiled entry:

```bash
npm ci && npm run build
node dist/mcp-server/main.js --spec specs/clean-arch.yaml --project fixtures/variant-a-structural
# stderr: daedalus-arch MCP server ready on stdio
```

`--spec` and `--project` can also come from `DAEDALUS_SPEC` and `DAEDALUS_PROJECT`. Every tool also takes an optional
`spec` argument. Use absolute paths in client configs.

Without a build you can run `npx tsx src/mcp-server/main.ts ...` from inside the checkout.

## Claude Code

```bash
claude mcp add daedalus-arch -- node /path/to/DaedalusArch/dist/mcp-server/main.js \
  --spec /path/to/your-project/architecture/spec.yaml --project "$PWD"
```

Add `-s project` to write the entry to the project's `.mcp.json` instead of your local config. Claude Code asks you to
approve a project server the first time you start `claude` in that folder. Until then, `claude mcp list` shows it as
"Pending approval".

A project-level `.mcp.json` written by hand looks like this:

```json
{
  "mcpServers": {
    "daedalus-arch": {
      "command": "node",
      "args": [
        "/path/to/DaedalusArch/dist/mcp-server/main.js",
        "--spec", "/path/to/your-project/architecture/spec.yaml",
        "--project", "/path/to/your-project"
      ]
    }
  }
}
```

## Any other MCP client

Most clients (Cursor's `.cursor/mcp.json`, and others) accept the same `mcpServers` shape: a `command`, an `args`
list and an optional `env`. Use the JSON above.

## With PR #135 (`daedalus-mcp`, no database for any tool)

On branch `v1.3-npx`, `evaluate_project` uses the in-process engine when `NEO4J_URI` is not set. A repeated call on an
unchanged project is answered from a cache. In testing, the first call on `fixtures/variant-a-structural` took about
2 s and a repeat took a few milliseconds. `check_file` also takes `templates: true`, which runs the graph rules on the
project with the proposed file in place (about 1–3 s).

From the packed tarball (see [chapter 1](01-quick-start.md)):

```json
{
  "mcpServers": {
    "daedalus-arch": {
      "command": "npx",
      "args": [
        "--yes", "--package=/abs/path/daedalus-arch-0.1.0.tgz", "daedalus-mcp",
        "--spec", "/path/to/your-project/architecture/spec.yaml",
        "--project", "/path/to/your-project"
      ]
    }
  }
}
```

Leave `NEO4J_URI` out of `env` here. On that branch, setting it switches the server to Neo4j.

## What the agent gets back

`check_file` with path `src/domain/entities/Order.ts` and content `import { Entity } from "typeorm"; export class Order {}`,
on `specs/clean-arch.yaml` (output from branch `v1.3`, shortened):

```json
{
  "path": "src/domain/entities/Order.ts",
  "layer": "domain",
  "verdict": "violations",
  "summary": "src/domain/entities/Order.ts (domain): 1 violation(s) of FF-P01; apply each fix.",
  "violations": [
    {
      "rule": "FF-P01",
      "ruleName": "domain-purity",
      "severity": "critical",
      "tier": "blocking",
      "line": 1,
      "subject": "import \"typeorm\"",
      "reason": "domain layer domain may not import typeorm: it matches forbidden_imports entry \"typeorm\"",
      "fix": "Remove the \"typeorm\" import from domain. Keep framework code (decorators, ORM models, HTTP types) in infrastructure and map it to plain domain classes there."
    }
  ]
}
```

`which_layer` with path `src/domain/entities/Task.ts`:

```json
{
  "layer": "domain",
  "matchedGlob": "src/domain/**",
  "mayImport": [],
  "mayNotImport": ["application", "infrastructure"],
  "forbiddenPackages": ["@nestjs/*", "typeorm", "express", "prisma", "@prisma/*", "sequelize"]
}
```

On `v1.3`, `evaluate_project` without a database returns an error result that says what is missing:
`CONFIG_MISSING_ENV: NEO4J_PASSWORD is not set. evaluate_project needs a Neo4j instance...`.

## Try `check_file` without an MCP client

The same handler is available as a command (exit 0 clean, 1 violations, 2 usage):

```bash
printf 'import { Entity } from "typeorm";\nexport class Order {}\n' \
  | npm run -s mcp:check-file -- --spec specs/clean-arch.yaml src/domain/entities/Order.ts
echo $?    # 1
```

## Suggested agent instructions

A line like this in your agent's instructions (for example `CLAUDE.md`) makes the tools get used:

> Before creating or editing a file under `src/`, call `check_file` with the full new content. Fix every violation
> whose tier is `blocking` before writing. Use `suggest_placement` to decide where a new class goes.
