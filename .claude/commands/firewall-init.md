# Architectonic Firewall — Project Init

Generate a tailored `firewall.spec.yaml` for a TypeScript project, run the first evaluation, create a baseline, and produce an HTML report.

**Usage**: `/firewall-init --project <path-to-target-project>`

## Prerequisites

- Neo4j must be running locally (`docker compose up -d` from DaedalusArch root)
- The target project must be a TypeScript project with `package.json` and `tsconfig.json`
- The target project must have dependencies installed (`npm install`)

## Workflow

### Step 1: Validate prerequisites

1. Check Neo4j is running: `docker ps --filter "name=neo4j"`
2. Check the target project exists and has `package.json` + `tsconfig.json`
3. Check `node_modules/` exists in the target — if not, warn the user to run `npm install`

### Step 2: Scan project structure

Read the project to gather structural signals:

1. Read `package.json` — check dependencies for framework markers:
   - `@nestjs/core` in dependencies → **NestJS** project
   - No framework markers → **Clean Architecture** / plain TypeScript
2. Read `tsconfig.json` — check for:
   - `include` field: must include source files (not just project references)
   - Path aliases: note any `@app/*`, `@core/*`, etc.
   - If `tsconfig.json` uses project references with empty `include`/`files`, check for `tsconfig.app.json` and warn that a flat tsconfig is needed for ts-morph
3. List the `src/` directory tree (2 levels deep) to understand folder structure
4. Count `.ts` files per top-level directory under `src/`

### Step 3: Classify architecture style

Based on structural signals, classify as one of:
- **nestjs**: `@nestjs/core` in dependencies
- **clean-architecture**: No framework markers (default)

Report the classification and evidence to the user.

### Step 4: Detect project shape (NestJS only)

For NestJS projects, determine if the project uses:

**A) Layered directories** — explicit `src/domain/`, `src/application/`, `src/infrastructure/` folders
**B) Feature modules (co-located)** — `src/auth/`, `src/users/`, etc. where each module contains its own controller, service, repository, DTOs

Most real-world NestJS projects use shape B. The preset handles BOTH shapes via `file_patterns` fallback — no manual tuning needed.

### Step 5: Select and copy preset

Copy the matching preset to the target project root:

```bash
cp DaedalusArch/presets/nestjs.yaml <target>/firewall.spec.yaml
# or
cp DaedalusArch/presets/clean-architecture.yaml <target>/firewall.spec.yaml
```

**IMPORTANT**: The NestJS preset works out of the box for both layered and feature-module projects. It uses `file_patterns` to assign layers per file:

| File pattern | Layer | Role |
|---|---|---|
| `*.controller.ts` | presentation | controller |
| `*.module.ts` | presentation | module |
| `*.guard.ts` | presentation | guard |
| `*.interceptor.ts` | presentation | interceptor |
| `*.service.ts` | application | service |
| `*.processor.ts` | application | processor |
| `**/dto/**`, `*.dto.ts` | application | dto |
| `*.repository.ts` | infrastructure | repository |
| `*.worker.ts` | infrastructure | worker |
| `**/strategies/**` | infrastructure | strategy |

Layer order (inner to outer): **domain → infrastructure → application → presentation**

Dependency direction: outer layers may import from adjacent inner layers. `*.module.ts` files are excluded from layer-skip checking because they are NestJS DI wiring.

### Step 6: Customize exclude paths

Check for project-specific paths to exclude and add them to `default_exclude_paths` in the spec:

- If `src/generated/` or `src/__generated__/` exists → add `src/generated/**`
- If `prisma/` has generated client in `src/` → add the generated path
- If `migrations/` exist → add `src/migrations/**`
- If `test/` or `tests/` exists and not already listed → add it

### Step 7: Validate the spec

Run from the DaedalusArch directory:

```bash
NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'validate',
  '--spec', '<target>/firewall.spec.yaml',
  '--project', '<target>']);
"
```

Expected: `Spec valid: N fitness functions, L layers, 0 errors`

If validation fails, fix the spec and retry.

### Step 8: Run first evaluation

```bash
NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'evaluate',
  '--project', '<target>',
  '--spec', '<target>/firewall.spec.yaml',
  '--symbolic-only',
  '--format', 'json',
  '--verbose']);
"
```

