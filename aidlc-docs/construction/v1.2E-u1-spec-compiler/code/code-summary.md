# U1 Spec and Compiler — Code Summary

> **Cycle**: v1.2 Evaluation-Readiness (lane 2) · **Unit**: U1 — Spec and compiler (C3 spec parser, C4 fitness compiler and templates, C9 `validate` action) · **Date**: 2026-10-08
> **Branch**: `v1.2e-u1-spec-compiler` (worktree `DaedalusArch-wt-u1`, created off `origin/v1.2e` at `b692139`; rebased in Step 11 onto `cea1e7c`, which carries the U2 merge `f7ae34b`). Merges into `v1.2e` with a **merge commit** (D-U1-5).
> **Plan**: `aidlc-docs/construction/plans/v1.2E-u1-spec-compiler-code-generation-plan.md`. Each step has a "Done" note with its gate counts and deviations. Done notes written before the Step 11 rebase name pre-rebase SHAs. The table below gives the SHAs on the branch now.
> **Binding design**: `aidlc-docs/construction/v1.2E-u1-spec-compiler/functional-design/` (`business-logic-model.md`, `business-rules.md` BR-U1-01..46, `domain-entities.md`), ADR-015, ADR-016, `v1.2E-lane2-functional-design-clarifications.md`.

## Outcome

Every declared check now runs against the parameters its spec declares. Layers bind by kind, including `controllerLayer`. Templates apply only to the architectural styles they belong to. Every template is ordered and bounded, and the construct defects named under ADR-015 item 1 and ADR-016 a are corrected. The snapshots changed **by design** in exactly seven K commits (K2, K3, K4, K5, K6, K12, K13). Each change is attributed in `tests/golden/CHANGES.md` with its canonical attribution. The final per-function pass/fail equals the binding table (`business-logic-model.md` §8.2).

| Measure | Baseline (Step 3, `b692139`) | Re-baseline (Step 11, after U2) | U1 exit (Step 30 head `afe131b`) |
|---|---|---|---|
| `npm test` (Gate U) | 592 tests, 55 suites | `U_1` 967 tests, 75 suites | 1277 tests, 94 suites, 0 failures (+310 on `U_1`; 6 removed at K8) |
| Gate T (`typecheck`, `typecheck:u0-tests`, `tsc -p tsconfig.u1-tests.json`) | clean | clean | clean |
| Gate L (lint errors) | L0 624 / 4 warnings | L1 621 / 3 warnings | 575 (−46 vs L1); no touched file gained an error; every U1-created file 0 |
| Gate B (test type errors, scratch config) | 85, 0 `TS2688` | 85 | 85, per-file unchanged |
| Golden suite strict (`N_G`, 0 skipped) | 8 (2 suites) | 17 (3 suites) | 38 (4 suites) |

The Step 33 exit run re-measures these values on a clean `npm ci`. Its Done note in the plan records the result.

## Commits (one per step; SHAs on the branch after the Step 11 rebase)

