# U3 code summary: semantic facts (A2), N4 fragmentation, vendor-neutral route, a true K3 case


- Design: [`aidlc-docs/construction/v1.4/U3/functional-design/design.md`](../functional-design/design.md)
- Plan (every step ticked): [`aidlc-docs/construction/v1.4/U3/plan.md`](../plan.md)
- Zero model calls and no Neo4j: mock and estimate modes only, with the in-process Cypher interpreter. **The pilot was not run.**

### What changed
- **A2 facts** (`src/apg-enrich/ontology/facts.ts`). Every run writes `facts.json`, holding parser facts and model facts only, never findings. It is validated against I1 to I5. Ids are content hashes that leave out the cluster ids, and dates come from the cassettes, so a record and its replay are byte-identical.
- **Loader and Sem rules** (`facts-loader.ts`, `sem-rules.ts`). A1 + A2 go into a `MemoryGraphRepository` through the ingestion statements. SEM-MISPLACED, SEM-DUP and SEM-FRAG run as Cypher. `$policy` must equal the run's `producer.factPolicy`.
- **N4.** Fragmentation counts only inside one declared bounded context, and `minFragmentClasses` is 2. Concepts are also paired inside a declared context. Cross-context identity becomes a fact with no finding.
- **Prompt `ontology-v0.2`.** The rule pass now also returns input checks, each rule labelled `kind: business | input-validation`. Only business rules are clustered. The mock answers got `kind: business`, and `cassettes-mock/` was re-recorded with the scripted mock (0 model calls).
- **Vendor-neutral route** (`routes.ts`, `LlmOntologyProvider`). `--provider claude-cli|gemini-api|gemini-agy|mock`, and `--model` is required for the Gemini routes. Estimate and replay never open a route. The runner takes injected factories: `main(argv, deps)`. Mock-tested only.
- **Runner.** New flags: `--fact-policy`, `--ns02` (the 12 projects of `set.json`) and `--temperature`. `--runs 1` with `agreed-only` is refused (exit 2). New outputs: `facts.json`, `verdicts.json`, `fact-scores.json`, `verdict-scores.json`. The `--fixtures` output lines and the `scores.json` aggregate keys are unchanged.
- **Case set.** New pair `ns02/case-09-limit-only-in-controller` / `ns02/case-09t-control-length-check-in-controller` (cheap-blind), plus `ns02/set.json` and parent `ns02` sidecar blocks under `ns02/parent-blocks/`. The parent manifests are byte-unchanged and their hashes are checked by a test. Case-06 is retired, and stays on disk unchanged.
- **Docs.** `Docs/v1.3/ontology-v0-design.md` §13 is appended; lines 1 to 286 are unchanged. `g-onto-min-fragment` and `g-onto-found` get `known` entries. ADR placeholder `ADR-V13-N4`.

### Test results
- `npx jest --maxWorkers=2 tests/unit/apg-enrich tests/unit/scripts/ontology-run.test.ts`: **35 suites, 187 tests, all pass.**
  - Under machine memory pressure, a jest worker sometimes segfaulted on an unchanged `cheap/` suite, a different one each run. Each passed when rerun alone.
- `npx tsc --noEmit -p .` is clean. ESLint on the changed `src/` and `scripts/` files is clean.
  - On test files, every jest global is reported as `no-unsafe-call`, in unchanged suites too. Jest types do not resolve in the worktree.
- `node replication/v1.3/run.mjs --group g-onto-mock`: **PASS 31, KNOWN 2, FAIL 0, ERROR 0.** The two KNOWN rows are `(2)` (was `(3)`) and `2 of 3` (was `3 of 3`), both under N4.
- Mock record of the six parents: 110 calls. The replay makes 0 calls with 110 cache hits, accepts 128 assertions and rejects 4 of 4 hallucinations. Found 2 of 3: case-03 is out of N4 scope.
- `--fixtures --replay` writes the A2 and verdict files. Case-02 hits 2 of 2 required facts with 0 of 9 false facts, and SEM-MISPLACED is found. Case-04b has 0 of 6 false facts, and SEM-MISPLACED is clear.
- Pilot invariant: a mock record of case-02 + case-04b at runs = 2 and `--budget 20` makes 16 + 10 = **26 calls**. The `--estimate` upper bounds are 96 and 90 on both Gemini routes, and the cap is 40 per vendor.
- `--ns02 --estimate`: 12 projects, nothing called. Upper bounds at runs = 2: 106, 100, 96, 96, 92, 96, 96, 90, 96, 98, 94, 94.
- **Case-09 dry-run gate (BR-U3-16): passes.** Every cheap proxy gives identical output on the pair. The defect is `caught` and the twin `flagged` (the same cheap outcome), so no revision was needed.
  - Estimate at runs = 2: a = 8, b ≤ 6, c = 2, d ≤ 80, upper bound 96.
  - A mock record with empty answers makes 16 calls per case.

