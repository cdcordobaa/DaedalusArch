# U0 Foundation — Code Summary

> **Cycle**: v1.2 Evaluation-Readiness · **Unit**: U0 Foundation · **Date**: 2026-10-07
> **Branch**: `v1.2e-u0-foundation` (off `v1.2e` at `427cf9e`, off `main` at `7cd15b4`). Not merged.
> **Plan**: `aidlc-docs/construction/plans/v1.2E-u0-foundation-code-generation-plan.md`. Each step has a "Done" note with its commit, gate counts and deviations.

## Outcome

U0 changes no runtime behaviour. The golden snapshots committed at `GOLDEN_BASE` = `f5fed3fbf1ba5ad84196b88dc80d474736534941` are identical at U0 exit, and no commit after `GOLDEN_BASE` touches `tests/golden/__snapshots__`. The Cypher templates, presets, specs and fixtures are unchanged.

| Measure | Baseline (`7cd15b4`) | U0 exit |
|---|---|---|
| `npm test` | 421 tests, 43 suites | 592 tests, 55 suites, 0 failures |
| Clean clone on `node:22`, `test:unit` | 406 | 577 |
| Golden suite (`GOLDEN_REQUIRED=1`) | did not exist | 8 tests (5 cases, 3 infra), 0 skipped |
| Gate B (test type errors, scratch config) | 85 | 85, per file identical |
| Gate L (lint) | broken (exit 2) | runs; baseline 626 errors / 4 warnings at Step 11; 624 / 4 at exit |
| `npm run typecheck`, `typecheck:u0-tests` | clean / n.a. | clean / clean |
| `npm audit --audit-level=high` (CI, report-only) | n.a. | 49 (2 low, 10 moderate, 37 high, 0 critical) |

CI proved the baseline before any change (run 37679924705 on `bda5172`). The run on `ebefd92` (Step 29) was green with 8 golden tests (run 37687447717).

## Commits (one per step)

| Step | Commit | Subject |
|---|---|---|
| 1 | `427cf9e` | inception artifacts (on `v1.2e`) |
| 4 | `0127cc6` | lock file tracked unchanged; `engines` |
| 5–7 | `0cb9795` | golden suite scaffolding, runner, normaliser, infra test (one commit for three steps) |
| 8 | `f5fed3f` | **GOLDEN_BASE** snapshots |
| 9 | `bda5172` | golden suite in CI; triggers; digest pin; lint non-blocking |
| 10 | `7eb8f06` | remove `@anthropic-ai/sdk` |
| 11 | `1fa02b5` | repair lint tooling |
| 12 | `67b1d4b` | compose: no default password, localhost ports, digest pin |
| 13 | `5210ec7` | `npm audit` in CI |
| 14 | `86e1b7f` | `Docs/environment.md` |
| 15 | `1bb2cc3` | `Docs/corpus.md` |
| 16 | `32ed66f` | findings doc committed without the in-memory claim |
| 17 | `ba530ad` | C10 enums |
| 18 | `edef4b2` | spec contract, weight literals |
| 19 | `7fb0bb1` | fitness-compiler shape |
| 20 | `ed6e1c1` | graph contract |
| 21 | `c00e089` | violation contract |
| 22 | `764abf7` | evaluation and report contract |
| 23 | `1bea1d5` | revised LLM port |
| 24 | `519ac3f` | provider configuration; pipeline `LLMConfig` removed |
| 25 | `6d8fb1d` | query timeout contract and plumbing |
| 26 | `9db9a77` | scored-report slot |
| 27 | `355c58e` | secret scrubber |
| 28 | `d2b406d` | process runner, `buildChildEnv` |
| 29 | `ebefd92` | report and manifest schema drafts |
| 30 | `48b8d26` | hand-offs recorded in design docs |
| 31 | (this commit) | code summary and plan progress |

## Files

**Created (U0 owner)**: `src/shared/errors/scrub.ts`, `src/shared/interfaces/process-runner.ts`, `src/shared/process/node-process-runner.ts`, `schemas/report.schema.json`, `schemas/manifest.schema.json`, `tests/golden/**` (cases, env guards, runner, normaliser, golden and infra tests, 5 snapshots, `CHANGES.md`), `tests/unit/golden/**`, new unit tests for enums, LLM port, LLM-config equivalence, CLI LLM config, repository timeout, scored-report slot, scrubber, process runner, child env, schemas; `jest.golden.config.cjs`, `tsconfig.u0-tests.json`, `tsconfig.eslint.json`, `Docs/environment.md`, `Docs/corpus.md`.

**Modified (U0 owner)**: `src/shared/types/{enums,spec,apg,evaluation,llm-config}.ts`, `src/shared/interfaces/{llm-provider,graph-repository}.ts`, `src/shared/taxonomy/violation-types.ts`, `src/shared/context/firewall-context.ts`, `src/shared/index.ts`, `src/fitness-compiler/types.ts`, `.gitignore`, `package.json`, `package-lock.json`, `eslint.config.mjs`, `jest.config.cjs`, `docker-compose.yml`, `.env.example`, `.github/workflows/ci.yml`, the findings doc.

**Modified under the compile-fix exception (semantics unchanged)**: `src/neo4j-ingestion/{graph-ingester,neo4j-repository,fs-snapshot-store}.ts`, `src/apg-extractor/apg-extractor.ts`, `src/spec-parser/{layer-parsers,template-registry,spec-validator}.ts`, `src/fitness-compiler/fitness-compiler.ts`, `src/llm-critic/{llm-critic,gemini-provider,mock-provider,null-provider}.ts`, `src/pipeline/{types,index,pipeline-factory}.ts`, `src/cli/{cli,batch-runner}.ts`. `src/scoring-engine/score-computer.ts` was not needed (Option B). In total, `git diff 7cd15b4 --stat -- src` reports 31 files, +889 / −86.

