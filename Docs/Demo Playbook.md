# Demo Playbook — Architectonic Firewall

A live walkthrough evaluating [Ghostfolio](https://github.com/ghostfolio/ghostfolio), a production open-source wealth management platform with 4k+ GitHub stars. No hand-tuning, no configuration — preset to report in under 2 minutes.

---

## What You'll Show

1. Clone a real production NestJS project (Nx monorepo, 267 files)
2. Copy the generic preset (zero customization)
3. Run one command that produces an interactive HTML report
4. Walk through the findings — all architecturally real

**Time**: ~3 minutes (including npm install)

---

## About the Target

**Ghostfolio** is a privacy-first, open-source wealth management dashboard. Real users, real production traffic. The backend is a NestJS API inside an Nx monorepo:

- 267 TypeScript files in `apps/api/`
- Prisma ORM + PostgreSQL
- 12 data provider integrations (Yahoo Finance, CoinGecko, Alpha Vantage, etc.)
- Queue-based portfolio snapshots (Bull)
- Auth, cron jobs, caching, i18n
- Separated cross-cutting concerns (`guards/`, `interceptors/`, `middlewares/`, `decorators/`)

This is not a toy project — it's a real app with real architectural decisions.

---

## Prerequisites (already running)

```bash
# From the DaedalusArch directory:
docker compose up -d          # Neo4j
```

---

## The Demo

### 1. Clone and install (60s)

```bash
cd /path/to/workspace
git clone --depth 1 https://github.com/ghostfolio/ghostfolio.git ghostfolio-test
cd ghostfolio-test && npm install
```

> **Talking point**: "Ghostfolio — 4,000+ stars on GitHub, a real financial platform. Let's see what its architecture actually looks like."

### 2. Prepare the target (15s)

Ghostfolio is an Nx monorepo. The backend lives in `apps/api/`. Its `tsconfig.json` uses project references, so we create a flat one for ts-morph:

```bash
cd apps/api
cat > tsconfig.json << 'EOF'
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
cd ../../..     # back to workspace root
```

> **Talking point**: "Monorepo setup — we point at the API app directory. One tsconfig tweak because Nx uses project references."

### 3. Copy the preset (5s)

```bash
cp DaedalusArch/presets/nestjs.yaml ghostfolio-test/apps/api/firewall.spec.yaml
```

> **Talking point**: "One file. Zero configuration. The preset knows NestJS conventions — `*.controller.ts` is presentation, `*.service.ts` is application, `*.repository.ts` is infrastructure. Works on any NestJS project."

### 4. Run the evaluation + generate report (90s)

```bash
cd DaedalusArch
TARGET=../ghostfolio-test/apps/api

NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'report',
  '--project', '$TARGET',
  '--spec', '$TARGET/firewall.spec.yaml',
  '-o', '$TARGET/report.html',
  '--symbolic-only', '--verbose']);
"
```

The terminal will show:

```
Evaluating ghostfolio-test/apps/api (mode: symbolic-only)...
╔═══════════════════════════════════════════╗
║  Architectural Health Score: 0.78 (WARNING)║
╚═══════════════════════════════════════════╝

  Per-Dimension Breakdown:
    structural     AVR: 0.000  (0 violations)
    coupling       AVR: 0.667  (4 violations)
    pattern        AVR: 0.250  (1 violations)
    solid          AVR: 0.000  (0 violations)
    convention     AVR: 0.333  (1 violations)

  Pipeline completed in ~2s
```

> **Talking point**: "267 files analyzed in under 2 seconds. 24 fitness functions evaluated. The score is 0.78 — that's a WARNING, not a block. The structural dimension is perfect — zero cyclic dependencies, zero layer violations in a 267-file codebase. That's impressive."

### 5. Open the report

```bash
open $TARGET/report.html
```

---

## Walking Through the Report

### The Score: AHS 0.78 (WARNING)

The interactive HTML report shows a gauge, per-dimension breakdown, and every violation with its file path, explanation, and suggested fix.

### What's Good (highlight first)

> "Let's start with what Ghostfolio gets right."

| Dimension | Score | What it means |
|---|---|---|
| **structural: 0.000** | Perfect | Zero cyclic dependencies across 267 files. Zero layer-skip violations. Clean dependency direction. In a project with 12 data provider integrations and queue processors, that's excellent engineering. |
| **solid: 0.000** | Perfect | No god classes. No interface bloat. Classes are well-sized with focused responsibilities. |

> **Talking point**: "Two dimensions score perfect. For a project this size with this many integrations, that's not accidental — someone made deliberate architectural choices."

### What's Flagged

#### 1. Dependency Inversion (FF-P02) — 55 violations, critical

> "The biggest finding — 55 services inject concrete classes instead of interfaces."

Show a few examples in the report:
- `src/services/data-provider/yahoo-finance/yahoo-finance.service.ts`
- `src/services/data-provider/coingecko/coingecko.service.ts`
- `src/app/access/access.service.ts`

> "All 12 data provider services have this pattern. They inject Prisma directly rather than through a repository interface. In a financial application where you might want to swap data sources or add caching layers, this creates coupling that's hard to change later."

> "But notice — the firewall tells you exactly WHAT to fix: *Introduce an interface (port) in the higher-level module and have the lower-level module implement it.* That's actionable."

#### 2. Component Instability (FF-C03) — 31 violations, major

> "31 files have an instability index above 0.8 — meaning they only have outgoing dependencies and nothing depends on them. These are leaf nodes in the dependency graph."

Show examples: module files, processor files, queue services.

> "This is typical for NestJS modules and queue processors — they're wiring or background jobs by nature. The threshold is 0.8, so only extreme cases are flagged."

#### 3. Orphan Files (FF-C04) — 46 violations, minor

> "46 files with no static import connections."

> "Many of these are Prisma models, DTOs, or NestJS entities loaded via decorators rather than static imports. This is a known limitation of static analysis — dynamic loading via `@Module({ imports: [...] })` doesn't create edges in the AST. Minor severity, doesn't significantly affect the score."

#### 4. Fan-out (FF-C02) — 1 violation, major

> "One file exceeds the fan-out threshold of 12 imports — likely `app.module.ts`, the root module that wires everything together."

> "This is expected in NestJS — the root module IS the composition root. In a project with 23 feature modules, 12+ imports is normal."

#### 5. Missing Tests (FF-CV05) — 202 violations, advisory

> "202 source files with no paired test file. This is the project's biggest gap in engineering practice. Advisory severity — it informs, doesn't block."

#### 6. Low Abstraction Ratio (FF-C06) — 1 violation, advisory

> "17.4% of types are abstractions (interfaces/abstract classes). The rest are concrete. For a project that relies heavily on Prisma's generated types, this is expected."

### The Punchline

> "267 files. Zero configuration. 336 findings, every one architecturally real. The score of 0.78 tells the right story: **structurally excellent, but coupled to concrete implementations with no test safety net.** The path to 0.85+ is clear — introduce repository interfaces for the data provider layer and add tests."

---

## Comparison Slide

| Project | Type | Files | AHS | Verdict |
|---|---|---|---|---|
| DevNest | Social backend, Prisma | 77 | 0.54 | soft-block |
| Truthy | Headless CMS, TypeORM | 131 | 0.69 | warning |
| **Ghostfolio** | **Wealth mgmt, Prisma, Nx monorepo** | **267** | **0.78** | **warning** |
| RealWorld | Blog API, TypeORM | 34 | 0.80 | warning |

> "Four different projects, four different sizes, same preset. The scores differentiate correctly. DevNest has no interfaces and no tests — soft-block. Ghostfolio has clean structure but concrete coupling — warning. RealWorld has interfaces and clean deps — warning, almost passing."

---

## Bonus: Baseline for CI (30s)

```bash
NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'baseline',
  '--project', '$TARGET',
  '--spec', '$TARGET/firewall.spec.yaml',
  '-o', '$TARGET/baseline_violations.json',
  '--verbose']);
"
```

> "Baseline created with 336 violations. Now in CI, only NEW violations block. The team fixes issues incrementally — no big-bang refactor needed."

---

## If Something Goes Wrong

| Problem | Fix |
|---|---|
| "No .ts source files found" | `npm install` in project root; check tsconfig has `"include": ["src/**/*.ts"]` |
| "authentication failure" | `NEO4J_PASSWORD=daedalus-dev` |
| Neo4j not running | `docker compose up -d` from DaedalusArch root |
| npm install fails | `npm install --legacy-peer-deps` for older NestJS |
| Monorepo tsconfig issues | Create flat tsconfig with explicit `include` (see Step 2) |

---

## Alternative Demo Targets

| Repo | Stars | Files | AHS | What It Is |
|---|---|---|---|---|
| [ghostfolio/ghostfolio](https://github.com/ghostfolio/ghostfolio) | 4k+ | 267 | 0.78 | Wealth management, Nx monorepo (recommended) |
| [lujakob/nestjs-realworld-example-app](https://github.com/lujakob/nestjs-realworld-example-app) | 5k+ | 34 | 0.80 | RealWorld blog spec, TypeORM |
| [gobeam/truthy](https://github.com/gobeam/truthy) | 600+ | 131 | 0.69 | Headless CMS, RBAC |
| [johnvesslyalti/dev-nest](https://github.com/johnvesslyalti/dev-nest) | small | 77 | 0.54 | Social media backend, Prisma |
