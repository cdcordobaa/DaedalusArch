# Architectonic Firewall — Agent Playbook

Instructions for an AI coding agent to evaluate any TypeScript project for architectural compliance. Each step explains what happens inside the engine so results are interpretable.

---

## System Overview

The Architectonic Firewall treats source code not as text but as a **graph**. It parses every TypeScript file into an Architecture Property Graph (APG) — a directed graph of files, classes, interfaces, methods, and their relationships (imports, implements, extends, injects). That graph is loaded into Neo4j, and 24 fitness functions are compiled into Cypher queries that run against it. The results are scored across 5 dimensions to produce a single Architectural Health Score (AHS).

```
TypeScript Source Code
        │
        ▼
┌─────────────────┐
│  APG Extractor   │  ts-morph parses ASTs → nodes + edges
│  (static analysis)│  5 node types: File, Class, Interface, Method, Function
│                   │  7 edge types: IMPORTS, IMPLEMENTS, EXTENDS,
│                   │    CONSTRUCTOR_INJECTS, CALLS, DECLARES, CONTAINS
└────────┬──────────┘
         │  APGResult (in-memory graph)
         ▼
┌─────────────────┐
│  Layer Annotator  │  Assigns each file to an architectural layer
│                   │  Priority: directory glob → file_patterns → class naming → decorators
│                   │  e.g. auth.service.ts → "application", auth.controller.ts → "presentation"
└────────┬──────────┘
         │  Annotated graph
         ▼
┌─────────────────┐
│  Neo4j Ingestion  │  Creates labeled nodes + typed relationships in Neo4j
│                   │  Each file becomes a :File node with layer property
│                   │  Each import becomes an :IMPORTS edge
└────────┬──────────┘
         │  Graph in Neo4j
         ▼
┌─────────────────┐
│  Fitness Compiler │  Reads spec YAML → compiles 24 fitness functions into Cypher queries
│                   │  Injects exclude_paths as WHERE NOT clauses
│                   │  Parameterizes queries with layer ordering, thresholds, patterns
└────────┬──────────┘
         │  CypherQuery[] (ready to execute)
         ▼
┌─────────────────┐
│  Symbolic         │  Executes each Cypher query against Neo4j
│  Evaluator        │  Maps results → typed Violation objects
│                   │  Each violation: file path, severity, dimension, explanation, fix suggestion
└────────┬──────────┘
         │  Violation[] per function
         ▼
┌─────────────────┐
│  Scoring Engine   │  Per-dimension AVR = violated_functions / total_functions
│                   │  AHS = weighted sum of (1 - AVR) across dimensions
│                   │  Verdict: pass / warning / soft-block / hard-block
└────────┬──────────┘
         │  EvaluationReport
         ▼
┌─────────────────┐
│  Report Generator │  Produces interactive HTML with:
│                   │  - AHS gauge and verdict
│                   │  - Per-dimension charts
│                   │  - Full violation list with file paths, explanations, fix suggestions
│                   │  - Universal metrics (cycles, fan-out, abstraction ratio, etc.)
└─────────────────┘
```

The entire pipeline runs in under 2 seconds for a 267-file project.

---

## Engine and Target Directories

The system has two parts in separate directories:

```
FIREWALL_HOME  (the engine)             TARGET_PATH  (the project being evaluated)
├── src/cli/cli.ts   ← CLI entry       ├── src/
├── presets/                            │   ├── auth/
│   ├── nestjs.yaml                     │   ├── users/
│   └── clean-architecture.yaml         │   └── ...
├── docker-compose.yml  ← Neo4j        ├── package.json
└── ...                                 ├── tsconfig.json
                                        │
                                        │  ── created by the agent ──
                                        ├── firewall.spec.yaml
                                        ├── report.html
                                        └── baseline_violations.json
```

All CLI commands run from `FIREWALL_HOME` with `--project` pointing at the target.

**Engine location**:
```
/Volumes/Life-OS/Users/Arkatechie/Development/Archi-Firewall/DaedalusArch
```

---

## Invocation

Available as a **user-level Claude Code command** from any project directory:

```
/firewall
/firewall /path/to/specific/project
```

