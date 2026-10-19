# U2 code summary: declared post-seal norm rules (D5, N3)

**Design:** `aidlc-docs/construction/v1.4/U2/functional-design/design.md`. **Plan:** `aidlc-docs/construction/v1.4/U2/plan.md` (every step ticked). **ADRs:** `Docs/v1.4/adr-v14.md` (ADR-V14-01 for D5, ADR-V14-02 for N3). **Tier record:** `Docs/v1.4/rule-tiers-post-seal.md`.

## What was built

- **One table for the post-seal rules.** `src/fitness-compiler/post-seal-rules.ts` holds `POST_SEAL_RULES` with two entries:
  - FF-S02 `no-cyclic-deps`, ddd only (D5, ADR-V14-01);
  - FF-P07 `application-purity`, for clean-architecture, hexagonal, nestjs and ddd (N3, ADR-V14-02), with the HTTP delivery-mechanism list.

  The same file holds the new `application-purity` template (`POST_SEAL_TEMPLATES`), the overlay (`postSealOverlay`, `applyPostSealRules`) and `withPostSealRules` for a parsed spec.
- **Compiler.** `CompileOptions.postSealRules` is on in `V13_COMPILE_OPTIONS` and off in the new `V13_SEALED_COMPILE_OPTIONS`, which equals the pre-U2 value. The overlay runs before the construct overlays. The post-seal template joins the catalogue and the BR-SPEC-10 check only when the option is on. `buildParams` binds `compositionRootLayers`, `compositionRootPatterns` and `testPatterns` only for a template that declares them. `checkBoundParameters` takes a catalogue.
- **Mode gate.**
  - `PipelineConfig.postSealRules` defaults to `scoringMode === 'v1.3'` (`postSealRulesOf`).
  - `CompileCommand` takes the flag, applies the overlay to the declared side too (identity I1), and records `postSealRules` and `postSealAdded` in its compile facts.
  - The CLI has `--post-seal on|off` on `evaluate` and `validate`.
  - `tiers.tierTable` names both tier records when the rules are on.
- **Tiers.** `POST_SEAL_RULE_TIERS` (FF-P07 blocking in the four styles, ADR-V14-02). `ruleTier` falls back to it and reports source `post-seal`. FF-S02 in ddd keeps the sealed row, with source `table`. The `tierSource` enum gains `post-seal` in the types and in the report schema (`schemas/report.schema.json` and the embedded copy, with an amendment note).
- **Downstream.**
  - The `post-seal` extension catalogue and the `getExtensionTemplate` fallback.
  - The edge view: `POST_SEAL_EDGE_VIEWS`, resolved.
  - MCP: the construct and source rows; the spec loader applies the overlay; the fast-path note and the `notChecked` reason for FF-P07.
  - The correctness checker `application-purity` and the new `BLOCKING_COVERAGE` rows.
  - The gated reference scope: `loadReference(…, { postSeal })`, default off, plus `postSealScopeOf`, wired into `ue-score.ts`.
  - Two files added to the freeze-check `MANIFEST_FILES`.
- **Registered figures pinned (BR-U2-10).** The six `scripts/v1.3` importers that regenerate figures now use `V13_SEALED_COMPILE_OPTIONS`. The nine `scripts/v1.3` scripts that build the pipeline themselves pass `postSealRules: false`. The SDD demo replay loads specs with `createSpecLoader({ postSeal: false })`. The caller table is in ADR-V14-02 ("Callers") and is repeated below.
- **Delta script.** `scripts/v1.4/u2-fixture-delta.ts` runs 83 committed fixture/spec pairs through the pipeline (cypher-interp, symbolic-only). Its outputs are in `results/v1.4-u2/`.

## Tests

| Run | Before | After |
|---|---|---|
| Plan step 0.1 set (fitness-compiler, scoring-engine, ddd, hexagonal, semantic-rules, mcp-server, labelling, golden-parity) | 84 suites passed, 2 skipped; 1330 passed, 39 skipped | 84 suites passed, 2 skipped; 1330 passed, 39 skipped |
| `tests/unit/post-seal` (new, 8 files) | none | 8 suites; 114 passed |
| construct-switches, pipeline, cli, schemas, report, shared, spec-parser | not run | 70 suites; 828 passed |
| The other unit directories (advisory-filter to rule-mining) | not run | 103 suites; 1564 passed |
| `tests/unit/scripts`, apg-extractor, neo4j-ingestion | not run | 218 suites; all passed after the declared test changes below |
| `tests/integration` | not run | 3 passed, 1 skipped (Neo4j) |