| Step | K | Commit | Subject (short) | Snapshots |
|---|---|---|---|---|
| 1 | | `dd753a8` | worktree and unit branch | — |
| 2 | | `d3e95c7` | lane Neo4j smoke on 7688, lane env file | — |
| 3 | | `74aa9cc` | baselines and scratch binding tooling | — |
| 4 | | `abed00a` | `tsconfig.u1-tests.json` | — |
| (a) CI | | `b49060c` | group (a) Gate G-CI record | — |
| 5 | | `fefa83a` | `compilerInputFromSpec` | — |
| 6 | | `31514a0` | change-log checker, frozen-threshold pin | — |
| 7 | | `6e25e0d` | `Golden change log` CI step | — |
| (b) CI | | `2e7c6ab` | group (b) Gate G-CI record | — |
| 8 | | `21335fd` | C3 pure modules (unwired) | — |
| 9 | | `3477fe6` | C4 pure helpers (unwired) | — |
| 10 | K1 | `d68cc83` | layer kinds bound by kind | none |
| 10A | | `7541ec3` | corpus-spec migration script | — |
| (c) CI | | `b548bde` | group (c) Gate G-CI record | — |
| 11 | | `a0aa6e4` | rebase onto `v1.2e` with U2, re-baseline | — |
| 11 CI | | `726deff` | Step 11 Gate G-CI record | — |
| 12 | K2 | `4504947` | typed FR-07 fields, BR-SPEC-10 | **changed** |
| 13 | K3 | `983c4c9` | FF-CV02 `*Service\|*UseCase` | **changed** |
| 14 | K4 | `ce1e02b` | style applicability; FF-S03 layered only | **changed** |
| 15 | K5 | `ff54a93` | `repository-pattern` reports only violations | **changed** |
| (e) CI | | `0e0748d` | group (e) Gate G-CI record | — |
| 16 | K6 | `632626e` | bounded canonical cycle query, sentinel | **changed** |
| 17 | K7 | `0fe0f40` | total `ORDER BY`, sorted `collect` | none |
| 18 | K8 | `773ed2c` | exclude anchors replace the splice | none |
| 19 | K9 | `d70f4b5` | `$applicationLayers`, restricted maps | none |
| 20 | K10 | `40f7fee` | FR-12 RETURN columns | none |
| 21 | K11 | `4d58544` | template tags | none |
| 22 | K12 | `08790d1` | dependency rules follow RE_EXPORTS | **changed** |
| 23 | K13 | `53c8f7e` | orphan template typed `:File` | **changed** |
| (g) CI | | `a967c0e` | group (g) Gate G-CI record | — |
| 24 | K14 | `28a6c42` | `integrity` dimension, `intent` aliases | none |
| 25 | | `2bab8fa` | FR-33 `judge_unit` | — |
| 26 | K15 | `88f00fe` | `layered` library and preset | none |
| 27 | K16 | `cee4e0e` | `controllerLayer` binding | none |
| 28 | | `9f50ac1` | C9 `validate` parity | — |
| 29 | | `f76b860` | determinism, denominator, disabled-reason tests | — |
| 30 | | `afe131b` | migrated corpus spec parses without `SPEC_004` | — |
| 31 | | `c6e7545` | amendments and hand-offs recorded | — |
| 32 | | this commit | code summary and plan progress | — |
| 33 | | exit record | exit verification, PR | — |

`git log --format=%s f5fed3f..HEAD -- tests/golden/__snapshots__` lists exactly K2, K3, K4, K5, K6, K12, K13. No other commit touches the snapshots, and `git diff --name-only f5fed3f..HEAD -- results/` is empty (BR-U1-42).

## Files

**Created (owner U1)**: `src/spec-parser/{function-fields,dimension-alias,layer-kind-resolver}.ts`; `src/fitness-compiler/{compiler-input,layer-binding,template-applicability,bound-param-checker,pattern-compiler}.ts`; `presets/layered.yaml`; `scripts/migrate-corpus-spec.ts`, `scripts/migrate-corpus-spec-cli.ts`; `tests/golden/check-changes-log.ts`, `tests/golden/check-changes-log-cli.ts`, `tests/golden/u1-templates.test.ts` (gated, 21 container tests); `tsconfig.u1-tests.json`; 32 new unit test files under `tests/unit/{fitness-compiler,spec-parser,golden,scripts,cli}/`.

**Modified (owner U1)**: `src/spec-parser/{spec-schema,spec-parser,layer-parsers,spec-validator,template-registry,types}.ts`; `src/fitness-compiler/{fitness-compiler,cypher-templates,exclude-injector,index}.ts` (`glob-to-regex.ts` untouched); `src/pipeline/commands/compile-command.ts`; `presets/{clean-architecture,nestjs}.yaml`; `specs/{clean-arch,daedalus-arch}.yaml`; `tests/golden/__snapshots__/*` (K commits only), `tests/golden/CHANGES.md`, `tests/golden/normalise.ts` (cycle-cap predicate only); existing tests under `tests/unit/spec-parser/**`, `tests/unit/fitness-compiler/**`, `tests/unit/golden/normalise.test.ts`; `tests/integration/spec-parser/full-pipeline.test.ts` (one assertion, K9).

