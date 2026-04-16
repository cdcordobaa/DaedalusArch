# Architectonic Firewall — Agent Playbook

Complete operational guide for evaluating any TypeScript project for architectural compliance. This document is self-contained — an agent reading it understands the system internals, the graph model, the rule engine, the spec format, and every step of execution.

---

## What This System Is

The Architectonic Firewall converts source code into a **directed property graph** and runs **architectural fitness functions** (Cypher queries) against it. It answers: "does this codebase follow its declared architectural rules?"

The core idea: architecture is not in the text of the code — it's in the **relationships between modules**. Who imports whom, who injects whom, who extends whom. A graph database captures these relationships naturally, and graph queries express architectural rules concisely.

---

## The Graph Model (APG — Architecture Property Graph)

Every TypeScript file is parsed into nodes and edges that form the APG.

### Node Types

| Type | What it represents | Key properties |
|---|---|---|
| `File` | A `.ts` source file | `filePath`, `name`, `layer`, `role`, `isBarrel` |
| `Class` | A class declaration | `filePath`, `name`, `layer`, `decorators[]` |
| `Interface` | An interface declaration | `filePath`, `name`, `layer` |
| `Method` | A method on a class/interface | `filePath`, `name` |
| `Function` | A standalone function | `filePath`, `name` |

### Edge Types

| Type | Meaning | Example |
|---|---|---|
| `IMPORTS` | File A imports from File B | `auth.service.ts` → `prisma.service.ts` |
| `IMPLEMENTS` | Class implements Interface | `UserRepository` → `IUserRepository` |
| `EXTENDS` | Class extends another Class | `AdminService` → `BaseService` |
| `CONSTRUCTOR_INJECTS` | Class constructor takes a dependency | `AuthService` injects `JwtService` |
| `CALLS` | Function/method calls another | `login()` calls `hashPassword()` |
| `DECLARES` | File declares a Class/Interface/Function | `user.entity.ts` declares `UserEntity` |
| `CONTAINS` | Class contains a Method | `AuthService` contains `login()` |

### Example: What a NestJS Feature Module Looks Like in the Graph

Given this source structure:
```
src/auth/
  auth.controller.ts    → imports auth.service
  auth.service.ts       → imports prisma.service, jwt (NestJS), bcrypt
  auth.module.ts        → imports controller, service, jwt module
  dto/auth.dto.ts       → standalone, imported by controller
  guards/jwt.guard.ts   → imports jwt from @nestjs
```

The graph contains:
```
(:File {name: "auth.controller.ts", layer: "presentation"})
  -[:IMPORTS]-> (:File {name: "auth.service.ts", layer: "application"})
  -[:IMPORTS]-> (:File {name: "auth.dto.ts", layer: "application"})

(:File {name: "auth.service.ts", layer: "application"})
  -[:IMPORTS]-> (:File {name: "prisma.service.ts", layer: "infrastructure"})

(:Class {name: "AuthService", layer: "application"})
  -[:CONSTRUCTOR_INJECTS]-> (:Class {name: "PrismaService"})   ← concrete, not interface
  -[:CONSTRUCTOR_INJECTS]-> (:Class {name: "JwtService"})
  -[:CONTAINS]-> (:Method {name: "login"})
  -[:CONTAINS]-> (:Method {name: "register"})
```

This graph is loaded into Neo4j. Every fitness function is a Cypher query against this graph.

---

## The Spec (firewall.spec.yaml)

The spec is a YAML file with three sections:

### 1. Architecture — Layer Definitions

```yaml
architecture:
  style: nestjs

  layers:
    # Ordered inner → outer. Dependencies flow inward (outer imports inner).
    - name: domain
      directories:
        - src/domain/**
        - src/core/**
      roles: [entity, value-object, domain-service, repository-interface]

    - name: infrastructure
      directories:
        - src/prisma/**
        - src/lib/**
      file_patterns:
        - "**/*.repository.ts"
        - "**/*.worker.ts"
        - "**/strategies/**"
      roles: [repository-impl, orm-entity, external-service, middleware]

    - name: application
      file_patterns:
        - "**/*.service.ts"
        - "**/*.processor.ts"
        - "**/dto/**"
      roles: [use-case, dto, application-service, processor]

    - name: presentation
      file_patterns:
        - "**/*.controller.ts"
        - "**/*.module.ts"
        - "**/*.guard.ts"
        - "**/*.interceptor.ts"
      roles: [controller, module, guard, interceptor]
      decorators: ["@Controller", "@Module"]
```

