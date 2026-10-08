# U3 Code Summary — Evaluation, Scoring and Report

> **Cycle**: v1.2 Evaluation-Readiness (lane 3) · **Unit**: U3 · **Date**: 2026-10-08 · **Branch**: `v1.2e-u3-evaluation-scoring-report` on `origin/v1.2e` @ `ecf0184`
> **Plan**: `aidlc-docs/construction/plans/v1.2E-u3-evaluation-scoring-report-code-generation-plan.md` (Steps 0–34; per-step Done notes are the detailed record). **Design**: `functional-design/` (BR-U3-01..93, BLM §9 golden table R1–R14, DE §8 bundled patch). **Hand-offs**: `code/handoffs.md`.
> Commit hashes below are the current branch hashes. Group 3–7 Done notes quote pre-rebase hashes (D-U3-12 rebases onto `e35ef8a` and `ecf0184`, both with no conflict and no tree change in `src`, `tests`, `schemas`).

## 1. Files

### 1.1 Created (U3-owned)
- `src/evaluation-engine/violation-id.ts`, `evidence.ts`, `cycle-canonicaliser.ts`, `scc-cycles.ts`
- `src/scoring-engine/renormaliser.ts`, `warning-merge.ts`, `report-builder.ts`, `report-schema.ts`, `report-schema-validator.ts`
- `src/pipeline/commands/assemble-report-command.ts`, `src/pipeline/scrubbing-context.ts` (R11), `src/cli/require-env.ts`
- Fixtures `fixtures/unit/u3-state-purity/{field-new,ctor-inject,ctor-inject-two}/`, `fixtures/unit/u3-reexport/` (TF-02..05)
- Gated tests `tests/golden/u3-templates.test.ts`, `tests/golden/u3-byte-stability.test.ts`; helper `tests/golden/byte-stability.ts`
- 25 unit-test files under `tests/unit/{evaluation-engine,scoring-engine,pipeline,cli,report,golden,shared}/` (plus `tests/unit/scoring-engine/assembled-report-fixture.ts` and `fixtures/golden-base-u3-scores.json`); `tsconfig.u3-tests.json`
- Records: `code/handoffs.md`, this file

### 1.2 Modified (U3 owner)
- C6: `src/evaluation-engine/{symbolic-evaluator,types,index}.ts`
- C8: `src/scoring-engine/{index,report-formatter,score-computer,scoring-engine,types,universal-metrics}.ts`
- S1 / pipeline: `src/pipeline/commands/{compile-command,extract-command,score-command,symbolic-evaluate-command,index}.ts`, `src/pipeline/pipeline-factory.ts`
- C9: `src/cli/{cli,batch-runner,drift-handler}.ts`; C13: `src/report/{dashboard-data-builder,html-template,report-generator,types}.ts`
- C4 hunks: `src/fitness-compiler/cypher-templates.ts` (`domain-purity`, `domain-state-purity`, three metric tails, T-MAP `resultMapping`s, `TEMPLATE_DISCRIMINATORS`); `src/spec-parser/template-registry.ts` (`domain-state-purity` entry)
- `schemas/report.schema.json` (frozen at R10); `tests/golden/{golden-runner,normalise,check-changes-log}.ts`, `tests/golden/CHANGES.md`, the five `tests/golden/__snapshots__/*.json`; `.github/workflows/ci.yml` (one `if:`); existing tests under `tests/unit/{cli,pipeline,report,schemas,scoring-engine,golden}/`, `tests/integration/spec-parser/full-pipeline.test.ts`