- Every run used `jest --maxWorkers=2`. No Neo4j was started. The skipped suites are the Neo4j ones (`ddd-neo4j`, `v13-edge-views-neo4j` and the integration Neo4j suite). `tests/golden` needs Neo4j and was not run; it is v1.2e mode, and the fixture delta shows the golden 5 unchanged.
- During one run, three suites died with a SIGSEGV of a jest worker (machine memory pressure). They passed when re-run.
- `tsc --noEmit` is clean for `tsconfig.json` and `tsconfig.scripts.json`. `npm run lint:protocol` is OK. ESLint reports no error on the added lines, apart from the repository's existing jest-type resolution noise in test files.

**Existing tests changed as declared** (each is a forward consequence that the design names):
- `tests/unit/fitness-compiler/v13-fix-round.test.ts`: `V13_COMPILE_OPTIONS` now carries `postSealRules: true`. The applicability comparison uses the sealed options.
- `tests/unit/construct-switches/compile.test.ts`: the "status quo has no FF-S02 in ddd" assertion uses the sealed options.
- `tests/unit/pipeline/commands.test.ts` and `tests/unit/pipeline/assemble-report.test.ts`: the compile options and facts carry the post-seal flag. The clean-arch spec declares FF-P07 through the overlay.
- `tests/unit/spec-parser/v13-spec-validator.test.ts`: the `post-seal` catalogue.
- `tests/unit/scripts/v1.3/declared-to-aac.test.ts` and `human-rules-pilot.test.ts`: compile the translated rules with the sealed options.
- `tests/fixtures/mcp-interp-parity/default-golden.json`: re-captured with its own command (`npx tsx tests/unit/mcp-server/interp-parity-capture.ts`). Its only changes are additions: FF-P07 in `notChecked`, and the fast-path note.

## Fixture delta

`results/v1.4-u2/fixture-delta.md`:
- With post-seal off, every pair reproduces the pre-U2 baseline (`results/v1.4-u2/baseline.json`, written on the unchanged tree).
- With it on, exactly one row is added: ddd v09, an FF-S02 cycle over `PlaceOrder.ts`, `Customer.ts` and `CustomerRepository.ts`, tier blocking.
- No pair gains an FF-P07 row, and no tiered verdict changes.

## Registered figures (before and after)

| Check | Before | After |
|---|---|---|
| `node replication/v1.3/run.mjs --fast` | PASS 4366, FAIL 0 | PASS 4366, FAIL 0 |
| `node scripts/v1.3/claims-ledger-check.mjs` | 6139 rows, 0 failures | 6139 rows, 0 failures |

The outputs are `results/v1.4-u2/replication-{before,after}.json`. A first run after the change failed `e-ev-names` and `e-ev-res` (`Docs/v1.3/edge-views.md:71`). That was fixed by moving the FF-P07 view out of the 38-entry v1.3 edge-view table into `POST_SEAL_EDGE_VIEWS`.

## Caller table (BR-U2-10)

