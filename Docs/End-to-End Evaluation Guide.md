# End-to-End Evaluation Guide

How to evaluate any new TypeScript project with the Architectonic Firewall, from clone to HTML report.

---

## Fastest path: use the `/firewall-init` skill

If you're in a Claude Code session inside the DaedalusArch project, the entire workflow below is automated:

```
/firewall-init --project /path/to/target-project
```

This scans the project, classifies the architecture, selects a preset, generates `firewall.spec.yaml`, runs the evaluation, creates a baseline, and produces an HTML report — all in one shot. The steps below document what the skill does under the hood, and how to do it manually.

---

## Prerequisites

| Dependency | Purpose | Check |
|---|---|---|
| **Node.js** >= 18 | Runtime | `node -v` |
| **Docker** | Neo4j graph database | `docker --version` |
| **DaedalusArch repo** | The firewall engine + CLI | Must be cloned locally |
| **Target project** | The TypeScript project to evaluate | Must have `package.json` + `tsconfig.json` |

---

## Step 0: One-time setup (do once)

```bash
# Clone the firewall engine (if not already done)
git clone <daedalus-arch-repo-url> DaedalusArch
cd DaedalusArch
npm install

# Start Neo4j
docker compose up -d

# Verify Neo4j is healthy
docker ps --filter "name=neo4j"
```

Neo4j credentials (from `docker-compose.yml`):
- **User**: `neo4j`
- **Password**: `daedalus-dev` (override with `NEO4J_PASSWORD` env var)

---

## Step 1: Clone the target project

```bash
cd /path/to/your/workspace
git clone <target-repo-url> my-target
```

**Important**: The target project must have its dependencies installed for ts-morph to resolve imports:

```bash
cd my-target
npm install
cd ../DaedalusArch    # return to the firewall project
```

### Monorepo projects (Nx, Turborepo)

If the target is a monorepo, point at the specific app directory that contains its own `tsconfig.json`. For example:

```
my-monorepo/
  apps/
    api/          <-- point here (has its own tsconfig.json)
    client/
  libs/
```

