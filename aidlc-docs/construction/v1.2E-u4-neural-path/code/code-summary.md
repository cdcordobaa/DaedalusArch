# U4 Neural path — Code Summary

> **Unit**: U4 (C7 LLM critic, C14 Claude CLI provider, C5 router, C9 provider-selection hunks) · **Branch**: `v1.2e-u4-neural-path` · **Date**: 2026-10-08
> **Plan**: `aidlc-docs/construction/plans/v1.2E-u4-neural-path-code-generation-plan.md` (Part 2 executed; the Done notes there carry every gate value). **Design**: `aidlc-docs/construction/v1.2E-u4-neural-path/functional-design/`. **Decisions**: ADR-015, ADR-016 b, ADR-017 item 9, ADR-018 (judge config-dir allow-list, CLI pin 2.1.294).
> **Golden**: no snapshot changed and no `tests/golden/CHANGES.md` line was written (BR §13; D-U4-4).

## 1. Files

### 1.1 Created (U4-owned)

| Area | Files |
|---|---|
| C7 building blocks | `src/llm-critic/{frozen,rubric,verdict-schema,canonical-json,judge-graph,judge-unit-selector,source-context,aggregation,cassette-provider,provenance,neural-result-rows,judge-stage}.ts` |
| C14 | `src/llm-critic/claude-cli-provider.ts` |
| C9 options | `src/cli/llm-options.ts` |
| Scripts | `scripts/corpus-rubric-u4.ts`, `scripts/corpus-rubric-u4-cli.ts` (run by Build and Test, RUB-03) |
| Probe fixtures | `tests/fixtures/claude-cli/*.json` (12 scrubbed probe files plus 4 derived ISO-06 negatives) |
| Selector and graph fixtures | `tests/fixtures/judge-units/**` (golden prompt, NestJS remap, exclusion reasons, three-layer cap), `tests/fixtures/judge-graph/*.json` (recorded `QueryResult` fakes) |
| Fixture cassettes | `tests/fixtures/judge-cassettes/correct-reference/**` (42 Mock-recorded entries, D-U4-12, U5b OI-3) |
| Tests | `tests/golden/u4-neural.test.ts` (gated); 15 new unit test files under `tests/unit/llm-critic/`, `tests/unit/neuro-symbolic-router/router-modes.test.ts`, `tests/unit/cli/llm-options.test.ts`, `tests/unit/scripts/corpus-rubric-u4.test.ts`, `tests/unit/shared/types/u4-c10-patch.test.ts` |
| Config and docs | `tsconfig.u4-tests.json` (D-U4-9), `Docs/judge-preregistration.md` (draft until SEN-01) |

### 1.2 Modified

| Owner | Files | Scope |
|---|---|---|
| U4 | `src/llm-critic/{llm-critic,context-assembler,verdict-parser,cassette-manager,gemini-provider,mock-provider,null-provider,provider-factory,types,index}.ts`; `src/neuro-symbolic-router/{index,router,types}.ts`; `tests/unit/llm-critic/{llm-critic,llm-port,provider-factory}.test.ts`, `tests/unit/neuro-symbolic-router/router.test.ts` | owner |
| U0 (C10 rows, D-U4-5) | `src/shared/types/evaluation.ts` (rows 1 optional, 6, 13, 14, 15), `src/shared/interfaces/llm-provider.ts` (row 15), `src/shared/taxonomy/violation-types.ts` (row 15 comment), `src/shared/index.ts` | U4-K1 |
| U0 (comment) | `src/shared/types/llm-config.ts:19-20` (`VCRMode` comment) | Step 12 deviation |
| U0 (one line) | `.gitignore` (`.firewall/`) | Step 18 |
| U1 (rubric hand-off) | `presets/{clean-architecture,nestjs,layered}.yaml`, `specs/{clean-arch,daedalus-arch}.yaml`, `src/spec-parser/template-registry.ts`; tests `tests/unit/spec-parser/k14-integrity-dimension.test.ts`, `tests/unit/scripts/migrate-corpus-spec.test.ts` | U4-K6 only |
| U5a (attributed) | `scripts/generator/prompts/full-aac.md`, `Docs/generator-protocol.md` §5 DRAFT hash rows | U4-K6 only (BR-U5a-52) |
| U3 (C9 hunks) | `src/cli/cli.ts`, `src/pipeline/pipeline-factory.ts`, `src/pipeline/commands/{route-evaluate,neuronal-evaluate}-command.ts`; U0 test `tests/unit/cli/cli-llm-config.test.ts` | cross-unit commit `73420f4` + review follow-up `e4feed7` |

