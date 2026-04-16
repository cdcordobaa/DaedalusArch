# Demo Playbook — Architectonic Firewall

A live walkthrough evaluating [Truthy](https://github.com/gobeam/truthy), an open-source NestJS headless CMS with 600+ GitHub stars. No hand-tuning, no configuration — preset to report in under 2 minutes.

---

## What You'll Show

1. Clone a public NestJS project the audience has never seen
2. Copy the generic preset (zero customization)
3. Run one command that produces an HTML report
4. Walk through the findings — all architecturally real

**Time**: ~3 minutes (including npm install)

---

## Prerequisites (already running)

```bash
# From the DaedalusArch directory:
docker compose up -d          # Neo4j
```

---

## The Demo

### 1. Clone the target (30s)

```bash
cd /path/to/workspace
git clone --depth 1 https://github.com/gobeam/truthy.git truthy-demo
cd truthy-demo && npm install --legacy-peer-deps
cd ../DaedalusArch
```

> **Talking point**: "This is a headless CMS — auth, RBAC, roles, permissions, email, 2FA, i18n. 131 TypeScript files. We've never seen this codebase before."

### 2. Copy the preset (5s)

```bash
cp presets/nestjs.yaml ../truthy-demo/firewall.spec.yaml
```

> **Talking point**: "One preset file. No configuration. The preset uses file-naming conventions to assign architectural layers — `*.controller.ts` is presentation, `*.service.ts` is application, `*.repository.ts` is infrastructure. It works for any NestJS project."

### 3. Run the evaluation + generate report (60s)

```bash
TARGET=../truthy-demo

NEO4J_PASSWORD=daedalus-dev npx tsx -e "
import { main } from './src/cli/cli.ts';
main(['node', 'firewall', 'report',
  '--project', '$TARGET',
  '--spec', '$TARGET/firewall.spec.yaml',
  '-o', '$TARGET/report.html',
  '--symbolic-only', '--verbose']);
"
```

> **Talking point**: "The pipeline extracts a property graph from the TypeScript AST, loads it into Neo4j, compiles 24 fitness functions into Cypher queries, runs them, scores the results, and generates the report. Under 2 seconds for the actual evaluation."

### 4. Open the report

```bash
open ../truthy-demo/report.html
```

---

## What the Report Shows

### Score: AHS 0.69 (WARNING)

| Dimension | AVR | Weight | Meaning |
|---|---|---|---|
| **structural** | 0.000 | 35% | No cyclic deps, no layer skips, clean dependency direction |
| **coupling** | 0.333 | 20% | 65 orphan files (no imports/exports), low abstraction ratio |
| **pattern** | 0.750 | 30% | 8 services lack dependency inversion, 6 missing repository pattern, 5 use-case isolation issues |
| **solid** | 0.000 | 10% | Classes are well-sized, no SRP or ISP violations |
| **convention** | 0.333 | 5% | 65 source files with no paired test file |

### Walk-through: Top Violations

#### 1. Dependency Inversion (FF-P02) — 8 violations, critical

> "Every service injects concrete classes — `AuthService` depends on the concrete `UserRepository`, not an interface. In a strict layered architecture, you'd define a `UserRepositoryPort` interface in the application layer and have the infrastructure provide the implementation."

Show `src/auth/auth.service.ts` — concrete TypeORM repository injection.

#### 2. Repository Pattern (FF-P03) — 6 violations, critical

> "Several modules access the ORM directly from services without going through a repository abstraction."

#### 3. Orphan Files (FF-C04) — 65 violations, minor

> "65 files have no import connections — they're neither imported by other files nor import anything. Many of these are entity files, DTOs, or configuration that are loaded dynamically by TypeORM/NestJS rather than via static imports."

> **Talking point**: "This is a known limitation — the firewall tracks static imports only. TypeORM entities loaded via `forFeature([Entity])` don't create import edges in the AST. These are minor severity and don't affect the score significantly."

#### 4. Missing Tests (FF-CV05) — 65 violations, advisory

> "Zero test files paired with source files. This is a real observation — the project has no unit tests."

#### 5. Low Abstraction Ratio (FF-C06) — 1 violation, advisory

> "Abstraction ratio is 0.16 — only 16% of types are interfaces or abstract classes. The rest are concrete implementations."

### What It Got Right (No False Positives)

- **Structural dimension: perfect score** — zero cyclic deps, zero layer violations. The feature modules have clean dependency chains.
- **SOLID: perfect score** — classes are reasonably sized, no god classes.
- **No generated-code noise** — `src/generated/**` excluded by default.
- **No module-file noise** — `*.module.ts` excluded from layer-skip checking.

---

## The Punchline

> "131 files. Zero configuration. 150 findings, every one architecturally real. The score of 0.69 correctly reflects a project with clean structure but no dependency inversion and no tests. A well-architected project with interfaces and tests would score 0.85+."

---

## Comparison Slide (if time permits)

| Project | Files | AHS | Verdict | Key Differentiator |
|---|---|---|---|---|
| DevNest | 77 | 0.54 | soft-block | No interfaces, no tests, service→Prisma coupling |
| **Truthy** | **131** | **0.69** | **warning** | **Clean structure, no DI, no tests** |
| RealWorld | 34 | 0.80 | warning | Has interfaces, TypeORM entity cycles |
| Ghostfolio | 267 | 0.78 | warning | Production-grade, some DI violations at scale |

> "Four different projects, four different sizes, same preset, zero customization. The scores differentiate correctly — projects with better architecture score higher."

---

## Bonus: Create Baseline (if audience asks about CI)

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

> "Baseline created with 150 violations. Now in CI, only NEW violations block the build. The team can fix issues incrementally without being overwhelmed."

---

## If Something Goes Wrong

| Problem | Fix |
|---|---|
| "No .ts source files found" | Run `npm install` in the target project |
| "authentication failure" | Set `NEO4J_PASSWORD=daedalus-dev` |
| Neo4j not running | `docker compose up -d` from DaedalusArch root |
| npm install fails | Try `--legacy-peer-deps` (older NestJS projects) |

---

## Repo Options (alternatives if Truthy is unavailable)

| Repo | Stars | What It Is | Clone Command |
|---|---|---|---|
| [gobeam/truthy](https://github.com/gobeam/truthy) | 600+ | Headless CMS with RBAC | `git clone --depth 1 https://github.com/gobeam/truthy.git` |
| [lujakob/nestjs-realworld-example-app](https://github.com/lujakob/nestjs-realworld-example-app) | 5k+ | RealWorld blog API | `git clone https://github.com/lujakob/nestjs-realworld-example-app.git` |
| [johnvesslyalti/dev-nest](https://github.com/johnvesslyalti/dev-nest) | small | Social media backend | `git clone https://github.com/johnvesslyalti/dev-nest.git` |