**Caveat**: If the `tsconfig.json` uses project references with empty `include`, ts-morph won't discover files. Create a flat tsconfig that directly includes source files:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "module": "commonjs", "target": "es2021" },
  "include": ["src/**/*.ts"],
  "exclude": ["**/*.spec.ts", "**/*.test.ts"]
}
```

---

## Step 2: Select and copy a preset

Presets live in `DaedalusArch/presets/`. Pick one based on the target project:

| Preset | When to use | Detection signal |
|---|---|---|
| `nestjs.yaml` | `@nestjs/core` in `package.json` dependencies | NestJS decorators, `*.module.ts` files |
| `clean-architecture.yaml` | No framework markers, explicit `src/domain/`, `src/application/`, `src/infrastructure/` directories | Layered folder structure |

```bash
# Copy the preset as the project's firewall spec (zero customization needed)
cp DaedalusArch/presets/nestjs.yaml /path/to/my-target/firewall.spec.yaml
```

### What the preset provides out of the box

The NestJS preset uses **file-pattern-based layer assignment** that works for both layered-directory and feature-module (co-located) projects:

| File pattern | Assigned layer | Examples |
|---|---|---|
| `*.controller.ts` | presentation | `auth.controller.ts` |
| `*.module.ts` | presentation | `auth.module.ts` |
| `*.guard.ts` | presentation | `jwt-auth.guard.ts` |
| `*.service.ts` | application | `auth.service.ts` |
| `*.processor.ts` | application | `feed.processor.ts` |
| `**/dto/**`, `*.dto.ts` | application | `create-user.dto.ts` |
| `*.repository.ts` | infrastructure | `users.repository.ts` |
| `*.worker.ts` | infrastructure | `bcrypt.worker.ts` |
| `**/strategies/**` | infrastructure | `jwt.strategy.ts` |

If a file matches a directory glob (e.g., `src/prisma/**`), the directory takes priority over file patterns. This means explicit layer directories and co-located feature modules both work.

---

## Step 3: Validate the spec

```bash
cd DaedalusArch

NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'validate',
  '--spec', '/path/to/my-target/firewall.spec.yaml',
  '--project', '/path/to/my-target']);
"
```

Expected output: `Spec valid: N fitness functions (M disabled), L layers, 0 errors`

---

## Step 4: Run evaluation

```bash
NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'evaluate',
  '--project', '/path/to/my-target',
  '--spec', '/path/to/my-target/firewall.spec.yaml',
  '--symbolic-only',
  '--format', 'human',
  '--verbose']);
"
```

### Output formats

| Flag | Use case |
|---|---|
| `--format human` | Terminal-friendly summary (stderr) |
| `--format json` | Machine-readable, pipe to `jq` or CI scripts (stdout) |
| `--format csv` | Spreadsheet/batch analysis (stdout) |

### What the evaluation does (pipeline stages)

```
1. Extract APG    ── ts-morph scans all .ts files → nodes + edges
2. Parse Spec     ── reads firewall.spec.yaml → layers, fitness functions, weights
   (stages 1 & 2 run in parallel)
3. Ingest APG     ── loads the graph into Neo4j
4. Compile        ── turns fitness functions into Cypher queries
5. Evaluate       ── runs queries against Neo4j, collects violations
6. Score          ── computes per-dimension AVR, weighted AHS, verdict
```

---

## Step 5: Generate HTML report

```bash
NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'report',
  '--project', '/path/to/my-target',
  '--spec', '/path/to/my-target/firewall.spec.yaml',
  '-o', '/path/to/my-target/report.html',
  '--symbolic-only',
  '--verbose']);
"
```

Open in browser:
```bash
open /path/to/my-target/report.html
```

The HTML report includes:
- AHS score gauge with verdict
- Per-dimension breakdown (structural, coupling, pattern, solid, convention)
- Full violation list with severity, file path, explanation, and suggested fix
- Universal metrics (cycles, fan-out, fan-in, abstraction ratio, instability)

---

## Step 6: Create baseline (optional)

If the project has existing violations you want to accept for now, create a baseline. Future CI runs will only block on **new** violations.

```bash
NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'baseline',
  '--project', '/path/to/my-target',
  '--spec', '/path/to/my-target/firewall.spec.yaml',
  '-o', '/path/to/my-target/baseline_violations.json',
  '--verbose']);
"
```

To evaluate against the baseline (only new violations block):

```bash
NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'evaluate',
  '--project', '/path/to/my-target',
  '--spec', '/path/to/my-target/firewall.spec.yaml',
  '--baseline', '/path/to/my-target/baseline_violations.json',
  '--symbolic-only',
  '--format', 'human']);
"
```

---

## Scoring reference

### AHS (Architectural Health Score)

```
AHS = sum( weight_d * (1 - AVR_d) )  for each dimension d
```

Where AVR (Aggregated Violation Ratio) = violated functions / total functions in that dimension.

### Default weights (symbolic mode)

| Dimension | Weight | What it measures |
|---|---|---|
| structural | 0.35 | Layer direction, cyclic deps, layer-skipping |
| pattern | 0.30 | Dependency inversion, repository pattern, domain purity |
| coupling | 0.20 | Fan-out, instability, orphan files, abstraction ratio |
| solid | 0.10 | SRP proxy (public methods, deps), ISP proxy, inheritance depth |
| convention | 0.05 | Naming, test pairing, index logic |

### Verdict thresholds

| Verdict | AHS range | Exit code | CI behavior |
|---|---|---|---|
| **pass** | >= 0.80 | 0 | Green |
| **warning** | 0.65 - 0.79 | 0 | Yellow (non-blocking) |
| **soft-block** | 0.50 - 0.64 | 1 | Red (blocking) |
| **hard-block** | < 0.50 | 1 | Red (blocking) |

---

## Customizing the spec

After the initial evaluation, you may want to tune the spec for your project:

### Adjust thresholds

```yaml
fitness_functions:
  - id: FF-C02
    name: module-fan-out
    threshold: 15          # default is 12, raise if your modules are legitimately large

  - id: FF-SO01
    name: single-responsibility-proxy
    max_public_methods: 12 # default is 10
    max_dependencies: 7    # default is 5
```

### Disable a function

```yaml
  - id: FF-P02
    name: dependency-inversion
    enabled: false
    reason: "Team decided to skip DI for this sprint"
```

### Add per-function exclude paths

```yaml
  - id: FF-S03
    name: no-layer-skip
    exclude_paths:
      - "**/*.module.ts"     # NestJS modules are DI wiring
      - "src/main.ts"        # Bootstrap file
```

### Add project-specific exclude paths

```yaml
default_exclude_paths:
  - "node_modules/**"
  - "dist/**"
  - "**/*.spec.ts"
  - "**/*.test.ts"
  - "test/**"
  - "src/generated/**"      # Prisma / GraphQL codegen
  - "src/migrations/**"     # DB migrations
```

---

## Quick reference (copy-paste)

### Full evaluation in one shot

```bash
# From the DaedalusArch directory:
TARGET=/path/to/my-target
SPEC=$TARGET/firewall.spec.yaml

# 1. Copy preset
cp presets/nestjs.yaml $SPEC

# 2. Evaluate + report
NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'report',
  '--project', '$TARGET',
  '--spec', '$SPEC',
  '-o', '$TARGET/report.html',
  '--symbolic-only', '--verbose']);
"

# 3. Open report
open $TARGET/report.html
```

---

## Validated results

This workflow has been validated on three projects with zero false positives:

| Project | Type | Files | AHS | Verdict |
|---|---|---|---|---|
| [DevNest](https://github.com/johnvesslyalti/dev-nest) | NestJS + Prisma, feature-modules | 77 | 0.54 | soft-block |
| [nestjs-realworld-example-app](https://github.com/lujakob/nestjs-realworld-example-app) | NestJS + TypeORM, feature-modules | 34 | 0.80 | warning |
| [Ghostfolio](https://github.com/ghostfolio/ghostfolio) | NestJS + Prisma, Nx monorepo | 267 | 0.78 | warning |

All three used the same unmodified `presets/nestjs.yaml` — zero hand-tuning required.