| File | Options | Choice |
|---|---|---|
| `src/cli/cli.ts` | V13_COMPILE_OPTIONS | forward (`--post-seal off` passes false) |
| `src/ise/propose.ts` | V13_COMPILE_OPTIONS | forward |
| `src/mcp-server/rule-meta.ts` | V13_COMPILE_OPTIONS | forward |
| `src/pipeline/commands/compile-command.ts` | V13_COMPILE_OPTIONS | forward (flag from config) |
| `src/rule-mining/propose.ts` | V13_COMPILE_OPTIONS | forward |
| `scripts/lib/loop/specs.ts` | V13_COMPILE_OPTIONS | forward (Study 2 harness) |
| `scripts/v1.3/lib/freeze-check.ts` | V13_COMPILE_OPTIONS | forward (hold-out freeze) |
| `scripts/v1.3/lib/study2-tunables.ts` | V13_COMPILE_OPTIONS | forward (tunables drift expected) |
| `scripts/v1.4/u2-fixture-delta.ts` | V13_COMPILE_OPTIONS | forward |
| `scripts/v1.3/apg2-live.ts` | V13_SEALED_COMPILE_OPTIONS | sealed |
| `scripts/v1.3/convergent-run.ts` | V13_SEALED_COMPILE_OPTIONS | sealed |
| `scripts/v1.3/cycle-collapse-sensitivity.ts` | V13_SEALED_COMPILE_OPTIONS | sealed |
| `scripts/v1.3/declared-rules-live.ts` | V13_SEALED_COMPILE_OPTIONS | sealed |
| `scripts/v1.3/scc-large-latency.ts` | V13_SEALED_COMPILE_OPTIONS | sealed |
| `scripts/v1.3/lib/construct-rescore.ts` | V13_SEALED_COMPILE_OPTIONS | sealed |

The pipeline-building v1.3 scripts that pass `postSealRules: false` are `rule-mutation.ts`, `fix-hints-eval.ts`, `fixes-mined-run.ts`, `refactor-pr-run.ts`, `html-report-fixtures.ts`, `memory-parity.ts`, `cypher-interp-bench.ts`, `scale/equivalence.ts` and `scale/profile.ts`.

## Deviations from the design

1. **Template helpers were copied, not exported.** `DEP_EDGE` and `FR12_DEP_COLUMNS` are copied with the same values into `post-seal-rules.ts`, so the frozen `cypher-templates.ts` stays byte-identical. The plan said to export them.
2. **The edge view sits in its own map.** It is in `POST_SEAL_EDGE_VIEWS`, not in `TEMPLATE_EDGE_VIEWS`, because adding it to the table moved two registered v1.3 counts. `edgeViewOf` and `applyEdgeView` read both maps.
3. **The MCP overlay sits in the spec loader.** It is in `createSpecLoader` (`src/mcp-server/tools.ts`), the single place the MCP server loads specs, not in `context.ts` or `spec-view.ts`. The loader takes `{ postSeal: false }` for the SDD demo replay, a recorded v1.3 session. `diff-check.ts` needed no change, because it carries the `file-check` notes.
4. **The pipeline config type is in a different file.** `PipelineConfig` lives in `src/pipeline/types.ts`, not in `src/shared/types/evaluation.ts`.
5. **`templateOf` needed no change.** FF-P07 rows have type `CUSTOM_application-purity`, which already maps to the template. The checker falls back to the post-seal default list when the spec does not declare FF-P07.
6. **More callers were pinned than the design listed.** BR-U2-10 named the importers of `V13_COMPILE_OPTIONS`. The nine v1.3 scripts that build the pipeline themselves, and the SDD demo replay, were also pinned to the sealed rule set, so that no registered figure moves on a re-run.
7. **The delta extracts each pair twice.** The script runs the full pipeline twice per pair (off, then on), one pair after another. The design asked to extract once and compile twice over one graph; two full runs are simpler and reproduce the pipeline exactly. The whole run takes about 15 seconds.
8. **The flag did not reach the report.** As merged in PR #255, `ue-score.ts` read `postSealRules` from each raw output, but no report could carry it: `report-builder.ts` did not copy the compile facts and the schema had no field. Fixed in the verification follow-up (ADR-V14-03, below). The live reference runner (`scripts/v1.3/lib/validate-reference-main.ts`, Neo4j only) saves raw rows, not reports, and still does not write the field, so its outputs score with the sealed scope until it does (TODO 1).
9. **CHECK-2 was not re-run.** No read-only export of `v1.3-judge-v22-prep` was made, so `--check2-repo` was not used for the K-tally.

## Verification follow-up (2026-10-18)

The AI-DLC read-only verification of U2 found these after PR #255 was merged. Fixed in the follow-up PR:

