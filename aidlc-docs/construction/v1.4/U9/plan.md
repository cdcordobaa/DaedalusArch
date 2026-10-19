# U9 code-generation plan: semantic paths (BUILD-S; C1d semantic facts, C4 interpretation)

**Designs:** `ops/notes/c4-01-interpretation-design.md` (C4-01; on branch `v14/c4-mean02-design`, PR #275, not merged when this unit ran), `ops/notes/ns-02-facts-contract-and-cases.md` (NS-02), `ops/notes/trust-01-path-to-a-trusted-instrument.md` (TRUST-01, links L3, L7, L9), `ops/notes/rev-05-first-study-fable.md` (REV-05 §4 SO2 and SO3, §6 item 6). MEAN-02 was read for context; nothing here builds it.
**Map parts:** C1d (A2 facts, the A2 → graph loader), C4 (A5 interpretation), C6 (an opt-in MCP tool).
**Brownfield:** extends `src/apg-enrich/ontology/` and `src/mcp-server/`; edits named in each step.
This plan is the single source of truth for the unit's code generation. Mark each step `[x]` in the same interaction that completes it.

## Hard constraints for every step

- **Zero model calls.** Mock, estimate and replay only. No model API, no `claude` or `agy` CLI session, not even a pre-flight. Live routes are built only by the injected factories, which no test and no dry run reaches.
- No Neo4j: every C3 run and every Sem rule runs on `cypher-interp` / `MemoryGraphRepository`.
- Never read a `*sealed*` path except `Docs/v1.3/sealed-hashes.md`; never open `results/v1.3-meaning/mean-01-sample.*`.
- `npx jest --maxWorkers=2`; `npx tsc --noEmit -p .` clean; ESLint clean on the changed `src/` and `scripts/` files.
- The frozen labeller pin `AGY_PINNED_VERSION = '1.3.2'` and the frozen judge (`src/llm-critic/frozen.ts`, `judge-v22.ts`) are not changed.
- The new MCP tool is off by default and is not wired into any study plan, arm or tool list (`TOOL_NAMES`, `SPEC_TOOL_NAMES`, the Study 2 tunables are unchanged).
- Repo-relative paths in docs, comments and committed files; no billing figures.

## Steps

### Step 1 (S1): gemini-agy ontology route, exploratory versions (C4-01 §3 gap 2, §11 item 6)
- [x] Move `AGY_EXPLORATORY_VERSIONS = ['1.3.6', '1.4.2']` into `src/llm-critic/agy-cli-provider.ts` (frozen array, next to `AGY_PINNED_VERSION`); `scripts/v1.3/bf-01-run.ts` imports and re-exports that one constant (no copy).
- [x] `src/apg-enrich/ontology/routes.ts`: `OntologyRouteSpec.exploratory`; `agyExploratoryVersions(spec)` returns the shared constant only for an exploratory `gemini-agy` spec; `RouteDeps.agyCli` and the real factory pass it to `AgyCliProvider` (`exploratoryVersions`); `exploratory` on another route is refused (`ONTOLOGY_ROUTE_EXPLORATORY_AGY_ONLY`); the cache key (`describeRoute`) does not change with it.
- [x] `scripts/v1.3/ontology-run.ts`: `--exploratory`.
- [x] Tests in `tests/unit/apg-enrich/ontology/routes.test.ts`: the list and the 1.3.2 pin; the constant itself (identity) reaches the agy factory; no extra versions without the label; refused elsewhere; estimate and replay never reach the factory.

### Step 2 (S2): the C4 context builder takes every blocking finding (C4-01 §3 gap 1, §4.1, §11 item 1)
- [x] New `src/apg-enrich/ontology/c4-findings.ts`: `C4Finding` (rule, origin, sites, files, edge, context, facts, sem), `fromViolation` (refuses advisory rows), `fromSemVerdict`, `tierOf`, `blockingFindings(report, apg, semVerdicts)`, `c3VerdictOf` (copied, never computed).
- [x] `src/apg-enrich/ontology/interpretation.ts`: `buildInterpretationContext` accepts a `C4Finding` or a `SemVerdict`; symbolic findings get a window of the source file around the edge line and its comments; docs are searched for every class of the finding's files (the edge target too); an ADR excerpt below the head brings the ADR head (title, status) with it. Schema `c4-v0.2` (C4-01 §4.2) replaces `c4-facts-v0.1`; `INTERPRETATION_SYSTEM`; the prompt asks for explanation, intent match, a doc-cited exception claim, a severity class inside the blocking tier, and cites.
- [x] `src/apg-enrich/ontology/pipeline.ts`: `unitsOf(input)`, the units with no provider and no call. `reading.ts`: `docsSection` takes a hint (C4 cites doc lines; C1d keeps "cite code").
- [x] The model-call pass id widens to `CallPass = PassId | 'interpret'` (`types.ts`, `provider.ts`, `cache.ts`); the C1d scripted responder never answers an `interpret` call.
- [x] Contract tests `tests/unit/apg-enrich/ontology/c4-contract.test.ts` (schema has no verdict key and closes every object; symbolic and SEM findings; advisory refused) and `c4-cases.test.ts` (every target of the seeded set is a blocking finding on `cypher-interp`; every finding gets code, the C3 verdict copied and a prompt; the planted docs, ADR status lines and comments reach each target's prompt). The existing A1 test (`reading.test.ts`) now expects the ADR head before the excerpt.
- [x] The byte-identical test (C4-01 §4.4): `tests/unit/apg-enrich/ontology/c4-invariance.test.ts` runs C3 twice with a fresh in-process evaluator, before and after the runner writes A5 into the project; the reports are byte-identical except the run id and timings.

### Step 3 (S3): the C4 runner, baseline and seeded case scaffold (C4-01 §4 to §7, §9, §11 items 2 to 5, 7, 8)
- [x] New `src/apg-enrich/ontology/c4-contract.ts`: `groundC4Answer` (rules 2 to 4: doc or comment citation only, lines exist, quote occurs, a failure turns the claim off and counts a hallucinated exception, never repaired; unresolved cites dropped; the contradicts-plus-claim inconsistency flag), `mergeRuns` (rule 6: agreed / single-run / disagreed), A5 types, `proposedExceptions` (agreed claims only, status `proposed`), `keywordBaseline` (§6.2, zero calls).
- [x] New `src/apg-enrich/ontology/c4-runner.ts`: `interpretFindings` through the ontology `ModelCaller` (cache key, cassettes, budget, one schema retry, stop codes; pass `interpret`), `estimateInterpretation` (expected = findings × runs, upper bound × 2, cached, prompt tokens), `a5File`, `c4MockResponder` (a scripted stand-in that answers what the keyword baseline says; NOT model output).
- [x] New `src/apg-enrich/ontology/c4-scorer.ts`: `C4CaseManifest`, `scoreC4Case` (correct in every run; twin clean; baseline scored the same way), `aggregateC4`.
- [x] New `scripts/v1.4/c4-run.ts`: `--cases [--pilot|--only]` or `--project --spec [--facts --layers]`; routes `mock` (default), `claude-cli`, `gemini-agy` (`--model`, `--exploratory`), `gemini-api`; `--estimate`, `--replay`, `--runs`, `--budget` (whole-run cap, default 80), `--cassettes`, `--out`. Writes `interpretations.json`, `proposed-exceptions.json`, `baseline.json`, `score.json`, `scores.json`. Live routes open only in record mode, after the route check.
- [x] Fixtures `tests/fixtures/v1.4-c4/`: six cases and six twins per C4-01 §6 (pair 6's twin is the unchanged NS-02 `case-02`), each with `expected-c4.json`; `set.json` with the manifest hashes, the pilot pairs and the non-author rows X1 to X3 marked `to-be-filled`; `README.md` with authorship (all twelve author/Claude-written by this session, not signed, not independent of C4) and the fixed X3 brief.
- [x] Tests: `c4-contract.test.ts` (grounding, merge, proposals, baseline), `c4-cases.test.ts` (hashes, authorship flags, baseline right on cases 1 to 4 and clean on twins 1, 2 and 5, false on near-miss twins 3 and 4 by design; mock record then replay with 0 calls and the same A5; replay with no cassette calls nothing; the estimate).

### Step 4 (S4): A2 loader smoke (REV-05 §4 SO2; TRUST-01 L3)
- [x] `tests/unit/apg-enrich/ontology/a2-graph-smoke.test.ts`: `facts.json` written by the ontology runner (mock replay of the committed cassettes; NS-02 case-05 by a scripted mock record) is read back from disk, loaded into the in-process graph, and read by SEM-MISPLACED, SEM-DUP and SEM-FRAG through their Cypher text. Every model fact that maps to a Sem edge is an edge with its `factId`; every verdict cites model facts of the file; removing the model facts, or changing the one value the rule compares, removes the verdict.

### Step 5 (S5): opt-in read-only semantic MCP tool (TRUST-01 L9; exploratory in-loop cell, not wired)
- [x] New `src/mcp-server/semantic-facts.ts`: `semantic_facts` returns the recorded A2 facts and Sem findings, re-checked against the current code (stale facts and the findings citing them left out unless `includeStale`); filters `file`, `policy`; statuses `not-configured`, `unavailable`, `ok`; findings are `blocking: false`.
- [x] Confinement: the A2 directory is fixed at start (`--semantic-facts <dir>` or `DAEDALUS_SEMANTIC_FACTS`); no argument names a path to open; reads go through `ProjectView` (lexical and realpath confinement); no write, no process, no network, no model.
- [x] Wiring: `ServerContext.semanticFacts`, `McpArgs.semanticFacts`, `SEMANTIC_TOOL_NAMES`, `toolNamesFor`; registered last with read-only annotations (`openWorldHint: false`). `TOOL_NAMES` and `SPEC_TOOL_NAMES` are unchanged.
- [x] Tests `tests/unit/mcp-server/semantic-facts.test.ts`: off by default; flag and env; annotations; facts and SEM-MISPLACED for the current snapshot; filters; staleness; an escaping citation and a symlink out of the root are never read; the trees are unchanged after a call and the module imports no process, network or write API.

### Step 6: checks, docs, audit, PR
- [x] `npx tsc --noEmit -p .` and `-p tsconfig.scripts.json`: clean.
- [x] ESLint on the changed `src/` and `scripts/` files: clean. (`scripts/v1.3/bf-01-run.ts` is outside the ESLint project, as on `main`; its change is one import line.)
- [x] Full `npx jest --maxWorkers=2` (results in `code/summary.md`).
- [x] `code/summary.md`; one appended `aidlc-docs/audit.md` entry; PR "BUILD-S: semantic paths (U9)" to `main`, not merged.