**Removed**: `tests/unit/fitness-compiler/exclude-injector.test.ts` (6 tests, K8: they tested the removed `injectExcludePaths`/`detectNodeAlias` splice; names in the Step 18 Done note).

**Shared-file hunks**: `src/cli/cli.ts`, the `validate` action only (Step 28). `.github/workflows/ci.yml`: `fetch-depth: 0` and the PR-only `Golden change log` step (Step 7).

**U0-owned files, patch only**: `src/fitness-compiler/types.ts` (`requiredLayerKinds` required at K1, `tag` required at K11, `LayerKindBinding.controllerLayer?` at K16 under ADR-016 a); `src/shared/taxonomy/violation-types.ts` (deprecation comment on `INTENT_VIOLATION`, K14). `src/shared/types/enums.ts` is **not** touched (D-U0-1 row 1 now U3).

**U2-owned tests changed (cross-unit, flagged)**: `tests/unit/neo4j-ingestion/neo4j-repository.test.ts` and `tests/unit/golden/golden-env.test.ts` (K2). They read fixture strings from the snapshots that K2 changes by design. The seven `GOLDEN_BASE` `EVAL_001` texts are now pinned inline and the containment checks use a key every snapshot keeps. The rules (BR-U2-42, BR-U2-43) are unchanged, and one test was added.

**Docs (Step 31)**: requirements FR-19/FR-20/FR-29; `v1.2E-unit-of-work.md` (U1 row, hand-offs to U3/U4/Build and Test); `v1.2E-unit-of-work-requirement-map.md` (FR-35 row); `v1.2E-component-methods.md`; U0 plan patch table; U1 FD plan boxes.

## Recorded values

### Gate history

| After | Gate U | Gate L | `N_G` |
|---|---|---|---|
| Step 3 (baseline) | 592 / 55 | 624 (L0) | 8 |
| Step 10 (K1) | 735 / 66 | 621 | 8 |
| Step 10A | 751 / 67 | 621 | 8 |
| Step 11 (rebase, U2 in) | 967 / 75 (`U_1`) | 621 (L1) | 17 |
| K2 | 1006 / 77 | 609 | 19 |
| K3 / K4 / K5 | 1010 / 1041 / 1044 | 609 | 19 |
| K6 | 1050 / 81 | 605 | 25 |
| K7 | 1077 / 82 | 605 | 27 |
| K8 | 1100 / 82 (−6 removed) | 601 | 29 |
| K9 | 1136 / 83 | 578 | 29 |
| K10 / K11 | 1149 / 1177 | 578 | 31 |
| K12 / K13 | 1187 / 1189 | 578 | 33 / 35 |
| K14 / Step 25 | 1210 / 1215 | 575 | 35 |
| K15 / K16 | 1225 / 1236 | 575 | 37 / 38 |
| Steps 28 / 29 / 30 | 1245 / 1274 / 1277 (94 suites) | 575 | 38 |

Gate B stayed 85 with a per-file list identical to the baseline at every step. Gate U runs with `NEO4J_*` unset (`tests/unit/cli/cli.test.ts` reads the environment); the lane preamble is used for Gate G only.

### Golden protocol

- `GOLDEN_BASE` = `f5fed3fbf1ba5ad84196b88dc80d474736534941`. Lane Neo4j `bolt://localhost:7688` (container `daedalus-neo4j-u1`, 5.26.24, APOC 5.26.24, CI-pinned image digest).
- Gate G-CI runs (all success, golden step green, 0 skipped): 37722511017 (group a, 8 tests), 37723949376 (group b, 8), 37726267376 (group c, 8), 37746281678 (Step 11, 17), 37748784296 (group e, 19), 37752716911 (group g, 35); later pushes 37755100372 (K16) and 37756323467 (Step 30) also green. `Golden change log` is skipped on push events by design; it runs on the U1 PR (Step 33).
- `check-changes-log-cli.ts` exited 0 after every K commit, and `--self-test` exited 1.