**How layer assignment works**: When the APG is ingested into Neo4j, the Layer Annotator assigns each `:File` node a `layer` property. It tries four strategies in priority order:

1. **Directory glob** — `src/prisma/prisma.service.ts` matches `src/prisma/**` → `infrastructure`
2. **File pattern** — `src/auth/auth.service.ts` matches `**/*.service.ts` → `application`
3. **Class naming** — a class named `UserRepository` matches the `repository-impl` role → `infrastructure`
4. **Decorator** — a class with `@Controller` decorator → `presentation`

First match wins. Files that match nothing get `layer: null` and are excluded from layer-aware rules.

**Why layer ORDER matters**: The order in the YAML defines allowed dependency direction. Adjacent layers can depend on each other (outer → inner). Non-adjacent imports are "layer skips." For NestJS:

```
presentation → application → infrastructure → domain
(allowed)      (allowed)      (allowed)
presentation → infrastructure                        ← LAYER SKIP (violation)
presentation → domain                                ← LAYER SKIP (violation)
infrastructure → presentation                        ← WRONG DIRECTION (violation)
```

### 2. Fitness Functions

Each function is a named rule with a severity, dimension, and evaluation route:

```yaml
fitness_functions:
  - id: FF-S02
    name: no-cyclic-deps
    dimension: structural
    severity: critical
    route: symbolic
    validated: true

  - id: FF-P02
    name: dependency-inversion
    dimension: pattern
    severity: critical
    route: symbolic
    validated: true
    threshold: 0.85

  - id: FF-C02
    name: module-fan-out
    dimension: coupling
    severity: major
    route: symbolic
    validated: true
    threshold: 12

  - id: FF-S03
    name: no-layer-skip
    dimension: structural
    severity: critical
    route: symbolic
    exclude_paths:
      - "**/*.module.ts"     # NestJS modules are DI wiring
```

### 3. Scoring Weights and Thresholds

```yaml
scoring:
  weights:
    structural: 0.35
    coupling: 0.20
    pattern: 0.30
    solid: 0.10
    convention: 0.05
  thresholds:
    pass: 0.80
    warning: 0.65
    soft_block: 0.50
```

---

## The Cypher Queries (What the Rules Actually Look Like)

Each fitness function compiles to a parameterized Cypher query. Here are the most important ones:

### Cyclic Dependencies (FF-S02)

Finds circular import chains of length 2 or more:

```cypher
MATCH path = (f:File)-[:IMPORTS*2..]->(f)
RETURN [n IN nodes(path) | n.filePath] AS cycle
LIMIT 100
```

If this returns rows, each row is a cycle like `[auth.service.ts, user.service.ts, auth.service.ts]`.

### Dependency Direction (FF-S01)

Finds files in inner layers that import from outer layers (wrong direction):

```cypher
WITH $layerOrder AS layerOrder
MATCH (src:File)-[:IMPORTS]->(tgt:File)
WHERE src.layer IS NOT NULL AND tgt.layer IS NOT NULL
  AND src.layer <> tgt.layer
WITH src, tgt,
     apoc.coll.indexOf(layerOrder, src.layer) AS srcIdx,
     apoc.coll.indexOf(layerOrder, tgt.layer) AS tgtIdx
WHERE srcIdx >= 0 AND tgtIdx >= 0 AND srcIdx < tgtIdx
RETURN src.filePath AS source, tgt.filePath AS target,
       src.layer AS srcLayer, tgt.layer AS tgtLayer
```

`$layerOrder` = `["domain", "infrastructure", "application", "presentation"]`. A file at index 0 (domain) importing from index 2 (application) has `srcIdx < tgtIdx` → violation.

### Layer Skip (FF-S03)

