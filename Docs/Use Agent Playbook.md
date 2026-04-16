# Use Agent Playbook — Architectonic Firewall

This playbook serves two purposes:
1. **Showcase reference** — exact inputs, outputs, and what to expect at each step
2. **Executable script** — paste the prompt block at the bottom into a fresh Claude Code session and it runs the full demo autonomously

---

## Context

- **Agent session**: Claude Code, working directory = `DaedalusArch/`
- **Target**: Any NestJS TypeScript project (playbook uses [Ghostfolio](https://github.com/ghostfolio/ghostfolio))
- **Infrastructure**: Neo4j running via `docker compose up -d`
- **Output**: Interactive HTML report + baseline + terminal summary

---

## Step-by-Step Showcase

### Step 1: Start Neo4j

**Input** (user runs before starting Claude Code):
```bash
cd /path/to/DaedalusArch
docker compose up -d
```

**Expected output**:
```
Container daedalus-arch-neo4j  Running
```

---

### Step 2: Clone target project

**Input** (Claude Code or user):
```bash
cd /path/to/workspace
git clone --depth 1 https://github.com/ghostfolio/ghostfolio.git ghostfolio-test
```

**Expected output**:
```
Cloning into 'ghostfolio-test'...
```

---

### Step 3: Install dependencies

**Input**:
```bash
cd ghostfolio-test && npm install
```

**Expected output**: npm install completes (may take 30-60s for a large project). Warnings are fine.

---

### Step 4: Handle monorepo tsconfig (Ghostfolio-specific)

Ghostfolio is an Nx monorepo where `apps/api/tsconfig.json` uses project references with empty `include`. ts-morph needs a flat tsconfig to discover files.

**Input**:
```bash
cat > ghostfolio-test/apps/api/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "types": ["node"],
    "emitDecoratorMetadata": true,
    "moduleResolution": "node10",
    "target": "es2021",
    "module": "commonjs"
  },
  "exclude": ["**/*.spec.ts", "**/*.test.ts"],
  "include": ["src/**/*.ts"]
}
EOF
```

**Expected output**: No output (file created silently).

**Note**: This step is only needed for Nx/Turborepo monorepos with project-reference tsconfigs. Standard NestJS projects skip this.

---

### Step 5: Copy NestJS preset

**Input**:
```bash
cp DaedalusArch/presets/nestjs.yaml ghostfolio-test/apps/api/firewall.spec.yaml
```

**Expected output**: No output (file copied).

**What this does**: The preset defines:
- 4 layers: domain → infrastructure → application → presentation
- `file_patterns` for per-file layer assignment (`*.service.ts` → application, etc.)
- 24 fitness functions across 5 dimensions
- `*.module.ts` excluded from layer-skip checking
- Generated code excluded by default

---

### Step 6: Run evaluation + generate report

**Input** (from DaedalusArch directory):
```bash
NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'report',
  '--project', '../ghostfolio-test/apps/api',
  '--spec', '../ghostfolio-test/apps/api/firewall.spec.yaml',
  '-o', '../ghostfolio-test/apps/api/report.html',
  '--symbolic-only', '--verbose']);
"
```

**Expected output**:
```
Evaluating ghostfolio-test/apps/api (mode: symbolic-only)...
╔═══════════════════════════════════════════╗
║  Architectural Health Score: 0.78 (WARNING)║
╚═══════════════════════════════════════════╝

  AHS (deterministic): 0.78
  Verdict:             warning
  Mode:                symbolic-only

  Per-Dimension Breakdown:
    structural     AVR: 0.000  (17 functions, 0 violations)
    coupling       AVR: 0.667  (17 functions, 4 violations)
    pattern        AVR: 0.250  (17 functions, 1 violations)
    solid          AVR: 0.000  (17 functions, 0 violations)
    convention     AVR: 0.333  (17 functions, 1 violations)

  Top Violations:
    1. [critical] FF-P02 — dependency-inversion — src/app/access/access.service.ts
    2. [critical] FF-P02 — dependency-inversion — src/services/data-provider/yahoo-finance/...
    3. [major]    FF-C03 — component-instability — src/app/app.module.ts
    ... and more

  Universal Metrics:
    Cycles: 0 | Max fan-out: 32 | Max fan-in: 5
    Abstraction ratio: 0.174 | Avg instability: 0.408 | Orphans: 57

  Pipeline completed in ~2s

Report written to ../ghostfolio-test/apps/api/report.html
```

**Key numbers to highlight**:
- 267 files analyzed
- 336 total violations
- 55 critical (dependency-inversion)
- 0 structural violations (perfect)
- 0 SOLID violations (perfect)
- Pipeline under 2 seconds

---

### Step 7: Create baseline

**Input**:
```bash
NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'baseline',
  '--project', '../ghostfolio-test/apps/api',
  '--spec', '../ghostfolio-test/apps/api/firewall.spec.yaml',
  '-o', '../ghostfolio-test/apps/api/baseline_violations.json',
  '--verbose']);
"
```

**Expected output**:
```
Running evaluation for baseline creation...
Baseline created with 336 violation(s) at ../ghostfolio-test/apps/api/baseline_violations.json
```

---

### Step 8: Open report

**Input**:
```bash
open ../ghostfolio-test/apps/api/report.html
```

**Expected output**: Browser opens with interactive HTML report showing:
- AHS gauge (0.78, yellow)
- Per-dimension breakdown chart
- Full violation list with file paths, explanations, and fix suggestions

---

### Step 9: Summary

**Files created in target project**:
```
ghostfolio-test/apps/api/
  ├── firewall.spec.yaml          # Evaluation spec (from preset)
  ├── report.html                 # Interactive HTML report
  └── baseline_violations.json    # Baseline for CI
```

**Interpretation**:
- AHS 0.78 = WARNING — good structure, room for improvement
- Structural + SOLID = perfect — no cycles, no god classes
- Pattern (DI violations) = main gap — services coupled to concrete Prisma
- Convention (missing tests) = informational

---

## Executable Prompt

Copy the block below into a **fresh Claude Code session** opened in the DaedalusArch directory. It will execute the full demo autonomously.

````
Evaluate the Ghostfolio project with the Architectonic Firewall. Follow these steps exactly:

**Prerequisites check:**
1. Verify Neo4j is running: `docker ps --filter "name=neo4j"`. If not running, start it with `docker compose up -d` and wait for it to be healthy.

**Setup target:**
2. Check if `/Volumes/Life-OS/Users/Arkatechie/Development/Archi-Firewall/ghostfolio-test` exists. If not, clone it:
   ```
   cd /Volumes/Life-OS/Users/Arkatechie/Development/Archi-Firewall
   git clone --depth 1 https://github.com/ghostfolio/ghostfolio.git ghostfolio-test
   ```
3. Check if `ghostfolio-test/node_modules` exists. If not, run `cd ghostfolio-test && npm install` (use --legacy-peer-deps if it fails).
4. Ensure `ghostfolio-test/apps/api/tsconfig.json` has `"include": ["src/**/*.ts"]` (not just project references). If it only has references, create a flat tsconfig:
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "outDir": "../../dist/out-tsc",
       "types": ["node"],
       "emitDecoratorMetadata": true,
       "moduleResolution": "node10",
       "target": "es2021",
       "module": "commonjs"
     },
     "exclude": ["**/*.spec.ts", "**/*.test.ts"],
     "include": ["src/**/*.ts"]
   }
   ```

**Copy preset:**
5. Copy `presets/nestjs.yaml` to `ghostfolio-test/apps/api/firewall.spec.yaml`

**Evaluate:**
6. Run the evaluation and generate an HTML report. Use `NEO4J_PASSWORD=daedalus-dev` and execute via:
   ```
   NEO4J_PASSWORD=daedalus-dev npx tsx -e "
   import { main } from './src/cli/cli.ts';
   main(['node', 'firewall', 'report',
     '--project', '../ghostfolio-test/apps/api',
     '--spec', '../ghostfolio-test/apps/api/firewall.spec.yaml',
     '-o', '../ghostfolio-test/apps/api/report.html',
     '--symbolic-only', '--verbose']);
   "
   ```

**Baseline:**
7. Create a baseline:
   ```
   NEO4J_PASSWORD=daedalus-dev npx tsx -e "
   import { main } from './src/cli/cli.ts';
   main(['node', 'firewall', 'baseline',
     '--project', '../ghostfolio-test/apps/api',
     '--spec', '../ghostfolio-test/apps/api/firewall.spec.yaml',
     '-o', '../ghostfolio-test/apps/api/baseline_violations.json',
     '--verbose']);
   "
   ```

**Open report:**
8. Open the report: `open ../ghostfolio-test/apps/api/report.html`

**Summarize:**
9. Present a summary with:
   - AHS score and verdict
   - Per-dimension breakdown
   - Top 5 violations with file paths
   - Universal metrics (cycles, fan-out, abstraction ratio)
   - Files created
````

---

## Generic Executable Prompt (any NestJS repo)

Replace the repo URL and project path for any NestJS project:

````
Evaluate a NestJS project with the Architectonic Firewall. The target repo is:

  REPO: https://github.com/<owner>/<repo>.git
  CLONE_DIR: /Volumes/Life-OS/Users/Arkatechie/Development/Archi-Firewall/<name>-test
  PROJECT_PATH: <name>-test  (or <name>-test/apps/api for monorepos)

Steps:
1. Verify Neo4j is running (`docker ps --filter "name=neo4j"`). Start with `docker compose up -d` if needed.
2. Clone the repo to CLONE_DIR if it doesn't exist.
3. Run `npm install` in CLONE_DIR if node_modules is missing (use --legacy-peer-deps if needed).
4. For monorepos: ensure the target app's tsconfig.json has `"include": ["src/**/*.ts"]`.
5. Copy `presets/nestjs.yaml` to `<PROJECT_PATH>/firewall.spec.yaml`.
6. Run report: `NEO4J_PASSWORD=daedalus-dev npx tsx -e "import { main } from './src/cli/cli.ts'; main(['node', 'firewall', 'report', '--project', '../<PROJECT_PATH>', '--spec', '../<PROJECT_PATH>/firewall.spec.yaml', '-o', '../<PROJECT_PATH>/report.html', '--symbolic-only', '--verbose']);"
7. Create baseline: same command but with `baseline` instead of `report`, `-o` to `baseline_violations.json`.
8. Open report: `open ../<PROJECT_PATH>/report.html`
9. Present summary: AHS, verdict, per-dimension, top violations, metrics, files created.
````
