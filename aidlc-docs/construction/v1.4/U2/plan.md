# U2 code-generation plan: declared post-seal norm rules (D5, N3)

**Design:** `aidlc-docs/construction/v1.4/U2/functional-design/design.md`. **Depth:** minimal. **Workspace:** brownfield; the application code is at the repository root and nothing goes under `aidlc-docs/`.

**Hard limits** (from the brief):
- Never read `daedalus-sealed/`, `.env` or any credential or config directory.
- No model or external API call.
- Never start Neo4j. Use the in-process interpreter only.
- Run jest as `npx jest --maxWorkers=2 <paths>`.
- Do not edit `ops/`, `aidlc-docs/audit.md` or `aidlc-docs/aidlc-state.md`.
- Do not edit `presets/*.yaml`, `Docs/v1.3/rule-tiers.md`, any `expected-findings.json` or `reference.json`, or the mutation operators.
- No git operations in this stage.
- Docs use repo-relative paths only, and give no billing figures.

**Author defaults used until the PR review** (design §8): Q-A overlay; Q-B HTTP delivery list; Q-C FF-P07 blocking in clean-architecture, hexagonal, nestjs and ddd; Q-D no fast re-statement; Q-E follow the hold-out prespec (lines 13 and 59), with the sealed-scope figures reported next to the main ones. Each one is a single data value or flag, and both ADRs mark it "Proposed".

---

## Step 0. Baseline (before any edit)
- [ ] 0.1 Run `npx jest --maxWorkers=2 tests/unit/fitness-compiler tests/unit/scoring-engine tests/unit/ddd tests/unit/hexagonal tests/unit/semantic-rules tests/unit/mcp-server tests/unit/scripts/v1.3/labelling tests/unit/cypher-interp/golden-parity.test.ts`. Record the pass and fail counts, and any failures that come from the environment (N173), in the code summary. Skip, and note, any test that needs Neo4j.
- [ ] 0.2 Write `scripts/v1.4/u2-fixture-delta.ts` (step 8 spec) first, and run it **before** the change with `--write-baseline results/v1.4-u2/baseline.json`. The baseline must come from the unchanged tree. It also stores the five presets' compile output under today's `V13_COMPILE_OPTIONS`, which test 9.1 compares with `V13_SEALED_COMPILE_OPTIONS`.
- [ ] 0.3 Registered-figure baseline (BR-U2-10), offline, one command at a time: `node replication/v1.3/run.mjs --fast --json results/v1.4-u2/replication-before.json` and `node scripts/v1.3/claims-ledger-check.mjs`. Record the PASS, FAIL and KNOWN counts. The runner strips credentials and never runs needs-Neo4j or needs-LLM groups. Do not run it in parallel with jest.

## Step 1. Post-seal rule table and template
- [ ] 1.1 Create `src/fitness-compiler/post-seal-rules.ts`:
  - `PostSealRule`;
  - `POST_SEAL_RULES` with two entries: FF-S02 `no-cyclic-deps`, ddd, D5, ADR-V14-01; and FF-P07 `application-purity`, clean-architecture/hexagonal/nestjs/ddd, N3, ADR-V14-02, default `forbiddenImports`;
  - `POST_SEAL_TEMPLATES` holding the `application-purity` `CypherTemplate` exactly as in design BR-U2-05: required params, `requiredLayerKinds: ['application']`, tag `pattern-proxy`, `applicableStyles`, and a result mapping like `domain-purity` (`DEP_EDGE`, `FR12_DEP_COLUMNS(['target'])`; export those helpers from `cypher-templates.ts` if they are not exported, without changing their values);
  - `applyPostSealRules(input: CompilerInput): CompilerInput`, which returns the same object when nothing applies. It adds nothing when the spec already declares the rule id **or** the template name under another id, and then it returns a warning (design BR-U2-03.6);
  - the template text without the dead `src.layer IS NULL` branch (design BR-U2-05);
  - `withPostSealRules(spec: ParsedSpec): ParsedSpec`, the same semantics on a parsed spec.
- [ ] 1.2 Check that the template text parses and type-checks with `parseCypher`, using the interpreter's `typecheck` (step 9.6 asserts this).

