# U3 Code Generation Plan: semantic facts (A2), N4 fragmentation, vendor-neutral route, a true K3 case

**AI-DLC v1.4, construction, unit U3, code generation, part 1 (planning). Depth: minimal. Written 2026-10-18.**

- **Design:** `aidlc-docs/construction/v1.4/U3/functional-design/design.md`. Business-rule ids BR-U3-xx refer to it.
- **Requirements:** `ops/03-build-list.md` row C1d; `ops/notes/ns-02-facts-contract-and-cases.md` §1, §2, §3 and §6; decisions N1, M4, N4 and CDX.
- **Workspace:** brownfield TypeScript (ESM), existing structure. Code goes in `src/`, `scripts/` and `tests/`, never in `aidlc-docs/`.

**Hard limits for every step:**
- no model or network call;
- no Neo4j, only the in-process interpreter;
- `jest --maxWorkers=2`;
- don't read `daedalus-sealed/`, `.env` or any credential directory;
- don't edit `ops/`, `aidlc-docs/audit.md` or `aidlc-docs/aidlc-state.md`;
- no git operations by the generator; the orchestrator commits;
- **the pilot is not run;**
- every record-mode command passes `--cassettes <scratchpad>/…` and `--out <scratchpad>/…`. The runner's default cassette directory is the committed `tests/fixtures/v1.3-ontology/cassettes-<provider>/`, and only step 4 replaces it, on purpose;
- `Docs/v1.3/ontology-v0-design.md` is **append-only** (design BR-U3-17).

**Unit context:**
- **Depends on:** nothing from other v1.4 units.
- **Shares nothing it edits** with U2 (rules), U4 (drift) or U5 (generator Gemini adapter). U3 does not edit `src/llm-critic/`. Its one shared-harness edit is the two `known` entries in `replication/v1.3/groups/g-ontology.mjs`, a file no other unit owns.
- **Contracts produced:** A2 `facts.json` and `verdicts.json` (design §3).
- **Story traceability:** none (user stories skipped). Each step lists the design deliverable (D1–D9) and the business rules it implements.

Run the tests with `npx jest --maxWorkers=2 tests/unit/apg-enrich/ontology tests/unit/scripts/ontology-run.test.ts`.

---

## Step 1: Declared context in the units (D3; BR-U3-10)
- [x] `src/apg-enrich/cheap/context.ts`: add an exported pure `declaredContextOf(file, layerModel): string | null`. It uses the same prefix test as `componentOf`, and `componentOf` calls it, so its behaviour is unchanged.
- [x] `src/apg-enrich/ontology/units.ts`: add `ClassUnit.declaredContext: string | null`, filled from `declaredContextOf`.
- [x] Test (`tests/unit/apg-enrich/ontology/passes.test.ts` or a new `units.test.ts`): with `ns02/case-05-fragmentation-in-context/layers.json`, every class has `declaredContext = 'sales'`. With the parent `layers.json`, every class has null, and the components stay unchanged.

## Step 2: N4 in clustering and in the pipeline (D3; BR-U3-07, -08, -09)
- [x] `src/apg-enrich/ontology/clustering.ts`: add `ClusterItem.context?: string | null`. In `candidatePairs`, a concept pair whose components are equal is allowed only when both have the same non-null `context`. Rules and capabilities are unchanged. Update the header comment.
- [x] `src/apg-enrich/ontology/pipeline.ts`:
  - set `context: s.cls.declaredContext` on concept items;
  - fragmentation: group the definers by `declaredContext`, and emit one `concept-fragmentation` finding per declared context with at least `minFragmentClasses` distinct names. Definers with a null context never count;
  - `DEFAULT_ONTOLOGY_OPTIONS.minFragmentClasses` becomes 2;
  - rules: only `kind: business` rule sites become rule cluster items (BR-U3-18). `input-validation` sites stay in `ruleSites`.
- [x] `tests/unit/apg-enrich/ontology/clustering.test.ts`: add the cases for a declared same-context pair, an undeclared same-component pair (not proposed) and a cross-component pair (still proposed). The existing "never within a component" rule assertion stays.