Finds imports that bypass intermediate layers:

```cypher
MATCH (src:File)-[:IMPORTS]->(tgt:File)
WHERE src.layer IS NOT NULL AND tgt.layer IS NOT NULL
  AND src.layer <> tgt.layer
  AND NOT (src.layer + '>' + tgt.layer) IN $allowedTransitions
RETURN src.filePath AS source, tgt.filePath AS target,
       src.layer AS srcLayer, tgt.layer AS tgtLayer
```

`$allowedTransitions` = `["presentation>application", "application>infrastructure", "infrastructure>domain"]`. A controller (presentation) importing a repository (infrastructure) directly produces `"presentation>infrastructure"` which is NOT in the allowed list → violation.

### Dependency Inversion (FF-P02)

Checks whether application-layer classes inject interfaces or concrete classes:

```cypher
MATCH (c:Class)-[:CONSTRUCTOR_INJECTS]->(dep)
WHERE c.layer = "application"
WITH c,
  count(CASE WHEN dep:Interface THEN 1 END) AS interfaceDeps,
  count(dep) AS totalDeps
WHERE totalDeps > 0
RETURN c.name AS class, c.filePath AS filePath,
       toFloat(interfaceDeps) / totalDeps AS ratio,
       CASE WHEN toFloat(interfaceDeps) / totalDeps < 0.85
            THEN true ELSE false END AS violation
```

If `AuthService` injects 4 concrete classes and 0 interfaces, `ratio = 0.0` which is below threshold 0.85 → violation.

### Component Instability (FF-C03)

Robert C. Martin's instability metric per file:

```cypher
MATCH (f:File) WHERE f.layer IS NOT NULL
OPTIONAL MATCH (f)<-[:IMPORTS]-(incoming:File)
OPTIONAL MATCH (f)-[:IMPORTS]->(outgoing:File)
WITH f, count(DISTINCT incoming) AS fanIn, count(DISTINCT outgoing) AS fanOut
WHERE fanIn + fanOut > 0
WITH f, fanIn, fanOut, toFloat(fanOut) / (fanIn + fanOut) AS instability
WHERE instability > 0.8
RETURN f.filePath AS filePath, f.layer AS layer, instability
```

Instability = fanOut / (fanIn + fanOut). A file that imports 10 things but nothing imports it has instability 1.0. Threshold is 0.8.

### Fan-Out (FF-C02)

```cypher
MATCH (f:File)-[:IMPORTS]->(dep:File)
WITH f, count(DISTINCT dep) AS fanOut
WHERE fanOut > 12
RETURN f.filePath AS filePath, fanOut
```

### Single Responsibility Proxy (FF-SO01)

```cypher
MATCH (c:Class)
OPTIONAL MATCH (c)-[:CONTAINS]->(m:Method)
OPTIONAL MATCH (c)-[:CONSTRUCTOR_INJECTS]->(dep)
WITH c, count(DISTINCT m) AS methodCount, count(DISTINCT dep) AS depCount
WHERE methodCount > 10 OR depCount > 5
RETURN c.name AS class, c.filePath AS filePath, methodCount, depCount
```

### Test File Pairing (FF-CV05)

```cypher
MATCH (src:File)
WHERE src.layer IS NOT NULL
  AND NOT src.isBarrel
  AND NOT src.filePath CONTAINS '.spec.'
  AND NOT src.filePath CONTAINS '.test.'
  AND NOT EXISTS {
    MATCH (test:File)
    WHERE test.filePath = replace(src.filePath, '.ts', '.spec.ts')
       OR test.filePath = replace(src.filePath, '.ts', '.test.ts')
  }
RETURN src.filePath AS filePath
```

### Abstraction Ratio (FF-C06)

```cypher
MATCH (n) WHERE n:Class OR n:Interface
WITH count(CASE WHEN n:Interface THEN 1 END) AS interfaces,
     count(n) AS total
WHERE total > 0
RETURN toFloat(interfaces) / total AS ratio,
       CASE WHEN toFloat(interfaces) / total < 0.3
            THEN true ELSE false END AS violation
```

---

## Scoring