## Step 2. Compiler wiring
- [ ] 2.1 `src/fitness-compiler/fitness-compiler.ts`:
  - add `postSealRules?: boolean` to `CompileOptions`, and `postSealRules: true` to `V13_COMPILE_OPTIONS`;
  - add `V13_SEALED_COMPILE_OPTIONS`, today's value with `postSealRules: false`, and export it from `index.ts`;
  - in `compileFunctions`, apply `applyPostSealRules` **before** `applyConstructCompileOverlays`, only when the flag is set;
  - in `compileFunctionsCore`, merge `POST_SEAL_TEMPLATES` into the catalogue when the flag is set.
- [ ] 2.2 `buildParams`: add the candidates `compositionRootLayers` (from `compositionRootLayers(layerModel)` in `apg2-in-memory.ts`), `compositionRootPatterns` (`APG2_COMPOSITION_ROOT_NAME_PATTERNS`) and `testPatterns` (`APG2_TEST_PATTERNS`, `src/shared/apg2-scope.ts`). No existing template declares these names, so no existing query changes. Step 9.1 verifies this.
- [ ] 2.3 `src/fitness-compiler/bound-param-checker.ts`: `checkBoundParameters(input, templates = CYPHER_TEMPLATES)`. The core compiler passes its active catalogue.
- [ ] 2.4 `src/fitness-compiler/edge-views.ts`: add `['application-purity', { view: 'resolved', reason: 'usage rule by symbol, as domain-purity' }]`.
- [ ] 2.5 `src/fitness-compiler/extension-templates.ts`: add `['post-seal', POST_SEAL_TEMPLATES]` to `V13_EXTENSION_TEMPLATE_CATALOGUES`, and `POST_SEAL_TEMPLATES` to the `getExtensionTemplate` fallback.
- [ ] 2.6 `src/fitness-compiler/index.ts`: export the new module's public names.

## Step 3. Mode gate in the pipeline
- [ ] 3.1 `src/pipeline/commands/compile-command.ts`: a constructor argument `postSealRules: boolean` (default `true`, the v1.3 scoring the switch file implies). `execute` builds options as `{ ...v13, postSealRules: this.postSealRules, ... }`.
  - **The declared side** (`overlaid`, BR-U3-52) becomes `applyConstructCompileOverlays(postSeal ? applyPostSealRules(input) : input, answers)`, so identity I1 holds (design BR-U2-03.7).
  - `compileFactsOf` records `postSealRules` and `postSealAdded`.
- [ ] 3.2 `src/pipeline/pipeline-factory.ts`: pass `config.postSealRules ?? config.scoringMode === 'v1.3'`, next to `constructAnswers` (R30). Add `postSealRules?: boolean` to the pipeline config type.
- [ ] 3.3 `src/cli/cli.ts`: `--post-seal on|off` (default `on` under `--scoring v1.3`, ignored under `v1.2e`), passed into the pipeline config and into the `rules === 'v1.3'` compile at `cli.ts:677`.
- [ ] 3.4 Confirm that `FitnessCompilerStage` (no options) and the CLI's `rules === 'v1.2e'` path stay as they are.
- [ ] 3.5 **Caller table** (design BR-U2-10): list every importer of `V13_COMPILE_OPTIONS` (`grep -rln V13_COMPILE_OPTIONS src scripts tests`). For each one, record "forward, keeps the post-seal rules" or "regenerates a registered figure, switch to `V13_SEALED_COMPILE_OPTIONS`", with a reason. Apply the switches. Put the table in ADR-V14-02 ("Callers") and in the code summary.

## Step 4. Tiers
- [ ] 4.1 `src/scoring-engine/rule-tiers.ts`:
  - `POST_SEAL_RULE_TIERS`, with FF-P07 `byStyle` per the Q-C default, `adr: 'ADR-V14-02'` and a construct reason;
  - `POST_SEAL_TIERS_DOC = 'Docs/v1.4/rule-tiers-post-seal.md'`;
  - `ruleTier` falls back to it and returns `source: 'post-seal'`;
  - `RULE_TIERS`, `DDD_RULE_TIERS` and `HEXAGONAL_RULE_TIERS` are not edited.
- [ ] 4.2 Widen `ResolvedTier['source']` and every `tierSource` type to `'table' | 'untiered-default' | 'post-seal'`, in:
  - `src/shared/types/evaluation.ts`;
  - `src/mcp-server/types.ts` (two fields);
  - `src/scoring-engine/report-schema.ts` (both enums);
  - `src/mcp-server/rule-meta.ts` (pass-through).
  - `TieredScoring.tierTable` names both tier records when post-seal rules are on.