## Step 3: `enforcesRule.kind` and the prompt bump (D4; BR-U3-11)
- [x] `src/apg-enrich/ontology/types.ts`: add `RuleOut.kind: 'business' | 'input-validation'` and export a `RULE_KINDS` const.
- [x] `src/apg-enrich/ontology/prompts.ts`: add `kind` (enum, required) to `RULE_SCHEMA`. Rewrite `rulePrompt`'s task sentence (BR-U3-11): today it excludes technical checks, so `input-validation` could never be returned. Ask for business rules *and* limits or thresholds checked on incoming data, each with its kind; keep null checks and parsing excluded; add the neutral two-kind definition (no case-derived example, no case identifier). Set `PROMPT_VERSION = 'ontology-v0.2'`.
- [x] Test: a scripted `input-validation` rule is a rule site but enters no rule cluster and no `semantic-rule-duplication` finding.
- [x] `tests/fixtures/v1.3-ontology/mock-answers/*.json`: add `"kind"` to every scripted rule. Every current scripted rule is a business rule, so use `"business"`. Check each one by reading it, not by bulk replace.
- [x] `src/apg-enrich/ontology/scripted-provider.ts`: no change is expected. Confirm that it passes `kind` through.

## Step 4: Provenance plumbing for A2 (D1 prerequisites)
- [x] `src/apg-enrich/ontology/passes.ts`: add `Kept.runIndex`, the primary run's index.
- [x] `src/apg-enrich/ontology/caller.ts`: record `recordedAt` per `(promptHash, runIndex)`, from a cache hit's entry or from the new entry, and expose it with `recordedDates(): ReadonlyMap<string, string>`. `CallStats` and `OntologyResult` stay unchanged.
- [x] `src/apg-enrich/ontology/pipeline.ts`: `OntologyRunDetail` gains `units: OntologyUnits` and `recordedAt: ReadonlyMap<string, string>`. Export `projectHash`.
- [x] `pipeline.ts`: `OntologyRunDetail.factPolicy` (`agreed-only` when `requireAgreement`, else `any`).
- [x] Re-record the mock cassettes. This is zero model calls: the scripted responder is a function. Run `npx tsx scripts/v1.3/ontology-run.ts --fixtures --provider mock --cassettes <scratchpad>/cas-mock --out <scratchpad>/mock-rec`. Then replace `tests/fixtures/v1.3-ontology/cassettes-mock/` with `<scratchpad>/cas-mock/` (delete the old directory first, so no `ontology-v0.1` entry stays behind), and confirm `--fixtures --provider mock --replay --out <scratchpad>/rep` gives 0 provider calls. Keep `now` fixed at `2026-10-15T00:00:00.000Z`, as the runner does today. The record must still make 110 calls and the replay must still report 128 accepted assertions (`g-onto-mock`). Record the new cache-hit total for the design doc's §13 (step 13).

## Step 5: A2 writer (D1; BR-U3-01 to -05; invariants I1 to I5)
- [x] New `src/apg-enrich/ontology/facts.ts`. It contains:
  - `FACT_PREDICATES`, `Fact`, `FactsFile` and `factId()`;
  - `buildFacts(detail, input, { layerModelPath, now })`, which follows the per-predicate mapping of design §3.2: parser facts from `units`; model facts from `classSemantics`, `ruleSites`, `groupSemantics` and the cluster adjudications; `ruleEquivalenceVerified` through `verifyRuleDuplication`;
  - `validateFacts(file, apg)`, which throws `A2InvariantError` and lists every violation.
