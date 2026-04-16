# Architectonic Firewall — Project Init

Generate a tailored `firewall.spec.yaml` for a TypeScript project. This skill scans the codebase, classifies the architecture style, selects a preset, maps directories to layers, and produces a ready-to-use spec.

## Prerequisites

- The Architectonic Firewall CLI must be installed (`npx firewall --help` should work)
- Neo4j must be running locally (`docker compose up -d neo4j`)
- The target project must be a TypeScript project with `package.json` and `tsconfig.json`

## Workflow

### Step 1: Scan Project Structure

Read the project to gather structural signals:

1. Read `package.json` — check dependencies for framework markers:
   - `@nestjs/core` → NestJS project
   - No framework markers → Clean Architecture / plain TypeScript
2. Read `tsconfig.json` — note path aliases and source roots
3. List the `src/` directory tree (2 levels deep) to understand folder structure
4. Count files per top-level directory under `src/`

### Step 2: Classify Architecture Style

Based on structural signals, classify as one of:
- **nestjs**: `@nestjs/core` in dependencies
- **clean-architecture**: No framework markers (default)

Report the classification and the evidence that led to it.

### Step 3: Select Preset

Load the matching preset template:
- `presets/clean-architecture.yaml` for clean-architecture
- `presets/nestjs.yaml` for NestJS

### Step 4: Map Directories to Layers

Examine the actual project directory structure and map folders to architectural layers:

**For clean-architecture:**
- Domain layer: `src/domain/`, `src/core/`, `src/entities/`, `src/models/`
- Application layer: `src/application/`, `src/use-cases/`, `src/services/`
- Infrastructure layer: `src/infrastructure/`, `src/infra/`, `src/adapters/`, `src/persistence/`

**For nestjs:**
- Domain layer: `src/domain/`, `src/core/`
- Application layer: `src/application/`, `src/use-cases/`, `src/services/`
- Infrastructure layer: `src/infrastructure/`, `src/persistence/`, `src/adapters/`
- Presentation layer: `src/controllers/`, `src/modules/`, `src/gateways/`

Only include directories that actually exist in the project. Add glob suffixes (`/**`).

### Step 5: Customize Exclude Paths

Add project-specific exclude paths:
- Always: `node_modules/**`, `dist/**`, `**/*.spec.ts`, `**/*.test.ts`
- If `test/` or `tests/` exists: `test/**` or `tests/**`
- If generated code dirs exist (e.g., `generated/`, `__generated__/`): add them

### Step 6: Generate firewall.spec.yaml

Create `firewall.spec.yaml` in the project root by:
1. Starting from the preset template
2. Replacing placeholder layer directories with actual project paths
3. Adding project-specific exclude paths

Present the generated spec to the user for review.

### Step 7: Validate the Spec

Run:
```bash
npx firewall validate --spec firewall.spec.yaml --project .
```

If validation fails, fix the issues and regenerate.

### Step 8: Run First Evaluation

After user approves the spec:
```bash
npx firewall evaluate --spec firewall.spec.yaml --project . --format json --symbolic-only
```

Present a summary:
- AHS score
- Verdict (pass/warning/soft-block/hard-block)
- Number of violations by severity
- Top 5 most impactful violations

### Step 9: Create Baseline

If the evaluation found violations:
```bash
npx firewall baseline --spec firewall.spec.yaml --project . -o baseline_violations.json
```

Report: "Baseline created with N existing violations. Future new violations will block CI."

### Step 10: Summary

Present the final summary:
- Architecture style detected
- Layers mapped
- Fitness functions active (enabled count / total)
- AHS score from first evaluation
- Baseline status
- Files created: `firewall.spec.yaml`, `baseline_violations.json` (if applicable)

Suggest next steps:
- Add `firewall evaluate` to CI pipeline
- Review and customize thresholds in `firewall.spec.yaml`
- Run `firewall evaluate --baseline baseline_violations.json` in CI

---

## APG Mining Queries

These Cypher queries can be used against the Neo4j APG to extract structural signals for classification. They are provided here as reference for manual investigation — the skill uses directory scanning and `package.json` analysis for classification instead.

### Query 1: Directory Structure Signals
```cypher
MATCH (f:File)
WITH split(f.filePath, '/') AS parts
WITH parts[0..size(parts)-1] AS dirParts
WITH reduce(s = '', p IN dirParts | s + '/' + p) AS dir
RETURN dir, count(*) AS fileCount
ORDER BY fileCount DESC
LIMIT 20
```

### Query 2: Dependency Matrix (Layer-to-Layer)
```cypher
MATCH (source:File)-[:IMPORTS]->(target:File)
WHERE source.layer IS NOT NULL AND target.layer IS NOT NULL
RETURN source.layer AS fromLayer, target.layer AS toLayer, count(*) AS importCount
ORDER BY importCount DESC
```

### Query 3: Naming Pattern Counts
```cypher
MATCH (c:Class)
WITH c,
  CASE
    WHEN c.name STARTS WITH 'I' AND c.name =~ 'I[A-Z].*' THEN 'Interface-prefix'
    WHEN c.name ENDS WITH 'Repository' THEN 'Repository'
    WHEN c.name ENDS WITH 'Service' THEN 'Service'
    WHEN c.name ENDS WITH 'UseCase' THEN 'UseCase'
    WHEN c.name ENDS WITH 'Controller' THEN 'Controller'
    WHEN c.name ENDS WITH 'Module' THEN 'Module'
    ELSE 'Other'
  END AS pattern
RETURN pattern, count(*) AS count
ORDER BY count DESC
```

### Query 4: Constructor Injection Ratio
```cypher
MATCH (c:Class)
OPTIONAL MATCH (c)-[:HAS_CONSTRUCTOR]->(ctor:Method)
OPTIONAL MATCH (ctor)-[:HAS_PARAMETER]->(p:Parameter)
WHERE p.type STARTS WITH 'I' OR p.type CONTAINS 'Interface'
WITH c, count(p) AS interfaceParams
RETURN
  count(CASE WHEN interfaceParams > 0 THEN 1 END) AS classesWithDI,
  count(c) AS totalClasses,
  toFloat(count(CASE WHEN interfaceParams > 0 THEN 1 END)) / count(c) AS diRatio
```

### Query 5: Anomalies (Cross-Layer Violations)
```cypher
MATCH (source:File)-[:IMPORTS]->(target:File)
WHERE source.layer IS NOT NULL AND target.layer IS NOT NULL
AND source.layer <> target.layer
RETURN source.filePath, source.layer, target.filePath, target.layer
LIMIT 20
```