- [ ] 4.3 `src/construct-switches/tiers.ts`: no change. `constructRuleTier` inherits the fallback through `ruleTier`. Step 9.5 pins this.

## Step 5. Rule metadata, checker and reference scope
- [ ] 5.1 `src/mcp-server/rule-meta.ts`:
  - `CONSTRUCTS['application-purity'] = 'Delivery mechanism is a detail: no HTTP framework in the application layer'`;
  - `OTHER_SOURCES['application-purity']` (Martin 2017 ch. 21 "The Web is a delivery mechanism" and ch. 22; Cockburn 2005).
- [ ] 5.2 `scripts/v1.3/lib/labelling/correctness.ts`:
  - an `applicationPurity` checker: the `domainPurity` logic with the layer test replaced by "an application-kind layer that is not a composition root, and a file that is not a test";
  - an `'application-purity': 'resolved'` view entry;
  - `CHECKERS['application-purity']`;
  - the `templateOf` mapping of FF-P07's report rows to `application-purity`;
  - `BLOCKING_COVERAGE` rows for FF-P07 in every style where it is blocking, and `{ style: 'ddd', ruleId: 'FF-S02', template: 'no-cyclic-deps', coverage: 'full' }`.
- [ ] 5.3 `scripts/v1.3/lib/reference-model.ts`: an option `{ postSeal?: boolean }` on `loadReference` and `loadAllReferences`, default `false`. Only when it is true, append the post-seal rules for the style to `scopeRules` after the descriptor is built, on both the hand-written and the ddd overlay paths (`tierRow`, `blockingCandidate` from `ruleTier`). Scorers pass it from the outputs' compile facts (`postSealRules`), and they fail on a mix. Re-scoring saved pre-U2 outputs must give the committed scores unchanged. Leave every file under `tests/fixtures/v1.3-reference/` untouched.
- [ ] 5.4 `scripts/v1.3/lib/freeze-check.ts`: add `Docs/v1.4/rule-tiers-post-seal.md` and `Docs/v1.4/adr-v14.md` to `MANIFEST_FILES`.

## Step 6. MCP spec load
- [ ] 6.1 `src/mcp-server/context.ts` and `spec-view.ts`: apply `withPostSealRules` to the loaded spec.
- [ ] 6.2 `src/mcp-server/file-check.ts` and `diff-check.ts`: on the fast path, when the spec holds FF-P07 and the file is in an application layer, add the note "FF-P07 application-purity is checked by the compiled Cypher only (`--fast-rules-engine cypher-interp`, `evaluate_project`)". Do not add a TypeScript re-statement (Q-D default).