- [x] Adjudication facts take as evidence the grounded evidence of the two items compared. Exact-name and exact-statement merges are `source: parser`, `basis: apg`.
- [x] `factId` hashes the value without `conceptId` / `ruleId` / `capabilityId`. `ruleId` is null for `input-validation` rules.
- [x] `date`: model facts from the primary run's `recordedAt`; parser facts from the earliest `recordedAt` of the run (else `now()`), so record and replay give the same bytes.
- [x] `ruleEquivalenceVerified`: one fact per pair `m1 < m2` of members of a business-rule cluster whose classes are in different contexts, from `verifyRuleDuplication([m1, m2], …)`. Not limited to adjudicated pairs.
- [x] `producer.factPolicy` from `detail.factPolicy`.
- [x] Export the new names from `src/apg-enrich/ontology/index.ts`.
- [x] New `tests/unit/apg-enrich/ontology/facts.test.ts`. It covers:
  - one negative test per invariant;
  - stable ids, and byte-identical output on a rebuild;
  - a vocabulary guard (no verdict-shaped predicate);
  - no finding fields in A2;
  - the case-02 golden fact (design §7).

## Step 6: A2 loader and the Sem rules (D2; BR-U3-06, -07)
- [x] First, check the edge names. In a throwaway test, ingest `case-01-rule-dup-shapes` into `MemoryGraphRepository` with `annotateNodes`/`ingestNodes`/`ingestEdges`, and list the edge types between Class and Method nodes. If it isn't `CONTAINS`, use the real name in the queries and record it in the design doc.
- [x] New `src/apg-enrich/ontology/facts-loader.ts`: `loadFacts(apg, layerModel, facts, repo)`, as in design §3.4. It works on a copy of the Class nodes, with `layerKind`, `context` and `contextDeclared`. Sem nodes and edges go in through `nodeIngestCypher` / `edgeIngestCypher`, with scalar properties only.
- [x] The loader writes `SemRULE_VERIFIED` once per pair (lower id → higher id), and creates `SemBusinessRule` / `SemENFORCES` only for `kind: business`.
- [x] New `src/apg-enrich/ontology/sem-rules.ts`: the three Cypher constants of design §3.4 and `runSemRules(repo, facts, policy): Promise<DomainResult<SemVerdict[]>>`. It fails when `policy !== facts.producer.factPolicy`. SEM-MISPLACED sites are Class ids. SEM-DUP groups by `rule` (sites = union, `verified` = every row verified), and SEM-FRAG groups by `(context, concept)`.
- [x] Before freezing the queries, assert that each one parses with `parseCypher`. Fix any unsupported construct in the query text. Do not edit `src/cypher-interp/`.
- [x] New `tests/unit/apg-enrich/ontology/facts-loader.test.ts` and `sem-rules.test.ts`, covering:
  - parity with the pipeline findings on the six parent mock replays (SEM-MISPLACED at the owning class; SEM-DUP site for site with `verified`);
  - case-03 has no SEM-FRAG row;
  - synthetic in-context, cross-context and mixed-cluster SEM-FRAG;
  - `$policy` on a single-run fact, and the policy-mismatch refusal;
  - the ablation: A1 with an empty A2 gives zero verdicts;
  - an `input-validation` rule at two contexts gives no SEM-DUP row.

  Prepare each parent case once per file (`beforeAll`) and use a fresh `MemoryGraphRepository` per case.

## Step 7: Vendor-neutral route and the Gemini adapter (D5; BR-U3-12, -13, -14)
- [x] `src/apg-enrich/ontology/provider.ts`: add `LlmOntologyProvider(inner: LLMProvider, { route, model, maxTokens, temperature? })` and `toVendorSchema(route, schema)`, with JSON parsing, the served-model check and error pass-through as in design §3.5.
- [x] New `src/apg-enrich/ontology/routes.ts`: `ONTOLOGY_ROUTES`, `OntologyRouteSpec`, `describeRoute` (pure) and `openRoute(spec, deps)`. `deps` holds injected factories:
  - `claudeCli()`, which builds `ClaudeCliProvider` + `ClaudeCliOntologyProvider` as the runner does today;
  - `geminiApi(cfg)` → `GeminiProvider`;
  - `agyCli(cfg)` → `AgyCliProvider` plus its `prepare()` pre-flight.

  The factories are the only place where `process.env.GEMINI_API_KEY` or the agy home is read. Export them as `DEFAULT_ROUTE_DEPS`. The runner's `main(argv, deps = DEFAULT_ROUTE_DEPS)` takes them as a parameter, so its tests pass fakes. No `dotenv` import anywhere in U3's code.