If no argument is given, the current working directory is evaluated.

The command is defined at `~/.claude/commands/firewall.md`.

---

## Procedure — Step by Step

### Step 1: Resolve target path

Use the provided argument, or default to the current working directory.

Verify it has a `package.json`. If not, this is not a valid target — abort.

---

### Step 2: Start Neo4j

The APG needs a graph database. Neo4j runs locally via Docker.

```bash
cd $FIREWALL_HOME
docker ps --filter "name=neo4j" --format "{{.Names}} {{.Status}}"
```

If not running:
```bash
docker compose up -d
```

Wait ~15 seconds for the health check. Neo4j listens on:
- `bolt://localhost:7687` — Cypher query protocol (used by the pipeline)
- `http://localhost:7474` — browser UI (useful for manual APG exploration)

Credentials: `neo4j` / `daedalus-dev`

---

### Step 3: Install target dependencies

ts-morph (the static analysis engine) needs `node_modules/` to resolve import paths, type aliases, and barrel re-exports. Without it, files that import from packages will fail to resolve and the APG will have missing edges.

```bash
cd $TARGET_PATH
ls node_modules/ 2>/dev/null || npm install
```

Use `--legacy-peer-deps` if npm fails on peer conflicts (common with older NestJS projects).

---

### Step 4: Verify tsconfig.json

The APG extractor discovers source files via `tsconfig.json`. It must have an `include` field that covers the source tree.