### 1.3 Attributed cross-unit
- R6: `presets/{clean-architecture,nestjs,layered}.yaml`, `specs/clean-arch.yaml` (FF-P06); U1 test expectations (`tests/unit/fitness-compiler/{denominator,fitness-compiler,k1-layer-kinds,k11-template-tags,k15-layered,k4-style-applicability,template-applicability,v1.1-compiler-extensions}.test.ts`, `tests/unit/spec-parser/{template-registry,spec-validator,v1.1-spec-validator}.test.ts`, `tests/golden/u1-templates.test.ts`)
- Step 18: `scripts/migrate-corpus-spec.ts`, `scripts/migrate-corpus-spec-cli.ts` (FF-P06 rule), `tests/unit/scripts/migrate-corpus-spec.test.ts`
- R7 (`intent` keys only): `src/spec-parser/layer-parsers.ts`, `template-registry.ts`, `src/spec-parser/dimension-alias.ts` (type-only fix, R7 deviation 1), U1 tests `k14-integrity-dimension`, `spec-parser`
- R2/R5 (T-MAP pin updates, recorded deviations): `tests/unit/fitness-compiler/{k5-repository-pattern,k7-order-by}.test.ts`
- R11: `src/neo4j-ingestion/neo4j-repository.ts` (U2) now calls the shared scrub moved to `src/shared/errors/scrub.ts` (BR-U3-58 fallback; 7 + / 47 −, no behaviour change)
- Step 5: `tests/golden/check-changes-log.ts` grammar (U1 checker) and its test