- [x] Temperature for `gemini-api`: take it from `--temperature`, and when absent, from the P4 labeller constant if one exists (find it by searching `src/llm-critic/` and `scripts/v1.3/` for the ADR-035 settings). If none exists, require the flag. Record what was used in `describe().temperature`.
- [x] New `tests/unit/apg-enrich/ontology/llm-provider.test.ts` and `routes.test.ts`, using a fake `LLMProvider` and spied factories only. Cover every case listed in design §7. No `GeminiProvider` or `AgyCliProvider` instance is ever asked to evaluate.

## Step 8: Fact scorer and verdict scorer (D7)
- [x] New `src/apg-enrich/ontology/fact-scorer.ts`:
  - `Ns02Block`, the type of the manifests' `ns02` block;
  - `resolveSubject(name, apg)`, where `Class` or `Class.method` resolves to an id, and an ambiguous or missing name is an error;
  - `scoreFacts(ns02, facts, apg, policy)`, which matches values as a subset on the keys the manifest lists. It gives `hit` / `missed` for required facts, `false-fact` / `clear` for forbidden ones, and `observed` for tolerated ones;
  - `scoreVerdicts(ns02, verdicts, apg)`, where no row means `pass`. For SEM-MISPLACED a `Class.method` site resolves to its owning class before matching.
- [x] Extend `ExpectedSemanticManifest` in `scorer.ts` with an optional `ns02?: Ns02Block`. The legacy scoring is unchanged.
- [x] New `tests/unit/apg-enrich/ontology/fact-scorer.test.ts`.

## Step 9: The replacement K3 pair, gated on a zero-call dry run (D8; BR-U3-16)
- [x] Create `tests/fixtures/v1.3-ontology/ns02/case-09-limit-only-in-controller/` and `.../case-09t-control-length-check-in-controller/`. Each holds `src/ordering/{presentation,application,domain,infrastructure}/…`, `tsconfig.json`, and `layers.json` (copied from case-06, with `ddd.contexts = [{ name: 'ordering', root: 'src/ordering' }]`). The files are as in design §5: byte-identical except the controller's guard line, its constant and its error text. `giftNote` reaches `PlaceOrderService.place` and `Order.create` in both. No explanatory comments.
- [x] Dry run with zero model calls, writing to the scratchpad:
  - `--project <case> --layers <case>/layers.json --estimate --runs 2` for both cases;
  - then `--provider mock` with an empty scripted script, `--cassettes <scratchpad>/cas-09 --out <scratchpad>/out-09`. Without `--cassettes`, record mode would write into the committed `cassettes-mock/`.
  - Read the cheap-proxy outcome on every item, from every proxy (role, logic density, literals, clones with guard units, vocabulary). **Gate (BR-U3-16):** the defect's expected item and the twin's matching forbidden item must have the same cheap outcome (`caught` with `flagged`, or `missed` with `clear`). If they don't, change the case, record the change in a `revisions[]` list, and repeat.
- [x] Write both `expected-semantic.json` files as in design §5, with `writtenAt: 2026-10-18`, `writtenBefore`, and `cheapExpectation` taken from the dry run (both outcomes). The required `enforcesRule` value is `{kind: business, threshold: 20}` with no operator, and the forbidden subject is `Order.create`. Record the estimate's call counts in the manifest's `ns02.calls` field.
- [x] Parent `ns02` blocks (design §5.1, D10): `tests/fixtures/v1.3-ontology/ns02/parent-blocks/<case>.json` for `case-01`, `case-02`, `case-04a` and `case-04b`, written from each parent manifest's `expect`/`forbid` items and NS-02 §3, dated `2026-10-18`, before any model run. Do **not** edit the parent manifests.
- [x] New `tests/fixtures/v1.3-ontology/ns02/set.json`. It lists the six pairs (pair 2 = case-09 / case-09t) with relative paths, and `retired: [{ pair: 'case-06 / case-06t', reason: 'cheap role proxy separates the pair (NS-01 §7 falsifier 1)', retiredOn: '2026-10-18' }]`. Pairs 4 and 5 point to the parent directory, to their `parent-blocks/` file, and to the sha256 of each parent manifest (a test checks that the manifests are unchanged).
- [x] `tests/fixtures/v1.3-ontology/ns02/README.md`: replace pair 2's row and add the retirement line. Case-06 and case-06t stay untouched on disk.

