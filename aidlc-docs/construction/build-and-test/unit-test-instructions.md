# Unit Test Execution — DaedalusArch

## Overview

- **Framework**: Jest 29.x with ts-jest
- **Test files**: 27 unit test files across 10 modules
- **Total tests**: 312 (as of U7 completion)
- **BDD features**: 4 Gherkin feature files (jest-cucumber)

## Run All Unit Tests

```bash
npm run test:unit
```

**Expected**: 27 suites pass, ~280 unit tests pass, 0 failures.

## Run All Tests (Unit + Integration + BDD)

```bash
npm test
```

**Expected**: 29 suites, 312 tests, 0 failures, ~14s runtime.

## Run with Coverage

```bash
npm run test:coverage
```

**Expected**:
- **Statements**: >= 76%
- **Functions**: >= 82%
- **Lines**: >= 77%
- Coverage report at `coverage/lcov-report/index.html`

## Per-Module Test Breakdown

### Shared Domain (U1)
```bash
npx jest tests/unit/shared/ --no-coverage
```
| Suite | Tests | Key Assertions |
|-------|-------|---------------|
| `firewall-context.test.ts` | ~15 | Set-once invariant, typed getters, warning accumulation |
| `domain-result.test.ts` | ~10 | Ok/fail constructors, type narrowing |
| `value-objects.test.ts` | ~8 | Brand validation, range constraints |

### APG Extractor (U2)
```bash
npx jest tests/unit/apg-extractor/ --no-coverage
```
| Suite | Tests | Key Assertions |
|-------|-------|---------------|
| `apg-extractor.test.ts` | ~11 | Project parsing, fixture extraction, parse coverage |
| `node-extractor.test.ts` | ~15 | 5 node types: File, Class, Interface, Method, Function |
| `edge-extractor.test.ts` | ~20 | 7 edge types: IMPORTS, IMPLEMENTS, EXTENDS, etc. |
| `id-generator.test.ts` | ~5 | Deterministic ID generation |

### Spec Parser (U3)
```bash
npx jest tests/unit/spec-parser/ --no-coverage
```
| Suite | Tests | Key Assertions |
|-------|-------|---------------|
| `spec-parser.test.ts` | ~15 | 3-layer YAML parsing, template resolution |
| `spec-validator.test.ts` | ~10 | JSON Schema validation, business rule validation |
| `adr-parsers.test.ts` | ~8 | MADR, Nygard, Y-Statement, custom YAML formats |
| `template-registry.test.ts` | ~5 | Clean-architecture template, registry lookup |

### Fitness Compiler (U3)
```bash
npx jest tests/unit/fitness-compiler/ --no-coverage
```
| Suite | Tests | Key Assertions |
|-------|-------|---------------|
| `fitness-compiler.test.ts` | ~20 | Cypher template instantiation, 7 dimensions, route tagging |

### Neo4j Ingestion (U4)
```bash
npx jest tests/unit/neo4j-ingestion/ --no-coverage
```
| Suite | Tests | Key Assertions |
|-------|-------|---------------|
| `neo4j-ingestion.test.ts` | ~12 | APG ingestion, layer annotation, stateless mode |
| `layer-annotator.test.ts` | ~10 | Directory/naming/decorator priority |
| `delta-computer.test.ts` | ~8 | Added/removed nodes/edges computation |
| `drift-detector.test.ts` | ~10 | Structural, coupling, convention, violation trend drift |
| `fs-snapshot-store.test.ts` | ~8 | Save/load snapshots, delta persistence |

### Router + Evaluation (U5)
```bash
npx jest tests/unit/neuro-symbolic-router/ tests/unit/evaluation-engine/ tests/unit/llm-critic/ --no-coverage
```
| Suite | Tests | Key Assertions |
|-------|-------|---------------|
| `router.test.ts` | ~12 | Route dispatch, mode filtering, parallel execution |
| `symbolic-evaluator.test.ts` | ~10 | Cypher execution, violation collection, APOC cycles |
| `llm-critic.test.ts` | ~15 | Context assembly, prompt construction, verdict parsing, VCR |

### Scoring Engine (U6)
```bash
npx jest tests/unit/scoring-engine/ --no-coverage
```
| Suite | Tests | Key Assertions |
|-------|-------|---------------|
| `scoring-engine.test.ts` | ~20 | AVR, AHS, verdict, dual scoring, report formatting |

### Pipeline (U7)
```bash
npx jest tests/unit/pipeline/ --no-coverage
```
| Suite | Tests | Key Assertions |
|-------|-------|---------------|
| `pipeline-executor.test.ts` | 8 | Sequential execution, fail-fast, shutdown, timings |
| `parallel-command.test.ts` | 6 | Promise.all, error propagation, warning merge |
| `commands.test.ts` | 9 | Extract/Parse/Compile context read/write, error mapping |
| `pipeline-factory.test.ts` | 7 | Preset sequences, flag overrides, cleanup |

### CLI (U7)
```bash
npx jest tests/unit/cli/ --no-coverage
```
| Suite | Tests | Key Assertions |
|-------|-------|---------------|
| `cli.test.ts` | 24 | Commander.js parsing, exit codes, output routing, cleanup |
| `batch-runner.test.ts` | 19 | Project discovery, sequential execution, CSV/JSON output |

## BDD Feature Files

```bash
npx jest tests/features/ --no-coverage
```

| Feature | Scenarios |
|---------|-----------|
| `apg-extraction.feature` | APG extraction from TypeScript projects |
| `import-resolution.feature` | Barrel imports, path aliases |
| `parse-coverage.feature` | Coverage percentage reporting |
| `violation-taxonomy.feature` | Violation type classification |

## Fix Failing Tests

1. Run the specific failing suite in verbose mode:
   ```bash
   npx jest tests/unit/<module>/<file>.test.ts --verbose --no-coverage
   ```
2. Check for environment issues (Neo4j not running, missing env vars)
3. Check for module dependency issues (`npm ci` to reset)
4. Review the test output for assertion mismatches
