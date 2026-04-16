# Architectonic Firewall — Agent Playbook

Instructions for an AI coding agent to evaluate any TypeScript project for architectural compliance.

---

## Architecture

The system has two parts that live in separate directories:

```
FIREWALL_HOME  (the engine)          TARGET_PATH  (the project being evaluated)
├── src/cli/cli.ts                   ├── src/
├── presets/nestjs.yaml              │   ├── auth/
├── presets/clean-architecture.yaml  │   ├── users/
├── docker-compose.yml               │   └── ...
└── ...                              ├── package.json
                                     ├── tsconfig.json
                                     ├── firewall.spec.yaml    ← created by the agent
                                     ├── report.html           ← created by the agent
                                     └── baseline_violations.json  ← created by the agent
```

The engine is at a fixed path. All CLI commands run from `FIREWALL_HOME` with `--project` pointing at the target. The agent's working directory can be either location.

**Engine location**:
```
/Volumes/Life-OS/Users/Arkatechie/Development/Archi-Firewall/DaedalusArch
```

---

## Invocation

The evaluation is available as a **user-level Claude Code command** that works from any project directory:

```
/firewall
/firewall /path/to/specific/project
```

If no path argument is given, the current working directory is evaluated.

The command is defined at `~/.claude/commands/firewall.md` and contains the full procedure. It knows where the engine lives, which preset to select, and how to run the CLI.

---

## What the Command Does

### Inputs
- A TypeScript project path (or current directory)

### Outputs
- `firewall.spec.yaml` — the evaluation spec (copied from a preset, possibly with project-specific exclude paths added)
- `report.html` — interactive HTML report with scores, violations, and fix suggestions
- `baseline_violations.json` — snapshot of current violations for CI baseline comparison

### Procedure (executed by the agent)

1. **Resolve target** — use argument or cwd
2. **Check Neo4j** — start if not running (`docker compose up -d` from engine dir)
3. **Check dependencies** — `npm install` if `node_modules/` missing
4. **Check tsconfig** — must have `include` with source files; fix if only project references
5. **Detect style** — read `package.json` for `@nestjs/core` → NestJS preset; else clean-architecture
6. **Copy preset** — `cp presets/<style>.yaml <target>/firewall.spec.yaml`
7. **Add excludes** — scan for `src/generated/`, `src/migrations/` and add to spec if found
8. **Evaluate + report** — single CLI command produces the HTML report
9. **Baseline** — snapshot current violations
10. **Open report** — `open report.html`
11. **Summarize** — AHS score, verdict, per-dimension breakdown, top violations, metrics

---

## How the Preset Works (no customization needed)

The NestJS preset assigns architectural layers **per file** using naming conventions. This works for both layered-directory projects (`src/domain/`, `src/infrastructure/`) and co-located feature-module projects (`src/auth/auth.controller.ts`, `src/auth/auth.service.ts` in the same folder).

| File pattern | Assigned layer |
|---|---|
| `*.controller.ts`, `*.module.ts`, `*.guard.ts`, `*.interceptor.ts` | presentation |
| `*.service.ts`, `*.processor.ts`, `**/dto/**` | application |
| `*.repository.ts`, `*.worker.ts`, `**/strategies/**` | infrastructure |
| Files in `src/domain/**`, `src/core/**` | domain |

Layer order (inner → outer): **domain → infrastructure → application → presentation**

The 24 fitness functions check: dependency direction, cyclic imports, layer skipping, dependency inversion, repository pattern, domain purity, fan-out, instability, SRP, ISP, naming conventions, test pairing, and more.

`*.module.ts` files are excluded from layer-skip checking because NestJS modules are DI wiring that imports from all layers by design.

---

## Reading the Results

### AHS (Architectural Health Score)

```
AHS = sum( weight * (1 - AVR) )  per dimension
AVR = violated_functions / total_functions  per dimension
```

| Dimension | Weight | Measures |
|---|---|---|
| structural | 35% | Dependency direction, cycles, layer skips |
| pattern | 30% | Dependency inversion, repository pattern, domain purity |
| coupling | 20% | Fan-out, instability, orphan files, abstraction ratio |
| solid | 10% | SRP, ISP, inheritance depth |
| convention | 5% | Naming, test pairing |

### Verdicts

| AHS | Verdict | Meaning |
|---|---|---|
| >= 0.80 | **pass** | Architecture is healthy |
| 0.65 - 0.79 | **warning** | Issues exist, not blocking |
| 0.50 - 0.64 | **soft-block** | Significant architectural problems |
| < 0.50 | **hard-block** | Severe structural issues |

### Common Findings

| ID | Name | What it means | Typical fix |
|---|---|---|---|
| FF-P02 | dependency-inversion | Service depends on concrete class, not interface | Define a port interface in application layer |
| FF-S02 | no-cyclic-deps | Circular import chain | Extract shared types or introduce an interface |
| FF-C03 | component-instability | File instability > 0.8 | Expected for modules — investigate if it's a service |
| FF-C04 | no-orphan-files | No import connections | Often dynamic loading (TypeORM/Prisma entities) — minor |
| FF-CV05 | test-file-pairing | No paired test file | Advisory only |
| FF-C02 | module-fan-out | Too many outgoing imports | Expected for root module — investigate if it's a service |

---

## Reference Benchmarks

Scores from 4 validated projects using the unmodified NestJS preset:

| Project | Files | AHS | Verdict | Key characteristic |
|---|---|---|---|---|
| DevNest | 77 | 0.54 | soft-block | No interfaces, no tests |
| Truthy | 131 | 0.69 | warning | Clean structure, no DI |
| Ghostfolio | 267 | 0.78 | warning | Production-grade, some DI violations |
| RealWorld | 34 | 0.80 | warning | Has interfaces, entity cycles |

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `No .ts source files found` | Missing `node_modules/` or tsconfig has no `include` | `npm install`; add `"include": ["src/**/*.ts"]` to tsconfig |
| `authentication failure` | Wrong Neo4j password | `NEO4J_PASSWORD=daedalus-dev` |
| `Unknown architecture style` | Unregistered style in spec | Use `nestjs` or `clean-architecture` |
| `Schema validation failed` | Invalid spec YAML | Each layer needs `name`, `roles`, and `directories` or `file_patterns` |
| Pipeline hangs | Neo4j not running | `docker compose up -d` from engine dir |
| npm install fails | Peer dependency conflicts | Use `--legacy-peer-deps` |

---

## The Cross-Directory Problem

The engine lives in DaedalusArch. The target is a separate project. An agent working in the target directory needs to reach the engine.

**Current solution**: The user-level command at `~/.claude/commands/firewall.md` carries the engine path and full procedure. It's available in every Claude Code session regardless of working directory. The agent reads it via `/firewall`, switches to the engine directory to run CLI commands, and writes output files to the target directory.

**Future solution**: Publish DaedalusArch as an npm package (`npx daedalus-arch evaluate --project .`) so no path is needed. This removes the cross-directory problem entirely.