### Snapshot-changing commits and their `CHANGES.md` lines (summarised; full text in `tests/golden/CHANGES.md`)

| K | Cases changed | Change | Lines |
|---|---|---|---|
| K2 | all five | `unexecutedFunctionIds` 7 → 0, 7 `EVAL_001` removed, rows 17 → 24; + FF-CV02 (cr 2, a 1, b 2, c 1, d 1), + FF-SO01 c (`GodTask`), + FF-SO02 b, c (`ITaskRepository`); cr warning → **pass** | 5 change + 4 observation (FF-P01 vacuous; FF-SO02/CV01/CV04 sensitivity; `default_exclude_paths`; cr flip partly via FF-P01) + self |
| K3 | all five | FF-CV02 passes (`*Service\|*UseCase`) | 5 + self |
| K4 | all five | FF-S03 row and violations leave (cr 2, a 4, b 3, c 2, d 4); rows 24 → 23 | 5 + self |
| K5 | cr, a, d | FF-P03 1 → 0, passes; d hard-block → **soft-block** (0.505) | 3 + 1 observation (d at 0.505) + self |
| K6 | a, c | FF-S02 duplicate rotations removed (a 4 → 2, c 2 → 1) | 2 + 1 observation (cycles > 10; sentinel) + self |
| K12 | d | FF-S01 2 → 3 (`TaskUtils.ts … re-exports from … InfraFormatters.ts`) | 1 + self |
| K13 | d | FF-C04 1 → 0, passes; AHS 0.505 → 0.538 | 1 + self |

Non-snapshot `CHANGES.md` lines: `U1-K1 self`, `U1-K8 self`, `U1-K14 observation all` (full-mode window, Q11) and `U1-K14 self`, `U1-K16 observation all` (`controllerLayer`, no fixture has a presentation layer).

### Final per-case state vs the §8.2 estimates

| Case | Failing set (final, binding) | AHS final | §8.2 estimate | Verdict |
|---|---|---|---|---|
| correct-reference | C03, CV05 | 0.958 | .958 | pass |
| variant-a-structural | S01, S02, S04, P02, P04, C01, C03, C06, CV05 | 0.422 | .422 | hard-block |
| variant-b-pattern | S01, P02, P03, P04, C03, C06, SO02, CV05 | 0.595 | .595 | soft-block |
| variant-c-everything | S01, S02, P02, P03, P04, C03, C04, C06, SO01, SO02, CV05 | 0.412 | .412 | hard-block |
| variant-d-subtle | S01, S04, P02, P04, C01, C03, C06, CV05 | 0.538 | .538 | soft-block |

23 `functionResults` rows and `unexecutedFunctionIds` = [] in every case. `u1-golden-check.mjs K16` exits 0. Every intermediate K row matched its estimate to 3 dp. These are **interim** values. They are never quoted as results; FR-18 in Build and Test is the only reported baseline (BR-U1-42).

### Compiled denominators (declared / compiled / disabled / ADR / dropped)

clean-architecture 26/25/1/0/0, nestjs 26/25/1/0/0, `specs/clean-arch.yaml` 26/25/1/0/0, `specs/daedalus-arch.yaml` 25/25/0/0/0, `presets/layered.yaml` 26/17/9/0/0 (7 by style: FF-S04, FF-P02, FF-P03, FF-P04, FF-P05, FF-C01, FF-CV04; 2 by kind: FF-CV01, FF-CV02). Probe: 0 unbound parameters on the four shipped specs (Step 12 test).

## Decisions as executed (D-U1-1..15)