**Hand-off branch**: none. U3 merged (PR #5) before Group 6, so the C9 hunks were applied directly on the unit branch (D-U4-7 as amended by the orchestrator); `v1.2e-u4-c9-hunks` was never created.

## 2. Commits (first parent, unit branch)

| Step | Commit | Subject (short) |
|---|---|---|
| 7–9 | `b683d26`, `4a1834e`, `48c5445` | worktree, lane Neo4j, baselines |
| 10 | `350597e` | probe fixtures and canary result |
| 11 | `4806c19` | **U4-K1** U4 rows of the bundled C10 patch |
| 12 | `3011d42` | **U4-K2** C7 uses C10 `VCRMode`, bypass removed |
| 13–18 | `c8d0569`, `2b4b92e`, `bd2a812`, `063b478`, `44ae0f5`, `018fb53` | frozen values; verdict parsing; selector; source context; aggregation; cassette decorator |
| 19 | `4d10087` | Claude CLI provider, isolation, version pin |
| 20 | `034724e` | **U4-K3** factory, pinned ids, LLM options |
| 21 | `f602422` | **U4-K4** critic wiring |
| 22 | `810efdf` | **U4-K5** router mode filter, BR-U3-53, failures forwarded |
| 23 | `cfcf404` | **U4-K7** `judgeProvenanceOf` |
| 24 | `232f57f` | neural result rows, baseline reader |
| 25 | `73420f4`, `e4feed7` | C9 hunks (cross-unit); review follow-up (CAS-07, CAS-10, ISO-05) |
| 26 | `3049e78` | **U4-K6** rubric text and names |
| 27 | `55501c4` | corpus rubric script |
| 28 | `b21a82e` | gated acceptance and Mock fixture cassettes |
| 29 | `acbfc2a` | live smoke record (docs only) |
| 30 | `a1b783d` | probe values, amendments, hand-offs |
| Gate G-CI records | `cc36b9a`, `1b49e26`, `bb64e8c`, `852846c`, `1209bea` | docs |
| D-U4-13 merges | `ce3f3d8`, `704fbcb` (+ Step 32 merge) | `origin/v1.2e` into the unit branch |

## 3. Baselines and counts

| Value | Step 9 (`U4_BASE` `ecf0184`) | Re-recorded (D-U4-13, `U4_BASE` `83b5c81`) | Final (Step 31 head) |
|---|---|---|---|
| Tests (`npm test`) | `U_BASE` 1280 / 94 suites | 2155 / 152 suites | **2610 / 171 suites**, green |
| Lint errors | `L0_U4` 581 | 558 | **497** |
| Test type errors (Gate B) | `B0_U4` 85 | 85 | **80**, 0 `TS2688` |
| Golden executed | `N_G_U4` 38 / 4 suites | 74 / 6 suites | **80 / 7 suites** (74 + `N_U4` 6), 0 skipped |
| Snapshots | 5 hashes recorded | 5 hashes = `git show 83b5c81:<file>` | unchanged |

The Step 32 exit run re-measures these on the final head after the last D-U4-13 merge (docs-only on `origin/v1.2e`).

## 4. Gate H evidence (Group 1, 2026-10-08)

PASS on H1–H5 (plan Step 6 Done note; fixtures in `tests/fixtures/claude-cli/`): H1 `envelope-schema-tools-off.json` (exit 0, `is_error` false); H2 `init-clean.json` (`apiKeySource` `none`, `mcp_servers` `[]`, `tools` `["StructuredOutput"]`); H3 all ISO-02 flags accepted; H4 `canary-result.json` (negatives empty, ancestor positive control fired); H5 `structured_output` present. ISO-04 conflict (plugin marketplace auto-installed into the judge dir) settled by ADR-018. Live calls: Group 1 probe and the Step 29 smoke (three calls) only.

## 5. Decisions as executed

| # | As executed |
|---|---|
| D-U4-1 | Probe first; Gate H pass; no H-halt |
| D-U4-2 | Probe area `~/.firewall/u4-probe/`; raw deleted at Step 10; scrubbed set committed |
| D-U4-3 | Lane `daedalus-neo4j-u4` on 7690; credentials only via the mode-600 lane file |
| D-U4-4 | Seven `U4-Kn` labels (K1–K7); no `CHANGES.md` line, no snapshot change |
| D-U4-5 | "Absent" branch at Step 11: rows 1 (optional), 6, 13, 14, 15 only; U3-R1 (`730c4c8`) later landed its rows; row 1 stays optional on `v1.2e` |
| D-U4-6 | `computeViolationId` imported from U3-R2 (merged with U3, PR #5); no local hasher |
| D-U4-7 | Amended: no hand-off branch; one attributed cross-unit commit on the unit branch |
| D-U4-8 | Report field `neuralResults[]` (BR-U3-65); no sidecar |
| D-U4-9 | `tsconfig.u4-tests.json`; no `package.json` change |
| D-U4-10 | Corpus script as pure module plus CLI entry with `--self-test` |
| D-U4-11 | No new dependency |
| D-U4-12 | Mock-recorded fixture cassettes for `correct-reference` committed; one live smoke (3 calls), not committed or quoted |
| D-U4-13 | Merge (not rebase) of `origin/v1.2e`, baselines re-recorded; pushed history never rewritten |
| D-U4-14 | Gate T local only; residual below |

## 6. Deviations (detail in the plan's Done notes)

1. ISO-04 resolution via ADR-018 (allow-list additions incl. bare `projects`, `settings.json` key-name rule, forbidden names checked per path segment); `DISABLE_AUTOUPDATER` in `JUDGE_ENV_ALLOW`; the author-install switch not applied (AUTHOR ACTION).
2. Canary H4 run in the instructed variant (real HOME); user `CLAUDE.md` and `UserPromptSubmit` channels not positively controlled.
3. `INTENT_VIOLATION` comment keeps U1's `deprecated (FR-22, BR-U1-23)` prefix (U1 test pins it).
4. `llm-config.ts` comment hunk (U0-owned) at Step 12.
5. U0 `ClaudeCliConfig` not extended; `ClaudeCliProviderConfig` owned by C14.
6. Judge wrapping in `createJudgeProvider` / the evaluation command at execute time (`prepareJudgeStage`), not in `createLLMProvider` / `pipeline-factory.ts`.
7. Graph reader uses U2 names (`filePath`, `DECLARES`), not the plan's draft Cypher.
8. Full mode evaluates symbolic halves in one call and neural instructions in one critic call (one pool, one manifest); hybrid-only symbolic-only/neuronal-only runs give `NO_FUNCTIONS_TO_EVALUATE`.
9. C9 hunks without a hand-off branch; `tests/unit/cli/cli-llm-config.test.ts` rewritten; U1 tests, U5a prompt and DRAFT protocol hash rows updated with K6.
10. Row schema follows U3's frozen definition (`singleFileModules`, `origin` optional).
11. Various signature extensions (`filterMembers`, `selectUnits`, `formUnitViolations`, `judge()`, `judgeProvenanceOf`, `parseLLMOptions`) beyond the plan's sketches; exported names unchanged.
12. Step 29 Done note committed with the Group 8 Gate G-CI record.
13. Gate U runs with `NEO4J_URI` unset (U3 test `cli.test.ts` "defaults neo4j-uri" reads the exported lane URI); environmental.

## 7. Residuals and open items

| Item | Owner |
|---|---|
| Full-mode golden lane L0 (after U3 R7), incl. CAS-11's "re-record: <n> missing keys" lane message test and live-judge fixture cassettes | Build and Test |
| SEN-01 (unit-level criterion) and the rubric freeze; `FROZEN_SHA256` updated at the freeze; `Docs/judge-preregistration.md` leaves draft | Build and Test |
| Unverified probe values: USAGE_LIMIT patterns, calls per usage window; canary channels with a logged-in throwaway config dir; author-install `DISABLE_AUTOUPDATER` | Build and Test (AUTHOR ACTION) |
| OI-U4-8 consumer side: U5b `acceptReport` reasons `seeded-list-nonempty`, `missing-baseline-selection`, `judge.model` check | U5b |
| C10 rows left to U3-R1: row 1 required form (`failures` still optional; stale comment in `evaluation.ts`) | U3 / record owner |
| U4 test type-check is local only (D-U4-14): CI does not run `tsc -p tsconfig.u4-tests.json` | declared |
| Mock record provenance `model` (`mock-model` in record, requested model in replay; Step 28 deviation 3) | Build and Test |
| ADR prose not wired into the critic (`adrProse` accepted, section absent) | Build and Test |
| `tests/fixtures/u5a/layered/firewall.spec.yaml` still carries the old FF-N01/FF-N02 names | U5a / RUB-03 corpus step |
| U1 assertion pinning the `INTENT_VIOLATION` prefix | lane-2 record owner |

## 8. Threats to validity for Ch. 7 (BR §11)

- **Judge model**: self-preference on Claude-generated E1 projects (AD-6), mitigated only by the Phase 5 Gemini cross-check; a substituted model invalidates the call (VRD-07).
- **Effort**: affects verdicts; changed only by ladder step 3 with a full re-record.
- **`JUDGE_MAX_TOKENS`**: ignored by the CLI; truncated Gemini answers become `PARSE_FAILURE`.
- **Isolation and CLI version**: CLI behaviour can change between versions; checked per run and by the canary; cassettes from two versions are reported as mixed provenance. Two canary channels are not positively controlled (residual).
- **Persona and verdict schema**: wording effects on verdicts; fixed and hashed (`FROZEN_SHA256`).
- **Verdict path rules**: dropped paths become false negatives; counted per function.
- **Runs per evaluation (3)**: majority over few samples; within-run agreement reported.
- **Unit validity**: invalid units shrink the judged set; counted by cause.
- **Aggregation threshold** (> 1/2 of valid units): any-fail and share variants recomputed offline from `neuralResults[].unitResults`.
- **Instability and confidence**: instability depends on run count; LLM self-reported confidence is not calibrated.
- **Selection** (`unitCap` 20, seed, coverage): detection bounded by coverage on capped projects; reported overall and conditional on selection. Candidate filter is heuristic; one-file modules are judged without cross-file evidence.
- **Token budgets and excerpt**: truncation hides evidence; a seed that changes a neighbour re-judges the unit.
- **Rubric**: wording defines the construct; frozen only after SEN-01; MO-X02/MO-X03 run on `correct-reference`, the same dev-split base SEN-01 uses, so probe detection is reported as dev-split only.
- **E1 evaluator spec**: the `full-aac` generator saw text matching the evaluator spec.
- **Timeouts**: long module prompts can time out and become invalid runs; counted.
- **Cassette reuse**: unchanged units are judged once per experiment; judge noise on them is removed from differential scores.
- **Degradation ladder**: any applied step is reported with its trigger.