Read `$TARGET_PATH/tsconfig.json` and check:
- **Has `include`** with source paths (e.g., `"include": ["src/**/*.ts"]`) → good, proceed.
- **Has only project references** with empty `include`/`files` (common in Nx/Turborepo monorepos) → the extractor will find zero files. Create a flat tsconfig:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"],
    "emitDecoratorMetadata": true,
    "target": "es2021",
    "module": "commonjs"
  },
  "exclude": ["**/*.spec.ts", "**/*.test.ts"],
  "include": ["src/**/*.ts"]
}
```

Adjust the `extends` path relative to the tsconfig location.

**Why this matters**: ts-morph reads `tsconfig.json` to build its project model. If `include` is empty, it has nothing to parse. The Nx convention of project references (`"references": [{"path": "./tsconfig.app.json"}]`) is for `tsc --build` — ts-morph doesn't follow references.

---

### Step 5: Detect architecture style

Read `$TARGET_PATH/package.json` and check the `dependencies` object:

| Signal in dependencies | Detected style | Preset to use |
|---|---|---|
| `@nestjs/core` | NestJS | `presets/nestjs.yaml` |
| None of the above | Clean Architecture | `presets/clean-architecture.yaml` |

Report the detected style and the evidence (e.g., "`@nestjs/core` v11.1.12 found in dependencies → NestJS").

---

### Step 6: Copy preset

```bash
cp $FIREWALL_HOME/presets/<detected-style>.yaml $TARGET_PATH/firewall.spec.yaml
```

**What the preset contains**:

The `firewall.spec.yaml` is the full evaluation configuration. It defines:

**1. Layer definitions** — which files belong to which architectural layer.

The NestJS preset uses two strategies simultaneously:
- **`directories`** — explicit folder globs (e.g., `src/prisma/**` → infrastructure)
- **`file_patterns`** — filename conventions (e.g., `*.service.ts` → application)

Directory matches take priority. File patterns are a fallback for co-located feature modules where `auth.controller.ts`, `auth.service.ts`, and `auth.repository.ts` all live in the same `src/auth/` folder.

| File pattern | Assigned layer | Role |
|---|---|---|
| `*.controller.ts` | presentation | HTTP boundary |
| `*.module.ts` | presentation | DI wiring container |
| `*.guard.ts`, `*.interceptor.ts`, `*.gateway.ts` | presentation | Cross-cutting HTTP concerns |
| `*.service.ts`, `*.processor.ts` | application | Business logic |
| `**/dto/**`, `*.dto.ts` | application | Data transfer objects |
| `*.repository.ts` | infrastructure | Data access |
| `*.worker.ts`, `**/workers/**` | infrastructure | Background processing |
| `**/strategies/**` | infrastructure | Auth/external strategies |
| `src/prisma/**`, `src/lib/**` | infrastructure | Database/utility |
| `src/domain/**`, `src/core/**` | domain | Entities, value objects |

**2. Layer ordering** — defines allowed dependency direction.

NestJS preset order (inner → outer): **domain → infrastructure → application → presentation**

This is different from clean-architecture (where infrastructure is outer). In NestJS, the practical dependency flow is `Controller → Service → Repository → ORM`, which maps to `presentation → application → infrastructure`.

Only adjacent layers can depend on each other: `presentation → application` is allowed, `presentation → infrastructure` is a "layer skip" violation.

`*.module.ts` files are excluded from layer-skip checking — NestJS modules are DI wiring that imports from all layers by design.

**3. 24 fitness functions** across 5 dimensions:

| Dimension | Functions | What they check |
|---|---|---|
| **structural** (4) | `dependency-direction`, `no-cyclic-deps`, `no-layer-skip`, `no-domain-outward-dep` | Do imports respect the layer hierarchy? Are there circular dependencies? |
| **pattern** (5) | `domain-purity`, `dependency-inversion`, `repository-pattern`, `use-case-isolation`, `controller-no-entity` | Does application code depend on interfaces rather than concrete classes? Is the domain free of framework imports? |
| **coupling** (6) | `domain-stability`, `module-fan-out`, `component-instability`, `no-orphan-files`, `max-fan-in`, `abstraction-ratio` | How tightly coupled are modules? Are there god classes with too many dependencies? What % of types are abstractions? |
| **solid** (3) | `single-responsibility-proxy`, `interface-segregation-proxy`, `inheritance-depth` | Do classes have too many public methods or dependencies (SRP)? Are interfaces too large (ISP)? |
| **convention** (6) | `naming-conventions`, `naming-services`, `naming-repos`, `naming-controllers`, `test-file-pairing`, `no-index-logic` | Do files follow naming conventions? Does every source file have a test? |

Each function has a **severity** (critical, major, minor, advisory) and a **threshold** where applicable (e.g., fan-out > 12, instability > 0.8).

**4. Scoring weights**:

| Dimension | Weight |
|---|---|
| structural | 35% |
| pattern | 30% |
| coupling | 20% |
| solid | 10% |
| convention | 5% |

**5. Verdict thresholds**: pass >= 0.80, warning >= 0.65, soft-block >= 0.50, hard-block < 0.50

**6. Default exclude paths**: `node_modules/**`, `dist/**`, `**/*.spec.ts`, `**/*.test.ts`, `test/**`, `src/generated/**`

---

### Step 7: Add project-specific excludes

Scan `$TARGET_PATH/src/` for generated code. If any of these directories exist, add them to `default_exclude_paths` in `firewall.spec.yaml`:

| Directory found | Add to excludes | Why |
|---|---|---|
| `src/generated/` | `src/generated/**` | Prisma/GraphQL codegen — circular refs are by design |
| `src/__generated__/` | `src/__generated__/**` | Alternative codegen output |
| `src/migrations/` | `src/migrations/**` | DB migrations follow their own patterns |

**Why this matters**: Generated code creates noise — Prisma's generated client has circular imports by design, codegen output doesn't follow architectural conventions. Excluding it at the APG extraction stage (not just query time) prevents these files from entering the graph at all.

---

### Step 8: Run evaluation and generate report

```bash
cd $FIREWALL_HOME

NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'report',
  '--project', '<TARGET_PATH>',
  '--spec', '<TARGET_PATH>/firewall.spec.yaml',
  '-o', '<TARGET_PATH>/report.html',
  '--symbolic-only', '--verbose']);
"
```

**What happens inside** (pipeline stages):

```
Stage 1 — Extract APG + Parse Spec (parallel, ~400ms)
  Extract: ts-morph reads every .ts file in the project
    → Builds AST for each file
    → Extracts nodes (File, Class, Interface, Method, Function)
    → Extracts edges (who imports whom, who implements what, constructor injection)
    → Applies exclude patterns (default + project-specific)
    → Reports parse coverage (e.g., "58 files, 100% parsed")
  Parse: reads firewall.spec.yaml
    → Validates against JSON schema
    → Resolves template (merges preset functions with any overrides)
    → Builds LayerModel (layer definitions + ordering)

Stage 2 — Ingest APG into Neo4j (~200-400ms)
  → Clears previous graph
  → Creates :File, :Class, :Interface, :Method, :Function nodes
  → Creates :IMPORTS, :IMPLEMENTS, :EXTENDS, etc. edges
  → Layer Annotator runs: assigns each file a `layer` property
    Priority: directory glob match → file_patterns match → class name match → decorator match
    Files that match nothing get layer=null (excluded from layer-aware rules)

Stage 3 — Compile Fitness Functions (~1ms)
  → Reads the 24 fitness functions from the parsed spec
  → Filters out disabled functions
  → For each symbolic function, looks up its Cypher template
  → Parameterizes each query with layer ordering, thresholds, allowed transitions
  → Injects per-function exclude_paths as WHERE NOT clauses in the Cypher
  → Output: array of ready-to-execute CypherQuery objects

Stage 4 — Evaluate (~100-600ms)
  → Executes each Cypher query against Neo4j
  → Each query returns rows = violations (files that break the rule)
  → Maps each row to a typed Violation with:
    - File path
    - Severity (critical / major / minor / advisory)
    - Dimension (structural / coupling / pattern / solid / convention)
    - Message explaining what violated and why
    - Suggested fix
  → Functions with zero result rows → passed

Stage 5 — Score (~10-30ms)
  → Groups violations by dimension
  → Per dimension: AVR = violated_functions / total_functions_in_dimension
    (proportional — 1 violation out of 4 structural functions = AVR 0.25, not 1.0)
  → AHS = sum(weight_d * (1 - AVR_d)) across all dimensions
  → Verdict based on AHS threshold

Stage 6 — Generate Report
  → Produces interactive HTML with embedded JavaScript
  → AHS gauge, per-dimension charts, violation table
  → Each violation clickable with full details
```

---

### Step 9: Create baseline

```bash
NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'baseline',
  '--project', '<TARGET_PATH>',
  '--spec', '<TARGET_PATH>/firewall.spec.yaml',
  '-o', '<TARGET_PATH>/baseline_violations.json',
  '--verbose']);
"
```

**What this does**: Runs the same evaluation and saves all current violations as a JSON snapshot. In CI, future runs with `--baseline baseline_violations.json` only report NEW violations — existing ones are accepted. This enables incremental adoption: the team fixes issues over time without being overwhelmed on day one.

---

### Step 10: Open report

```bash
open <TARGET_PATH>/report.html
```

---

### Step 11: Present summary

After evaluation, present:

- **Project**: name, path, file count, detected framework
- **AHS score** and **verdict**
- **Per-dimension breakdown**:
  - AVR score (0 = perfect, 1 = all functions violated)
  - Violation count
  - What the dimension measures
- **Top 5 non-advisory violations** with:
  - Severity and fitness function ID (e.g., `[critical] FF-P02`)
  - File path
  - What the violation means in plain language
  - Suggested fix
- **Universal metrics**:
  - Cycle count — circular dependency chains found
  - Max fan-out — highest number of outgoing imports from a single file
  - Max fan-in — highest number of files importing a single file
  - Abstraction ratio — % of types that are interfaces/abstract classes vs concrete
  - Average instability — mean instability across all files (0 = stable, 1 = unstable)
  - Orphan count — files with no import connections
- **Files created**: `firewall.spec.yaml`, `report.html`, `baseline_violations.json`
- **Interpretation**: what the score means for this specific project and what the highest-impact improvements would be

---

## Reading the Results

### AHS Formula

```
AHS = sum( weight_d * (1 - AVR_d) )  for each dimension d

AVR_d = violated_functions_in_d / total_functions_in_d
```

A dimension with 0 violations has AVR=0, contributing its full weight to AHS.
A dimension where every function has violations has AVR=1, contributing 0.

### Verdict Thresholds

| AHS Range | Verdict | What it means |
|---|---|---|
| >= 0.80 | **pass** | Architecture is healthy — no blocking issues |
| 0.65 - 0.79 | **warning** | Issues exist but manageable — review recommended |
| 0.50 - 0.64 | **soft-block** | Significant architectural problems — should address before scaling |
| < 0.50 | **hard-block** | Severe — architecture impedes development at current scale |

### Understanding Specific Violations

| ID | Name | Severity | What the Cypher query checks | What it means in practice |
|---|---|---|---|---|
| FF-S01 | dependency-direction | critical | Files in inner layers importing from outer layers | Domain code depends on infrastructure — fragile, hard to test |
| FF-S02 | no-cyclic-deps | critical | Import chains that form cycles (A→B→C→A) | Circular dependencies make modules impossible to extract or test independently |
| FF-S03 | no-layer-skip | critical | Imports that skip intermediate layers (presentation → infrastructure) | Controller bypasses service layer, coupling HTTP boundary to data access |
| FF-P01 | domain-purity | critical | Domain files importing framework packages (express, prisma, typeorm) | Domain logic coupled to infrastructure — can't reuse or test without the framework |
| FF-P02 | dependency-inversion | critical | Service classes that inject concrete classes instead of interfaces | Tight coupling — can't swap implementations, mock for tests, or add decorators |
| FF-P03 | repository-pattern | critical | Services accessing ORM directly without repository abstraction | Data access logic mixed into business logic |
| FF-C02 | module-fan-out | major | Files with more outgoing imports than the threshold (default: 12) | God module — knows about too many things, hard to reason about |
| FF-C03 | component-instability | major | Files where instability = fanOut/(fanIn+fanOut) exceeds 0.8 | Highly unstable — depends on many things, nothing depends on it |
| FF-SO01 | single-responsibility-proxy | major | Classes with > 10 public methods OR > 5 constructor dependencies | Likely doing too many things — SRP violation signal |
| FF-CV05 | test-file-pairing | advisory | Source files with no corresponding `.spec.ts` or `.test.ts` | No test coverage for this module |
| FF-C06 | abstraction-ratio | advisory | Project-wide ratio of interfaces to concrete types below threshold (0.3) | Few abstractions — changes ripple through concrete dependencies |

---

## Reference Benchmarks

Scores from 4 validated projects using the unmodified NestJS preset:

| Project | Files | AHS | Verdict | Why it scored this way |
|---|---|---|---|---|
| DevNest | 77 | 0.54 | soft-block | Zero interfaces (all DI violations), zero tests, services call Prisma directly |
| Truthy | 131 | 0.69 | warning | Clean structure, but no DI and no tests |
| Ghostfolio | 267 | 0.78 | warning | Perfect structural + SOLID, but 55 services inject concrete Prisma, no tests |
| RealWorld | 34 | 0.80 | warning | Has interfaces, good abstraction ratio, but TypeORM entity cycles |

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `No .ts source files found` | Missing `node_modules/` or tsconfig has empty `include` | `npm install` in target; add `"include": ["src/**/*.ts"]` to tsconfig |
| `authentication failure` | Wrong Neo4j password | Use `NEO4J_PASSWORD=daedalus-dev` |
| `Unknown architecture style` | Style in spec not registered in template registry | Use `nestjs` or `clean-architecture` |
| `Schema validation failed` | Invalid spec YAML structure | Each layer needs `name`, `roles`, and at least `directories` or `file_patterns` |
| Pipeline hangs | Neo4j not running or not healthy | `docker compose up -d` from engine dir, wait 15s |
| npm install fails | Peer dependency conflicts (older NestJS) | Use `--legacy-peer-deps` |
| Very low score with many violations | Generated code not excluded | Add `src/generated/**` to `default_exclude_paths` in spec |

---

## The Cross-Directory Problem

The engine lives in `DaedalusArch/`. The target is a separate project. An agent working in the target directory needs to reach the engine.

**Current solution**: The user-level command at `~/.claude/commands/firewall.md` carries the engine path and full procedure. It is available in every Claude Code session regardless of working directory. The agent reads it via `/firewall`, switches to the engine directory for CLI commands, and writes output files to the target directory.

**Future solution**: Publish DaedalusArch as an npm package (`npx daedalus-arch evaluate --project .`) so no cross-directory navigation is needed.