### AVR (Aggregated Violation Ratio) — per dimension

```
AVR = violated_functions / total_functions_in_dimension
```

Example: Structural dimension has 4 functions (S01, S02, S03, S04). If only S02 has violations:
```
AVR_structural = 1/4 = 0.25
```

### AHS (Architectural Health Score) — single number

```
AHS = sum( weight_d * (1 - AVR_d) )

AHS = 0.35 * (1 - 0.25)    structural
    + 0.20 * (1 - 0.00)    coupling
    + 0.30 * (1 - 0.50)    pattern
    + 0.10 * (1 - 0.00)    solid
    + 0.05 * (1 - 0.33)    convention
    = 0.2625 + 0.20 + 0.15 + 0.10 + 0.0335
    = 0.746   → WARNING
```

### Verdicts

| AHS | Verdict | Exit code | CI behavior |
|---|---|---|---|
| >= 0.80 | pass | 0 | Green |
| 0.65 - 0.79 | warning | 0 | Yellow (non-blocking) |
| 0.50 - 0.64 | soft-block | 1 | Red (blocking) |
| < 0.50 | hard-block | 1 | Red (blocking) |

---

## Engine Location and Invocation

**Engine path**:
```
/Volumes/Life-OS/Users/Arkatechie/Development/Archi-Firewall/DaedalusArch
```

All CLI commands run from this directory with `--project` pointing at the target.

**Invocation** — available as a user-level Claude Code command from any directory:
```
/firewall
/firewall /path/to/target
```

Defined at `~/.claude/commands/firewall.md`.

---

## Procedure

### Step 1: Check prerequisites

1. **Neo4j running**: `docker ps --filter "name=neo4j"` from engine dir. If not: `docker compose up -d`, wait 15s.
2. **Target has node_modules/**: If missing, `cd <target> && npm install` (use `--legacy-peer-deps` for older projects).
3. **Target tsconfig.json has `include`**: Must cover source files. If only project references (Nx/Turborepo), create flat tsconfig with `"include": ["src/**/*.ts"]`.

### Step 2: Detect architecture style

Read `<target>/package.json` dependencies:
- `@nestjs/core` → NestJS → use `presets/nestjs.yaml`
- No framework → use `presets/clean-architecture.yaml`

### Step 3: Copy preset to target

```bash
cp $FIREWALL_HOME/presets/<style>.yaml <target>/firewall.spec.yaml
```

### Step 4: Add project-specific excludes

If `src/generated/`, `src/__generated__/`, or `src/migrations/` exist, add to `default_exclude_paths` in the spec.

### Step 5: Run evaluation + report

```bash
cd $FIREWALL_HOME

NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'report',
  '--project', '<target>',
  '--spec', '<target>/firewall.spec.yaml',
  '-o', '<target>/report.html',
  '--symbolic-only', '--verbose']);
"
```

### Step 6: Create baseline

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

### Step 7: Open report and summarize

```bash
open <target>/report.html
```

Present: AHS + verdict, per-dimension AVR breakdown, top violations with file paths and explanations, universal metrics, files created, interpretation of what the score means for this project.

---

## Reference Benchmarks

| Project | Files | AHS | Verdict | Key characteristic |
|---|---|---|---|---|
| DevNest | 77 | 0.54 | soft-block | No interfaces, no tests, direct Prisma coupling |
| Truthy | 131 | 0.69 | warning | Clean structure, no DI, no tests |
| Ghostfolio | 267 | 0.78 | warning | Perfect structural/SOLID, DI violations across data providers |
| RealWorld | 34 | 0.80 | warning | Has interfaces, TypeORM entity cycles |

---

## Troubleshooting

| Error | Fix |
|---|---|
| `No .ts source files found` | `npm install`; ensure tsconfig has `"include": ["src/**/*.ts"]` |
| `authentication failure` | `NEO4J_PASSWORD=daedalus-dev` |
| `Unknown architecture style` | Use `nestjs` or `clean-architecture` |
| `Schema validation failed` | Each layer needs `name`, `roles`, and `directories` or `file_patterns` |
| Pipeline hangs | `docker compose up -d` from engine dir |