### Deviations from the design
1. `tests/fixtures/v1.3-ontology/ns02/` (case-05 to case-08t) was untracked in the main tree and missing on `origin/main`. It is copied in unchanged and committed here.
2. `OntologyRunDetail` gains `clusterItems`, `ranAt`, `runs` and `decimalScaleMaxPower`, and `AdjudicationRecord` gains `answers`. A2 needs these for cluster ids and adjudication provenance. `result.json` is unchanged.
3. SEM-FRAG also returns `ea.factId` and `eb.factId`, so a verdict can cite its facts.
4. Routes:
   - `checkRoute` is added, and `openRoute(spec, deps, { mode })`.
   - `gemini-agy` with `--temperature` is refused.
   - The `gemini-api` default temperature is `LABELLER_TEMPERATURE` (0), and its max tokens are `LABELLER_API_MAX_TOKENS`. No thinking level is set.
5. Scorer: pair predicates match in either orientation, and an expected SEM-DUP may state `verified`.
6. The runner also scores parent sidecar blocks under `--fixtures` and `--project`. `scores.json` gains top-level `factPolicy` and `notes`, and the aggregate keys are unchanged.
7. **This file was first the PR #254 description.** The generator's harness refused to write the summary file; the integrator copied the PR body here before merge.
8. The plan says the generator does no git operations. The orchestrator's task asked for the commit and this PR.

### Open author questions
- Claims-ledger row C0215 ("3 of 3") and the min-fragment default are superseded under N4. The ledger's own process needs to pick this up.
- Instrument map v3 §8 cuts the cross-family C1d arm, but NS-02 §4 gives 26 calls per vendor at runs = 2. Does the Gemini arm run, and at runs 1 or 2?
- Which Gemini route would the pilot use: `gemini-agy` or `gemini-api`?
- The `any` sensitivity row needs its own pass (b) and (d) calls.
- The orchestrator assigns the final id for `ADR-V13-N4`.

### Integration follow-up (before merge, 2026-10-18)
- `tests/fixtures/v1.3-byte-identity/v12e-hashes.json` pins the ten `ns02` fixture projects (computed on this branch and with main's `src/` in place: same values; no existing row changed).
- `facts.json` records the layer model path repo-relative (`repoRelative` in `scripts/v1.3/ontology-run.ts`, design §3.1), so an absolute `--layers` path is never written. Test in `tests/unit/scripts/ontology-run.test.ts`.
- New positive test for BR-U3-07/09 in `tests/unit/apg-enrich/ontology/pipeline.test.ts`: case-03 with one declared context around the three definers gives one `concept-fragmentation` finding; one context per component gives none.

### TODOs from the AI-DLC verification (not fixed here)
1. Amendment A1 (`aidlc-docs/construction/v1.4/U3/amendments/A1-graph-complements-reading.md`) is not applied: A2 facts citing a code or doc location and a graph statistic, prompts with code and graph context, mock tests for both. U3 is not done until it lands.
2. SEM-FRAG is never compared with the legacy pipeline's finding on a case that has one (the parity test covers SEM-MISPLACED and SEM-DUP only), and no mock answers exist for `ns02/case-05`, so nothing runs it end to end.
3. BR-U3-15 budget cap test: asserts only 'budget 20' in the estimate output, not the 40-per-vendor cap or the within-budget verdict, and only on `gemini-agy`.
4. BR-U3-16 gate test: compares only the `misplacedResponsibilities` cheap outcome, not every proxy (density, literals, clones, vocabulary).
5. Case-09's forbidden fact `enforcesRule(Order.create) kind business` is probably vacuous: if the single rule-candidate class is OrderController, Order is never asked, so the item always scores `clear`. Check the candidate or note it in the manifest.
6. ESLint on the changed test files is unverified (jest types do not resolve in the worktree).