- **Report origin end to end (BR-U2-03.7, BR-U2-08).** `report-builder.ts` now writes `postSealRules: true` and `postSealAdded` from the compile facts when the post-seal rules were compiled, and the report schema has both as optional fields. A report with the rules off is unchanged. Test: `tests/unit/post-seal/ddd-cycle.test.ts` (v09 through the pipeline, on and off).
- **Frozen schema amendment declared.** ADR-V14-03 (`Docs/v1.4/adr-v14.md`) declares the three schema changes (`tierSource` `post-seal`, `postSealRules`, `postSealAdded`), each dated in the schema `$comment`.
- **BR-U2-10, CLI path.** Every script that runs `firewall evaluate` passes `--post-seal` explicitly: `off` everywhere except `scripts/v1.3/complementarity.ts` (`on`, the forward K-tally run). `scripts/run-experiment.ts` uses `--scoring v1.2e`, where the flag is not read.
- **BR-U2-10, unlisted pipeline callers.** `scripts/sdd/lib/full-eval.ts`, `scripts/v1.3/loop-fault-drills.ts`, `scripts/v1.3/ci-gate-synthetic.ts` and `scripts/v1.3/grid-scale-replay.ts` pass `postSealRules: false` (sealed).
- **Caller test widened.** `tests/unit/post-seal/compile-option-callers.test.ts` now also fails when a pipeline-building script does not set `postSealRules`, or a CLI-calling script does not pass `--post-seal`.
- **ADR-V14-02 effect table.** The header-only FF-P07 table is replaced by a sentence (no rows).

TODOs (not fixed here):

1. `scripts/v1.3/lib/validate-reference-main.ts` (live, Neo4j) does not write `postSealRules` into its raw outputs, so `ue-score.ts` scores them on the sealed scope.
2. The Study 2 tunables manifest (`scripts/v1.3/lib/study2-tunables.ts`) does not hash `POST_SEAL_EDGE_VIEWS`, `POST_SEAL_RULE_TIERS`, `POST_SEAL_RULES` or `Docs/v1.4/rule-tiers-post-seal.md` (`SEALED_DOCS` lists only the v1.3 docs). A later change to FF-P07 would not show as tunable drift. Adding them changes the verified manifest (`Docs/v1.3/study2-tunables.json`), so it needs the author's sign-off. The freeze-check already covers them.
3. Test gaps (design §6.1): the identity test compares `compile({})` with `compile({ postSealRules: false })`, not with pre-change output; the `loadReference` test checks only that FF-P07 and FF-S02 are absent, not equality with the pre-U2 scope; the I1 reference test does not assert the absence of `REPORT_COUNTS_INCONSISTENT`.
4. Test gap (design §6.2): the FF-P07 positives assert `ruleTier('FF-P07', style)`, not the tier and `tierSource` of the emitted report rows.
5. The dated deviation list in `ops/` lives on PR #252, not on main. ADR-V14-03 is to be added to it when #252 lands.

## Author defaults in force (Proposed in the ADRs)

- **Q-A:** a compile-time overlay; the presets are untouched.
- **Q-B:** the HTTP delivery-mechanism list.
- **Q-C:** FF-P07 blocking in clean-architecture, hexagonal, nestjs and ddd.
- **Q-D:** no fast re-statement; a note instead.
- **Q-E:** follow the hold-out prespec, lines 13 and 59.

## Hand-off (orchestrator and author)

- **K-tally recount.** 4 of 12 K0 seeds were re-run and are now symbolic-visible through FF-P07: the round-1 `antipattern-nest` seeds. Every FRAMEWORK-LEAKn twin stays at zero (`results/v1.4-u2/complementarity/`). The 8 E1 seeds are pending at U7, and the CHECK-2 seeds need the read-only export.
- **V4 count and power re-run.** Y now counts ddd FF-S02 cycle edges and FF-P07 edges, so the base-rate inputs move.
- **N17** (`Docs/v1.3/compendium/nulls-and-limits.md`) can be marked addressed by ADR-V14-01 once the author accepts it.
- **Q16.** The answer line for B belongs to ADR-V13-03 and to the author.
- **Q-E.** The hold-out scope decision, before the freeze.
- **ADR numbers.** Confirm ADR-V14-01 and ADR-V14-02 at merge, against U6.
- **Study 2 tunables.** `compiler/v13-compile-options` and the new `template/post-seal/*` entries drift by design.