Present a summary to the user:
- **AHS score** and **verdict** (pass / warning / soft-block / hard-block)
- **Per-dimension breakdown** (structural, coupling, pattern, solid, convention)
- **Violation counts** by severity (critical, major, minor, advisory)
- **Top 5 violations** with file paths and explanations
- **Universal metrics** (cycles, max fan-out, max fan-in, abstraction ratio, avg instability, orphans)

### Step 9: Generate HTML report

```bash
NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'report',
  '--project', '<target>',
  '--spec', '<target>/firewall.spec.yaml',
  '-o', '<target>/report.html',
  '--symbolic-only',
  '--verbose']);
"
```

Open in browser: `open <target>/report.html`

### Step 10: Create baseline

If violations were found, create a baseline so future CI runs only block on NEW violations:

```bash
NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'baseline',
  '--project', '<target>',
  '--spec', '<target>/firewall.spec.yaml',
  '-o', '<target>/baseline_violations.json',
  '--verbose']);
"
```

### Step 11: Final summary

Present the complete summary:

```
Architecture style:  [nestjs / clean-architecture]
Project shape:       [feature-modules / layered-directories]
Files analyzed:      N
Layers mapped:       L (list names)
Fitness functions:   X enabled / Y total

AHS Score:           0.XX (verdict)
Violations:          N total (C critical, M major, m minor, A advisory)

Files created:
  - firewall.spec.yaml
  - report.html
  - baseline_violations.json (if violations found)
```

Suggest next steps:
1. Open `report.html` to review violations in detail
2. Add `firewall evaluate --baseline baseline_violations.json` to CI pipeline
3. Review and customize thresholds in `firewall.spec.yaml` if needed
4. Address critical violations first — they have the highest AHS impact

---

## Troubleshooting

### "No .ts source files found"
- **Cause**: Dependencies not installed, or `tsconfig.json` uses project references with empty `include`
- **Fix**: Run `npm install` in the target project. For monorepos, ensure the `tsconfig.json` in the target app has `"include": ["src/**/*.ts"]`

### "Failed to clear graph: authentication failure"
- **Cause**: Wrong Neo4j password
- **Fix**: Set `NEO4J_PASSWORD=daedalus-dev` (or whatever is configured in `docker-compose.yml`)

### "Unknown architecture style"
- **Cause**: The `style` field in the spec doesn't match a registered template
- **Fix**: Use `nestjs` or `clean-architecture` (these are the two registered styles)

### "Schema validation failed"
- **Cause**: Spec YAML has invalid structure
- **Fix**: Check that each layer has `name`, `roles`, and at least one of `directories` or `file_patterns`

---

## APG Mining Queries (optional)

After evaluation, the APG is in Neo4j. These Cypher queries can be used for manual investigation via the Neo4j Browser at `http://localhost:7474`:

### Layer assignment summary
```cypher
MATCH (f:File)
RETURN f.layer AS layer, count(*) AS fileCount
ORDER BY fileCount DESC
```

### Cross-layer imports
```cypher
MATCH (src:File)-[:IMPORTS]->(tgt:File)
WHERE src.layer IS NOT NULL AND tgt.layer IS NOT NULL
  AND src.layer <> tgt.layer
RETURN src.layer AS fromLayer, tgt.layer AS toLayer, count(*) AS importCount
ORDER BY importCount DESC
```

### Naming pattern distribution
```cypher
MATCH (c:Class)
WITH c,
  CASE
    WHEN c.name ENDS WITH 'Repository' THEN 'Repository'
    WHEN c.name ENDS WITH 'Service' THEN 'Service'
    WHEN c.name ENDS WITH 'Controller' THEN 'Controller'
    WHEN c.name ENDS WITH 'Module' THEN 'Module'
    WHEN c.name ENDS WITH 'Guard' THEN 'Guard'
    ELSE 'Other'
  END AS pattern
RETURN pattern, count(*) AS count
ORDER BY count DESC
```

### Files with highest fan-out
```cypher
MATCH (f:File)-[:IMPORTS]->(target:File)
WITH f, count(target) AS fanOut
ORDER BY fanOut DESC
LIMIT 10
RETURN f.filePath, fanOut
```