## Step 10: Runner wiring (D6, D9; BR-U3-06, -12, -15)
- [x] `scripts/v1.3/ontology-run.ts`:
  - `--provider claude-cli|gemini-api|gemini-agy|mock` through `routes.ts`;
  - `--model`, required for the Gemini routes;
  - `--temperature`;
  - `--fact-policy agreed-only|any` (default `agreed-only`), which maps to `requireAgreement`;
  - refuse `--runs 1` with `agreed-only` in record and replay modes: exit 2, with a message naming the trap. `--estimate --runs 1` still prints;
  - `main(argv, deps = DEFAULT_ROUTE_DEPS)`;
  - `--ns02`, which runs the 12 projects of `set.json`, each with its own `layers.json` (the parent `layers.json` for the parent cases), and one output subdirectory per project;
  - after each run: `buildFacts` → `validateFacts` → `facts.json`; `loadFacts` into a fresh `MemoryGraphRepository` → `runSemRules` → `verdicts.json`; and, when the manifest has `ns02`, `fact-scores.json` and `verdict-scores.json`;
  - estimate and replay use `NoCallProvider` with `describeRoute(spec)`, and no factory is called;
  - case-03 gets the N4 note on its **own** line after its per-case line (BR-U3-09). The `--fixtures` per-case and estimate lines keep their exact current format, `--fixtures` still runs the six parent cases only, and `scores.json` keeps its aggregate keys (BR-U3-17; `replication/v1.3/groups/g-ontology.mjs` parses them);
  - update the usage header.
- [x] `tests/unit/scripts/ontology-run.test.ts`: add the cases listed in design §7, with fake route factories and temporary `--cassettes`/`--out` directories in every case, including the **pilot invariant**: a mock record of case-02 + case-04b at runs = 2 makes exactly 26 provider calls, and the `--estimate` totals stay as recorded in NS-02 §4. Add the output-format assertion against the two replication regexes.

## Step 11: Update the existing regression tests (BR-U3-09)
- [x] `tests/unit/apg-enrich/ontology/pipeline.test.ts`:
  - the aggregate becomes `expected 3, found 2`;
  - case-03: no `concept-fragmentation` finding, and the concept cluster or `sameConceptAs` adjudications are still present;
  - the hallucination and agreement assertions are re-checked after the re-record. They should be unchanged, because the bump affects only the cache keys.
- [x] `tests/unit/apg-enrich/ontology/provider.test.ts`: add the `LlmOntologyProvider` smoke test, if `llm-provider.test.ts` doesn't cover it.

## Step 12: Full verification (no live call)
- [x] `npx tsc --noEmit -p .` is clean.
- [x] The repository's lint script passes on the changed files.
- [x] `npx jest --maxWorkers=2 tests/unit/apg-enrich tests/unit/scripts/ontology-run.test.ts` is green.
- [x] `npx tsx scripts/v1.3/ontology-run.ts --fixtures --provider mock --replay --out <scratchpad>/r`: 0 provider calls, and the A2/verdict files are written.
- [x] `npx tsx scripts/v1.3/ontology-run.ts --ns02 --estimate`: 12 projects, the counts are printed, and nothing is called.
- [x] The pilot estimate for case-02 and case-04b at `--runs 2 --budget 20`, with each Gemini route and `--estimate`: 26 calls on the mock profile, the cap is 40, and nothing is called. **Do not run the pilot.**
- [x] `node replication/v1.3/run.mjs --group g-onto-mock` (offline; the mock provider only, records into its own scratch). Every number is PASS, except `g-onto-min-fragment` and `g-onto-found`, which are KNOWN (step 13). Any other FAIL blocks the hand-back.
- [x] `git status` shows no change under `tests/fixtures/v1.3-ontology/case-*/` and no change to lines 1–279 of `Docs/v1.3/ontology-v0-design.md` (`git diff -U0` hunks start after line 279).
- [x] `grep` the diff for absolute personal paths, `GEMINI_API_KEY` values and billing figures. There must be none.