## Step 7. Documents
- [ ] 7.1 Create `Docs/v1.4/rule-tiers-post-seal.md`: date, status "post-seal, declared", the principle (sealed table unchanged; each row names its ADR), and one table: rule, template, styles, tier, construct reason, ADR. The rows are FF-S02 in ddd (blocking, "membership only; tier from the sealed FF-S02 row") and FF-P07 per style.
- [ ] 7.2 Create `Docs/v1.4/adr-v14.md` with:
  - **ADR-V14-01** "DDD rule set gains FF-S02 (acyclic dependencies), post-seal (D5)": the context (N17; the blind key's not-scored row; Q16); the check that FF-S02 was not in the DDD list; the decision (membership only, the template and sealed tier unchanged, Q16 settled as B); the effect (the exact delta table from step 8, the reference re-score in both directions, Study 2 Y); the dependency on Q3; what is not changed.
  - **ADR-V14-02** "Application purity FF-P07, post-seal (N3, Q26)": the context (NS-01 §4a, the 12 K0 seeds, G1 and why it is not promoted); the decision (template, styles, list, exclusions); the tier and its construct reason (Proposed, Q-C); the limits (`@nestjs/common` HTTP types, built-ins, composition-root names, the fast path, the advisory G1 duplicate); "written with sight of development effects" (the trigger seeds and the `ap-hosts` count, design §2.2 and R2); the circularity of the seed hits (R12); the effect (the exact delta table, the replication and claims-ledger changes, Study 2 Y, the hold-out consequence under Q-E, and the K-tally as "4 of 12 re-run, 8 E1 seeds pending at U7"); the "Callers" table (step 3.5); what is not changed (the operator's `expectedTemplates`, G1, the presets, FF-P01).
  - Number the ADRs by the next free `ADR-V14-nn` at write time, and keep `POST_SEAL_RULES.adr` equal to it.
- [ ] 7.3 Validate both documents against `.aidlc-rule-details/common/content-validation.md`: no diagrams; the tables render; the code blocks are fenced; the paths are repo-relative.

## Step 8. Fixture delta, listed exactly
- [ ] 8.1 `scripts/v1.4/u2-fixture-delta.ts` (`npx tsx`). For each pair in a fixed, committed list:
  - `tests/golden` (5);
  - `tests/fixtures/v1.3-reference/<style>/{project|clean}` and every variant (overlays materialised as `validate-reference.ts` does);
  - `tests/fixtures/hexagonal`;
  - `fixtures/unit/antipattern-nest`;
  - `fixtures/unit/ap-hosts`;
  - the MCP parity capture (`tests/unit/mcp-server/interp-parity-capture.ts`, default and cypher-interp engines).

  Run the pipeline with `graphEngine: 'cypher-interp'`, `evaluationMode: 'symbolic-only'` and the scoring mode the fixture's own test uses. Extract each fixture once and compile it twice over the same in-memory graph. Run the pairs one after another and release each graph before the next. Diff the normalised findings (rule, file, target, tier) and the MCP outputs against `results/v1.4-u2/baseline.json`. Write `results/v1.4-u2/fixture-delta.json` and `fixture-delta.md`. The run makes no model call and no Neo4j connection.
- [ ] 8.2 Run it after steps 1–6. Copy the delta table **verbatim** into the effect sections of ADR-V14-01 and ADR-V14-02. If a row is unexpected, stop: record it in the ADR as found, and do not tune the rule (Q16 caveat).
- [ ] 8.3 If the MCP default golden (`tests/fixtures/mcp-interp-parity/default-golden.json`) changes, update it only for the rows the delta lists, list it in the ADR, and say in the code summary that it was re-captured.
- [ ] 8.4 K-tally symbolic re-run (design test 3b): `npx tsx scripts/v1.3/complementarity.ts prepare --work <scratch>`, then `npx tsx scripts/v1.3/complementarity.ts --work <scratch> --out results/v1.4-u2/complementarity`. The script is unchanged. There is no `--e1` directory, so the E1 rows stay as recorded. Add `--check2-repo` only with a read-only `git archive` export of `v1.3-judge-v22-prep` in the scratch directory: no checkout, and never the v1.3 or v1.2e branches. Never write to `results/v1.3-complementarity/`. Report the FRAMEWORK-LEAK rows before and after, by `symbolicSource`.
- [ ] 8.5 Registered figures after (BR-U2-10): re-run step 0.3 into `results/v1.4-u2/replication-after.json`. For every number that went from PASS to FAIL, either pin its caller to `V13_SEALED_COMPILE_OPTIONS` (step 3.5) and re-run, or list it in the ADR effect table. Re-run `node scripts/v1.3/claims-ledger-check.mjs`.

## Step 9. Tests (`tests/unit/post-seal/`)
- [ ] 9.1 `post-seal-rules.test.ts`:
  - without the option, the compile output for all five presets and `specs/clean-arch.yaml` deep-equals the output of the frozen path. Assert no FF-P07 and no extra FF-S02.
  - with the option, the per-style membership is as in design §6.1;
  - a spec-declared FF-P07 that is disabled, or that has its own list, is kept as declared;
  - an unstyled spec gets nothing;
  - Q16 B plus the overlay gives one FF-S02;
  - every pre-existing query's `cypher` and `params` is unchanged;
  - `V13_SEALED_COMPILE_OPTIONS` reproduces the step 0.2 compile baseline for all five presets;
  - `application-purity` declared under another id gives no FF-P07, plus the warning;
  - identity I1: a v1.3 pipeline run (cypher-interp, symbolic-only, post-seal on) on each reference spec has no `REPORT_COUNTS_INCONSISTENT`, and `postSealAdded` lists the overlay ids;
  - `loadReference` without `postSeal` gives today's `scopeRules` for all five styles.
- [ ] 9.2 `application-purity.test.ts`, with the semantic harness. The positives and twins per style are those of design §6.2: express as a value import, express as a type import, a fastify re-export; then the DTO twin, the composition roots (`src/main.ts`, `src/config/**`, `*.module.ts`), an application test file, `@nestjs/common` `Injectable`, express in presentation or an adapter, and express in the domain (FF-P01 or FF-DT04 only). Layered: not compiled. Each positive has tier and source per the post-seal table.
- [ ] 9.3 `ddd-cycle.test.ts`, with the semantic harness: the three-file cycle gives one blocking `table` row; the acyclic twin gives 0; and the public-API path case. Then the extracted `tests/fixtures/v1.3-reference/ddd` v09 overlay through the pipeline (cypher-interp, v1.3 scoring) holds the FF-S02 row over `PlaceOrder.ts`, `CustomerRepository.ts` and `Customer.ts`.
- [ ] 9.4 `framework-leak-seeds.test.ts`: apply the unchanged `AP-FRAMEWORK-LEAK` and `AP-FRAMEWORK-LEAKn` operators to temporary copies of `fixtures/unit/antipattern-nest` (nestjs) and `fixtures/unit/ap-hosts/translation-jobs` (hexagonal). Do not use the clean reference project: nothing there imports or maps `express`, so the operator's precondition rejects every site. Require at least one applied seed per host. Run the pipeline (cypher-interp, symbolic-only, v1.3). The seeded file has an FF-P07 row and the twin has none. Clean up the temporary directories. Timeout 120 s.
- [ ] 9.5 `post-seal-tiers.test.ts`:
  - `Docs/v1.4/rule-tiers-post-seal.md` parses and equals `POST_SEAL_RULE_TIERS` and `POST_SEAL_RULES` (the rule, styles, tier and ADR);
  - `ruleTier('FF-P07', s)` holds for each style; `ruleTier('FF-S02', 'ddd')` is blocking, source `table`;
  - `constructRuleTier` at the status quo agrees;
  - the sha256 of `Docs/v1.3/rule-tiers.md` equals its row in `Docs/v1.3/sealed-hashes.md`.
- [ ] 9.6 `application-purity-cypher.test.ts`: the interpreter parses and type-checks the template, and the predicate is a top-level conjunction (BR-U1-44). Each composition-root and test pattern gives the same match result under `new RegExp` and under the interpreter's `javaRegex` on the design §6.8 sample paths.
- [ ] 9.9 `compile-option-callers.test.ts`: the set of files importing `V13_COMPILE_OPTIONS` or `V13_SEALED_COMPILE_OPTIONS` equals the ADR-V14-02 "Callers" table.
- [ ] 9.7 `fixture-delta.test.ts`: re-run the delta in-process for the light subset (the reference ddd and clean, the golden 5), and require it to equal `results/v1.4-u2/fixture-delta.json`. Parse the ADR effect tables and require them to equal the committed delta file.
- [ ] 9.8 Update the existing tests only where the delta or a new coverage row requires it (the correctness coverage test, the report-schema enum test if present, the MCP default golden). List every touched test file in the code summary and in the ADR.

## Step 10. Verify
- [ ] 10.1 `npx tsc --noEmit -p tsconfig.json` (and the scripts tsconfig if separate). Run the lint the repo uses for `src/` and `scripts/`.
- [ ] 10.2 `npx jest --maxWorkers=2 tests/unit/post-seal` and the step 0.1 set. The pass count must be at least the baseline plus the new tests. Any new failure is either fixed or declared.
- [ ] 10.3 `npm run lint:protocol` (`scripts/v1.3/protocol-consistency-check.mjs`) still passes. No protocol document changed.
- [ ] 10.4 Confirm that no file under `ops/`, `presets/`, `daedalus-sealed/`, `tests/fixtures/v1.3-reference/**/expected-*.json`, `results/v1.3-*/` or `Docs/v1.3/rule-tiers.md` changed.
- [ ] 10.5 Confirm that the step 8.5 replication has no unexplained PASS-to-FAIL row, and that `node scripts/v1.3/claims-ledger-check.mjs` passes.

## Step 11. Code summary
- [ ] 11.1 Write `aidlc-docs/construction/v1.4/U2/code/summary.md` (markdown only). It holds: the files created and modified; the test counts before and after; the fixture delta (a link to `results/v1.4-u2/fixture-delta.md`); the ADR ids used; the author defaults in force (Q-A to Q-D); the skipped Neo4j tests; and the hand-off. The hand-off covers the K-tally recount of the 12 seeds, the V4 count and power re-run inputs, the N17 status in `Docs/v1.3/compendium/nulls-and-limits.md`, the Q16 answer line, Q-E (hold-out scope), the 8 E1 seeds still to re-run, and the replication and claims-ledger before-and-after counts, all for the orchestrator or author. It also holds the caller table (step 3.5).