| # | As executed |
|---|---|
| D-U1-1 | Steps 1–10A (setup, unwired modules, K1, migration YAML part) before U2; K2–K16 after the Step 11 rebase. |
| D-U1-2 | Steps 8, 9, 10A landed unwired with tests; Gate G strict green on each; K commits held only wiring, template/YAML and snapshot changes. |
| D-U1-3 | `tsconfig.u1-tests.json` lists every new U1 test file plus both script files; no `package.json` change. |
| D-U1-4 | `tests/golden/u1-templates.test.ts` gated by `resolveGoldenEnv`, seeds and wipes per `describe`; 21 tests at exit. |
| D-U1-5 | CI step `Golden change log` with the PR-only `if:` and `fetch-depth: 0` (Step 7); merge commit requested in the PR (Step 33). |
| D-U1-6 | All K subjects `U1-Kn: <type>(u1): …`; every message ends with the Co-Authored-By line. |
| D-U1-7 | Grammar enforced by the checker, plus a stricter canonical-attribution equality (Step 6 deviation 2). |
| D-U1-8 | Normaliser predicate `violationCount > CYCLE_ROW_CAP`, `count: CYCLE_ROW_CAP` (K6). |
| D-U1-9 | Rebase in Step 11 without conflicts (14 commits replayed); unit branch pushed with `--force-with-lease`; `v1.2e` never force-pushed. |
| D-U1-10 | Lane file `$HOME/.daedalus-u1.env` (mode 600); password never printed or committed. |
| D-U1-11 | `u1-golden-check.mjs` (also checks `unexecutedFunctionIds`, stricter) and `u1-snapshot-diff.mjs` used at every K step. |
| D-U1-12 | FR-33 `judge_unit` as its own commit (Step 25). |
| D-U1-13 | `default_exclude_paths` left unknown (`SPEC_001`); K2 observation line; not carried into `presets/layered.yaml`. |
| D-U1-14 | Plan ticks, Done notes and Step 31 doc edits on the unit branch; freeze held through Step 11 (plan unchanged on `v1.2e`). |
| D-U1-15 | Pure module + export-free CLI entry for both scripts; entry uses `void main(...).then(...)` instead of top-level `await` (CommonJS typecheck, TS1378); `--self-test` exits 1. |

## Deviations from the plan (details in each step's Done note)

- Gate G-CI results were recorded in bookkeeping commits after each pushed group (a, b, c, Step 11, e, g). A CI result cannot exist before the commit it tests.
- Step 1: the worktree and branch already existed (created by the orchestrator), so `git worktree add` and `git push -u` were not re-run.
- Step 2: the password containment check used a `node -e` scan of `process.env` instead of `grep -Ff <(printf …)` (the secret-dump hook blocks `printf`). Same semantics.
- Step 3: the Gate B config is `$SCRATCH/tsconfig.tests-audit.u1.json`, because the scratchpad is shared with U2.
- Step 5: `compile-command.ts` imports the builder from `compiler-input.js`, not `index.js`, so an existing mock stays valid.
- Step 6: the change-log checker is stricter (label detection, canonical attribution equality); the CLI does not use top-level `await`; `main` is non-async.
- K1: `parseLayerA` takes a warnings out-parameter (keeps `preset-loader.ts` untouched); one `COMPILER_004` text for every disablement; C5 only for non-neuronal functions.
- K2: `checkBoundParameters` returns `DomainResult<undefined>`; `bound-param-checker.ts` and `fitness-compiler.ts` import each other (call-time only); two U2-owned tests adapted (see Files).
- K3: a 4-case pin test added (the plan listed none).
- K7: three dependency templates ordered by `source, target` until K10 added `relType` (closed at K10).
- Step 28: the FF-P01 negative spec is an inline test spec, not a committed fixture.
- Step 30: the (c) check uses a full nestjs-style fixture derived from `presets/nestjs.yaml`, because the Step 10A fragment cannot pass `parseSpec`.
- Step 31: the FR-35 de-duplication re-allocation is also recorded in the requirement map and the U1 row.

No deviation contradicts the functional design or ADR-015/016. No escalation was raised.

## Hand-offs (Step 31; `v1.2E-unit-of-work.md`)