## Step 13: Documentation
- [x] `Docs/v1.3/ontology-v0-design.md`, **append-only** (BR-U3-17). The claims ledger (C0212–C0220) and `g-onto-mock` cite §1–§11 by line, so those lines are not edited. Add a new §13 "Ontology v0.2 (v1.4 U3)" after §12, holding:
  - A2 and the loader;
  - N4 pairing and the fragmentation rule;
  - the prompt version `ontology-v0.2`, the new rule-pass scope and `kind`;
  - the new mock baseline (2 of 3 parent defects; case-03 is out of N4 scope) and the cache-hit count, with a note that §9 keeps the v0.1 figures;
  - which §12 items are now done (§12 itself is left as is).
- [x] `replication/v1.3/groups/g-ontology.mjs`: add `known: { actual, note }` to `g-onto-min-fragment` (`(2)`) and `g-onto-found` (`2 of 3`), each note citing decision N4 and `ADR-V13-N4`, as `d-audit.mjs` does. Change nothing else in the group.
- [x] `Docs/v1.3/adr-v13.md`: one entry, placeholder id `ADR-V13-N4` (the orchestrator assigns the number at merge). It records:
  - fragmentation inside one declared bounded context;
  - the A2 facts contract v1, with the two changes to NS-02 (cluster ids; `inContext` as an object);
  - `PROMPT_VERSION` 0.2;
  - the retirement of case-06.
- [x] Code summary: `aidlc-docs/construction/v1.4/U3/code/summary.md`. It lists the files changed and created, the test counts, and the dry-run figures (calls only; repo-relative paths). *Done as the PR description: the generator's harness refused to write the summary file, so the orchestrator can copy it from the PR body.*

## Step 14: Hand back
- [x] Mark every checkbox above as it completes.
- [x] Report to the orchestrator: the files changed, the test results, the case-09 dry-run gate outcome, the new estimate counts, the `g-onto-mock` table, and the open author questions:
  - claims-ledger row C0215 ("3 of 3") and the min-fragment default are superseded under N4; the ledger is regenerated by its own process, not by U3;
  - the instrument map v3 §8 cuts the cross-family C1d arm and gives the pilot as 10–20 calls, while NS-02 §4 gives 26 per vendor at runs = 2: does the Gemini arm run, and at runs 1 or 2;
  - which Gemini route the pilot would use (`gemini-agy` or `gemini-api`);
  - the `any` sensitivity row needs its own pass (b)/(d) calls. The orchestrator logs these in `aidlc-docs/audit.md` and opens the PR, which is not merged. **The author's review of the PR is the code-approval gate.**

---

## Not in this plan
- Any live model run, including the 2-case pilot and the six-case run.
- Neo4j parity of the Sem rules.
- Q26 (U2) and the generator-side Gemini adapter (U5).
- Regenerating the claims ledger (the orchestrator hands C0215 and the min-fragment row to its process).

## Changelog
- 2026-10-18: first version.
- 2026-10-18: adversarial review. Scratch cassettes for every record step, and a clean replace of `cassettes-mock/`. Rule-prompt scope and business-only clustering (step 3). `factPolicy`, fact-id, date and verifier-pair rules (steps 4–5). Class-level SEM-MISPLACED, per-pair `verified`, the policy-mismatch refusal and the ablation (step 6). Injected route factories (steps 7 and 10). Parent `ns02` sidecar blocks (step 9). Runner output kept parseable by `g-onto-mock` (step 10). The `g-onto-mock` run and the doc-line check (step 12). Append-only design doc and `known` replication entries (step 13). Author questions in the hand-back (step 14).