## Golden observations (recorded in `tests/golden/CHANGES.md`)

- 17 of 24 compiled symbolic functions execute in every case. FF-CV02, FF-CV03, FF-CV04, FF-P01, FF-SO01, FF-SO02 and FF-SO03 fail with `EVAL_001` because of unbound parameters. This confirms the spec-parser binder defect (F1) on a live Neo4j; U1 fixes it (FR-07).
- 26 `SPEC_002` override warnings per case. No `no-cyclic-deps` truncation.
- Verdicts against the spec header: correct-reference warning 0.787 (header: pass 0.85); variant-a hard-block 0.308 (header: soft-block 0.54); variant-b soft-block 0.517 (header: soft-block 0.58); variant-c hard-block 0.396 (header: hard-block 0.33); variant-d hard-block 0.362 (header: warning 0.66). Only b and c match. The header figures come from the spike repo.

## Recorded values

- Neo4j image: `neo4j:5.26-community@sha256:f66304b9511c60d33555a2c451f88e03d82d1ebc893f32d84c98a6b326096435` (5.26.24, APOC 5.26.24), in `ci.yml` and `docker-compose.yml`.
- Neo4j timeout error code: `Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration`.
- Hardware: Apple M1, 16 GiB, macOS 26.5.2; CI `ubuntu-latest`, Node 22.

## Decisions as executed

D-U0-1 to D-U0-17 were executed as recommended in the plan (Option B for `intent`; optional report fields; `VCRMode` left in C7; optional template fields; timeout without a default; scrubber not wired; runner gaps closed as specified; password and key fallbacks kept verbatim; `openai` kept; `Docs/` spelling; localhost ports; D-U0-12 runner shape; ingestion order preserved; golden suite outside `npm test`; compile-fix hunks in U3-owned files; lint as a ratchet; `maxTokens` raise moved to U4).

## Deviations from the plan

1. **Branch names**: git cannot hold `v1.2e` and `v1.2e/<unit>` at the same time, so unit branches are `v1.2e-<unit>` and CI triggers on `'v1.2e-*'`. The plan and `v1.2E-unit-of-work.md` were updated.
2. **Image digest**: the floating tag had moved past the local image, so the local image's index digest was pinned (still served by Docker Hub) and local and CI run the same server.
3. **Steps 5–7** landed in a single commit.
4. **Golden suite**: an extra `tests/golden/golden-env.ts` holds the shared skip and host guards, and `redactSecrets` keeps failure output free of credentials. `normaliseForSnapshot` takes an optional `repoRoot`. Snapshot `warnings` come from `FirewallContext.warnings`, because `report.warnings` is always `[]` at HEAD.
5. **Lint**: `typescript-eslint` resolved to `^8.71.1`, which also moved the existing `@typescript-eslint/*` packages from 8.57.2 to 8.71.1 (dev-only). `no-throw-literal` was renamed to its v8 successor `only-throw-error`, since the old name made ESLint exit 2. `tsconfig.eslint.json` adds `rootDir: "."`.
6. **Process-runner test**: it uses `/bin/sh` for the grandchild-kill case to avoid a startup race; the runner itself never uses a shell. A macOS `__CF_USER_TEXT_ENCODING` variable is allowed in the env test.
7. **Schemas**: `ajv` and `ajv-formats` were already runtime dependencies, so nothing was added.

## Pre-agreed U0 patches (still open, applied by the owning unit)

Remove `'intent'` (U1, FR-22); make `CypherTemplate.tag` and `requiredLayerKinds` required (U1); make `discriminatorColumns` required (U3); make the report fields and `effectiveWeight` required (U3); C7 re-exports C10 `VCRMode` (U4).

## Hand-offs (recorded in Step 30)

- **U2**: repository default timeout (D-U0-5); scrubbing of `Neo4jRepository` errors (D-U0-6); the `'password'` default in `neo4j-ingestion/types.ts:29` (D-U0-8).
- **U3**: CLI, drift and batch password fallbacks; batch key fallback (D-U0-8).
- **U4**: the `GEMINI_API_KEY ?? ANTHROPIC_API_KEY` fallback (D-U0-8); the critic `maxTokens` raise (D-U0-17); `MockLLMProvider.getPrompts()`.

## Residual findings

- Lint: 624 errors and 4 warnings (dot-notation 181, no-non-null-assertion 98, restrict-template-expressions 92, …). The CI Lint step stays `continue-on-error`. Triage happens in Build and Test.
- `npm audit`: 37 high, 8 of them in the runtime tree (`brace-expansion`, `braces`, `fast-uri`, `form-data`). Report-only.
- The local `.env` `NEO4J_PASSWORD` equals the former compose default, which is still quoted in `.claude/commands/firewall-init.md` and `Docs/Use Agent Playbook.md`. These are stale `daedalus-dev` doc references. The container is localhost-only; rotating the password is the author's call.
- Corpus licences: dev-nest has MIT in the README but ISC in `package.json` and no licence file; realworld-test has ISC only in `package.json`.

## NFR-04 checklist items raised for Build and Test

ADR-005 node and edge lists (`Package`, `FLOWS_TO`, `RE_EXPORTS`); the `Docs/` spelling; stale `daedalus-dev` references; the spec-header verdicts in `specs/clean-arch.yaml:9-14` against the measured baseline.