### 1.4 Bundled C10 patch (R1, U0-owned files)
`src/shared/types/evaluation.ts`, `src/fitness-compiler/types.ts` (DE §8 rows 1–14, 16, 17; row 15 is U4's; row 1 kept optional, deviation); `src/shared/types/enums.ts` (`intent` removed at R7); `src/shared/types/spec.ts` (`ScoringWeights` comment, R7). Pinned by `tests/unit/shared/c10-bundled-patch.test.ts`.

## 2. Commits

| Label | Commit | Subject (abridged) | Snapshots |
|---|---|---|---|
| U3-R1 | `730c4c8` | bundled C10 patch | no |
| (Steps 8–12) | `f3c71b6`, `1364a4f`, `608b4ec`, `d6f87c3`, `a2d02b5` | unwired modules: id/evidence, cycle cap/SCC, renormaliser, warning merge, report builder | no |
| U3-R2 | `5f8189f` | FR-12 row mapping, hashed ids, golden pick gains `line`/`target` | a, b, c, d |
| U3-R3 | `1c7f7aa` | cycle sentinel dropped, truncation marked | no |
| U3-R4 | `71b68d6` | metric templates return violating rows only, project key, single pass rule | all five |
| U3-R5 | `8e48219` | `domain-purity` over Package nodes, IMPORTS\|RE_EXPORTS | b, c |
| U3-R6 | `b8a25b9` | `domain-state-purity` and FF-P06; U1 test updates | all five |
| (Step 18) | `3f8c20c` | corpus-spec migration adds FF-P06 | no |
| U3-R7 | `8ad3c3e` | seven dimensions, renormalised AHS variants, verdict source | all |
| U3-R8 | `3b6c48c` | bounded, File-typed universal metrics, visible failures | d |
| U3-R9 | `39d423b` | `AssembleReportCommand`, function execution, failures, warning routing | all |
| U3-R10 | `7cefd99` | frozen report schema, fail-closed validation | no |
| U3-R11 | `d5d8ec4` | scrubbing everywhere | no |
| U3-R12 | `2188c4f` | no default Neo4j password; batch without provider | no |
| U3-R13 | `4ce8688` | HTML from the assembled report | no |
| U3-R14 | `57d9867` | byte-stability test; SCC fallback present, off | no |

Non-R commits: Steps 0–6 records and tooling (`d887124`, `d1a1c82`, `9c6d718`, `7e0175b`, `2c3aea7`, `30eeffb`, `bb9ab3d`), group G-CI records, Steps 27–29 records, Steps 30–31 records. Snapshot-touching commits since `GOLDEN_BASE_U3` are exactly R2, R4, R5, R6, R7, R8, R9.

## 3. Gate history

| Point | Gate U (tests / suites) | L | B | `N_G` | CI run |
|---|---|---|---|---|---|
| Step 3 base (`U_0`, `L_0`, `B_0`) | 1277 / 94 | 575 | 85 | 38 | `37759345216` |
| Group 2 | 1290 / 94 | 575 | 85 | 38 | `37761113871` |
| Group 3 (R1) | 1299 / 95 | 575 | 85 | 38 | `37762673919` |
| Group 5 (R2–R4) | 1494 / 105 | 572 | 85 | 43 | `37768120473` |
| Group 6 (R5, R6, Step 18) | 1568 / 107 | 572 | 85 | 54 | `37770853169` |
| Group 7 (R7, R8) | 1623 / 109 | 568 | 85 | 54 | `37774762098` |
| Group 8 (R9–R11) | 1673 / 113 | 566 | 85 | 71 | `37779203441` |
| Group 9 (R12–R14) | 1712 / 119 | 558 | 85 | 74 | `37782742231` |

Gate U counts are unit + integration (CI job counts; equal to the local `npm test` runs recorded in the Done notes). No deliberate test removal is recorded in any Done note. Gate B stayed at 85 (= `B_0`) with no touched file gaining an error and no `TS2688`. Gate P printed 0 at every commit. The exit values are re-measured at Step 32.

## 4. Golden snapshots

`GOLDEN_BASE_U3` = `53c8f7e4568dd7e996a6038a7169694c9a62dc20`. Every snapshot change has one attributed `tests/golden/CHANGES.md` line per changed case (or `all`) with the D-U3-6 canonical attribution: R2 (a, b, c, d), R4 (cr, a, b, c, d), R5 (b, c), R6 (cr, a, b, c, d), R7 (`all`), R8 (d), R9 (`all`). The change-log checker accepts every line (CLI exit 0, `--self-test` exit 1).

### Final per-case state vs estimates

| Case | Failing functions | Rows | AHS (estimate) | Verdict |
|---|---|---|---|---|
| correct-reference | C03, CV05 | 24 | .958 (.958) | pass |
| variant-a-structural | S01, S02, S04, P02, P04, C01, C03, C06, CV05 | 24 | .442 (.442) | hard-block |
| variant-b-pattern | S01, P01, P02, P03, P04, C03, C06, SO02, CV05 | 24 | .575 (.575) | soft-block |
| variant-c-everything | S01, S02, P01, P02, P03, P04, C03, C04, C06, SO01, SO02, CV05 | 24 | .391 (.392; one-thousandth rounding) | hard-block |
| variant-d-subtle | S01, S04, P02, P04, C01, C03, C06, CV05 | 24 | .558 (.558) | soft-block |

Failing sets match the binding table at every step (`u3-golden-check.mjs` exit 0 at each R). Warnings: 28 per case (27 `SPEC_002` + 1 `COMPILER_004`); the 27th `SPEC_002` follows from FF-P06 declared in library and spec (R6 deviation). `unexecutedFunctionIds` [] in all five.

## 5. BR-U3-70 pinning tests (Step 26 checklist)
(1) warning cap 50 — `warning-merge.test.ts`; (2) metric empty-result semantics — `universal-metrics.test.ts` TF-07; (3) `CYCLE_STRATEGY = 'cypher'`, SCC key and cycle rules — `scc-cycles.test.ts`, `scc-wiring.test.ts`, `scc-default.test.ts`; (4) verdict source and `ahsNeuronal` weights — `renormaliser.test.ts`, `scoring-engine.test.ts`, `r7-scoring.test.ts`; (5) id merge rule — `evidence.test.ts`, `fr12-mapping.test.ts`; (6) evidence and id encoding — `evidence.test.ts`, `violation-id.test.ts` (BR-U3-05 vector, BR-U3-06 fan-in, BR-U3-13 `unitId`); (7) normaliser paths — `tests/unit/golden/byte-stability.test.ts`; (8)–(11) hybrid accounting, identities, disabled functions, schema — `r7-scoring.test.ts`, `report-builder.test.ts` (BR-U3-15 `skippedByMode` 3, BR-U3-64 layered 9 rows), `assemble-report.test.ts` (BR-U3-02, 03, 52, 55), `report-schema.test.ts` (BR-U3-63 judge stub); plus BR-U3-12 (`metric-filters.test.ts`), BR-U3-85 and BR-U3-41 source greps.

## 6. Decisions as executed (D-U3-1..14)

| # | As executed |
|---|---|
| D-U3-1 | Entry on `origin/v1.2e` with U2 `f7ae34b` and U1 `eee25fb` merged; `U3_BASE` `c553a04` |
| D-U3-2 | Ticks and Done notes in the plan on the unit branch, one commit per step; `audit.md`/`aidlc-state.md` only in `<MAIN>` |
| D-U3-3 | Lane Neo4j `daedalus-neo4j-u3` on 7689 (pinned digest, APOC); container pre-created by the orchestrator (Step 2 deviation); credentials only via the lane env file; Gate P 0 throughout |
| D-U3-4 | `tsconfig.u3-tests.json`, appended per new test file |
| D-U3-5 | R subjects `U3-Rn: <type>(u3): …`; R1–R14 in order |
| D-U3-6 | Checker accepts `U1-K`, `U3-R`, `U4-K` labels with byte-equal canonical attributions; CI `if:` widened |
| D-U3-7 | U4-K1 absent: R1 applied every row except 15; row 1 kept optional (router literal is U4's) |
| D-U3-8 | Five unwired modules before R2 (Steps 8–12); not delivered as an early PR (not requested) |
| D-U3-9 | Scratch check scripts used at every Gate G-update; never committed |
| D-U3-10 | No router code; U4-K5 verified open (Step 27) |
| D-U3-11 | Full and neuronal-only fail closed (`REPORT_NEURAL_ROWS_UNAVAILABLE`); no provider run |
| D-U3-12 | Two group-boundary rebases (`e35ef8a`, `ecf0184`), no conflict, snapshots unchanged, `--force-with-lease` on the unit branch only |
| D-U3-13 | Merge commit at Step 33 |
| D-U3-14 | Gated container tests under `tests/golden/` with `resolveGoldenEnv`, each seeding and wiping its graph |

## 7. Residuals
- `ScoringStage` stays unwired (BR-U3-85; one assembly point is `AssembleReportCommand`).
- SCC fallback present, `CYCLE_STRATEGY = 'cypher'`; flip only on the Build and Test latency gate (H13).
- Full and neuronal-only modes fail closed until U4 wires `toNeuralResultRows`/`judgeProvenanceOf` (Step 28 skipped; H8).
- U4's C9 hunks and the U4-K5 router change land after U3 (H10, H11); BR-U3-66 cross-unit test lands with U5a (H4).
- Design records owned by the lane-2/lane-3 record owners remain open (H6, H14, H15, H16).
- TF-04 `ctor-inject-two` yields one violation, not two (U2 keeps one `CONSTRUCTOR_INJECTS` edge per pair; R6 deviation 2).

## 8. Threats to validity (`business-rules.md` §11, unchanged by code)
Correlated checks (one injection fires FF-S01, FF-S04, FF-P06); merged-row evidence; SCC fallback without length bound; warning cap 50; verdict thresholds reused across modes; metric empty-result definitions; FF-P06 data-flow under `structural`; injection rows without a line; frozen evidence/id conventions; hybrid neural suppression; dropped dimensions without rows; `no-judge-units`; row weights in full mode.

## 9. Security Baseline (enabled; `business-rules.md` §13)

| Rule | Status | Evidence in code |
|---|---|---|
| SECURITY-03 logging | Compliant | R11: warnings, failures, audit entries, batch errors and the report scrubbed (`scrubbing.test.ts` TF-17, gated grep of the five golden outputs: 0) |
| SECURITY-05 input validation | Compliant | R10 `validateReport` on write, `parseReport` on read; R12 mode guard |
| SECURITY-09 no default credentials | Compliant | R12 `requireEnv`; no `?? 'neo4j'` fallback; batch builds no provider from API keys |
| SECURITY-10 supply chain | Compliant | No new dependency (Ajv already present) |
| SECURITY-12 credentials | Compliant | Environment only; Gate P 0 at every commit |
| SECURITY-13 data integrity | Compliant | Embedded schema equals `schemas/report.schema.json`; byte-stability test |
| SECURITY-15 fail-safe | Compliant | Fail closed on schema, counts, weights, env, neural rows |
| SECURITY-01, 02, 04, 06, 07, 08, 11, 14 | N/A | No storage, network, server, IAM, endpoint or alerting introduced; SECURITY-11 is enforced on U5a |