- **U3**: cycle sentinel (101 rows) and the literal bound 10 for the universal metric; FR-12 mapping of `target`/`line`/`relType`/`isTypeOnly`; scorer `integrity` (FR-32 acceptance with a no-violation `integrity` result); metric-template filters (Q23); universal orphan metric per ADR-016 g (no layer filter); `INTENT_VIOLATION` and the `Dimension` member `intent` (D-U0-1 row 1); executed counts (BR-U1-19); routing of `COMPILER_004` warnings (ADR-016 c); 30 s latency gate also for the universal cycle metric (ADR-016 e); golden change-log protocol for U3's snapshot changes (generalise the grammar to `U<n>-K<m>` and widen the `if:`, or add its own check).
- **U4**: rubric text and renames in the five YAMLs declaring FF-N01/FF-N02; consumption of `judgeUnit`.
- **Build and Test**: sensitivity check (BR-U1-39, ADR-016 b); latency table and SCC fallback decision (BR-U1-31); corpus preparation commits (BR-U1-25 a).

## Residuals (recorded, not fixed)

- FF-P01 passes vacuously until U3's FR-11 rewrite matches Package nodes (K2 observation).
- FF-CV01 (`'.*'` defaults) and FF-CV04 (`c.decorators` never ingested) cannot fire until the Build and Test sensitivity check fixes or excludes them (ADR-016 b). The per-YAML BR-U1-39 assertion is vacuous until then; an inline case keeps it live.
- Full mode and neuronal-only runs are unsupported and unreported between the U1 and U3 merges (BR-U1-24, K14 observation).
- D-U0-13's ingestion-order constraint is lifted from K7 on, because every template now has a total `ORDER BY`.
- `preset-loader.ts` (not U1-owned) drops `SPEC_005` and Layer C warnings. No shipped preset triggers either.
- `resultAvailableAfter` for the cycle query is read through a direct driver session, because `Neo4jRepository.executeQuery` does not expose the summary (relevant to the Build and Test latency table).

## Threats to validity (for Ch. 7; `business-rules.md` §8)

1. Cycles longer than 10 files are not detected (BR-U1-28); measured on the corpus in Build and Test.
2. Tag classification is the author's, under a definition frozen before results (§4.1).
3. The frozen `pattern` grammar: the correct-reference verdict is sensitive to its reading around the 0.80 cut-off (0.794 / 0.802 / 0.807 at K2). Its final value (0.958) rests on K3, K4 and K5. variant-d crosses the 0.50 soft-block cut-off at K5 (0.505; 0.538 after K13).
4. The `layered` applicability table is the author's (§3.1), frozen with citations.
5. Self-spec deviations from preset defaults (BR-U1-16): `core-modules` `kind: infrastructure`, FF-C03 `threshold: 0.8`.
6. FF-S03 is disabled for clean-architecture and nestjs (Q22 B; BR-U1-43), so no corpus result contains FF-S03. This is a construct correction, not a tuning.
7. FF-CV02's pattern was corrected after the fixtures were seen (BR-U1-01), dated before the first corpus run, and applied to corpus specs by a separate scripted step (BR-U1-25).
8. `repository-pattern` was corrected after the fixtures were seen (BR-U1-45); it matches the fixture manifests and is dated before the first corpus run.
9. Vacuous or cannot-fire checks (FF-P01 until U3; FF-CV01, FF-CV04 until the sensitivity check). FF-SO02 fires through U2's `CONTAINS` edges (ADR-016 f).
10. The full-mode window (BR-U1-24).
11. The tag reading notes R1–R3 (BR-U1-27) are the author's extension of the ADR-015 item 9 definitions.
12. NestJS controller checks bind `controllerLayer` (BR-U1-46), a construct correction under ADR-015 item 1, dated before the first corpus run.

## Security Baseline compliance (`business-rules.md` §9)

SECURITY-05 compliant: every spec value reaches Neo4j as a parameter, `pattern` passes the allowlist grammar before regex compilation, exclude anchors carry no user text, and the interpolated literals (`10`, `101`) are compile-time constants. SECURITY-15 compliant: BR-SPEC-10, schema errors, the pattern grammar and missing exclude anchors fail closed; disabled functions are reported with reasons. All other rules are N/A, as listed in §9. No new dependency was added. The lane password stayed out of every tracked file, command line and output (D-U1-10).
